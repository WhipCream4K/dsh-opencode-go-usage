import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
//#region src/config.ts
/**
* Configuration loader for dsh-ocgo-usage.
*
* Priority: env vars > config file ($DSH_HOME/ocgo-usage.json) > built-in
* defaults. The credential seam (`ctx.credentials`) outranks both and is
* consulted by the service, not here, because it is asynchronous.
*
* The API key is NEVER logged. If the config file is missing or unparseable we
* silently fall back to env vars + defaults — the browser readout shows a clean
* `noconfig` error if no source provides a usable value.
*
* Env var names match the pi-ocgo-usage extension so one shell profile works
* for both agents.
*
* The browser config editor (`/api/ocgo-usage/config`) reads a MASKED view
* (never the full key) and writes back through {@link writeConfigFile}.
* @module dsh-ocgo-usage/config
*/
const ENV_API_KEY = "OPENCODE_GO_API_KEY";
const ENV_CACHE_TTL = "OPENCODE_GO_CACHE_TTL";
const ENV_TIMEOUT_MS = "OPENCODE_GO_TIMEOUT_MS";
/** The environment variable the credential seam resolves by default. */
const CREDENTIAL_REF = ENV_API_KEY;
const DEFAULT_BASE_URL = "https://opencode.ai";
/** Quota path appended to the base URL (the official OpenCode Go endpoint). */
const USAGE_PATH = "/zen/go/v1/usage";
const DEFAULT_TIMEOUT_MS = 1e4;
const MAX_CACHE_TTL = 3600;
/** Resolve the DSH home directory ($DSH_HOME or ~/.dsh). */
function dshHome() {
	const explicit = process.env.DSH_HOME;
	if (typeof explicit === "string" && explicit.length > 0) return explicit;
	return join(homedir(), ".dsh");
}
/** Resolved location of the plugin config file. */
function configFilePath() {
	return join(dshHome(), "ocgo-usage.json");
}
/** The full quota URL for a resolved config. */
function usageEndpoint(cfg) {
	return `${cfg.baseUrl.replace(/\/+$/, "")}${USAGE_PATH}`;
}
/**
* Load and merge config from file + env vars.
* Returns a fully resolved OcgoConfig; never throws.
*/
function loadConfig() {
	const fileConfig = readFileConfig();
	return {
		apiKey: normalizeApiKey(pickString(process.env[ENV_API_KEY], asString(fileConfig?.apiKey))),
		baseUrl: pickString(process.env["OPENCODE_GO_BASE_URL"], asString(fileConfig?.baseUrl)) || "https://opencode.ai",
		cacheTTL: clamp(pickNumber(process.env[ENV_CACHE_TTL], asNumber(fileConfig?.cacheTTL), 300), 60, MAX_CACHE_TTL),
		timeoutMs: Math.max(0, pickNumber(process.env[ENV_TIMEOUT_MS], asNumber(fileConfig?.timeoutMs), DEFAULT_TIMEOUT_MS))
	};
}
/** Mask the last 4 characters of a secret for the browser (full value when ≤ 4 chars). */
function maskSecret(value) {
	if (value === void 0 || value.length === 0) return {
		set: false,
		tail: ""
	};
	return {
		set: true,
		tail: value.length <= 4 ? value : value.slice(-4)
	};
}
/** The browser-facing masked config view (never reveals the full API key). */
function maskedConfigView() {
	return { apiKey: maskSecret(loadConfig().apiKey) };
}
/**
* Write the API key into the config file (preserving any other fields), chmod
* 600, and return the updated masked view. The value is normalized like env
* input. An absent field is left untouched; pass `null` to clear it.
*/
function writeConfigFile(partial) {
	const next = { ...readFileConfig() ?? {} };
	if (partial.apiKey !== void 0) {
		const v = typeof partial.apiKey === "string" ? normalizeApiKey(partial.apiKey) : void 0;
		if (v !== void 0 && v.length > 0) next.apiKey = v;
		else delete next.apiKey;
	}
	const path = configFilePath();
	try {
		writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 384 });
	} catch {
		return maskedConfigView();
	}
	return { apiKey: maskSecret(typeof next.apiKey === "string" ? next.apiKey : void 0) };
}
function readFileConfig() {
	const path = configFilePath();
	if (!existsSync(path)) return null;
	try {
		const raw = readFileSync(path, "utf8");
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object") return parsed;
		return null;
	} catch {
		return null;
	}
}
/**
* Normalize a user-provided OpenCode Go API key.
*
* Accepts a bare key (`sk-...`), a quoted key, and an `Authorization` header
* value (`Bearer sk-...`), because those are the three shapes that get pasted
* into the Set field or exported into a shell profile. Whitespace and
* newlines are stripped; an empty result means "not configured".
*/
function normalizeApiKey(input) {
	if (!input) return void 0;
	let value = input.trim().replace(/^["']|["']$/g, "").trim();
	value = value.replace(/^Bearer\b\s*/i, "").trim();
	return value.length > 0 ? value : void 0;
}
function pickString(envVal, fileVal) {
	if (envVal && envVal.length > 0) return envVal;
	if (fileVal && fileVal.length > 0) return fileVal;
}
function pickNumber(envVal, fileVal, fallback) {
	const fromEnv = envVal ? Number.parseInt(envVal, 10) : NaN;
	if (Number.isFinite(fromEnv)) return fromEnv;
	if (fileVal !== void 0 && Number.isFinite(fileVal)) return fileVal;
	return fallback;
}
function asString(v) {
	return typeof v === "string" && v.length > 0 ? v : void 0;
}
function asNumber(v) {
	if (typeof v === "number" && Number.isFinite(v)) return v;
	if (typeof v === "string") {
		const n = Number.parseInt(v, 10);
		if (Number.isFinite(n)) return n;
	}
}
function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}
//#endregion
export { USAGE_PATH as a, maskSecret as c, writeConfigFile as d, ENV_API_KEY as i, normalizeApiKey as l, DEFAULT_BASE_URL as n, configFilePath as o, DEFAULT_TIMEOUT_MS as r, loadConfig as s, CREDENTIAL_REF as t, usageEndpoint as u };
