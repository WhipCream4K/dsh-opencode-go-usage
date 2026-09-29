/**
 * Unit tests for the harness-version compatibility shims.
 *
 * Each case names the shell generation it stands for, so a failure says which
 * DSH release stopped working rather than only which assertion tripped.
 * @module dsh-ocgo-usage/client/harness-compat.test
 */

import { describe, expect, it, vi } from 'vitest'
import {
  armSlotContribution,
  readModelProvider,
  type SessionsFace,
  type SlotInjectionEffect,
} from './harness-compat.ts'

const SLOT = 'conversation.input.right'

describe('armSlotContribution', () => {
  it('uses slots.inject when the shell has it (DSH >= 0.2.0-rc.2)', () => {
    const inject = vi.fn((_key: string, contribute: () => SlotInjectionEffect) => {
      expect(done).toBe(false)
      contribute()
      return () => {}
    })
    let done = false
    const armed = armSlotContribution({ inject }, SLOT, () => {
      done = true
      return () => {}
    })
    expect(armed.mode).toBe('deferred')
    expect(inject).toHaveBeenCalledTimes(1)
    expect(inject.mock.calls[0]?.[0]).toBe(SLOT)
    expect(done).toBe(true)
  })

  it('disposes through the inject owner (collapsing declaration included)', () => {
    const ownerDispose = vi.fn()
    const contributionDispose = vi.fn()
    const armed = armSlotContribution({
      inject: (_key, contribute) => {
        contribute()
        return ownerDispose
      },
    }, SLOT, () => contributionDispose)

    armed.dispose()
    expect(ownerDispose).toHaveBeenCalledTimes(1)
    // The inject owner already cascades; the contribution disposer must not
    // also run or a shell that counts disposals would see a double removal.
    expect(contributionDispose).not.toHaveBeenCalled()
  })

  it('falls back to the contribution disposer when inject returns nothing usable', () => {
    const contributionDispose = vi.fn()
    const armed = armSlotContribution({
      inject: (_key, contribute) => {
        contribute()
        return undefined
      },
    }, SLOT, () => contributionDispose)

    armed.dispose()
    expect(contributionDispose).toHaveBeenCalledTimes(1)
  })

  it('registers eagerly when the shell predates slots.inject', () => {
    const armed = armSlotContribution({}, SLOT, () => () => {})
    // No `inject` on the face: the old shell only had `register()`, which the
    // callback performs itself.
    expect(armed.mode).toBe('eager')
    armed.dispose()
  })

  it('runs an iterable effect set in reverse order', () => {
    const order: string[] = []
    const armed = armSlotContribution({}, SLOT, () => [
      () => order.push('first'),
      () => order.push('second'),
    ])
    armed.dispose()
    expect(order).toEqual(['second', 'first'])
  })

  it('does not treat a non-function inject property as the deferred path', () => {
    const armed = armSlotContribution(
      { inject: undefined as unknown as (key: string, contribute: () => SlotInjectionEffect) => unknown },
      SLOT,
      () => () => {},
    )
    expect(armed.mode).toBe('eager')
  })
})

/** A minimal rc.2-shaped sessions service answering one provider. */
function rc2Sessions(provider: string | undefined): SessionsFace {
  return {
    binding: () => ({
      session: {
        projections: {
          faceOf: (key: string) => ({
            getSnapshot: () => (key === 'modelSelection' ? { next: { provider } } : undefined),
          }),
        },
      },
    }),
  }
}

describe('readModelProvider', () => {
  it('reads the wire projection of an rc.2 shell', () => {
    expect(readModelProvider(rc2Sessions('opencode-go'), 's1')).toBe('opencode-go')
  })

  it('reads the durable state members when the wire view is absent', () => {
    const sessions: SessionsFace = {
      binding: () => ({
        session: {
          projections: {
            faceOf: () => ({ getSnapshot: () => ({ lastUsed: { provider: 'a' }, pending: { provider: 'b' } }) }),
          },
        },
      }),
    }
    // A committed-but-unused selection is what the next request will use.
    expect(readModelProvider(sessions, 's1')).toBe('b')
  })

  it('prefers next over lastUsed when both are present', () => {
    const sessions: SessionsFace = {
      binding: () => ({
        session: {
          projections: {
            faceOf: () => ({ getSnapshot: () => ({ next: { provider: 'live' }, lastUsed: { provider: 'old' } }) }),
          },
        },
      }),
    }
    expect(readModelProvider(sessions, 's1')).toBe('live')
  })

  it('accepts a shell that hands back the snapshot instead of the observable face', () => {
    const sessions: SessionsFace = {
      binding: () => ({
        session: { projections: { faceOf: () => ({ next: { provider: 'direct' } }) } },
      }),
    }
    expect(readModelProvider(sessions, 's1')).toBe('direct')
  })

  it('returns undefined for an empty or non-string provider', () => {
    expect(readModelProvider(rc2Sessions(''), 's1')).toBeUndefined()
    const sessions: SessionsFace = {
      binding: () => ({
        session: { projections: { faceOf: () => ({ getSnapshot: () => ({ next: { provider: 42 } }) }) } },
      }),
    }
    expect(readModelProvider(sessions, 's1')).toBeUndefined()
  })

  it('returns undefined when a hop is missing', () => {
    expect(readModelProvider(undefined, 's1')).toBeUndefined()
    expect(readModelProvider(rc2Sessions('opencode-go'), undefined)).toBeUndefined()
    expect(readModelProvider(rc2Sessions('opencode-go'), '')).toBeUndefined()
    expect(readModelProvider({}, 's1')).toBeUndefined()
    expect(readModelProvider({ binding: () => undefined }, 's1')).toBeUndefined()
    expect(readModelProvider({ binding: () => ({}) }, 's1')).toBeUndefined()
    expect(readModelProvider({ binding: () => ({ session: {} }) }, 's1')).toBeUndefined()
    expect(readModelProvider({
      binding: () => ({ session: { projections: undefined } }),
    }, 's1')).toBeUndefined()
    expect(readModelProvider({
      binding: () => ({ session: { projections: {} } }),
    }, 's1')).toBeUndefined()
  })

  it('hides the chip rather than throwing when the shell refuses the read', () => {
    const sessions: SessionsFace = {
      binding: () => {
        throw new Error('generation disposed')
      },
    }
    expect(readModelProvider(sessions, 's1')).toBeUndefined()
  })
})
