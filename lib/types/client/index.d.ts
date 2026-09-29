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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type OcgoKey } from './locales.ts';
export { OCGO_PROVIDER } from '../provider.ts';
export { OcgoDockEntry, formatDuration } from './OcgoDockEntry.tsx';
export type { OcgoDockEntryProps, OcgoInjected } from './OcgoDockEntry.tsx';
export { armSlotContribution, readModelProvider, type ArmedSlotContribution, type SessionsFace, type SlotArmingMode, } from './harness-compat.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** dsh-ocgo-usage chip copy. */
        ocgo: OcgoKey;
    }
}
/**
 * Required services. `slots` and `locale` are read directly; `conversation` is
 * declared so the eager fallback inside {@link armSlotContribution} — used by
 * shells predating `slots.inject` — runs after the package that declares the
 * composer row. On rc.2 and later the deferred path makes that order
 * irrelevant.
 */
export declare const inject: string[];
/**
 * Register the usage chip into the composer tool row next to the model selector.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map