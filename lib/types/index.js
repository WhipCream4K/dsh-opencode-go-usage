/**
 * dsh-ocgo-usage host half — mounts the usage service and its HTTP routes.
 * The browser half (the `./client` entry) reads the three OpenCode Go usage
 * windows (rolling 5h / weekly / monthly) through the same-origin
 * `/api/ocgo-usage` JSON endpoints. The host queries the official quota API
 * (`GET /zen/go/v1/usage`) with the `OPENCODE_GO_API_KEY` credential, so no
 * workspace id and no web-session cookie are needed. Install via
 * `dsh plugin --profile web add <path-or-git-url>`; the cordis.patch.yml
 * inserts this plugin row.
 * @module dsh-ocgo-usage
 */
import { makeOcgoRoutes } from "./routes.js";
import { OcgoUsageService } from "./service.js";
export { OcgoUsageService } from "./service.js";
export { OCGO_API_PREFIX, makeOcgoRoutes } from "./routes.js";
export { CREDENTIAL_REF, ENV_API_KEY, USAGE_PATH, configFilePath, loadConfig, maskSecret, normalizeApiKey, usageEndpoint, } from "./config.js";
export { credentialRef, describeCredential, resolveCredential } from "./credentials.js";
export { WINDOW_KEYS, fetchUsage, fetchViaApiKey, parseResetInSec, parseUsageBody, UsageError, } from "./api.js";
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'ocgo-usage';
/** Services required before the usage service can answer. */
export const inject = ['webServer'];
/** Register the usage service and its API routes on the context. */
export function apply(ctx, config = {}) {
    const service = new OcgoUsageService(ctx, config);
    // The routes are registered while the plugin is enabled.
    const routes = makeOcgoRoutes(service);
    ctx.effect(() => {
        const disposers = routes.map((route) => ctx.webServer.register(route));
        return () => {
            for (const dispose of disposers)
                dispose();
        };
    }, 'ocgo-usage: routes');
}
