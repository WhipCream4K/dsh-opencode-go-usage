/**
 * Unit tests for the OpenCode Go quota API client (API-key path).
 * @module dsh-ocgo-usage/api.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { UsageError, fetchUsage, fetchViaApiKey, parseResetInSec, parseUsageBody } from './api.ts'
import type { OcgoConfig } from './types.ts'

const CFG: OcgoConfig = {
  apiKey: 'sk-test-key',
  baseUrl: 'https://opencode.ai',
  cacheTTL: 300,
  timeoutMs: 5_000,
}

/** Fixed "now" so the derived countdowns are deterministic. */
const NOW = Date.parse('2026-09-28T18:00:00.000Z')

/** The live response shape, as observed from `GET /zen/go/v1/usage`. */
const OK_BODY = {
  usage: {
    rolling: { status: 'ok', percent: 10, resetsAt: '2026-09-28T20:28:02.440Z' },
    weekly: { status: 'ok', percent: 4, resetsAt: '2026-10-05T00:00:00.000Z' },
    monthly: { status: 'ok', percent: 52, resetsAt: '2026-10-21T07:41:16.000Z' },
  },
}

/** JSON Response helper for the mocked global fetch. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseUsageBody', () => {
  it('maps the three windows and derives resetInSec from resetsAt', () => {
    const parsed = parseUsageBody(OK_BODY, NOW)
    expect(parsed).toBeDefined()
    expect(parsed?.rolling).toEqual({
      kind: 'rolling',
      percent: 10,
      resetInSec: 2 * 3600 + 28 * 60 + 2,
      status: 'ok',
    })
    expect(parsed?.weekly?.percent).toBe(4)
    expect(parsed?.monthly?.percent).toBe(52)
  })

  it('ignores unknown keys so a grown API keeps working', () => {
    const parsed = parseUsageBody(
      { usage: { ...OK_BODY.usage, daily: { status: 'ok', percent: 1, resetsAt: '' }, extra: 7 } },
      NOW,
    )
    expect(Object.keys(parsed ?? {}).sort()).toEqual(['monthly', 'rolling', 'weekly'])
  })

  it('tolerates a partial body (only some windows present)', () => {
    const parsed = parseUsageBody({ usage: { weekly: OK_BODY.usage.weekly } }, NOW)
    expect(parsed?.weekly?.percent).toBe(4)
    expect(parsed?.rolling).toBeUndefined()
    expect(parsed?.monthly).toBeUndefined()
  })

  it('returns undefined when no window is recognizable', () => {
    expect(parseUsageBody({ usage: {} }, NOW)).toBeUndefined()
    expect(parseUsageBody({ usage: { rolling: { percent: 'ten' } } }, NOW)).toBeUndefined()
    expect(parseUsageBody({}, NOW)).toBeUndefined()
    expect(parseUsageBody(null, NOW)).toBeUndefined()
    expect(parseUsageBody({ usage: 'nope' }, NOW)).toBeUndefined()
  })

  it('treats a non-ok status as rate-limited', () => {
    const parsed = parseUsageBody(
      { usage: { rolling: { status: 'rate_limited', percent: 100, resetsAt: '' } } },
      NOW,
    )
    expect(parsed?.rolling?.status).toBe('rate-limited')
  })

  it('treats a reported 100% as rate-limited even when status still says ok', () => {
    const parsed = parseUsageBody(
      { usage: { rolling: { status: 'ok', percent: 100, resetsAt: '' } } },
      NOW,
    )
    expect(parsed?.rolling?.status).toBe('rate-limited')
  })

  it('clamps out-of-range percentages', () => {
    const parsed = parseUsageBody(
      {
        usage: {
          rolling: { status: 'ok', percent: 250, resetsAt: '' },
          weekly: { status: 'ok', percent: -3, resetsAt: '' },
        },
      },
      NOW,
    )
    expect(parsed?.rolling?.percent).toBe(100)
    expect(parsed?.weekly?.percent).toBe(0)
  })
})

describe('parseResetInSec', () => {
  it('converts an ISO stamp into seconds from now', () => {
    expect(parseResetInSec('2026-09-28T19:00:00.000Z', NOW)).toBe(3600)
  })

  it('never returns a negative countdown for a stamp already past', () => {
    expect(parseResetInSec('2026-09-28T17:00:00.000Z', NOW)).toBe(0)
  })

  it('returns 0 for absent or unparseable stamps', () => {
    expect(parseResetInSec(undefined, NOW)).toBe(0)
    expect(parseResetInSec('', NOW)).toBe(0)
    expect(parseResetInSec('not-a-date', NOW)).toBe(0)
    expect(parseResetInSec(42, NOW)).toBe(0)
  })
})

describe('fetchViaApiKey', () => {
  it('calls the official quota endpoint with a Bearer API key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(OK_BODY))
    await fetchViaApiKey(CFG, NOW)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://opencode.ai/zen/go/v1/usage')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test-key')
    // The cookie/workspace shape must be gone entirely.
    expect(url).not.toContain('workspace')
    expect(init.headers).not.toHaveProperty('Cookie')
  })

  it('honours a custom base URL and tolerates a trailing slash', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(OK_BODY))
    await fetchViaApiKey({ ...CFG, baseUrl: 'https://example.test/' }, NOW)
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://example.test/zen/go/v1/usage')
  })

  it('throws noconfig without an API key, without calling the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(OK_BODY))
    await expect(fetchViaApiKey({ ...CFG, apiKey: undefined }, NOW)).rejects.toMatchObject({
      code: 'noconfig',
    })
    await expect(fetchViaApiKey({ ...CFG, apiKey: '   ' }, NOW)).rejects.toMatchObject({
      code: 'noconfig',
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('maps 401/403 to an apikey error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 401 }))
    const error = await fetchViaApiKey(CFG, NOW).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(UsageError)
    expect((error as UsageError).code).toBe('apikey')
  })

  it('maps other HTTP failures to http<status>', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }))
    await expect(fetchViaApiKey(CFG, NOW)).rejects.toMatchObject({ code: 'http500' })
  })

  it('maps a non-JSON body to a parse error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>sign in</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    )
    await expect(fetchViaApiKey(CFG, NOW)).rejects.toMatchObject({ code: 'parse' })
  })

  it('maps an empty usage object to an empty error rather than a silent success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ usage: {} }))
    await expect(fetchViaApiKey(CFG, NOW)).rejects.toMatchObject({ code: 'empty' })
  })

  it('maps an aborted request to a timeout error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' }),
    )
    await expect(fetchViaApiKey(CFG, NOW)).rejects.toMatchObject({ code: 'timeout' })
  })

  it('maps a transport failure to a fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(fetchViaApiKey(CFG, NOW)).rejects.toMatchObject({ code: 'fetch' })
  })
})

describe('fetchUsage', () => {
  it('stamps updatedAt on the parsed windows', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(OK_BODY))
    const data = await fetchUsage(CFG)
    expect(data.updatedAt).toBeTypeOf('number')
    expect(data.rolling?.percent).toBe(10)
    expect(data.weekly?.percent).toBe(4)
    expect(data.monthly?.percent).toBe(52)
  })
})
