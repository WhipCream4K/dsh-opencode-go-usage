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
import type { NormalizedUsage, OcgoConfig } from './types.ts';
/** Error thrown by the HTTP / parsing layer; carries a short code for the UI. */
export declare class UsageError extends Error {
    readonly code: string;
    readonly name = "UsageError";
    constructor(message: string, code: string);
}
/** Recognized quota window keys, in display order. */
export declare const WINDOW_KEYS: readonly ["rolling", "weekly", "monthly"];
/**
 * Fetch usage through the API-key path. Throws UsageError on any failure.
 * @param cfg - resolved config carrying the API key, base URL and timeout.
 * @param now - epoch ms used to derive each window's reset countdown.
 */
export declare function fetchViaApiKey(cfg: OcgoConfig, now?: number): Promise<Omit<NormalizedUsage, 'updatedAt'>>;
/**
 * Normalize a `/zen/go/v1/usage` response body into window records.
 * @param body - parsed JSON payload.
 * @param now - epoch ms used to derive each window's reset countdown.
 * @returns the recognized windows, or `undefined` when none are usable.
 */
export declare function parseUsageBody(body: unknown, now?: number): Omit<NormalizedUsage, 'updatedAt'> | undefined;
/**
 * Convert an ISO-8601 `resetsAt` stamp into seconds from `now`.
 * Returns 0 when the stamp is absent, unparseable, or already in the past —
 * the UI renders that as "resets now" rather than a negative countdown.
 */
export declare function parseResetInSec(resetsAt: unknown, now?: number): number;
/**
 * Fetch usage with the current config and stamp the fetch timestamp so the UI
 * can show data freshness.
 * @param cfg - resolved config (must carry the API key).
 */
export declare function fetchUsage(cfg: OcgoConfig): Promise<NormalizedUsage>;
//# sourceMappingURL=api.d.ts.map