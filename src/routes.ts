/**
 * dsh-ocgo-usage HTTP routes — the browser half talks to the host through
 * plain same-origin JSON endpoints (`/api/ocgo-usage`, `/api/ocgo-usage/refresh`
 * and the config editor `/api/ocgo-usage/config`), which the host answers from
 * the cached OpenCode Go usage read. The client never sees the API key — the
 * config editor serves only a masked tail and accepts a new key to write.
 * @module dsh-ocgo-usage/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { normalizeApiKey } from './config.ts'
import type { OcgoUsageService, OcgoUsageView } from './service.ts'
import type { MaskedConfigView } from './types.ts'

/** Browser-facing base path of the usage API. */
export const OCGO_API_PREFIX = '/api/ocgo-usage'

/** Write one JSON response. */
function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** Require the method or answer 405. */
function requireMethod(req: IncomingMessage, res: ServerResponse, method: string): boolean {
  if (req.method === method) return true
  json(res, 405, { ok: false, error: 'method-not-allowed' })
  return false
}

/** Read a bounded JSON request body. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 64 * 1024) {
        reject(new Error('body-too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (raw.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw) as unknown)
      } catch {
        reject(new Error('bad-json'))
      }
    })
    req.on('error', reject)
  })
}

/** Wrap one async usage read as a GET JSON route. */
function getRoute(path: string, run: () => Promise<OcgoUsageView>): WebRoute {
  return {
    kind: 'exact',
    path,
    handler: (req: IncomingMessage, res: ServerResponse): void => {
      if (!requireMethod(req, res, 'GET')) return
      Promise.resolve(run()).then((value) => json(res, 200, value), (error) => {
        json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      })
    },
  }
}

/**
 * The config editor routes: GET the masked view, POST a new key to write.
 * The write goes through the service so it lands in the credential seam (the
 * store the `opencode-go` model provider reads) rather than in a shadowed
 * local file, and the usage cache is invalidated so the next poll re-queries
 * with the fresh key immediately.
 */
function makeConfigRoutes(service: OcgoUsageService): WebRoute[] {
  const read = (): Promise<MaskedConfigView> => service.configView()
  const write = async (req: IncomingMessage): Promise<MaskedConfigView> => {
    const body = (await readJsonBody(req)) as { apiKey?: unknown }
    // Only keys PRESENT in the body are touched: an absent `apiKey` keeps the
    // current one, while an explicit empty value clears it.
    if ('apiKey' in body) {
      const raw = typeof body.apiKey === 'string' ? body.apiKey : ''
      await service.setApiKey(normalizeApiKey(raw) ?? null)
    }
    return service.configView()
  }
  return [
    {
      kind: 'exact',
      path: `${OCGO_API_PREFIX}/config`,
      handler: (req: IncomingMessage, res: ServerResponse): void => {
        if (req.method === 'GET') {
          Promise.resolve(read()).then((value) => json(res, 200, value), (error) => {
            json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
          })
          return
        }
        if (req.method === 'POST') {
          Promise.resolve(write(req)).then((value) => json(res, 200, value), (error) => {
            json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          })
          return
        }
        json(res, 405, { ok: false, error: 'method-not-allowed' })
      },
    },
  ]
}

/** Build the full usage API route family for one service. */
export function makeOcgoRoutes(service: OcgoUsageService): WebRoute[] {
  return [
    getRoute(OCGO_API_PREFIX, () => service.view()),
    getRoute(`${OCGO_API_PREFIX}/refresh`, () => service.refresh()),
    ...makeConfigRoutes(service),
  ]
}
