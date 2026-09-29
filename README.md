# dsh-opencode-go-usage

[![npm](https://img.shields.io/npm/v/dsh-ocgo-usage)](https://www.npmjs.com/package/dsh-ocgo-usage)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

![The usage chip in the composer tool row](assets/custom-footer.png)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) **bundle** that shows [OpenCode Go](https://opencode.ai/docs/go/) subscription usage in the Web GUI's composer tool row, next to the model selector.

The Web counterpart of the [pi-ocgo-usage](https://github.com/v587d/pi-ocgo-usage) Pi extension: three usage windows (rolling 5h, weekly, monthly) with percentages and reset countdowns, colour-coded so you see a window approaching exhaustion before you hit the rate limit mid-work.

Collapsed, the chip is a compact strip:

```
[ OCGo ]  · 5h 10%  · wk 4%  · mo 52%  ⌄
```

Expanded, each window gets its own row:

```
5h Rolling        10%   resets in 2h 28m
Weekly             4%   resets in 6d 5h
Monthly           52%   resets in 22d 8h
Set                    Refresh   upd 20:15
```

> **An API key is all it takes.** The plugin reads the official quota endpoint
> `GET https://opencode.ai/zen/go/v1/usage`, authenticated with
> `Authorization: Bearer <OPENCODE_GO_API_KEY>` — the same key the `opencode-go`
> model provider already uses. **No workspace id and no browser session cookie.**

## Features

- **Three windows** — rolling (5h) / weekly / monthly percent plus a reset countdown derived from the API's `resetsAt` stamps
- **Colour thresholds** — the percentage starts shading at 50%, deepens through amber at 60/70%, turns red at ≥80%, and is bold red at ≥90% or when the window is rate-limited
- **Data freshness** — `upd HH:MM` shows the last successful fetch time
- **Lightweight polling** — every 10 s and on tab refocus; the host caches for 300 s (configurable TTL) with a 60 s failure cooldown, so opencode.ai is never hammered
- **Provider-aware** — the chip shows only while the session's current model routes through the `opencode-go` provider. Visibility reads the live in-memory selection (the session's `modelSelection` projection, no network request) on every poll, so switching to e.g. DeepSeek official via `/model` hides it within one 10 s cycle and switching back re-shows it
- **Click to expand** — a detail panel with per-window reset countdowns, a `Set` credential editor, and `refresh upd HH:MM`
- **Built-in credential editor** — no terminal needed: the `Set` panel writes the API key straight into DSH's credential store (the one the model provider itself reads), so the write takes effect immediately with no restart. A configured key is signalled by the field's placeholder rather than by echoing any characters
- **Graceful degradation** — missing config shows `<err:noconfig>`, a rejected key `<err:apikey>`; on error, clicking the chip opens the Set editor directly
- **API key stays on the host** — the browser only ever talks to the same-origin `/api/ocgo-usage` JSON endpoint; the key never reaches the page
- **Bilingual UI copy** — the detail panel, tooltips, buttons, and error text come from typed `zh`/`en` dictionaries registered with DSH's locale service. The collapsed chip keeps the language-neutral compact `5h` / `wk` / `mo` abbreviations, and the API returns JSON, so the numbers read the same in either language

## Requirements

- DeepSeek Harness (web profile) whose client exposes the session `modelSelection` projection — **verified on `0.2.0-rc.2`**
- pnpm on `PATH` (for `dsh plugin`)

## Installation

This package is a standard dsh **bundle**: it declares `dsh.bundle` in its manifest and installs through `dsh plugin --profile web add <spec>` (a pnpm forwarder), which links the package and appends it to the profile's `dsh.profile.bundles`. The repo ships pre-built `lib/` artifacts, so **no build step or install-time build permission is needed** — this follows the official [publish guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md).

### From GitHub (recommended)

```sh
dsh plugin --profile web add github:WhipCream4K/dsh-opencode-go-usage
```

Because `lib/` is committed, pnpm installs the built package directly and never asks for a build-script allowance.

### From npm

```sh
dsh plugin --profile web add dsh-ocgo-usage
```

> **About the name:** the repo is `dsh-opencode-go-usage`, but that npm name is already taken by a similar third-party plugin, so the npm package publishes as `dsh-ocgo-usage`. GitHub installs are unaffected.

### From a tarball

```sh
pnpm pack            # in this repo → dsh-ocgo-usage-0.3.0.tgz
dsh plugin --profile web add ./dsh-ocgo-usage-0.3.0.tgz
```

### From a local checkout (development)

```sh
git clone https://github.com/WhipCream4K/dsh-opencode-go-usage.git
cd dsh-opencode-go-usage
pnpm install
pnpm run build
dsh plugin --profile web add link:$(pwd)
```

**Restart `dsh web`, then refresh the page.** The usage chip appears in the composer tool row, next to the model selector. Verify the plugin layer is composed without booting:

```sh
dsh --profile web --dump-config   # shows a "# == dsh-ocgo-usage" layer
```

> Host-half code changes only take effect after a **restart of `dsh web`**: Node's ESM module cache will not re-import the entry module just because the patch layer hot-reloads.

## Configuration

### Option 1: do nothing (recommended)

DSH keeps provider API keys in its credential store — the `refs:` section of `$DSH_HOME/.credentials.yaml`. The plugin resolves `OPENCODE_GO_API_KEY` through `ctx.credentials` on every refresh, which is the very key the `opencode-go` provider uses. If OpenCode Go already works in your dsh, **there is nothing else to configure**.

### Option 2: the in-UI Set panel

Click the chip to expand → `Set` (bottom-left) → type the API key → click outside, press Esc, or hit Save — it takes effect immediately. The panel writes to that same credential store rather than to a private config file, so the key it saves is the one actually used and cannot be shadowed by a stale value. When the reference is supplied by a read-only source (a process environment variable, say) the panel reports that plainly instead of pretending the save worked.

### Option 3: environment variable or config file (fallbacks)

```sh
export OPENCODE_GO_API_KEY="sk-..."
```

or write `$DSH_HOME/ocgo-usage.json` (default `~/.dsh/ocgo-usage.json`):

```jsonc
{
  "apiKey": "sk-..."
}
```

```sh
chmod 600 ~/.dsh/ocgo-usage.json
```

Resolution order: **credential store (`ctx.credentials`) > environment variable > config file.** The credential store wins because that is where DSH keeps provider keys.

### Optional overrides

| Env var | Default | Description |
|---|---|---|
| `OPENCODE_GO_BASE_URL` | `https://opencode.ai` | API base URL (the quota path is fixed at `/zen/go/v1/usage`) |
| `OPENCODE_GO_CACHE_TTL` | `300` | Host cache TTL in seconds, clamped to 60–3600 |
| `OPENCODE_GO_TIMEOUT_MS` | `10000` | HTTP timeout |

Composition-level config (via `~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- id: ocgo-usage
  config:
    enabled: false                        # master switch, default true
    apiKeyEnv: OPENCODE_GO_API_KEY        # credential reference name; this is the default
```

> **Invalid or expired API key:** the chip shows `<err:apikey>` (HTTP 401/403). After reissuing the key, update it through the Set panel or edit `OPENCODE_GO_API_KEY` in `$DSH_HOME/.credentials.yaml`.

### Error codes

| `<err:...>` | Meaning |
|---|---|
| `noconfig` | No usable key found in any of the three sources |
| `apikey` | HTTP 401/403 — key invalid or revoked |
| `httpNNN` | Any other HTTP failure |
| `timeout` | Request timed out |
| `parse` | Response was not valid JSON |
| `empty` | HTTP 200 with no recognizable window |
| `fetch` | Network-layer failure |
| `disabled` | Plugin switched off with `enabled: false` |

## Usage

Click the chip to expand the detail panel: each window shows its full name, percent, and reset countdown; `refresh upd HH:MM` (bottom-right) refreshes manually and shows the data time.

![Usage detail](assets/usage-detail.png)

The Set panel is a single API Key field; when a key is already configured the field says so through its placeholder rather than echoing any characters:

![Set editor](assets/set-cookie-wid.png)

### The chip never shows up

Visibility accepts exactly two provider id shapes: `opencode-go` and `opencode-go/<sub-route>`. A hyphenated route name such as `opencode-go-live-completions` is treated as a different provider and ignored without a word, so the chip never renders and the console stays empty. Rename that route in the profile's `cordis.patch.yml` to `opencode-go/live-completions` and it appears.

Also, in a **brand-new session that has never committed a model selection** the `modelSelection` projection is still empty, so the chip stays hidden — it appears once you send the first message (or pick a model in the model selector).

## How it works

- **Host half** (`src/index.ts`, `src/service.ts`, `src/api.ts`, `src/routes.ts`, `src/credentials.ts`) — on every refresh it first resolves `OPENCODE_GO_API_KEY` through the credential store (`ctx.credentials`), falling back to the environment and then `$DSH_HOME/ocgo-usage.json`; it then calls `GET https://opencode.ai/zen/go/v1/usage` with `Authorization: Bearer <key>` and normalizes the returned `usage.{rolling,weekly,monthly}.{status,percent,resetsAt}` into the three windows (`resetInSec` derived from `resetsAt`). Results are cached and served as same-origin JSON at `/api/ocgo-usage`, plus `/api/ocgo-usage/refresh` and `/api/ocgo-usage/config` (GET masked view, POST to write).
- **Browser half** (`src/client/`) — registers a chip into the `conversation.input.right` slot (the composer tool row, next to the model selector), polls the host endpoints every 10 s, and renders the three windows with severity colours; visibility comes from the live provider in the session's `modelSelection` projection.

The browser never sees the API key; all fetching and parsing happen on the host.

## Security

- All it needs is an OpenCode Go **API key** — a scoped interface credential, **not** the browser session cookie older versions required (that cookie granted access to every workspace, subscription, and billing detail in your account, and is no longer used at all).
- The plugin **never** logs the key, includes it in error messages, or sends it to the browser.
- The config editor writes new values only into the DSH credential store; the browser ever sees only "configured / not configured" plus a last-4 masked tail, never the full value.

## Harness compatibility

DSH's client APIs are pre-stable, and a release can delete a package a plugin imports: `0.2.0-rc.2` removed `@deepseek-ai/dsh-client-runtime`, which is what version 0.3.0 of this plugin was built against. Three things keep that from being silent breakage:

1. **No removed-package imports.** The client half takes its context type from `@deepseek-ai/cordis` — seeded into the shell's module table — instead of a translation package, and imports every other DSH package type-only. The built bundle's only runtime requests are `react` and `react/jsx-runtime`.
2. **Probed seams.** `src/client/harness-compat.ts` adapts the seams whose shape has changed between releases: slot arming (`ctx.slots.inject`, added in `0.2.0-rc.2`, with the older eager `register` as the fallback) and the session projection read (every hop optional, so a moved one leaves the chip hidden rather than throwing).
3. **Contract tests.** `src/harness-contract.test.ts` reads the DSH packages actually installed in `node_modules` and asserts this plugin's assumptions against them: the slot key and its kind, the service names, the registration API, the route interface, and the built bundle's module requests. A DSH bump that moves any of them fails `pnpm test` by name, before it ever reaches a browser.

`dsh.client.inject` lists the packages whose services the browser half consumes. It is a package-name edge, not a runtime dependency: a shell that renames a service leaves the contribution pending, and the chip simply stays hidden.

### Upgrading to a new DSH release

```sh
pnpm install        # resolve the new @deepseek-ai/* versions
pnpm run verify     # typecheck + build + the whole suite
```

Two follow-ups when the check names them:

- **Shell module table changed** — refresh `shared/web-platform.ts` from `PLATFORM_MODULES` (and `PRELOADED_CLIENT_EXTERNALS`) in the DSH checkout's `packages/client/web/src/platform.ts`. The contract test fails if the bundle requests a module the table does not carry.
- **Supply-chain policy** — pnpm enforces a 1-day minimum release age and DSH ships prereleases, so copy any `package@version` pair the install names into `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.

A moved slot key or a renamed service is a port, not a test edit: adapt `src/client/` and `src/client/harness-compat.ts`, then let the contract test confirm the new shape.

## Development

```sh
pnpm install
pnpm run build      # tsc -b && tsdown → lib/
pnpm run typecheck  # the host/client program and the test program
pnpm test           # builds, then runs the whole suite
pnpm run verify     # typecheck + test
```

`pnpm test` builds first on purpose: the contract suite inspects `lib/client.js` to prove the bundle requests nothing outside the shell's module table, so it must never run against a stale artifact.

| Suite | Covers |
|---|---|
| `src/api.test.ts` | quota response parsing, error codes, timeouts |
| `src/config.test.ts` | resolution order, key normalization, masking |
| `src/service.test.ts` | caching, request dedup, failure cooldown, credential-seam writes |
| `src/provider.test.ts` | the provider matcher |
| `src/client/harness-compat.test.ts` | the shell shapes each shim adapts to (current, legacy, degraded) |
| `src/client/index.test.ts` | the browser half mounted on a live cordis context with service doubles |
| `src/index.test.ts` | the host half's JSON routes and their disposal on unload |
| `src/harness-contract.test.ts` | the installed DSH release, and the built bundle |

The build config (`shared/tsdown.client.ts`) is adapted from [dsh-balance-meter](https://github.com/Ghost011118/dsh-balance-meter) (BSD-3-Clause), itself a copy of the official DSH `packages/client/tsdown.client.ts` — it emits the `window.__ModuleLoader__.load({id, factory})` closure-factory artifact the web shell's module table consumes.

## License

MIT — see [LICENSE](./LICENSE).

## Changelog

### v0.3.0 — DSH 0.2.0-rc.2 support

**Ported to `0.2.0-rc.2`, with the version coupling confined to one module.**

- **Fixed the deleted module** — `0.2.0-rc.2` removed `@deepseek-ai/dsh-client-runtime`, which the browser half imported `ClientContext` from. It now comes straight from `@deepseek-ai/cordis` (seeded into the shell's module table); every other DSH package is a type-only import
- **Slot arming adapted** — `0.2.0-rc.2` added `ctx.slots.inject`, so a cross-package contribution no longer depends on apply order; a shell without it falls back to the eager `register`
- **Module table synced** — `shared/web-platform.ts` now matches `0.2.0-rc.2`'s `PLATFORM_MODULES` (`dsh-client-store` takes the store-engine slot; the `dsh-client-runtime` exemption is gone). The built bundle requests only `react` and `react/jsx-runtime`
- **Compatibility layer** — new `src/client/harness-compat.ts` collects the two seams that have moved between releases (slot arming, session projection read). Every hop of the projection read is optional, so a moved interface leaves the chip hidden instead of breaking the composer
- **Manifest corrected** — `dsh.client.inject` names the four packages actually consumed, `@deepseek-ai/dsh-api-session-controller` moved into devDependencies, and the peer ranges opened to `>=0.2.0-rc.2` so a future release cannot raise a spurious unmet-peer warning
- **Contract tests** — new `src/harness-contract.test.ts` (24 cases) reads the DSH packages installed in `node_modules` and checks the slot key and kind, the service names, the registration API, the route interface, and the built bundle's module requests and shape
- **Wiring tests** — the browser half is now driven against a live cordis context with service doubles (covering both the new and legacy shell paths), and the host half against its JSON routes, masking, and unload disposal. `pnpm test` builds before running; 114 cases total

### v0.2.0 — API-key-only reads

**No cookie and no workspace id any more.**

- **Official quota endpoint** — reads `GET https://opencode.ai/zen/go/v1/usage` with `Authorization: Bearer <OPENCODE_GO_API_KEY>`, the same key the `opencode-go` provider uses
- **Session cookie and workspace id removed** — `OPENCODE_GO_COOKIE`, `OPENCODE_GO_WORKSPACE_ID`, and the `cookie` / `workspaceID` fields in `$DSH_HOME/ocgo-usage.json` are gone, along with the whole SSR HTML fetch-and-parse path
- **Key lives in DSH's credential store** — resolved through `ctx.credentials`, shared with the model provider, so a rotated key needs no restart
- **Set panel reduced to one API Key field** — it writes to that credential store rather than to a private config file, and reports plainly when a read-only source supplies the reference
- **Locale-independent numbers** — the endpoint returns JSON, so there are no SSR labels to parse; the label-parsing added in v2.0.0 was deleted
- **Tests rewritten** — JSON parsing, `resetsAt` conversion, error-code mapping, credential resolution order, and read-only shadowing protection

### v2.0.0 — bilingual UI (inherited history)

- **Chinese UI support** — detection of DSH's zh/en interface locale, with localized window labels and reset phrases (this was label *parsing* at the time; v0.2.0 replaced that with typed dictionaries)
- **Dark-mode logo** — the chip's mark follows the DSH theme
- Thanks to [@waknow](https://github.com/waknow) for the original Chinese localization work, and to everyone who reported and fixed the cookie-era bugs recorded in [COOKIE-FIX.md](./COOKIE-FIX.md)
