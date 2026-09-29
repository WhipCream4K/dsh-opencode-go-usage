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

// The client root context is plain cordis. DSH 0.2.0-rc.2 removed the
// `@deepseek-ai/dsh-client-runtime` package that used to re-export it, and no
// replacement package is needed: the shell seeds `@deepseek-ai/cordis` into the
// shared module table.
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge (the composer tool row entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the renderer's Context merge (ctx.slots, the SlotRegistry service).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the session-controller Context merge (ctx.sessions).
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { OCGO_PROVIDER } from '../provider.ts'
import { armSlotContribution, readModelProvider, type SessionsFace } from './harness-compat.ts'
import { OcgoDockEntry, type OcgoDockEntryProps, type OcgoInjected } from './OcgoDockEntry.tsx'
import { en, zh, type OcgoKey } from './locales.ts'

export { OCGO_PROVIDER } from '../provider.ts'

export { OcgoDockEntry, formatDuration } from './OcgoDockEntry.tsx'
export type { OcgoDockEntryProps, OcgoInjected } from './OcgoDockEntry.tsx'
export {
  armSlotContribution,
  readModelProvider,
  type ArmedSlotContribution,
  type SessionsFace,
  type SlotArmingMode,
} from './harness-compat.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-ocgo-usage chip copy. */
    ocgo: OcgoKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'ocgo'

/** The composer tool row this entry occupies. */
const SLOT = 'conversation.input.right'

/** Stable list-slot cell id (the entry's identity inside the row). */
const ENTRY_ID = 'ocgo-usage'

/** Sort order inside the row. */
const ENTRY_ORDER = 110

/**
 * Required services. `slots` and `locale` are read directly; `conversation` is
 * declared so the eager fallback inside {@link armSlotContribution} — used by
 * shells predating `slots.inject` — runs after the package that declares the
 * composer row. On rc.2 and later the deferred path makes that order
 * irrelevant.
 */
export const inject = ['slots', 'locale', 'conversation']

/**
 * Register the usage chip into the composer tool row next to the model selector.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-ocgo-usage: dictionaries')

  ctx.inject(['slots', 'conversation', 'sessions'], (scope: ClientContext) => {
    // `readModelProvider` walks the sessions service through a local structural
    // face, so the chip does not pin the session-controller package's exported
    // types; the assignment is checked here.
    const sessions: SessionsFace = scope.sessions
    const armed = armSlotContribution(scope.slots, SLOT, () => scope.slots.register({
      name: SLOT,
      id: ENTRY_ID,
      order: ENTRY_ORDER,
      locale: NS,
      inject: (sessionId: string): OcgoInjected => ({
        dockSessionId: sessionId,
        provider: async () => readModelProvider(sessions, sessionId),
      }),
    }, OcgoDockEntry))
    scope.effect(() => armed.dispose, `dsh-ocgo-usage: chip registration (${armed.mode})`)
  })
}
