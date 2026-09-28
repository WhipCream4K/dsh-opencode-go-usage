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
import { Context, Service } from '@deepseek-ai/cordis';
import type { MaskedConfigView, OcgoUsageView } from './types.ts';
export type { NormalizedUsage, OcgoUsageView, UsageWindow, UsageWindowKind, UsageStatus } from './types.ts';
/** Plugin configuration. */
export interface OcgoUsageConfig {
    /** Master switch for the plugin (host routes + browser readout). */
    enabled?: boolean;
    /**
     * Credential reference resolved per refresh through `ctx.credentials`.
     * Defaults to `OPENCODE_GO_API_KEY`.
     */
    apiKeyEnv?: string;
}
/** After a failed fetch, skip further provider queries for this long. */
export declare const FAILURE_COOLDOWN_MS = 60000;
declare module '@deepseek-ai/cordis' {
    interface Context {
        ocgoUsage: OcgoUsageService;
    }
}
/**
 * Cached OpenCode Go usage read. `view()` answers from a fresh cache,
 * otherwise queries the provider (deduped when concurrent). A failed query
 * enters a short cooldown so a broken config is not hammered by the poller.
 */
export declare class OcgoUsageService extends Service {
    private readonly enabled;
    private readonly credentialRefName;
    private cached;
    private cachedAt;
    private failureUntilMs;
    private lastError;
    private inflight;
    constructor(ctx: Context, config?: OcgoUsageConfig);
    /** Whether the service answers queries while enabled. */
    isEnabled(): boolean;
    /** Cache TTL from the live config (seconds → ms). */
    private ttlMs;
    /** The credential seam, when this profile provides one. */
    private credentials;
    /**
     * Resolve the API key for one refresh. The credential seam is asked first
     * because that is where DSH keeps provider keys (`~/.dsh/.credentials.yaml`,
     * plus the process environment); the config loader is the fallback so the
     * plugin also works from a bare `OPENCODE_GO_API_KEY` export or from
     * `<DSH_HOME>/ocgo-usage.json`.
     */
    private resolveApiKey;
    /**
     * The config-editor view. The seam's `describe` half reports presence without
     * the value, which is the only way a key living in the DSH credential store
     * can read as configured — that store has no tail to display.
     */
    configView(): Promise<MaskedConfigView>;
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
    setApiKey(value: string | null): Promise<void>;
    /** RPC: most recent usage view. Returns the cached view when it is still
     * fresh, otherwise re-queries the provider (deduped when concurrent). */
    view(): Promise<OcgoUsageView>;
    /** RPC: force a fresh provider query (bypasses the cache window). */
    refresh(): Promise<OcgoUsageView>;
    /**
     * Drop the cached usage, the failure cooldown, and the last error so the
     * next read re-queries with the freshly written config. Called after a
     * config edit.
     */
    invalidateCache(): void;
    private query;
}
//# sourceMappingURL=service.d.ts.map