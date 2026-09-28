# dsh-opencode-go-usage

[English](README.en.md) | 中文

[![npm](https://img.shields.io/npm/v/dsh-ocgo-usage)](https://www.npmjs.com/package/dsh-ocgo-usage)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

![Footer demo](assets/custom-footer.png)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) **bundle**，在 Web 界面输入框的工具行（模型选择器旁）显示 [OpenCode Go](https://opencode.ai/docs/go/) 订阅用量。

它是 [pi-ocgo-usage](https://github.com/v587d/pi-ocgo-usage)（Pi 插件）的 Web 对应物：三个用量窗口（5h 滚动 / 每周 / 每月）的百分比与重置倒计时，按阈值变色，让你在窗口耗尽、请求被限流之前就发现。

```
OpenCode Go: 5h 0% (1h 23m) · wk 65% (2d 20h) · mo 83% (6d 21h) · upd 20:15
```

> **只需要一个 API Key。** 本插件读取 OpenCode 官方配额接口
> `GET https://opencode.ai/zen/go/v1/usage`，用 `Authorization: Bearer <OPENCODE_GO_API_KEY>`
> 认证——就是 `opencode-go` 模型 provider 已经在用的那把 key。
> **不需要 workspace id，也不需要浏览器会话 cookie。**

## 特性

- **三个窗口** —— 5h 滚动 / 每周 / 每月 的百分比 + 重置倒计时（由接口返回的 `resetsAt` 换算）
- **颜色阈值** —— 正常 → 黄色警告（≥80%）→ 红色错误（≥90% 或已限流）
- **数据新鲜度** —— `upd HH:MM` 显示最近一次成功抓取时间
- **轻量轮询** —— 每 10s 轮询（切回标签页立即刷新）；host 端 300s 缓存（TTL 可配）+ 60s 失败冷却，不会频繁打扰 opencode.ai
- **Provider 感知** —— 仅当会话当前模型走 `opencode-go` provider 时显示；每次轮询读取内存中的实时模型选择（会话的 `modelSelection` 投影，不发起网络请求），切到 DeepSeek 官方等其它 provider 后一个轮询周期内自动隐藏，切回自动恢复（与 pi-ocgo-usage 行为一致）
- **点击展开** —— 详情面板显示每个窗口的重置倒计时，左下角 `Set` 可配置凭据，右侧 `refresh upd HH:MM` 手动刷新
- **内置凭据编辑器** —— 无需碰终端：`Set` 面板直接写入 API Key（输入框以占位提示表示"已配置"，点击外部 / Esc / 保存确认写入）。写入目标是 DSH 的凭据库（`ctx.credentials`），也就是模型 provider 自己读的那个存储，因此改完立即生效、不需要重启
- **优雅降级** —— 配置缺失显示 `<err:noconfig>`，key 被拒显示 `<err:apikey>`；出错时点击 chip 直接进入 Set 面板
- **API Key 只在 host 侧** —— 浏览器只访问同源 `/api/ocgo-usage` JSON 端点，key 永不进入页面
- **与界面语言无关** —— 接口返回 JSON，不再解析 SSR 页面上的中英文标签，中英文界面结果完全一致

## 环境要求

- DeepSeek Harness（web profile），客户端需提供会话 `modelSelection` 投影（已在 `0.1.7-rc.2` 上验证）
- `PATH` 上有 pnpm（`dsh plugin` 需要）

浏览器半通过 `ctx.sessions.binding(id).session.projections.faceOf('modelSelection')` 读取当前 provider。`0.1.7-rc.2` 移除了旧版的 `connection.api.sessions`；如果某个 Harness 版本两套 API 都没有，chip 会注册成功但永远不渲染，也不会在控制台留任何提示。

## 安装

这是一个标准的 dsh **bundle**：`package.json` 声明了 `dsh.bundle`，通过 `dsh plugin --profile web add <spec>` 安装（pnpm 转发器），自动加入 profile 的 `dsh.profile.bundles`。仓库内置预构建的 `lib/` 产物，**安装无需任何构建步骤或构建权限**——遵循官方 [publish 指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)。

### 从 GitHub 安装（推荐）

```sh
dsh plugin --profile web add github:WhipCream4K/dsh-opencode-go-usage
```

因为 `lib/` 已提交到仓库，pnpm 直接安装构建好的包，不会要求构建脚本授权。

### 从 npm 安装（发布后）

```sh
dsh plugin --profile web add dsh-ocgo-usage
```

> **关于包名：** 仓库名为 `dsh-opencode-go-usage`，但 npm 上同名包已被他人抢先占用（一个功能类似的第三方插件），因此 npm 发布名定为 `dsh-ocgo-usage`。GitHub 安装（推荐）不受影响。

### 从 tarball 安装

```sh
pnpm pack            # 在本仓库内 → dsh-ocgo-usage-0.2.0.tgz
dsh plugin --profile web add ./dsh-ocgo-usage-0.2.0.tgz
```

### 本地开发安装

```sh
git clone https://github.com/WhipCream4K/dsh-opencode-go-usage.git
cd dsh-opencode-go-usage
pnpm install
pnpm run build
dsh plugin --profile web add link:$(pwd)
```

**重启 `dsh web` 并刷新页面**，chip 出现在输入框工具行、模型选择器旁。不启动即可验证插件层已组合：

```sh
dsh --profile web --dump-config   # 应显示 "# == dsh-ocgo-usage" 层
```

> host 半的代码改动**必须重启 `dsh web`** 才会生效：Node 的 ESM 模块缓存不会因为 patch 层热重载而重新导入入口模块。

## 配置

### 方式一：什么都不做（推荐）

DSH 把 provider 的 API Key 存在凭据库里，也就是 `$DSH_HOME/.credentials.yaml` 的 `refs:` 段。插件每次刷新都通过 `ctx.credentials.resolve('OPENCODE_GO_API_KEY')` 读取它——这正是 `opencode-go` provider 自己用的那把 key。已经在 dsh 里配好 OpenCode Go 的用户**无需任何额外配置**。

### 方式二：界面内 Set 面板

点击 chip 展开详情 → 左下角 `Set` → 输入 API Key → 点击外部 / Esc / 保存按钮确认，立即生效。面板会写入同一个凭据库（不是插件私有的配置文件），所以写入的 key 就是真正生效的那把，不存在被旧值遮蔽的问题。若该引用由只读来源（例如进程环境变量）提供，面板会明确报错而不是假装保存成功。

### 方式三：环境变量或配置文件（凭据库的兜底）

```sh
export OPENCODE_GO_API_KEY="sk-..."
```

或写入 `$DSH_HOME/ocgo-usage.json`（默认 `~/.dsh/ocgo-usage.json`）：

```jsonc
{
  "apiKey": "sk-..."
}
```

```sh
chmod 600 ~/.dsh/ocgo-usage.json
```

解析顺序：**凭据库（`ctx.credentials`）> 环境变量 > 配置文件**。凭据库优先，因为那是 DSH 存 provider key 的地方。

### 可选覆盖项

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `OPENCODE_GO_BASE_URL` | `https://opencode.ai` | API 基础地址（配额路径固定为 `/zen/go/v1/usage`） |
| `OPENCODE_GO_CACHE_TTL` | `300` | host 缓存秒数，范围 60–3600 |
| `OPENCODE_GO_TIMEOUT_MS` | `10000` | HTTP 超时 |

组合层配置（`~/.dsh/profiles/web/cordis.patch.yml`）：

```yaml
- id: ocgo-usage
  config:
    enabled: false                        # 总开关，默认 true
    apiKeyEnv: OPENCODE_GO_API_KEY        # 凭据引用的环境变量名，默认即此
```

> **API Key 无效或过期：** chip 显示 `<err:apikey>`（HTTP 401/403）。重新签发 key 后，通过 Set 面板更新，或在 `$DSH_HOME/.credentials.yaml` 中更新 `OPENCODE_GO_API_KEY`。

### 错误码

| `<err:...>` | 含义 |
|---|---|
| `noconfig` | 三处都没找到可用 key |
| `apikey` | HTTP 401/403，key 无效或已被吊销 |
| `httpNNN` | 其它 HTTP 失败 |
| `timeout` | 请求超时 |
| `parse` | 响应不是合法 JSON |
| `empty` | HTTP 200 但没有任何可识别窗口 |
| `fetch` | 网络层失败 |
| `disabled` | 插件被 `enabled: false` 关闭 |

## 使用

点击 chip 展开详情面板：每个窗口显示完整名称、百分比与重置倒计时；右下角 `refresh upd HH:MM` 手动刷新并显示数据时间。

![Usage detail](assets/usage-detail.png)

Set 面板（单一 API Key 字段；已配置时输入框以提示文案表示，而不是回显任何字符）：

![Set editor](assets/set-cookie-wid.png)

### chip 不显示

可见性只认 `opencode-go` 和 `opencode-go/<子路由>` 这两种 provider id。形如 `opencode-go-live-completions` 的连字符路由名会被当成别的 provider 静默忽略；chip 不渲染，控制台也没有任何提示。把 profile 的 `cordis.patch.yml` 里该路由 id 改成 `opencode-go/live-completions` 这种带斜杠的写法即可。

另外，**尚未提交过模型选择的新会话**里 `modelSelection` 投影还是空的，此时 chip 会隐藏——发出第一条消息（或在模型选择器里选定模型）后即出现。

## 工作原理

- **Host 半**（`src/index.ts`、`src/service.ts`、`src/api.ts`、`src/routes.ts`、`src/credentials.ts`）—— 每次刷新先通过凭据库（`ctx.credentials`）解析 `OPENCODE_GO_API_KEY`，回退到环境变量与 `$DSH_HOME/ocgo-usage.json`；然后 `GET https://opencode.ai/zen/go/v1/usage`（`Authorization: Bearer <key>`），把返回的 `usage.{rolling,weekly,monthly}.{status,percent,resetsAt}` 归一化为三个窗口（`resetInSec` 由 `resetsAt` 换算），缓存结果，通过同源 JSON 端点 `/api/ocgo-usage`（+ `/api/ocgo-usage/refresh`、`/api/ocgo-usage/config`）提供数据。
- **浏览器半**（`src/client/`）—— 向 `conversation.input.right` slot（输入框工具行，模型选择器旁）注册 chip，每 10s 轮询 host 端点，按严重级别着色渲染三个窗口；可见性来自会话 `modelSelection` 投影里的实时 provider。

浏览器永远看不到 API Key；抓取与解析全部在 host 侧完成。

## 安全

- 只需要一把 OpenCode Go **API Key**——它是作用域受限的接口凭据，**不是**浏览器会话 cookie（旧版本需要的那个 cookie 能访问你账户内的全部 workspace、订阅与账单，已经不使用了）。
- 插件**绝不**记录 key、不把它放进错误信息、不发送给浏览器。
- 配置编辑器只把新值写入 DSH 凭据库；浏览器始终只看到"已配置/未配置"与末 4 位掩码，永远拿不到完整值。

## 开发

```sh
pnpm install
pnpm run build     # tsc -b && tsdown → lib/
pnpm run typecheck # tsc -b --pretty false
pnpm test          # vitest run（解析器 / 配置 / 服务）
```

构建配置（`shared/tsdown.client.ts`）改编自 [dsh-balance-meter](https://github.com/Ghost011118/dsh-balance-meter)（BSD-3-Clause），后者是官方 DSH `packages/client/tsdown.client.ts` 的副本——它产出 web shell 模块表所需的 `window.__ModuleLoader__.load({id, factory})` 闭包工厂产物。

## License

MIT —— 见 [LICENSE](./LICENSE)。

## Changelog

### v0.2.0 - 只用 API Key

**🎉 重大更新：不再需要 cookie 和 workspace id。**

- **🔑 官方配额接口** —— 改为 `GET https://opencode.ai/zen/go/v1/usage`，用 `Authorization: Bearer <OPENCODE_GO_API_KEY>` 认证，也就是 `opencode-go` provider 自己那把 key
- **🗑️ 移除会话 cookie 与 workspace id** —— `OPENCODE_GO_COOKIE`、`OPENCODE_GO_WORKSPACE_ID` 与 `$DSH_HOME/ocgo-usage.json` 里的 `cookie` / `workspaceID` 字段全部废弃；SSR HTML 抓取与解析整条链路删除
- **🔐 密钥走 DSH 凭据库** —— 通过 `ctx.credentials` 解析 `OPENCODE_GO_API_KEY`，与模型 provider 共用同一个存储，轮换 key 无需重启
- **✏️ Set 面板改为单一 API Key 字段** —— 写入的是凭据库（真正生效的那个存储），而不是插件私有配置文件；若引用由只读来源提供则明确报错
- **🌏 与界面语言无关** —— 接口返回 JSON，不再需要中英文标签解析，中英文界面结果天然一致（v2.0.0 引入的标签本地化解析随之删除）
- **🧪 测试重写** —— 覆盖 JSON 解析、`resetsAt` 换算、错误码映射、凭据解析顺序与只读遮蔽保护（62 个用例）

### v2.0.0 - 中英双语支持（历史）

**🎉 重大更新：现在支持中文界面了！**

- **🌏 国际化 (i18n) 支持**：自动识别 DeepSeek Harness 的中文/英文界面语言
  - 新增中文标签解析：`滚动用量`、`每周用量`、`每月用量`
  - 新增中文时间单位支持：秒、分钟、小时、天、周、月、年
  - 智能匹配中英文重置提示：`Resets in` / `重置于`
- **🎨 深色模式优化**：调整 Logo 在深色主题下的对比度，视觉更舒适
- **🧪 完整测试覆盖**：新增中文场景单元测试，确保解析准确性

特别感谢 [@waknow](https://github.com/waknow) 贡献了核心的中文本地化功能！🙏

> 💡 **版本选择建议**：
> - 喜欢纯英文界面？继续使用 [v1.1.0](https://github.com/v587d/dsh-opencode-go-usage/releases/tag/v1.1.0)
> - 需要中英双语支持？升级到 v2.0.0+

---
