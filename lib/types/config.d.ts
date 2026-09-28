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
import type { MaskedConfigView, MaskedSecret, OcgoConfig } from './types.ts';
export declare const ENV_API_KEY = "OPENCODE_GO_API_KEY";
export declare const ENV_BASE_URL = "OPENCODE_GO_BASE_URL";
export declare const ENV_CACHE_TTL = "OPENCODE_GO_CACHE_TTL";
export declare const ENV_TIMEOUT_MS = "OPENCODE_GO_TIMEOUT_MS";
/** The environment variable the credential seam resolves by default. */
export declare const CREDENTIAL_REF = "OPENCODE_GO_API_KEY";
export declare const DEFAULT_BASE_URL = "https://opencode.ai";
/** Quota path appended to the base URL (the official OpenCode Go endpoint). */
export declare const USAGE_PATH = "/zen/go/v1/usage";
export declare const DEFAULT_CACHE_TTL = 300;
export declare const DEFAULT_TIMEOUT_MS = 10000;
export declare const MIN_CACHE_TTL = 60;
export declare const MAX_CACHE_TTL = 3600;
/** Resolve the DSH home directory ($DSH_HOME or ~/.dsh). */
export declare function dshHome(): string;
/** Resolved location of the plugin config file. */
export declare function configFilePath(): string;
/** The full quota URL for a resolved config. */
export declare function usageEndpoint(cfg: OcgoConfig): string;
/**
 * Load and merge config from file + env vars.
 * Returns a fully resolved OcgoConfig; never throws.
 */
export declare function loadConfig(): OcgoConfig;
/** Mask the last 4 characters of a secret for the browser (full value when ≤ 4 chars). */
export declare function maskSecret(value: string | undefined): MaskedSecret;
/** The browser-facing masked config view (never reveals the full API key). */
export declare function maskedConfigView(): MaskedConfigView;
/**
 * Write the API key into the config file (preserving any other fields), chmod
 * 600, and return the updated masked view. The value is normalized like env
 * input. An absent field is left untouched; pass `null` to clear it.
 */
export declare function writeConfigFile(partial: {
    apiKey?: string | null;
}): MaskedConfigView;
/**
 * Normalize a user-provided OpenCode Go API key.
 *
 * Accepts a bare key (`sk-...`), a quoted key, and an `Authorization` header
 * value (`Bearer sk-...`), because those are the three shapes that get pasted
 * into the Set field or exported into a shell profile. Whitespace and
 * newlines are stripped; an empty result means "not configured".
 */
export declare function normalizeApiKey(input: string | undefined): string | undefined;
//# sourceMappingURL=config.d.ts.map