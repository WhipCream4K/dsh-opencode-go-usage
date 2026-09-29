/**
 * dsh-ocgo-usage browser half — registers the OpenCode Go usage chip into the
 * composer tool row (`conversation.input.right`, next to the model selector)
 * and reads the host's same-origin `/api/ocgo-usage` JSON endpoints: poll the
 * host snapshot (every 10 s), refresh on demand. The chip shows the three
 * usage windows (rolling 5h / weekly / monthly) in a compact form; while the
 * host reports no usable data (missing config, key error, or provider failure)
 * it renders a compact `<err:code>` state with a manual refresh action.
 *
 * Provider visibility is decided CLIENT-side from the live model selection:
 * the session's `modelSelection` projection is read in memory (no network), so
 * switching models via `/model` is reflected on the very next poll — the
 * host's request-header fold lags until the next real request, which is why
 * visibility does not ride the usage endpoint. The chip renders nothing while
 * the current provider is not `opencode-go`, mirroring pi-ocgo-usage.
 *
 * Every DSH seam this file touches that has changed shape between releases goes
 * through `./harness-compat.ts`; see that module for the per-seam evidence.
 * @module dsh-ocgo-usage/client
 */
import { armSlotContribution, readModelProvider } from "./harness-compat.js";
import { OcgoDockEntry } from "./OcgoDockEntry.js";
import { en, zh } from "./locales.js";
export { OCGO_PROVIDER } from "../provider.js";
export { OcgoDockEntry, formatDuration } from "./OcgoDockEntry.js";
export { armSlotContribution, readModelProvider, } from "./harness-compat.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'ocgo';
/** The composer tool row this entry occupies. */
const SLOT = 'conversation.input.right';
/** Stable list-slot cell id (the entry's identity inside the row). */
const ENTRY_ID = 'ocgo-usage';
/** Sort order inside the row. */
const ENTRY_ORDER = 110;
/**
 * Required services. `slots` and `locale` are read directly; `conversation` is
 * declared so the eager fallback inside {@link armSlotContribution} — used by
 * shells predating `slots.inject` — runs after the package that declares the
 * composer row. On rc.2 and later the deferred path makes that order
 * irrelevant.
 */
export const inject = ['slots', 'locale', 'conversation'];
/**
 * Register the usage chip into the composer tool row next to the model selector.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-ocgo-usage: dictionaries');
    ctx.inject(['slots', 'conversation', 'sessions'], (scope) => {
        // `readModelProvider` walks the sessions service through a local structural
        // face, so the chip does not pin the session-controller package's exported
        // types; the assignment is checked here.
        const sessions = scope.sessions;
        const armed = armSlotContribution(scope.slots, SLOT, () => scope.slots.register({
            name: SLOT,
            id: ENTRY_ID,
            order: ENTRY_ORDER,
            locale: NS,
            inject: (sessionId) => ({
                dockSessionId: sessionId,
                provider: async () => readModelProvider(sessions, sessionId),
            }),
        }, OcgoDockEntry));
        scope.effect(() => armed.dispose, `dsh-ocgo-usage: chip registration (${armed.mode})`);
    });
}
