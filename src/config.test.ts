/**
 * Unit tests for the configuration loader.
 * @module dsh-ocgo-usage/config.test
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_BASE_URL,
  DEFAULT_CACHE_TTL,
  DEFAULT_TIMEOUT_MS,
  ENV_API_KEY,
  ENV_BASE_URL,
  ENV_CACHE_TTL,
  ENV_TIMEOUT_MS,
  MAX_CACHE_TTL,
  MIN_CACHE_TTL,
  USAGE_PATH,
  configFilePath,
  loadConfig,
  maskSecret,
  maskedConfigView,
  normalizeApiKey,
  usageEndpoint,
  writeConfigFile,
} from './config.ts'

const ENV_KEYS = [ENV_API_KEY, ENV_BASE_URL, ENV_CACHE_TTL, ENV_TIMEOUT_MS, 'DSH_HOME']

/** Clear every env var the config reads, remembering the previous values. */
function clearEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {}
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  return saved
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
}

describe('normalizeApiKey', () => {
  it('passes a bare key through unchanged', () => {
    expect(normalizeApiKey('sk-abc123')).toBe('sk-abc123')
  })

  it('strips surrounding whitespace and newlines', () => {
    expect(normalizeApiKey('  sk-abc123 \n')).toBe('sk-abc123')
  })

  it('strips a pasted Authorization header value', () => {
    expect(normalizeApiKey('Bearer sk-abc123')).toBe('sk-abc123')
    expect(normalizeApiKey('bearer   sk-abc123')).toBe('sk-abc123')
  })

  it('strips surrounding quotes', () => {
    expect(normalizeApiKey('"sk-abc123"')).toBe('sk-abc123')
    expect(normalizeApiKey("'sk-abc123'")).toBe('sk-abc123')
  })

  it('returns undefined for empty input', () => {
    expect(normalizeApiKey(undefined)).toBeUndefined()
    expect(normalizeApiKey('')).toBeUndefined()
    expect(normalizeApiKey('   ')).toBeUndefined()
    expect(normalizeApiKey('Bearer ')).toBeUndefined()
  })
})

describe('loadConfig', () => {
  let tmp: string
  let saved: Record<string, string | undefined>

  beforeEach(() => {
    saved = clearEnv()
    tmp = mkdtempSync(join(tmpdir(), 'dsh-ocgo-usage-cfg-'))
    process.env.DSH_HOME = tmp
  })

  afterEach(() => {
    restoreEnv(saved)
    rmSync(tmp, { recursive: true, force: true })
  })

  it('falls back to the defaults when nothing is configured', () => {
    const cfg = loadConfig()
    expect(cfg.apiKey).toBeUndefined()
    expect(cfg.baseUrl).toBe(DEFAULT_BASE_URL)
    expect(cfg.cacheTTL).toBe(DEFAULT_CACHE_TTL)
    expect(cfg.timeoutMs).toBe(DEFAULT_TIMEOUT_MS)
  })

  it('reads the API key from the environment', () => {
    process.env[ENV_API_KEY] = '  sk-from-env  '
    expect(loadConfig().apiKey).toBe('sk-from-env')
  })

  it('reads the API key from the config file', () => {
    writeFileSync(configFilePath(), JSON.stringify({ apiKey: 'sk-from-file' }))
    expect(loadConfig().apiKey).toBe('sk-from-file')
  })

  it('lets the environment win over the config file', () => {
    writeFileSync(
      configFilePath(),
      JSON.stringify({ apiKey: 'sk-from-file', baseUrl: 'https://file.test' }),
    )
    process.env[ENV_API_KEY] = 'sk-from-env'
    const cfg = loadConfig()
    expect(cfg.apiKey).toBe('sk-from-env')
    // baseUrl has no env override here, so the file still applies.
    expect(cfg.baseUrl).toBe('https://file.test')
  })

  it('clamps the cache TTL into [MIN, MAX]', () => {
    process.env[ENV_CACHE_TTL] = '5'
    expect(loadConfig().cacheTTL).toBe(MIN_CACHE_TTL)
    process.env[ENV_CACHE_TTL] = '999999'
    expect(loadConfig().cacheTTL).toBe(MAX_CACHE_TTL)
    process.env[ENV_CACHE_TTL] = '120'
    expect(loadConfig().cacheTTL).toBe(120)
  })

  it('ignores a corrupt config file instead of throwing', () => {
    writeFileSync(configFilePath(), '{ not json')
    expect(() => loadConfig()).not.toThrow()
    expect(loadConfig().apiKey).toBeUndefined()
  })

  it('builds the official quota endpoint from the base URL', () => {
    expect(usageEndpoint(loadConfig())).toBe(`${DEFAULT_BASE_URL}${USAGE_PATH}`)
    expect(usageEndpoint({ ...loadConfig(), baseUrl: 'https://x.test/' })).toBe(
      `https://x.test${USAGE_PATH}`,
    )
  })
})

describe('maskSecret', () => {
  it('keeps only the last 4 characters', () => {
    expect(maskSecret('sk-abcdefgh')).toEqual({ set: true, tail: 'efgh' })
  })

  it('reports unset for undefined or empty values', () => {
    expect(maskSecret(undefined)).toEqual({ set: false, tail: '' })
    expect(maskSecret('')).toEqual({ set: false, tail: '' })
  })
})

describe('maskedConfigView / writeConfigFile', () => {
  let tmp: string
  let saved: Record<string, string | undefined>

  beforeEach(() => {
    saved = clearEnv()
    tmp = mkdtempSync(join(tmpdir(), 'dsh-ocgo-usage-cfg-'))
    process.env.DSH_HOME = tmp
  })

  afterEach(() => {
    restoreEnv(saved)
    rmSync(tmp, { recursive: true, force: true })
  })

  it('never exposes the full API key to the browser view', () => {
    // Deliberately synthetic. Never paste a real key into a fixture: this file
    // is published, and a live credential in a test is a permanent leak.
    const key = 'sk-TESTONLY-000000000000000000000000000000000000000000000000000000000'
    process.env[ENV_API_KEY] = key
    const view = maskedConfigView()
    expect(view.apiKey).toEqual({ set: true, tail: key.slice(-4) })
    expect(JSON.stringify(view)).not.toContain('TESTONLY')
  })

  it('writes a new key to the config file and returns the masked view', () => {
    const view = writeConfigFile({ apiKey: 'Bearer sk-written-key-9abc' })
    // The written value is normalized: the Bearer prefix is stripped.
    expect(view.apiKey).toEqual({ set: true, tail: '9abc' })
    const raw = JSON.parse(readFileSync(configFilePath(), 'utf8')) as Record<string, unknown>
    expect(raw.apiKey).toBe('sk-written-key-9abc')
    expect(loadConfig().apiKey).toBe('sk-written-key-9abc')
  })

  it('clears the key when passed null', () => {
    writeConfigFile({ apiKey: 'sk-old' })
    const view = writeConfigFile({ apiKey: null })
    expect(view.apiKey).toEqual({ set: false, tail: '' })
    const raw = JSON.parse(readFileSync(configFilePath(), 'utf8')) as Record<string, unknown>
    expect(raw.apiKey).toBeUndefined()
  })

  it('preserves unrelated fields already in the config file', () => {
    writeFileSync(configFilePath(), JSON.stringify({ apiKey: 'sk-old', baseUrl: 'https://keep.test' }))
    writeConfigFile({ apiKey: 'sk-new' })
    const raw = JSON.parse(readFileSync(configFilePath(), 'utf8')) as Record<string, unknown>
    expect(raw.baseUrl).toBe('https://keep.test')
    expect(raw.apiKey).toBe('sk-new')
  })
})
