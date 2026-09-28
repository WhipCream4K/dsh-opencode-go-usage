/**
 * dsh-ocgo-usage browser half — registers the OpenCode Go usage chip into
 * the composer tool row (`conversation.input.right`, next to the model
 * selector) and reads the host's same-origin `/api/ocgo-usage` JSON endpoints:
 * poll the host snapshot (every 10 s),
 * refresh on demand. The chip shows the three usage windows (rolling 5h /
 * weekly / monthly) in a compact form; while the host reports no usable data
 * (missing config, cookie error, or provider failure) it renders a compact
 * `<err:code>` state with a manual refresh action.
 *
 * Provider visibility is decided CLIENT-side from the live model selection:
 * the session's `modelSelection` projection is read in memory (no network), so
 * switching models via `/model` is reflected on the very next poll — the
 * host's request-header fold lags until the next real request, which is why
 * visibility does not ride the usage endpoint. The chip renders nothing while
 * the current provider is not `opencode-go`, mirroring pi-ocgo-usage.
 * @module dsh-ocgo-usage/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge (the composer tool row entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import { OCGO_PROVIDER } from '../provider.ts'
import { OcgoDockEntry, type OcgoDockEntryProps } from './OcgoDockEntry.tsx'
import { en, zh, type OcgoKey } from './locales.ts'

export { OCGO_PROVIDER } from '../provider.ts'

export { OcgoDockEntry, formatDuration } from './OcgoDockEntry.tsx'
export type { OcgoDockEntryProps } from './OcgoDockEntry.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** dsh-ocgo-usage chip copy. */
    ocgo: OcgoKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'ocgo'

/** Required services: slots for the composer tool-row entry, locale for the copy. */
export const inject = ['slots', 'locale']

/**
 * The selected model of a session's `modelSelection` projection. Committed
 * state carries `lastUsed`/`pending`; the wire view renames the effective
 * choice to `next`, so all three are read.
 */
interface ModelSelectionView {
  /** Effective selection as the wire view names it. */
  next?: { provider?: string }
  /** Committed choice awaiting its first use. */
  pending?: { provider?: string }
  /** Last selection the session actually used. */
  lastUsed?: { provider?: string }
}

/**
 * The client `sessions` service as this plugin needs it: resolve a session id
 * to its binding, then read a projection off the bound session. Only these
 * two hops are used, so the face stays a local structural type instead of an
 * import from the session-controller package.
 */
interface SessionsFace {
  /** Resolve the live binding of a session, if it is open. */
  binding(id: string): {
    session: { projections: { faceOf(key: string): { getSnapshot(): unknown } } }
  } | undefined
}

/** The injected business face: the tool row's owning session plus a live provider read. */
export interface OcgoInjected {
  /** The session this dock entry renders for (slot inject factory arg). */
  dockSessionId: string | undefined
  /**
   * Resolve the CURRENT model provider of the dock's session from the live
   * in-memory `modelSelection` projection (no network). Undefined when the
   * session has no selection yet.
   */
  provider(): Promise<string | undefined>
}

/**
 * Register the usage chip into the composer tool row next to the model selector.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-ocgo-usage: dictionaries')

  ctx.inject(['slots', 'conversation', 'sessions'], (scope: ClientContext) => {
    scope.effect(() => scope.slots.register({
      name: 'conversation.input.right',
      id: 'ocgo-usage',
      order: 110,
      locale: NS,
      inject: (sessionId): OcgoInjected => {
        const sessions = scope.get('sessions') as SessionsFace | undefined
        return {
          dockSessionId: sessionId,
          provider: async () => {
            try {
              const binding = sessions?.binding?.(sessionId)
              const face = binding?.session?.projections?.faceOf?.('modelSelection')
              const snapshot = face?.getSnapshot?.() as ModelSelectionView | undefined
              const selection = snapshot?.next ?? snapshot?.pending ?? snapshot?.lastUsed
              return selection?.provider
            } catch {
              return undefined
            }
          },
        }
      },
    }, OcgoDockEntry), 'dsh-ocgo-usage: chip registration')
  })
}
