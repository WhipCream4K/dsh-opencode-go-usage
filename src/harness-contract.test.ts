/**
 * Harness contract tests.
 *
 * These do not test this package's behavior; they test the assumptions the
 * package makes about the DSH release it is installed into. Everything is read
 * from the packages actually present in `node_modules`, so running them after a
 * DSH bump answers one question: does this plugin still match the shell it will
 * be loaded by?
 *
 * On DSH 0.2.0-rc.2 the answer used to be no — `@deepseek-ai/dsh-client-runtime`
 * was deleted, and nothing failed until the browser asked the module table for
 * it. The checks below exist so that failure lands in `pnpm test` instead: a
 * moved slot, a renamed service, a dropped export, or a client bundle that
 * requires a module the shell no longer seeds all fail here by name.
 *
 * Fixing a failure is a port, not a test edit: adapt `src/client/` and, when
 * the shell's seed table moved, refresh `shared/web-platform.ts` from
 * `packages/client/web/src/platform.ts` in the DSH checkout.
 * @module dsh-ocgo-usage/harness-contract.test
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CLIENT_EXTERNALS } from '../shared/tsdown.client.ts'
import { PLATFORM_MODULES } from '../shared/web-platform.ts'
import { name as HOST_PLUGIN_NAME } from './index.ts'

const require = createRequire(import.meta.url)
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** The client bundle's entry, the root of the walk below. */
const CLIENT_ENTRY = join(PROJECT_ROOT, 'src', 'client', 'index.ts')

/**
 * Packages DSH 0.2.0-rc.2 removed. Importing any of them again is the exact
 * regression this suite was written for, so it gets a named check rather than
 * only the generic graph walk.
 */
const REMOVED_IN_RC2 = [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-web-react',
]

/** Read and parse a JSON file. */
function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

/** The installed directory of one harness package. */
function packageDir(name: string): string {
  return dirname(require.resolve(`${name}/package.json`))
}

/** The `dsh` block of an installed package manifest. */
function dshManifest(name: string): { client?: { platform?: string; inject?: string[] } } {
  return readJson<{ dsh?: { client?: { platform?: string; inject?: string[] } } }>(
    join(packageDir(name), 'package.json'),
  ).dsh ?? {}
}

/** Every emitted `.d.ts` under a package's `lib/types` tree, concatenated. */
function clientDeclarations(name: string): string {
  const pkgDir = packageDir(name)
  const typesRoot = join(pkgDir, 'lib', 'types')
  expect(existsSync(typesRoot), `${name} emits no lib/types tree (packaging layout changed?)`).toBe(true)
  const collected: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (entry.endsWith('.d.ts')) collected.push(readFileSync(full, 'utf8'))
    }
  }
  walk(typesRoot)
  return collected.join('\n')
}

/** Resolve one relative import to a source file, or undefined for non-code assets. */
function resolveRelative(spec: string, importer: string): string | undefined {
  const base = resolve(dirname(importer), spec)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return undefined
}

/** Every module specifier an import/export statement in one file names. */
function specifiersOf(source: string): string[] {
  const found: string[] = []
  const patterns = [
    /(?:^|\n)\s*import\s+(?:type\s+)?[^'"\n]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s+(?:type\s+)?[^'"\n]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1] !== undefined) found.push(match[1])
    }
  }
  return found
}

/** Walk the client bundle's module graph from its entry, collecting bare specifiers. */
function clientModuleGraph(entry: string): { files: string[]; bare: Map<string, string> } {
  const files: string[] = []
  const bare = new Map<string, string>()
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file) || extname(file) === '.css') continue
    seen.add(file)
    files.push(file)
    for (const spec of specifiersOf(readFileSync(file, 'utf8'))) {
      if (spec.startsWith('.')) {
        const resolved = resolveRelative(spec, file)
        if (resolved !== undefined) queue.push(resolved)
        continue
      }
      if (!bare.has(spec)) bare.set(spec, file)
    }
  }
  return { files, bare }
}

/** The package part of a module specifier (`@scope/name/sub` -> `@scope/name`). */
function packageOf(spec: string): string {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] as string)
}

const PROJECT_MANIFEST = readJson<{
  dsh: { client: { inject: string[]; platform: string } }
  peerDependencies: Record<string, string>
  devDependencies: Record<string, string>
}>(join(PROJECT_ROOT, 'package.json'))

const DECLARED_CLIENT_EDGES = PROJECT_MANIFEST.dsh.client.inject

/** The client bundle's source module graph, walked once for every check below. */
const CLIENT_GRAPH = clientModuleGraph(CLIENT_ENTRY)

describe('client entry edges', () => {
  it('names a platform for the browser half', () => {
    expect(PROJECT_MANIFEST.dsh.client.platform).toBe('web')
  })

  it.each(DECLARED_CLIENT_EDGES)('%s is an installed, loadable client row', (name) => {
    const pkg = readJson<{ exports?: Record<string, unknown> }>(join(packageDir(name), 'package.json'))
    expect(dshManifest(name).client?.platform).toBe('web')
    // `dsh.client` without a `./client` export is rejected by the host's
    // client-module scan, so the edge would never materialize.
    expect(pkg.exports?.['./client']).toBeDefined()
  })

  it('declares every declared edge as a development input', () => {
    for (const name of DECLARED_CLIENT_EDGES) {
      expect(PROJECT_MANIFEST.devDependencies[name], `${name} is an undeclared client edge`).toBeDefined()
    }
  })
})

describe('client module graph', () => {
  const allowed = new Set<string>([...PLATFORM_MODULES, ...DECLARED_CLIENT_EDGES])

  it('reaches the sources it is supposed to', () => {
    expect(CLIENT_GRAPH.files).toContain(join(PROJECT_ROOT, 'src', 'client', 'harness-compat.ts'))
    expect(CLIENT_GRAPH.files).toContain(join(PROJECT_ROOT, 'src', 'client', 'OcgoDockEntry.tsx'))
    expect(CLIENT_GRAPH.files).toContain(join(PROJECT_ROOT, 'src', 'provider.ts'))
  })

  it('imports only shell-seeded modules and its own declared client edges', () => {
    const offenders = [...CLIENT_GRAPH.bare.entries()]
      .filter(([spec]) => !allowed.has(spec) && !allowed.has(packageOf(spec)))
      .map(([spec, importer]) => `${spec} (from ${importer.slice(PROJECT_ROOT.length + 1)})`)
    expect(offenders, 'the shell cannot answer this require — declare it in dsh.client.inject, '
      + 'or move the import behind a type-only edge').toEqual([])
  })

  it('does not import a module DSH removed in 0.2.0-rc.2', () => {
    const offenders = [...CLIENT_GRAPH.bare.keys()].filter((spec) => REMOVED_IN_RC2.includes(packageOf(spec)))
    expect(offenders).toEqual([])
  })

  it('keeps the declared client edges free of removed modules', () => {
    for (const name of DECLARED_CLIENT_EDGES) expect(REMOVED_IN_RC2).not.toContain(name)
  })
})

describe('client service contracts', () => {
  it('ui-conversation declares conversation.input.right as an addable session row', () => {
    const declarations = clientDeclarations('@deepseek-ai/dsh-client-ui-conversation')
    const entry = declarations.match(/'conversation\.input\.right':\s*\{([^}]*)\}/)
    expect(entry, 'the composer tool row was renamed or removed').not.toBeNull()
    const body = entry?.[1] ?? ''
    // The plugin registers a list cell; a 'single' slot would shadow the row
    // and a non-session scope would not supply the dock's session id.
    expect(body).toMatch(/kind:\s*'list'/)
    expect(body).toMatch(/scope:\s*'session'/)
  })

  it('ui-renderer provides the slots service with inject() and register()', () => {
    const declarations = clientDeclarations('@deepseek-ai/dsh-client-ui-renderer')
    expect(declarations).toMatch(/slots:\s*SlotRegistry/)
    expect(declarations, 'SlotRegistry.inject (the deferred arming path) is gone').toMatch(/inject\(key:/)
    expect(declarations).toMatch(/register: SlotCore\['register'\]/)
  })

  it('ui-slots still owns the SlotMap and the composed-props aliases', () => {
    const declarations = clientDeclarations('@deepseek-ai/dsh-client-ui-slots')
    for (const name of ['interface SlotMap', 'interface LocaleNamespaceMap', 'type PropsRuntime', 'type PropsLocale']) {
      expect(declarations, `ui-slots no longer declares ${name}`).toContain(name)
    }
  })

  it('locale provides the locale service with a dictionary register()', () => {
    const declarations = clientDeclarations('@deepseek-ai/dsh-client-locale')
    expect(declarations).toMatch(/locale:\s*LocaleRuntime/)
    // The typed two-argument form: dictionaries checked against the merged
    // namespace key union, which is what the chip's `ocgo` namespace relies on.
    expect(declarations).toMatch(/register<N extends [\s\S]*?>\(ns: N, dicts: Record<BuiltInLocaleId, LocaleDictOf<N>>\)/)
  })

  it('session-controller provides sessions.binding() and the modelSelection projection', () => {
    const declarations = clientDeclarations('@deepseek-ai/dsh-api-session-controller')
    expect(declarations).toMatch(/sessions:\s*import\([^)]*\)\.ISessions/)
    expect(declarations, 'sessions.binding(id) is the chip\'s provider read').toMatch(/binding\(id:\s*SessionId\)/)
    expect(declarations, 'the modelSelection projection face is gone').toMatch(/faceOf\(key:\s*string\)/)
  })
})

describe('host contracts', () => {
  it('webserver still declares the exact-path WebRoute the plugin registers', () => {
    const declarations = readFileSync(
      join(packageDir('@deepseek-ai/dsh-host-webserver'), 'lib', 'types', 'index.d.ts'),
      'utf8',
    )
    expect(declarations).toMatch(/type WebRouteKind = 'exact' \| 'prefix'/)
    expect(declarations).toMatch(/interface WebRoute \{[\s\S]*?kind: WebRouteKind/)
    expect(declarations).toMatch(/interface WebRoute \{[\s\S]*?path: string/)
    expect(declarations).toMatch(/interface WebRoute \{[\s\S]*?handler: \(req: IncomingMessage, res: ServerResponse\)/)
    expect(declarations).toMatch(/register\(route: WebRoute\): \(\) => void/)
  })
})

describe('built artifacts', () => {
  const clientBundle = join(PROJECT_ROOT, 'lib', 'client.js')
  const hostBundle = join(PROJECT_ROOT, 'lib', 'index.js')

  it('has a build to inspect', () => {
    // `lib/` is committed, so a missing artifact means a broken build, not a
    // clean tree.
    expect(existsSync(clientBundle), 'lib/client.js is missing — run `pnpm run build`').toBe(true)
    expect(existsSync(hostBundle)).toBe(true)
  })

  it('is newer than the sources it was built from', () => {
    // A stale bundle is what makes the checks below report a phantom module
    // request; name the real problem first.
    const newestSource = Math.max(...CLIENT_GRAPH.files.map((file) => statSync(file).mtimeMs))
    expect(statSync(clientBundle).mtimeMs,
      'lib/ is stale — run `pnpm run build` (or `pnpm run verify`) before testing').toBeGreaterThan(newestSource)
  })

  it('emits the module-loader closure factory the shell expects', () => {
    const bundle = readFileSync(clientBundle, 'utf8')
    // Rolldown reflows the banner, so assert the handoff fields rather than
    // the exact text the preset writes.
    const head = bundle.slice(0, 200)
    expect(head).toMatch(/^window\.__ModuleLoader__\.load\(\{/)
    expect(head).toMatch(/id:\s*"dsh-ocgo-usage"/)
    expect(head).toMatch(/factory:\s*\(require\)\s*=>\s*\{/)
    // The sourcemap comment trails the footer, so strip it before reading the
    // closing of the closure factory.
    const body = bundle.replace(/\/\/# sourceMappingURL=\S+\s*$/, '').trimEnd()
    expect(body).toMatch(/return module\.exports;\s*\}\s*\}\);$/)
  })

  it('requires only modules the shell seeds into the frozen module table', () => {
    const bundle = readFileSync(clientBundle, 'utf8')
    const required = new Set(
      [...bundle.matchAll(/require\((\s*)"([^"]+)"\s*\)/g)].map((match) => match[2] as string),
    )
    const offenders = [...required].filter((spec) => !CLIENT_EXTERNALS.includes(spec))
    expect(offenders, 'the client bundle requests a module the shell does not carry — add it to '
      + 'shared/web-platform.ts from the DSH checkout, or stop importing it').toEqual([])
    // A sanity floor: the bundle must actually ask for React, or the banner
    // parsed nothing and this check is vacuous.
    expect(required.has('react/jsx-runtime')).toBe(true)
  })

  it('keeps the host bundle free of undeclared runtime imports', () => {
    const bundle = readFileSync(hostBundle, 'utf8')
    const required = [...bundle.matchAll(/from\s*"([^"]+)"/g)].map((match) => match[1] as string)
    const external = new Set(['node:http', 'node:fs', 'node:os', 'node:path', '@deepseek-ai/cordis'])
    const offenders = required.filter((spec) => spec.startsWith('@deepseek-ai/') && !external.has(spec))
    expect(offenders).toEqual([])
  })
})

describe('package layout', () => {
  const MANIFEST = readJson<{
    name: string
    exports: Record<string, unknown>
    files: string[]
    dsh: { bundle: { patch: string } }
  }>(join(PROJECT_ROOT, 'package.json'))

  it('publishes both halves and the bundle patch', () => {
    expect(MANIFEST.exports['.']).toBeDefined()
    expect(MANIFEST.exports['./client']).toBeDefined()
    expect(MANIFEST.files).toContain('cordis.patch.yml')
    expect(MANIFEST.files).toContain('src')
  })

  it('points dsh.bundle.patch at a patch file that ships', () => {
    const relative = MANIFEST.dsh.bundle.patch
    expect(existsSync(join(PROJECT_ROOT, relative)), `dsh.bundle.patch -> ${relative} is missing`).toBe(true)
    // `bundles.patch` is resolved relative to the package root, so an entry
    // outside `files` would vanish from the published tarball.
    expect(MANIFEST.files.some((entry) => relative.includes(entry))).toBe(true)
  })

  it('inserts the row under the names the halves export', () => {
    const patch = readFileSync(join(PROJECT_ROOT, MANIFEST.dsh.bundle.patch), 'utf8')
    // The insert id must equal the host half's exported plugin name, or the
    // Loader mounts the row under a name nothing else refers to.
    expect(patch).toMatch(new RegExp(`id:\\s*${HOST_PLUGIN_NAME}\\b`))
    // The row's module specifier is the package name the profile resolves.
    expect(patch).toMatch(new RegExp(`name:\\s*'?${MANIFEST.name}'?`))
  })
})
