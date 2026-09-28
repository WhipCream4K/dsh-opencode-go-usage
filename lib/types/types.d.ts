/**
 * Shared types for dsh-ocgo-usage.
 *
 * The plugin reads the official OpenCode Go quota API —
 * `GET <baseUrl>/zen/go/v1/usage` — authenticated with the regular OpenCode Go
 * API key (`Authorization: Bearer <OPENCODE_GO_API_KEY>`). That endpoint needs
 * no workspace id and no web-session cookie, so the whole config surface is a
 * single secret and nothing here carries session identity.
 * @module dsh-ocgo-usage/types
 */
/** One of the three OpenCode Go usage windows. */
export type UsageWindowKind = 'rolling' | 'weekly' | 'monthly';
/** Whether the window is still usable or the account is rate-limited. */
export type UsageStatus = 'ok' | 'rate-limited';
/** One usage window: percent used + seconds until reset. */
export interface UsageWindow {
    /** Window identity. */
    readonly kind: UsageWindowKind;
    /** 0–100 integer percent. */
    readonly percent: number;
    /** Seconds until the window resets, derived from the API `resetsAt` stamp. */
    readonly resetInSec: number;
    /** `rate-limited` when the window is exhausted. */
    readonly status: UsageStatus;
}
/** Normalized usage shape shared by every fetch path. */
export interface NormalizedUsage {
    /** Epoch ms of the last successful fetch (data freshness). */
    readonly updatedAt: number;
    /** Any window may be missing (new account, no Go subscription). */
    readonly rolling?: UsageWindow;
    readonly weekly?: UsageWindow;
    readonly monthly?: UsageWindow;
}
/** Fully resolved plugin configuration (env + config file + defaults). */
export interface OcgoConfig {
    /**
     * OpenCode Go API key, from `OPENCODE_GO_API_KEY` or the config file.
     *
     * This is only the *fallback* half of the resolution order: the service asks
     * the credential seam (`ctx.credentials`) first, which is where
     * `~/.dsh/.credentials.yaml` and the process environment are layered.
     */
    readonly apiKey?: string;
    /** API base URL. */
    readonly baseUrl: string;
    /** Cache TTL in seconds, clamped to [60, 3600]. */
    readonly cacheTTL: number;
    /** HTTP timeout in milliseconds. */
    readonly timeoutMs: number;
}
/** One window serialized for the browser (no credential material). */
export type UsageWindowView = UsageWindow;
/** The browser-facing snapshot served by the host JSON endpoint. */
export interface OcgoUsageView {
    /** Epoch ms of the last successful fetch (absent before any success). */
    readonly updatedAt?: number;
    readonly rolling?: UsageWindowView;
    readonly weekly?: UsageWindowView;
    readonly monthly?: UsageWindowView;
    /** Machine-readable error code, present only on failure. */
    readonly error?: string;
    /** Human-readable failure detail (never contains the API key). */
    readonly message?: string;
}
/** One masked secret field for the browser config editor (never the full value). */
export interface MaskedSecret {
    /** Whether a value is currently set (env or config file). */
    readonly set: boolean;
    /** The last 4 characters of the value (full value when ≤ 4 chars). */
    readonly tail: string;
}
/** The browser-facing config view: whether the API key is set, masked. */
export interface MaskedConfigView {
    /** The `OPENCODE_GO_API_KEY` currently visible to the host config loader. */
    readonly apiKey: MaskedSecret;
    /**
     * Where the effective key comes from (`env`, `user-env`, `file`, ...), when
     * the credential seam could report it. Absent when the key is unset or came
     * from this plugin's own config file, whose source is implied.
     *
     * The editor shows this so a key that lives in the DSH credential store —
     * and therefore has no tail to display — still reads as configured.
     */
    readonly source?: string;
}
//# sourceMappingURL=types.d.ts.map