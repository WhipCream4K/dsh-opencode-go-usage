/**
 * dsh-ocgo-usage host service — the cached OpenCode Go usage read.
 *
 * Resolves the API key on every refresh — first through the credential seam
 * (`ctx.credentials`, which layers the process environment over
 * `~/.dsh/.credentials.yaml`), then through the local config loader (env var,
 * then `$DSH_HOME/ocgo-usage.json`) — so a rotated key reaches the next query
 * without a plugin restart. The result is cached so the browser readout can
 * poll without spamming opencode.ai.
 * @module dsh-ocgo-usage/service
 */
import { Service } from '@deepseek-ai/cordis';
import { fetchUsage, UsageError } from "./api.js";
import { CREDENTIAL_REF, loadConfig, maskSecret, writeConfigFile } from "./config.js";
import { credentialRef, describeCredential, resolveCredential, } from "./credentials.js";
/** After a failed fetch, skip further provider queries for this long. */
export const FAILURE_COOLDOWN_MS = 60_000;
/** Map a UsageError (or any error) to a browser-safe view. */
function errorView(error) {
    if (error instanceof UsageError) {
        return { error: error.code, message: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { error: 'fetch', message };
}
/**
 * Cached OpenCode Go usage read. `view()` answers from a fresh cache,
 * otherwise queries the provider (deduped when concurrent). A failed query
 * enters a short cooldown so a broken config is not hammered by the poller.
 */
export class OcgoUsageService extends Service {
    enabled;
    credentialRefName;
    cached;
    cachedAt = 0;
    failureUntilMs = 0;
    lastError;
    inflight;
    constructor(ctx, config = {}) {
        super(ctx, 'ocgoUsage');
        this.enabled = config.enabled ?? true;
        this.credentialRefName = config.apiKeyEnv ?? CREDENTIAL_REF;
    }
    /** Whether the service answers queries while enabled. */
    isEnabled() {
        return this.enabled;
    }
    /** Cache TTL from the live config (seconds → ms). */
    ttlMs() {
        return loadConfig().cacheTTL * 1000;
    }
    /** The credential seam, when this profile provides one. */
    credentials() {
        return this.ctx.get('credentials');
    }
    /**
     * Resolve the API key for one refresh. The credential seam is asked first
     * because that is where DSH keeps provider keys (`~/.dsh/.credentials.yaml`,
     * plus the process environment); the config loader is the fallback so the
     * plugin also works from a bare `OPENCODE_GO_API_KEY` export or from
     * `<DSH_HOME>/ocgo-usage.json`.
     */
    async resolveApiKey(cfg) {
        const fromSeam = await resolveCredential(this.credentials(), this.credentialRefName);
        if (fromSeam !== undefined)
            return fromSeam;
        const direct = cfg.apiKey?.trim();
        return direct !== undefined && direct.length > 0 ? direct : undefined;
    }
    /**
     * The config-editor view. The seam's `describe` half reports presence without
     * the value, which is the only way a key living in the DSH credential store
     * can read as configured — that store has no tail to display.
     */
    async configView() {
        const local = maskSecret(loadConfig().apiKey);
        if (local.set)
            return { apiKey: local };
        const credentials = this.credentials();
        if (credentials?.describe !== undefined) {
            try {
                const info = await credentials.describe(credentialRef(this.credentialRefName));
                if (info.configured) {
                    return {
                        apiKey: { set: true, tail: '' },
                        ...(info.source === undefined ? {} : { source: info.source }),
                    };
                }
            }
            catch {
                // Fall through to the local view.
            }
        }
        return { apiKey: local };
    }
    /**
     * Store a new API key, or clear it with `null`.
     *
     * The credential seam is the write target of record because it is the store
     * the `opencode-go` model provider itself reads. Writing only to this
     * plugin's own config file would leave a seam value shadowing the new key, so
     * the panel would look like it saved while the old key kept being used.
     *
     * @throws UsageError with code `readonly` when a read-only source supplies
     * the reference and therefore shadows anything this plugin could store.
     */
    async setApiKey(value) {
        const credentials = this.credentials();
        const ref = credentialRef(this.credentialRefName);
        if (credentials !== undefined && value !== null) {
            const info = await describeCredential(credentials, ref);
            if (info?.configured === true && info.writable === false) {
                throw new UsageError(`${this.credentialRefName} is supplied by a read-only source (${info.source ?? 'unknown'}) `
                    + 'that would shadow anything stored here; change it at that source instead.', 'readonly');
            }
        }
        if (value !== null && credentials?.set !== undefined) {
            try {
                await credentials.set(ref, value);
                this.invalidateCache();
                return;
            }
            catch {
                // Fall through to the file — but only when nothing shadows it, so a
                // refused seam write can never masquerade as a saved key.
                const still = await resolveCredential(credentials, this.credentialRefName);
                if (still !== undefined) {
                    throw new UsageError(`The DSH credential store refused the write for ${this.credentialRefName}, and its current `
                        + 'value would shadow a local copy; the key was left unchanged.', 'readonly');
                }
            }
        }
        if (value === null && credentials?.unset !== undefined) {
            try {
                await credentials.unset(ref);
            }
            catch {
                // Ignore; the config file is cleared below regardless.
            }
        }
        writeConfigFile({ apiKey: value });
        this.invalidateCache();
    }
    /** RPC: most recent usage view. Returns the cached view when it is still
     * fresh, otherwise re-queries the provider (deduped when concurrent). */
    async view() {
        if (!this.enabled)
            return { error: 'disabled', message: 'The ocgo-usage plugin is disabled.' };
        const now = Date.now();
        if (this.cached !== undefined && now - this.cachedAt < this.ttlMs()) {
            return toView(this.cached);
        }
        // Failure cooldown: keep serving the last known error without a fetch.
        if (now < this.failureUntilMs) {
            return this.lastError ?? { error: 'fetch', message: 'Unknown failure' };
        }
        if (this.inflight !== undefined)
            return this.inflight;
        this.inflight = this.query().then((view) => {
            if (view.error === undefined) {
                // Success: remember the normalized payload for the cooldown window.
                this.lastError = undefined;
            }
            else {
                this.lastError = view;
                this.failureUntilMs = Date.now() + FAILURE_COOLDOWN_MS;
            }
            return view;
        }).finally(() => {
            this.inflight = undefined;
        });
        return this.inflight;
    }
    /** RPC: force a fresh provider query (bypasses the cache window). */
    async refresh() {
        if (!this.enabled)
            return { error: 'disabled', message: 'The ocgo-usage plugin is disabled.' };
        const view = await this.query();
        if (view.error === undefined) {
            this.lastError = undefined;
            this.failureUntilMs = 0;
        }
        else {
            this.lastError = view;
            this.failureUntilMs = Date.now() + FAILURE_COOLDOWN_MS;
        }
        return view;
    }
    /**
     * Drop the cached usage, the failure cooldown, and the last error so the
     * next read re-queries with the freshly written config. Called after a
     * config edit.
     */
    invalidateCache() {
        this.cached = undefined;
        this.cachedAt = 0;
        this.failureUntilMs = 0;
        this.lastError = undefined;
    }
    async query() {
        try {
            const cfg = loadConfig();
            const apiKey = await this.resolveApiKey(cfg);
            if (apiKey === undefined) {
                throw new UsageError(`Missing OpenCode Go API key: set ${this.credentialRefName} (e.g. in $DSH_HOME/.credentials.yaml), `
                    + 'export it in the environment, or store it in $DSH_HOME/ocgo-usage.json', 'noconfig');
            }
            const data = await fetchUsage({ ...cfg, apiKey });
            this.cached = data;
            this.cachedAt = Date.now();
            return toView(data);
        }
        catch (error) {
            return errorView(error);
        }
    }
}
/** Convert the internal normalized shape into the browser view. */
function toView(data) {
    return {
        updatedAt: data.updatedAt,
        ...(data.rolling === undefined ? {} : { rolling: data.rolling }),
        ...(data.weekly === undefined ? {} : { weekly: data.weekly }),
        ...(data.monthly === undefined ? {} : { monthly: data.monthly }),
    };
}
