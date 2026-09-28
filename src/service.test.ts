/**
 * Unit tests for the cached usage service.
 * @module dsh-ocgo-usage/service.test
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ENV_API_KEY, configFilePath, loadConfig } from './config.ts'
import type { CredentialProviderFace } from './credentials.ts'
import { OcgoUsageService } from './service.ts'

const SAVED_KEY = process.env[ENV_API_KEY]

/** The live `/zen/go/v1/usage` response shape. */
const OK_BODY = {
  usage: {
    rolling: { status: 'ok', percent: 10, resetsAt: '2099-09-28T20:28:02.440Z' },
    weekly: { status: 'ok', percent: 4, resetsAt: '2099-10-05T00:00:00.000Z' },
    monthly: { status: 'ok', percent: 52, resetsAt: '2099-10-21T07:41:16.000Z' },
  },
}

/** JSON Response helper for the mocked global fetch. */
function okResponse(): Response {
  return new Response(JSON.stringify(OK_BODY), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** A stand-in for `ctx.credentials` that answers one reference. */
function fakeCredentials(value: string | undefined): CredentialProviderFace & { resolve: ReturnType<typeof vi.fn> } {
  return {
    resolve: vi.fn(async () => (value === undefined ? undefined : { value, source: 'file' })),
  }
}

/**
 * Register a stand-in `ctx.credentials` on a bare test context. The real seam
 * is declared by `@deepseek-ai/dsh-credentials`, which this package does not
 * depend on, so the provision hop goes through a local structural cast — the
 * same trick the service itself uses to read the seam.
 */
function provideCredentials(ctx: Context, provider: CredentialProviderFace): void {
  const seam = ctx as unknown as { provide(name: string, value?: unknown): unknown }
  seam.provide('credentials', provider)
}

/** A seam double that also answers `describe`/`set`/`unset`. */
function fakeSeam(opts: { value?: string; source?: string; writable?: boolean } = {}): CredentialProviderFace & {
  resolve: ReturnType<typeof vi.fn>
  describe: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  unset: ReturnType<typeof vi.fn>
} {
  const configured = opts.value !== undefined
  const source = opts.source ?? 'file'
  const writable = opts.writable ?? true
  return {
    resolve: vi.fn(async () => (configured ? { value: opts.value as string, source } : undefined)),
    describe: vi.fn(async () => (
      configured ? { configured, source, writable } : { configured, writable }
    )),
    set: vi.fn(async () => undefined),
    unset: vi.fn(async () => undefined),
  }
}

/** The Authorization header of the first recorded fetch call. */
function authHeaderOf(spy: { mock: { calls: unknown[][] } }): string | undefined {
  const init = spy.mock.calls[0]?.[1] as RequestInit | undefined
  return (init?.headers as Record<string, string> | undefined)?.Authorization
}

describe('OcgoUsageService', () => {
  let ctx: Context
  let tmp: string

  beforeEach(() => {
    process.env[ENV_API_KEY] = 'sk-test-env'
    tmp = mkdtempSync(join(tmpdir(), 'dsh-ocgo-usage-svc-'))
    process.env.DSH_HOME = tmp
    ctx = new Context()
  })

  afterEach(() => {
    // Restore mocks FIRST so a failure below cannot leak state into the
    // next test. Cordis 4 exposes no public Context.dispose, and the service
    // owns no timers/subscriptions, so the test context is left for the
    // worker process to reclaim.
    vi.restoreAllMocks()
    if (SAVED_KEY === undefined) delete process.env[ENV_API_KEY]
    else process.env[ENV_API_KEY] = SAVED_KEY
    delete process.env.DSH_HOME
    rmSync(tmp, { recursive: true, force: true })
  })

  it('returns the parsed windows on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const service = new OcgoUsageService(ctx)
    const view = await service.view()
    expect(view.error).toBeUndefined()
    expect(view.rolling?.percent).toBe(10)
    expect(view.weekly?.percent).toBe(4)
    expect(view.monthly?.percent).toBe(52)
    expect(view.rolling?.status).toBe('ok')
    expect(view.updatedAt).toBeTypeOf('number')
  })

  it('queries the official quota endpoint with the env key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    await new OcgoUsageService(ctx).view()
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://opencode.ai/zen/go/v1/usage')
    expect(authHeaderOf(fetchSpy)).toBe('Bearer sk-test-env')
  })

  it('resolves the key through the credential seam when the profile provides one', async () => {
    const credentials = fakeCredentials('sk-from-seam')
    provideCredentials(ctx, credentials)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    await new OcgoUsageService(ctx).view()
    expect(credentials.resolve).toHaveBeenCalledWith('OPENCODE_GO_API_KEY')
    // The seam is asked first, so it wins over the env var.
    expect(authHeaderOf(fetchSpy)).toBe('Bearer sk-from-seam')
  })

  it('honours a custom apiKeyEnv reference', async () => {
    const credentials = fakeCredentials('sk-custom')
    provideCredentials(ctx, credentials)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    await new OcgoUsageService(ctx, { apiKeyEnv: 'MY_OCGO_KEY' }).view()
    expect(credentials.resolve).toHaveBeenCalledWith('MY_OCGO_KEY')
  })

  it('falls back to the env key when the seam has no value', async () => {
    const credentials = fakeCredentials(undefined)
    provideCredentials(ctx, credentials)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    await new OcgoUsageService(ctx).view()
    expect(authHeaderOf(fetchSpy)).toBe('Bearer sk-test-env')
  })

  it('deduplicates concurrent view() calls into one fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const service = new OcgoUsageService(ctx)
    const [a, b] = await Promise.all([service.view(), service.view()])
    expect(a.rolling?.percent).toBe(10)
    expect(b.rolling?.percent).toBe(10)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('serves the cached view within the TTL without refetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const service = new OcgoUsageService(ctx)
    await service.view()
    await service.view()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('returns a noconfig error when no API key is available anywhere', async () => {
    delete process.env[ENV_API_KEY]
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const service = new OcgoUsageService(ctx)
    const view = await service.view()
    expect(view.error).toBe('noconfig')
    expect(view.message).toContain('OPENCODE_GO_API_KEY')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('maps a rejected key to an apikey error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 401 }))
    const view = await new OcgoUsageService(ctx).view()
    expect(view.error).toBe('apikey')
  })

  it('maps an HTTP failure to an http<status> code and enters cooldown', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('boom', { status: 500 }),
    )
    const service = new OcgoUsageService(ctx)
    const first = await service.view()
    expect(first.error).toBe('http500')
    // Cooldown: the second call reuses the error without fetching again.
    const second = await service.view()
    expect(second.error).toBe('http500')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('refresh() bypasses the cache window', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const service = new OcgoUsageService(ctx)
    await service.view()
    await service.refresh()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('invalidateCache() forces the next view() to re-query', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const service = new OcgoUsageService(ctx)
    await service.view()
    service.invalidateCache()
    await service.view()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('answers disabled when the plugin is switched off', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse())
    const service = new OcgoUsageService(ctx, { enabled: false })
    const view = await service.view()
    expect(view.error).toBe('disabled')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('configView() reports the local tail when the env carries the key', async () => {
    const view = await new OcgoUsageService(ctx).configView()
    expect(view.apiKey).toEqual({ set: true, tail: 'sk-test-env'.slice(-4) })
  })

  it('configView() reports a seam-held key as configured without a tail', async () => {
    delete process.env[ENV_API_KEY]
    provideCredentials(ctx, fakeSeam({ value: 'sk-in-store', source: 'user-env' }))
    const view = await new OcgoUsageService(ctx).configView()
    // The seam never surrenders the value, so there is no tail to show — but
    // the editor must still read as configured.
    expect(view.apiKey).toEqual({ set: true, tail: '' })
    expect(view.source).toBe('user-env')
  })

  it('writes a new key through the credential seam, not the local file', async () => {
    const seam = fakeSeam({ value: 'sk-old' })
    provideCredentials(ctx, seam)
    await new OcgoUsageService(ctx).setApiKey('sk-new')
    expect(seam.set).toHaveBeenCalledWith('OPENCODE_GO_API_KEY', 'sk-new')
    // A seam write must NOT also drop a shadowed copy in this plugin's file.
    expect(existsSync(configFilePath())).toBe(false)
  })

  it('falls back to the config file when no seam can write', async () => {
    delete process.env[ENV_API_KEY]
    await new OcgoUsageService(ctx).setApiKey('sk-file')
    expect(loadConfig().apiKey).toBe('sk-file')
  })

  it('clears the key through the seam', async () => {
    const seam = fakeSeam({ value: 'sk-old' })
    provideCredentials(ctx, seam)
    await new OcgoUsageService(ctx).setApiKey(null)
    expect(seam.unset).toHaveBeenCalledWith('OPENCODE_GO_API_KEY')
  })

  it('refuses a Set write that a read-only source would shadow', async () => {
    const seam = fakeSeam({ value: 'sk-from-env', source: 'env', writable: false })
    provideCredentials(ctx, seam)
    const service = new OcgoUsageService(ctx)
    await expect(service.setApiKey('sk-new')).rejects.toMatchObject({ code: 'readonly' })
    // Neither store may be touched: a file write here would be dead weight.
    expect(seam.set).not.toHaveBeenCalled()
    expect(existsSync(configFilePath())).toBe(false)
  })

  it('refuses when a failed seam write would leave a shadowing value', async () => {
    const seam = fakeSeam({ value: 'sk-old' })
    seam.set.mockRejectedValue(new Error('store is locked'))
    provideCredentials(ctx, seam)
    await expect(new OcgoUsageService(ctx).setApiKey('sk-new')).rejects.toMatchObject({
      code: 'readonly',
    })
    expect(existsSync(configFilePath())).toBe(false)
  })
})
