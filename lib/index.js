import { a as USAGE_PATH, c as maskSecret, d as writeConfigFile, i as ENV_API_KEY, l as normalizeApiKey, o as configFilePath, s as loadConfig, t as CREDENTIAL_REF, u as usageEndpoint } from "./config-DHrQkJTL.js";
import { Service } from "@deepseek-ai/cordis";
//#region src/routes.ts
/** Browser-facing base path of the usage API. */
const OCGO_API_PREFIX = "/api/ocgo-usage";
/** Write one JSON response. */
function json(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
/** Require the method or answer 405. */
function requireMethod(req, res, method) {
	if (req.method === method) return true;
	json(res, 405, {
		ok: false,
		error: "method-not-allowed"
	});
	return false;
}
/** Read a bounded JSON request body. */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > 65536) {
				reject(/* @__PURE__ */ new Error("body-too-large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			const raw = Buffer.concat(chunks).toString("utf8");
			if (raw.length === 0) {
				resolve({});
				return;
			}
			try {
				resolve(JSON.parse(raw));
			} catch {
				reject(/* @__PURE__ */ new Error("bad-json"));
			}
		});
		req.on("error", reject);
	});
}
/** Wrap one async usage read as a GET JSON route. */
function getRoute(path, run) {
	return {
		kind: "exact",
		path,
		handler: (req, res) => {
			if (!requireMethod(req, res, "GET")) return;
			Promise.resolve(run()).then((value) => json(res, 200, value), (error) => {
				json(res, 500, {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}
	};
}
/**
* The config editor routes: GET the masked view, POST a new key to write.
* The write goes through the service so it lands in the credential seam (the
* store the `opencode-go` model provider reads) rather than in a shadowed
* local file, and the usage cache is invalidated so the next poll re-queries
* with the fresh key immediately.
*/
function makeConfigRoutes(service) {
	const read = () => service.configView();
	const write = async (req) => {
		const body = await readJsonBody(req);
		if ("apiKey" in body) {
			const raw = typeof body.apiKey === "string" ? body.apiKey : "";
			await service.setApiKey(normalizeApiKey(raw) ?? null);
		}
		return service.configView();
	};
	return [{
		kind: "exact",
		path: `${OCGO_API_PREFIX}/config`,
		handler: (req, res) => {
			if (req.method === "GET") {
				Promise.resolve(read()).then((value) => json(res, 200, value), (error) => {
					json(res, 500, {
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					});
				});
				return;
			}
			if (req.method === "POST") {
				Promise.resolve(write(req)).then((value) => json(res, 200, value), (error) => {
					json(res, 400, {
						ok: false,
						error: error instanceof Error ? error.message : String(error)
					});
				});
				return;
			}
			json(res, 405, {
				ok: false,
				error: "method-not-allowed"
			});
		}
	}];
}
/** Build the full usage API route family for one service. */
function makeOcgoRoutes(service) {
	return [
		getRoute(OCGO_API_PREFIX, () => service.view()),
		getRoute(`${OCGO_API_PREFIX}/refresh`, () => service.refresh()),
		...makeConfigRoutes(service)
	];
}
//#endregion
//#region src/api.ts
/**
* OpenCode Go quota API client for dsh-ocgo-usage.
*
* The official quota endpoint is
* `GET <baseUrl>/zen/go/v1/usage`, authenticated with the regular OpenCode Go
* API key (`Authorization: Bearer <key>`) — the same key the `opencode-go`
* model provider uses. No workspace id and no web-session cookie are involved,
* so there is no SSR scraping and no locale-specific label parsing: the
* response is JSON and identical for every UI language.
*
* The response shape is:
*
* ```json
* {
*   "usage": {
*     "rolling": { "status": "ok", "percent": 4, "resetsAt": "2026-09-28T20:28:02.440Z" },
*     "weekly":  { "status": "ok", "percent": 3, "resetsAt": "2026-10-05T00:00:00.000Z" },
*     "monthly": { "status": "ok", "percent": 1, "resetsAt": "2026-10-21T07:41:16.000Z" }
*   }
* }
* ```
*
* Unknown fields are tolerated (the API may grow), but a body without any
* recognizable window is rejected loudly so a silently-broken monitor never
* masquerades as a healthy one.
* @module dsh-ocgo-usage/api
*/
/** Error thrown by the HTTP / parsing layer; carries a short code for the UI. */
var UsageError = class extends Error {
	code;
	name = "UsageError";
	constructor(message, code) {
		super(message);
		this.code = code;
	}
};
/** Fetch the quota endpoint and decode its JSON body. */
async function safeFetchJson(url, apiKey, timeoutMs) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	let res;
	try {
		res = await fetch(url, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				Accept: "application/json"
			},
			signal: controller.signal
		});
	} catch (e) {
		if (e instanceof Error && e.name === "AbortError") throw new UsageError(`Request timed out after ${timeoutMs}ms`, "timeout");
		throw new UsageError(String(e instanceof Error ? e.message : e), "fetch");
	} finally {
		clearTimeout(timer);
	}
	if (res.status === 401 || res.status === 403) throw new UsageError(`OpenCode Go rejected the API key (HTTP ${res.status})`, "apikey");
	if (!res.ok) throw new UsageError(`HTTP ${res.status} for ${sanitizeUrl(url)}`, `http${res.status}`);
	try {
		return await res.json();
	} catch {
		throw new UsageError("OpenCode Go returned a body that is not JSON", "parse");
	}
}
/** Strip query params from a URL for safe error messages. */
function sanitizeUrl(url) {
	try {
		const u = new URL(url);
		return `${u.protocol}//${u.host}${u.pathname}`;
	} catch {
		return url;
	}
}
/** Recognized quota window keys, in display order. */
const WINDOW_KEYS = [
	"rolling",
	"weekly",
	"monthly"
];
/**
* Fetch usage through the API-key path. Throws UsageError on any failure.
* @param cfg - resolved config carrying the API key, base URL and timeout.
* @param now - epoch ms used to derive each window's reset countdown.
*/
async function fetchViaApiKey(cfg, now = Date.now()) {
	const apiKey = cfg.apiKey?.trim();
	if (apiKey === void 0 || apiKey.length === 0) throw new UsageError("Missing OpenCode Go API key for the usage endpoint", "noconfig");
	const parsed = parseUsageBody(await safeFetchJson(usageEndpoint(cfg), apiKey, cfg.timeoutMs), now);
	if (parsed === void 0) throw new UsageError("Response carried no usable usage data (usage.rolling/weekly/monthly all missing)", "empty");
	return parsed;
}
/**
* Normalize a `/zen/go/v1/usage` response body into window records.
* @param body - parsed JSON payload.
* @param now - epoch ms used to derive each window's reset countdown.
* @returns the recognized windows, or `undefined` when none are usable.
*/
function parseUsageBody(body, now = Date.now()) {
	if (typeof body !== "object" || body === null) return void 0;
	const usage = body.usage;
	if (typeof usage !== "object" || usage === null) return void 0;
	const record = usage;
	const out = {};
	for (const key of WINDOW_KEYS) {
		const window = parseWindow(key, record[key], now);
		if (window !== void 0) out[key] = window;
	}
	return out.rolling !== void 0 || out.weekly !== void 0 || out.monthly !== void 0 ? out : void 0;
}
/** Validate one window record; returns `undefined` when malformed. */
function parseWindow(kind, value, now) {
	if (typeof value !== "object" || value === null) return void 0;
	const record = value;
	if (typeof record.percent !== "number" || !Number.isFinite(record.percent)) return void 0;
	const percent = clampPercent(record.percent);
	return {
		kind,
		percent,
		resetInSec: parseResetInSec(record.resetsAt, now),
		status: parseStatus(record.status, percent)
	};
}
/**
* Map the API's window status onto the two states the chip renders. Anything
* other than `ok` means the window is spent; a window reported at 100% is
* treated as spent even when the status field still says `ok`.
*/
function parseStatus(raw, percent) {
	if (typeof raw === "string" && raw.toLowerCase() !== "ok") return "rate-limited";
	return percent >= 100 ? "rate-limited" : "ok";
}
/**
* Convert an ISO-8601 `resetsAt` stamp into seconds from `now`.
* Returns 0 when the stamp is absent, unparseable, or already in the past —
* the UI renders that as "resets now" rather than a negative countdown.
*/
function parseResetInSec(resetsAt, now = Date.now()) {
	if (typeof resetsAt !== "string" || resetsAt.length === 0) return 0;
	const at = Date.parse(resetsAt);
	if (!Number.isFinite(at)) return 0;
	return Math.max(0, Math.round((at - now) / 1e3));
}
/**
* Fetch usage with the current config and stamp the fetch timestamp so the UI
* can show data freshness.
* @param cfg - resolved config (must carry the API key).
*/
async function fetchUsage(cfg) {
	const now = Date.now();
	return {
		...await fetchViaApiKey(cfg, now),
		updatedAt: now
	};
}
function clampPercent(n) {
	return Math.max(0, Math.min(100, Math.floor(n)));
}
//#endregion
//#region src/credentials.ts
/**
* Brand a raw environment-variable name as a {@link CredentialRef}.
* @param name - a POSIX shell identifier such as `OPENCODE_GO_API_KEY`.
* @returns the same string, typed as a reference.
*/
function credentialRef(name) {
	return name;
}
/**
* Read one reference from an optional credential provider.
* @param provider - the `ctx.credentials` service, when the profile has one.
* @param name - the environment-variable name to resolve.
* @returns the trimmed value, or `undefined` when unset or unresolvable.
*/
async function resolveCredential(provider, name) {
	if (provider === void 0 || typeof provider.resolve !== "function") return void 0;
	try {
		const value = (await provider.resolve(credentialRef(name)))?.value?.trim();
		return value !== void 0 && value.length > 0 ? value : void 0;
	} catch {
		return;
	}
}
/**
* Describe one reference through the seam without exposing its value. Used to
* tell whether a write would land or be shadowed by a read-only source.
* @param provider - the `ctx.credentials` service, when the profile has one.
* @param ref - the reference to describe.
* @returns the seam's presence/writability facts, or `undefined` when the
* provider cannot answer (older seam, or a failing one).
*/
async function describeCredential(provider, ref) {
	if (provider?.describe === void 0) return void 0;
	try {
		return await provider.describe(ref);
	} catch {
		return;
	}
}
//#endregion
//#region src/service.ts
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
/** After a failed fetch, skip further provider queries for this long. */
const FAILURE_COOLDOWN_MS = 6e4;
/** Map a UsageError (or any error) to a browser-safe view. */
function errorView(error) {
	if (error instanceof UsageError) return {
		error: error.code,
		message: error.message
	};
	return {
		error: "fetch",
		message: error instanceof Error ? error.message : String(error)
	};
}
/**
* Cached OpenCode Go usage read. `view()` answers from a fresh cache,
* otherwise queries the provider (deduped when concurrent). A failed query
* enters a short cooldown so a broken config is not hammered by the poller.
*/
var OcgoUsageService = class extends Service {
	enabled;
	credentialRefName;
	cached;
	cachedAt = 0;
	failureUntilMs = 0;
	lastError;
	inflight;
	constructor(ctx, config = {}) {
		super(ctx, "ocgoUsage");
		this.enabled = config.enabled ?? true;
		this.credentialRefName = config.apiKeyEnv ?? "OPENCODE_GO_API_KEY";
	}
	/** Whether the service answers queries while enabled. */
	isEnabled() {
		return this.enabled;
	}
	/** Cache TTL from the live config (seconds → ms). */
	ttlMs() {
		return loadConfig().cacheTTL * 1e3;
	}
	/** The credential seam, when this profile provides one. */
	credentials() {
		return this.ctx.get("credentials");
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
		if (fromSeam !== void 0) return fromSeam;
		const direct = cfg.apiKey?.trim();
		return direct !== void 0 && direct.length > 0 ? direct : void 0;
	}
	/**
	* The config-editor view. The seam's `describe` half reports presence without
	* the value, which is the only way a key living in the DSH credential store
	* can read as configured — that store has no tail to display.
	*/
	async configView() {
		const local = maskSecret(loadConfig().apiKey);
		if (local.set) return { apiKey: local };
		const credentials = this.credentials();
		if (credentials?.describe !== void 0) try {
			const info = await credentials.describe(credentialRef(this.credentialRefName));
			if (info.configured) return {
				apiKey: {
					set: true,
					tail: ""
				},
				...info.source === void 0 ? {} : { source: info.source }
			};
		} catch {}
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
		if (credentials !== void 0 && value !== null) {
			const info = await describeCredential(credentials, ref);
			if (info?.configured === true && info.writable === false) throw new UsageError(`${this.credentialRefName} is supplied by a read-only source (${info.source ?? "unknown"}) that would shadow anything stored here; change it at that source instead.`, "readonly");
		}
		if (value !== null && credentials?.set !== void 0) try {
			await credentials.set(ref, value);
			this.invalidateCache();
			return;
		} catch {
			if (await resolveCredential(credentials, this.credentialRefName) !== void 0) throw new UsageError(`The DSH credential store refused the write for ${this.credentialRefName}, and its current value would shadow a local copy; the key was left unchanged.`, "readonly");
		}
		if (value === null && credentials?.unset !== void 0) try {
			await credentials.unset(ref);
		} catch {}
		writeConfigFile({ apiKey: value });
		this.invalidateCache();
	}
	/** RPC: most recent usage view. Returns the cached view when it is still
	* fresh, otherwise re-queries the provider (deduped when concurrent). */
	async view() {
		if (!this.enabled) return {
			error: "disabled",
			message: "The ocgo-usage plugin is disabled."
		};
		const now = Date.now();
		if (this.cached !== void 0 && now - this.cachedAt < this.ttlMs()) return toView(this.cached);
		if (now < this.failureUntilMs) return this.lastError ?? {
			error: "fetch",
			message: "Unknown failure"
		};
		if (this.inflight !== void 0) return this.inflight;
		this.inflight = this.query().then((view) => {
			if (view.error === void 0) this.lastError = void 0;
			else {
				this.lastError = view;
				this.failureUntilMs = Date.now() + FAILURE_COOLDOWN_MS;
			}
			return view;
		}).finally(() => {
			this.inflight = void 0;
		});
		return this.inflight;
	}
	/** RPC: force a fresh provider query (bypasses the cache window). */
	async refresh() {
		if (!this.enabled) return {
			error: "disabled",
			message: "The ocgo-usage plugin is disabled."
		};
		const view = await this.query();
		if (view.error === void 0) {
			this.lastError = void 0;
			this.failureUntilMs = 0;
		} else {
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
		this.cached = void 0;
		this.cachedAt = 0;
		this.failureUntilMs = 0;
		this.lastError = void 0;
	}
	async query() {
		try {
			const cfg = loadConfig();
			const apiKey = await this.resolveApiKey(cfg);
			if (apiKey === void 0) throw new UsageError(`Missing OpenCode Go API key: set ${this.credentialRefName} (e.g. in $DSH_HOME/.credentials.yaml), export it in the environment, or store it in \$DSH_HOME/ocgo-usage.json`, "noconfig");
			const data = await fetchUsage({
				...cfg,
				apiKey
			});
			this.cached = data;
			this.cachedAt = Date.now();
			return toView(data);
		} catch (error) {
			return errorView(error);
		}
	}
};
/** Convert the internal normalized shape into the browser view. */
function toView(data) {
	return {
		updatedAt: data.updatedAt,
		...data.rolling === void 0 ? {} : { rolling: data.rolling },
		...data.weekly === void 0 ? {} : { weekly: data.weekly },
		...data.monthly === void 0 ? {} : { monthly: data.monthly }
	};
}
//#endregion
//#region src/index.ts
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
const name = "ocgo-usage";
/** Services required before the usage service can answer. */
const inject = ["webServer"];
/** Register the usage service and its API routes on the context. */
function apply(ctx, config = {}) {
	const routes = makeOcgoRoutes(new OcgoUsageService(ctx, config));
	ctx.effect(() => {
		const disposers = routes.map((route) => ctx.webServer.register(route));
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "ocgo-usage: routes");
}
//#endregion
export { CREDENTIAL_REF, ENV_API_KEY, OCGO_API_PREFIX, OcgoUsageService, USAGE_PATH, UsageError, WINDOW_KEYS, apply, configFilePath, credentialRef, describeCredential, fetchUsage, fetchViaApiKey, inject, loadConfig, makeOcgoRoutes, maskSecret, name, normalizeApiKey, parseResetInSec, parseUsageBody, resolveCredential, usageEndpoint };
