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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
export const ENV_API_KEY = 'OPENCODE_GO_API_KEY';
export const ENV_BASE_URL = 'OPENCODE_GO_BASE_URL';
export const ENV_CACHE_TTL = 'OPENCODE_GO_CACHE_TTL';
export const ENV_TIMEOUT_MS = 'OPENCODE_GO_TIMEOUT_MS';
/** The environment variable the credential seam resolves by default. */
export const CREDENTIAL_REF = ENV_API_KEY;
export const DEFAULT_BASE_URL = 'https://opencode.ai';
/** Quota path appended to the base URL (the official OpenCode Go endpoint). */
export const USAGE_PATH = '/zen/go/v1/usage';
export const DEFAULT_CACHE_TTL = 300;
export const DEFAULT_TIMEOUT_MS = 10_000;
export const MIN_CACHE_TTL = 60;
export const MAX_CACHE_TTL = 3600;
/** Resolve the DSH home directory ($DSH_HOME or ~/.dsh). */
export function dshHome() {
    const explicit = process.env.DSH_HOME;
    if (typeof explicit === 'string' && explicit.length > 0)
        return explicit;
    return join(homedir(), '.dsh');
}
/** Resolved location of the plugin config file. */
export function configFilePath() {
    return join(dshHome(), 'ocgo-usage.json');
}
/** The full quota URL for a resolved config. */
export function usageEndpoint(cfg) {
    return `${cfg.baseUrl.replace(/\/+$/, '')}${USAGE_PATH}`;
}
/**
 * Load and merge config from file + env vars.
 * Returns a fully resolved OcgoConfig; never throws.
 */
export function loadConfig() {
    const fileConfig = readFileConfig();
    // API key: prefer env, fall back to the config file. A key pasted with a
    // `Bearer ` prefix or surrounding quotes is normalized so the common copy
    // mistakes still authenticate.
    const apiKey = normalizeApiKey(pickString(process.env[ENV_API_KEY], asString(fileConfig?.apiKey)));
    // baseUrl: prefer env, fall back to file, fall back to default.
    const baseUrl = pickString(process.env[ENV_BASE_URL], asString(fileConfig?.baseUrl)) || DEFAULT_BASE_URL;
    // cacheTTL: clamp into [60, 3600].
    const rawTTL = pickNumber(process.env[ENV_CACHE_TTL], asNumber(fileConfig?.cacheTTL), DEFAULT_CACHE_TTL);
    const cacheTTL = clamp(rawTTL, MIN_CACHE_TTL, MAX_CACHE_TTL);
    // timeoutMs: > 0.
    const timeoutMs = Math.max(0, pickNumber(process.env[ENV_TIMEOUT_MS], asNumber(fileConfig?.timeoutMs), DEFAULT_TIMEOUT_MS));
    return { apiKey, baseUrl, cacheTTL, timeoutMs };
}
/** Mask the last 4 characters of a secret for the browser (full value when ≤ 4 chars). */
export function maskSecret(value) {
    if (value === undefined || value.length === 0)
        return { set: false, tail: '' };
    return { set: true, tail: value.length <= 4 ? value : value.slice(-4) };
}
/** The browser-facing masked config view (never reveals the full API key). */
export function maskedConfigView() {
    return { apiKey: maskSecret(loadConfig().apiKey) };
}
/**
 * Write the API key into the config file (preserving any other fields), chmod
 * 600, and return the updated masked view. The value is normalized like env
 * input. An absent field is left untouched; pass `null` to clear it.
 */
export function writeConfigFile(partial) {
    const file = readFileConfig() ?? {};
    const next = { ...file };
    if (partial.apiKey !== undefined) {
        const v = typeof partial.apiKey === 'string' ? normalizeApiKey(partial.apiKey) : undefined;
        if (v !== undefined && v.length > 0)
            next.apiKey = v;
        else
            delete next.apiKey;
    }
    const path = configFilePath();
    try {
        writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    }
    catch {
        // Fall back to the env/current effective values rather than throwing to
        // the browser with a partial write.
        return maskedConfigView();
    }
    return {
        apiKey: maskSecret(typeof next.apiKey === 'string' ? next.apiKey : undefined),
    };
}
function readFileConfig() {
    const path = configFilePath();
    if (!existsSync(path))
        return null;
    try {
        const raw = readFileSync(path, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
}
// --- helpers ---
/**
 * Normalize a user-provided OpenCode Go API key.
 *
 * Accepts a bare key (`sk-...`), a quoted key, and an `Authorization` header
 * value (`Bearer sk-...`), because those are the three shapes that get pasted
 * into the Set field or exported into a shell profile. Whitespace and
 * newlines are stripped; an empty result means "not configured".
 */
export function normalizeApiKey(input) {
    if (!input)
        return undefined;
    let value = input.trim().replace(/^["']|["']$/g, '').trim();
    // `Bearer <key>` is the shape an Authorization header copy-pastes as. A
    // bare `Bearer` with nothing after it carries no key at all, so it must
    // normalize to "unset" rather than to the literal word.
    value = value.replace(/^Bearer\b\s*/i, '').trim();
    return value.length > 0 ? value : undefined;
}
function pickString(envVal, fileVal) {
    if (envVal && envVal.length > 0)
        return envVal;
    if (fileVal && fileVal.length > 0)
        return fileVal;
    return undefined;
}
function pickNumber(envVal, fileVal, fallback) {
    const fromEnv = envVal ? Number.parseInt(envVal, 10) : NaN;
    if (Number.isFinite(fromEnv))
        return fromEnv;
    if (fileVal !== undefined && Number.isFinite(fileVal))
        return fileVal;
    return fallback;
}
function asString(v) {
    return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function asNumber(v) {
    if (typeof v === 'number' && Number.isFinite(v))
        return v;
    if (typeof v === 'string') {
        const n = Number.parseInt(v, 10);
        if (Number.isFinite(n))
            return n;
    }
    return undefined;
}
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
