/**
 * Shared browser platform modules. Seeding, bundling externals, and Vite
 * aliases consume this list so their module identities cannot drift.
 * Copied verbatim from the DSH shell's seed table (`PLATFORM_MODULES`) for the
 * 0.2.0-rc.2 web shell. `@deepseek-ai/dsh-client-ui-dockkit` is a shell-internal
 * dependency served by the frontend bundle, so it is a seed word here only —
 * never an installable peer of this plugin.
 *
 * Refresh procedure on a DSH bump: copy `PLATFORM_MODULES` (and
 * `PRELOADED_CLIENT_EXTERNALS`, empty in 0.2.0-rc.2) out of
 * `packages/client/web/src/platform.ts` in the DSH checkout, then run
 * `pnpm run verify` — `src/harness-contract.test.ts` fails if the client bundle
 * requires a module this table does not carry.
 * @module dsh-ocgo-usage/web-platform
 */

/** The module specifiers the shell shares into the frozen module table. */
export const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
] as const

/** One platform module specifier (a seed-table key). */
export type PlatformModule = (typeof PLATFORM_MODULES)[number]
