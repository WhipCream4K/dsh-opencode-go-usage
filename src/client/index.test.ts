/**
 * Wiring tests for the browser half: `apply` against a live cordis context
 * whose `slots`, `locale`, `conversation`, and `sessions` services are doubles.
 *
 * These run the real registration site, so they cover what unit tests of the
 * shims cannot: which services the plugin waits for, which slot it arms, what
 * the injected provider face returns, and that both the rc.2 deferred path and
 * the legacy eager path produce a working contribution.
 * @module dsh-ocgo-usage/client/index.test
 */

import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OcgoDockEntry } from './OcgoDockEntry.tsx'
import { apply, inject as pluginInject } from './index.ts'

/** One recorded `slots.register` call. */
interface RecordedRegistration {
  options: Record<string, unknown>
  component: unknown
}

/** A `slots` service double; `deferred: false` models a pre-rc.2 shell. */
function fakeSlots(deferred: boolean) {
  const registrations: RecordedRegistration[] = []
  const armedKeys: string[] = []
  const disposed: string[] = []
  const face: Record<string, unknown> = {
    register(options: Record<string, unknown>, component: unknown): () => void {
      registrations.push({ options, component })
      return () => disposed.push('entry')
    },
  }
  if (deferred) {
    face.inject = (key: string, contribute: () => unknown): (() => void) => {
      armedKeys.push(key)
      contribute()
      return () => disposed.push('inject')
    }
  }
  return { face, registrations, armedKeys, disposed }
}

/** A `sessions` service double answering one provider through the rc.2 hops. */
function fakeSessions(provider: string | undefined) {
  return {
    binding: (id: string) => (id === 's1'
      ? {
        session: {
          projections: {
            faceOf: (key: string) => ({
              getSnapshot: () => (key === 'modelSelection' ? { next: { provider } } : undefined),
            }),
          },
        },
      }
      : undefined),
  }
}

/** Let cordis settle the injected plugin fiber it starts. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

/** Mount the client half on a fresh context with the given doubles. */
async function mount(opts: { deferred: boolean; provider?: string | undefined }) {
  const slots = fakeSlots(opts.deferred)
  const localeRegister = vi.fn(() => () => {})
  const ctx = new Context()
  const services = ctx as unknown as { provide(name: string, value?: unknown): unknown }
  services.provide('slots', slots.face)
  services.provide('locale', { register: localeRegister })
  services.provide('conversation', {})
  services.provide('sessions', fakeSessions(opts.provider ?? 'opencode-go'))
  apply(ctx as unknown as Parameters<typeof apply>[0])
  await settle()
  return { slots, localeRegister }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('client apply', () => {
  it('declares the services the browser half reads', () => {
    // `conversation` is not read directly; it sequences the eager fallback
    // behind the package that declares the composer row.
    expect(pluginInject).toEqual(['slots', 'locale', 'conversation'])
  })

  it('registers the chip into conversation.input.right', async () => {
    const { slots, localeRegister } = await mount({ deferred: true })
    expect(localeRegister).toHaveBeenCalledWith('ocgo', expect.objectContaining({ zh: expect.anything() }))
    expect(slots.registrations).toHaveLength(1)
    const registration = slots.registrations[0]
    expect(registration?.options.name).toBe('conversation.input.right')
    expect(registration?.options.id).toBe('ocgo-usage')
    expect(registration?.options.order).toBe(110)
    expect(registration?.options.locale).toBe('ocgo')
    expect(registration?.component).toBe(OcgoDockEntry)
  })

  it('arms the contribution through slots.inject on rc.2', async () => {
    const { slots } = await mount({ deferred: true })
    expect(slots.armedKeys).toEqual(['conversation.input.right'])
  })

  it('arms the contribution eagerly on a shell without slots.inject', async () => {
    const { slots } = await mount({ deferred: false })
    expect(slots.armedKeys).toEqual([])
    expect(slots.registrations).toHaveLength(1)
  })

  it('injects a provider read that follows the live model selection', async () => {
    const { slots } = await mount({ deferred: true, provider: 'opencode-go' })
    const injected = (slots.registrations[0]?.options.inject as (id: string) => {
      dockSessionId: string
      provider(): Promise<string | undefined>
    })('s1')
    expect(injected.dockSessionId).toBe('s1')
    await expect(injected.provider()).resolves.toBe('opencode-go')
  })

  it('resolves the provider to undefined for an unopened session', async () => {
    const { slots } = await mount({ deferred: true, provider: 'opencode-go' })
    const injected = (slots.registrations[0]?.options.inject as (id: string) => {
      provider(): Promise<string | undefined>
    })('missing')
    await expect(injected.provider()).resolves.toBeUndefined()
  })
})
