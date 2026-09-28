# dsh-opencode-go-usage

English | [中文](README.md)

[![npm](https://img.shields.io/npm/v/dsh-ocgo-usage)](https://www.npmjs.com/package/dsh-ocgo-usage)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

![Footer demo](assets/custom-footer.png)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) **bundle** that shows [OpenCode Go](https://opencode.ai/docs/go/) subscription usage in the Web GUI's composer tool row, next to the model selector.

The Web counterpart of the [pi-ocgo-usage](https://github.com/v587d/pi-ocgo-usage) Pi extension: three usage windows (rolling 5h, weekly, monthly) with percentages and reset countdowns, color-coded so you see a window approaching exhaustion before you hit the rate limit mid-work.

```
OpenCode Go: 5h 0% (1h 23m) · wk 65% (2d 20h) · mo 83% (6d 21h) · upd 20:15
```

> **An API key is all it takes.** The plugin reads the official quota endpoint
> `GET https://opencode.ai/zen/go/v1/usage`, authenticated with
> `Authorization: Bearer <OPENCODE_GO_API_KEY>` — the same key the `opencode-go`
> model provider already uses. **No workspace id and no browser session cookie.**

## Features

- **Three windows** — rolling (5h) / weekly / monthly percent + reset countdown (derived from the API's `resetsAt` stamps)
- **Color thresholds** — muted → warning (≥80%) → error (≥90% or rate-limited)
- **Data freshness** — `upd HH:MM` shows the last successful fetch time
- **Lightweight polling** — every 10 s (and on tab refocus); the host caches for 300 s (TTL configurable) with a 60 s failure cooldown, so opencode.ai is never hammered
- **Provider-aware** — the chip shows only while the session's current model routes through the `opencode-go` provider. Visibility reads the live in-memory selection (the session's `modelSelection` projection, no network request) on every poll, so switching to e.g. DeepSeek official via `/model` hides it within one 10 s cycle and switching back re-shows it (mirrors pi-ocgo-usage)
- **Click to expand** — detail panel with per-window reset countdowns, a `Set` credential editor, and `refresh upd HH:MM`
- **Built-in credential editor** — no terminal needed: the `Set` panel writes the API key straight into DSH's credential store (the one the model provider itself reads), so the write takes effect immediately with no restart. A configured key is signalled by the field's placeholder rather than by echoing any characters
- **Graceful degradation** — missing config shows `<err:noconfig>`, a rejected key `<err:apikey>`; on error, clicking the chip opens the Set editor directly
- **API key stays on the host** — the browser only ever talks to the same-origin `/api/ocgo-usage` JSON endpoint; the key never reaches the page
- **Locale-independent** — the endpoint returns JSON, so there are no SSR labels to parse and the numbers are identical in every UI language

## Requirements

- DeepSeek Harness (web profile) whose client exposes the session `modelSelection` projection (verified on `0.1.7-rc.2`)
- pnpm on `PATH` (for `dsh plugin`)

The browser half reads the current provider through `ctx.sessions.binding(id).session.projections.faceOf('modelSelection')`. `0.1.7-rc.2` removed the older `connection.api.sessions`. A Harness build that offers neither leaves the chip registered but permanently invisible, with nothing in the console to say why.

## Installation

This package is a standard dsh **bundle**: it declares `dsh.bundle` in its manifest and installs through `dsh plugin --profile web add <spec>` (a pnpm forwarder), which links the package and appends it to the profile's `dsh.profile.bundles`. The repo ships pre-built `lib/` artifacts, so **no build step or install-time build permission is needed** — this follows the official [publish guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md).

### From GitHub (recommended for users)

```sh
dsh plugin --profile web add github:WhipCream4K/dsh-opencode-go-usage
```

Because `lib/` is committed, pnpm installs the built package directly and never asks for a build-script allowance.

### From npm (after a release)

```sh
dsh plugin --profile web add dsh-ocgo-usage
```

> **About the name:** the repo is `dsh-opencode-go-usage`, but that npm name is already taken by a similar third-party plugin, so the npm package publishes as `dsh-ocgo-usage`. GitHub installs (recommended) are unaffected.

### From a tarball

```sh
pnpm pack            # in this repo → dsh-ocgo-usage-0.2.0.tgz
dsh plugin --profile web add ./dsh-ocgo-usage-0.2.0.tgz
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

Click the chip to expand → `Set` (bottom-left) → type the API key → click outside / press Esc / hit Save — it takes effect immediately. The panel writes to that same credential store rather than to a private config file, so the key it saves is the one actually used and cannot be shadowed by a stale value. When the reference is supplied by a read-only source (a process environment variable, say) the panel reports that plainly instead of pretending the save worked.

![Set editor](assets/set-cookie-wid.png)

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

### The chip never shows up

Visibility accepts exactly two provider id shapes: `opencode-go` and `opencode-go/<sub-route>`. A hyphenated route name such as `opencode-go-live-completions` is treated as a different provider and ignored without a word, so the chip never renders and the console stays empty. Rename that route in the profile's `cordis.patch.yml` to `opencode-go/live-completions` and it appears.

Also, in a **brand-new session that has never committed a model selection** the `modelSelection` projection is still empty, so the chip stays hidden — it appears once you send the first message (or pick a model in the model selector).

## How it works

- **Host half** (`src/index.ts`, `src/service.ts`, `src/api.ts`, `src/routes.ts`, `src/credentials.ts`) — on every refresh it first resolves `OPENCODE_GO_API_KEY` through the credential store (`ctx.credentials`), falling back to the environment and then `$DSH_HOME/ocgo-usage.json`; it then calls `GET https://opencode.ai/zen/go/v1/usage` with `Authorization: Bearer <key>` and normalizes the returned `usage.{rolling,weekly,monthly}.{status,percent,resetsAt}` into the three windows (`resetInSec` derived from `resetsAt`). Results are cached and served as same-origin JSON at `/api/ocgo-usage` (+ `/api/ocgo-usage/refresh`, `/api/ocgo-usage/config`).
- **Browser half** (`src/client/`) — registers a chip into the `conversation.input.right` slot (the composer tool row, next to the model selector), polls the host endpoints every 10 s, and renders the three windows with severity colors; visibility comes from the live provider in the session's `modelSelection` projection.

The browser never sees the API key; all fetching and parsing happen on the host.

## Security

- All it needs is an OpenCode Go **API key** — a scoped interface credential, **not** the browser session cookie older versions required (that cookie granted access to every workspace, subscription, and billing detail in your account, and is no longer used at all).
- The plugin **never** logs the key, includes it in error messages, or sends it to the browser.
- The config editor writes new values only into the DSH credential store; the browser ever sees only "configured / not configured" plus a last-4 masked tail, never the full value.

## Development

```sh
pnpm install
pnpm run build     # tsc -b && tsdown → lib/
pnpm run typecheck # tsc -b --pretty false
pnpm test          # vitest run (parser / config / service)
```

The build config (`shared/tsdown.client.ts`) is adapted from [dsh-balance-meter](https://github.com/Ghost011118/dsh-balance-meter) (BSD-3-Clause), itself a copy of the official DSH `packages/client/tsdown.client.ts` — it emits the `window.__ModuleLoader__.load({id, factory})` closure-factory artifact the web shell's module table consumes.

## License

MIT — see [LICENSE](./LICENSE).
