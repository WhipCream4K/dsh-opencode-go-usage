/**
 * Wiring tests for the host half: the plugin mounted through a live cordis
 * context whose `webServer` service is a double, plus the JSON routes it
 * registers.
 *
 * These cover what the service unit tests cannot: that the plugin asks for
 * `webServer`, that every route it advertises is reachable at the documented
 * path, that the handlers answer the shapes the browser half parses, and that
 * unloading the plugin removes the routes (the HMR-safety property every
 * registry contribution owes).
 * @module dsh-ocgo-usage/index.test
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ENV_API_KEY } from './config.ts'
import { apply, inject as pluginInject, name as pluginName } from './index.ts'

const SAVED_KEY = process.env[ENV_API_KEY]

/** The live `/zen/go/v1/usage` response body. */
const OK_BODY = {
  usage: {
    rolling: { status: 'ok', percent: 10, resetsAt: '2099-09-28T20:28:02.440Z' },
    weekly: { status: 'ok', percent: 4, resetsAt: '2099-10-05T00:00:00.000Z' },
    monthly: { status: 'ok', percent: 52, resetsAt: '2099-10-21T07:41:16.000Z' },
  },
}

/** A `webServer` service double recording what the plugin registers. */
function fakeWebServer() {
  const routes = new Map<string, WebRoute>()
  const registered = new Set<string>()
  return {
    routes,
    registered,
    face: {
      register(route: WebRoute): () => void {
        routes.set(route.path, route)
        registered.add(route.path)
        return () => {
          routes.delete(route.path)
        }
      },
    },
  }
}

/** A minimal `ServerResponse` double capturing what a handler writes. */
function fakeResponse() {
  const captured = { status: 0, body: '', headers: {} as Record<string, string> }
  const res = {
    writeHead(status: number, headers?: Record<string, string>): void {
      captured.status = status
      captured.headers = headers ?? {}
    },
    end(body?: string): void {
      captured.body = body ?? ''
    },
  }
  return { captured, res: res as unknown as ServerResponse }
}

/** Drive one registered route with a method. */
async function call(routes: Map<string, WebRoute>, path: string, method = 'GET') {
  const route = routes.get(path)
  if (route === undefined) throw new Error(`${path} was not registered`)
  const { captured, res } = fakeResponse()
  // The handler answers asynchronously and returns void, so the response is
  // only complete once its promise chain has run.
  await route.handler({ method } as IncomingMessage, res)
  await settle()
  return { status: captured.status, body: captured.body }
}

/** Decode a route answer as JSON. */
async function json(routes: Map<string, WebRoute>, path: string, method = 'GET') {
  const { status, body } = await call(routes, path, method)
  return { status, body: JSON.parse(body) as Record<string, unknown> }
}

/** Mount the host half as a cordis plugin, as the Loader does. */
function mount() {
  const web = fakeWebServer()
  const ctx = new Context()
  ;(ctx as unknown as { provide(name: string, value?: unknown): unknown }).provide('webServer', web.face)
  const fiber = ctx.plugin({ name: pluginName, inject: pluginInject, apply })
  return { ctx, web, fiber }
}

/** Let a plugin fiber settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  process.env[ENV_API_KEY] = 'sk-host-test'
})

afterEach(() => {
  vi.restoreAllMocks()
  if (SAVED_KEY === undefined) delete process.env[ENV_API_KEY]
  else process.env[ENV_API_KEY] = SAVED_KEY
})

describe('host apply', () => {
  it('declares the service it needs and the loader name the patch inserts', () => {
    expect(pluginInject).toEqual(['webServer'])
    expect(pluginName).toBe('ocgo-usage')
  })

  it('registers the browser-facing JSON endpoints as exact paths', async () => {
    const { web } = mount()
    await settle()
    expect([...web.routes.keys()].sort()).toEqual([
      '/api/ocgo-usage',
      '/api/ocgo-usage/config',
      '/api/ocgo-usage/refresh',
    ])
    for (const route of web.routes.values()) expect(route.kind).toBe('exact')
  })

  it('provides the ctx.ocgoUsage service the routes read through', async () => {
    const { ctx } = mount()
    await settle()
    const service = (ctx as unknown as { ocgoUsage?: { isEnabled(): boolean } }).ocgoUsage
    expect(service?.isEnabled()).toBe(true)
  })

  it('answers the usage snapshot the chip polls', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(OK_BODY), { status: 200 }),
    )
    const { web } = mount()
    await settle()
    const { status, body } = await json(web.routes, '/api/ocgo-usage')
    expect(status).toBe(200)
    expect(body).toMatchObject({
      rolling: { kind: 'rolling', percent: 10 },
      weekly: { percent: 4 },
      monthly: { percent: 52 },
    })
  })

  it('answers the refresh endpoint with a fresh provider read', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(OK_BODY), { status: 200 }),
    )
    const { web } = mount()
    await settle()
    await json(web.routes, '/api/ocgo-usage')
    await json(web.routes, '/api/ocgo-usage/refresh')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('answers the config view masked, never the key', async () => {
    const { web } = mount()
    await settle()
    const { status, body } = await json(web.routes, '/api/ocgo-usage/config')
    expect(status).toBe(200)
    expect(body).toEqual({ apiKey: { set: true, tail: 'test' } })
    expect(JSON.stringify(body)).not.toContain('sk-host-test')
  })

  it('rejects an unsupported method with 405', async () => {
    const { web } = mount()
    await settle()
    const { status, body } = await json(web.routes, '/api/ocgo-usage', 'POST')
    expect(status).toBe(405)
    expect(body).toEqual({ ok: false, error: 'method-not-allowed' })
  })

  it('reports a missing key as a noconfig snapshot instead of a transport error', async () => {
    delete process.env[ENV_API_KEY]
    const { web } = mount()
    await settle()
    const { status, body } = await json(web.routes, '/api/ocgo-usage')
    expect(status).toBe(200)
    expect(body.error).toBe('noconfig')
  })

  it('removes every route when the plugin unloads', async () => {
    const { web, fiber } = mount()
    await settle()
    expect(web.routes.size).toBe(3)
    await fiber.dispose()
    await settle()
    expect(web.routes.size).toBe(0)
    // Disposal must remove the exact paths it added, not merely empty a map.
    expect([...web.registered].sort()).toEqual([
      '/api/ocgo-usage',
      '/api/ocgo-usage/config',
      '/api/ocgo-usage/refresh',
    ])
  })
})
