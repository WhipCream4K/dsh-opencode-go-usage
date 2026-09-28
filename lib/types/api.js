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
import { usageEndpoint } from "./config.js";
// ============================================================================
// Errors
// ============================================================================
/** Error thrown by the HTTP / parsing layer; carries a short code for the UI. */
export class UsageError extends Error {
    code;
    name = 'UsageError';
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}
// ============================================================================
// HTTP wrapper
// ============================================================================
/** Fetch the quota endpoint and decode its JSON body. */
async function safeFetchJson(url, apiKey, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
        res = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
            },
            signal: controller.signal,
        });
    }
    catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
            throw new UsageError(`Request timed out after ${timeoutMs}ms`, 'timeout');
        }
        throw new UsageError(String(e instanceof Error ? e.message : e), 'fetch');
    }
    finally {
        clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 403) {
        throw new UsageError(`OpenCode Go rejected the API key (HTTP ${res.status})`, 'apikey');
    }
    if (!res.ok) {
        throw new UsageError(`HTTP ${res.status} for ${sanitizeUrl(url)}`, `http${res.status}`);
    }
    try {
        return (await res.json());
    }
    catch {
        throw new UsageError('OpenCode Go returned a body that is not JSON', 'parse');
    }
}
/** Strip query params from a URL for safe error messages. */
function sanitizeUrl(url) {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}${u.pathname}`;
    }
    catch {
        return url;
    }
}
// ============================================================================
// API-key path: GET /zen/go/v1/usage (JSON)
// ============================================================================
/** Recognized quota window keys, in display order. */
export const WINDOW_KEYS = ['rolling', 'weekly', 'monthly'];
/**
 * Fetch usage through the API-key path. Throws UsageError on any failure.
 * @param cfg - resolved config carrying the API key, base URL and timeout.
 * @param now - epoch ms used to derive each window's reset countdown.
 */
export async function fetchViaApiKey(cfg, now = Date.now()) {
    const apiKey = cfg.apiKey?.trim();
    if (apiKey === undefined || apiKey.length === 0) {
        throw new UsageError('Missing OpenCode Go API key for the usage endpoint', 'noconfig');
    }
    const body = await safeFetchJson(usageEndpoint(cfg), apiKey, cfg.timeoutMs);
    const parsed = parseUsageBody(body, now);
    // A 200 with no recognizable window is indistinguishable from "no Go
    // subscription"; only report success when at least one window was found.
    if (parsed === undefined) {
        throw new UsageError('Response carried no usable usage data (usage.rolling/weekly/monthly all missing)', 'empty');
    }
    return parsed;
}
/**
 * Normalize a `/zen/go/v1/usage` response body into window records.
 * @param body - parsed JSON payload.
 * @param now - epoch ms used to derive each window's reset countdown.
 * @returns the recognized windows, or `undefined` when none are usable.
 */
export function parseUsageBody(body, now = Date.now()) {
    if (typeof body !== 'object' || body === null)
        return undefined;
    const usage = body.usage;
    if (typeof usage !== 'object' || usage === null)
        return undefined;
    const record = usage;
    const out = {};
    for (const key of WINDOW_KEYS) {
        const window = parseWindow(key, record[key], now);
        if (window !== undefined)
            out[key] = window;
    }
    return out.rolling !== undefined || out.weekly !== undefined || out.monthly !== undefined
        ? out
        : undefined;
}
/** Validate one window record; returns `undefined` when malformed. */
function parseWindow(kind, value, now) {
    if (typeof value !== 'object' || value === null)
        return undefined;
    const record = value;
    if (typeof record.percent !== 'number' || !Number.isFinite(record.percent))
        return undefined;
    const percent = clampPercent(record.percent);
    return {
        kind,
        percent,
        resetInSec: parseResetInSec(record.resetsAt, now),
        status: parseStatus(record.status, percent),
    };
}
/**
 * Map the API's window status onto the two states the chip renders. Anything
 * other than `ok` means the window is spent; a window reported at 100% is
 * treated as spent even when the status field still says `ok`.
 */
function parseStatus(raw, percent) {
    if (typeof raw === 'string' && raw.toLowerCase() !== 'ok')
        return 'rate-limited';
    return percent >= 100 ? 'rate-limited' : 'ok';
}
/**
 * Convert an ISO-8601 `resetsAt` stamp into seconds from `now`.
 * Returns 0 when the stamp is absent, unparseable, or already in the past —
 * the UI renders that as "resets now" rather than a negative countdown.
 */
export function parseResetInSec(resetsAt, now = Date.now()) {
    if (typeof resetsAt !== 'string' || resetsAt.length === 0)
        return 0;
    const at = Date.parse(resetsAt);
    if (!Number.isFinite(at))
        return 0;
    return Math.max(0, Math.round((at - now) / 1000));
}
// ============================================================================
// Orchestrator
// ============================================================================
/**
 * Fetch usage with the current config and stamp the fetch timestamp so the UI
 * can show data freshness.
 * @param cfg - resolved config (must carry the API key).
 */
export async function fetchUsage(cfg) {
    const now = Date.now();
    const data = await fetchViaApiKey(cfg, now);
    return { ...data, updatedAt: now };
}
// ============================================================================
// Internal helpers
// ============================================================================
function clampPercent(n) {
    return Math.max(0, Math.min(100, Math.floor(n)));
}
