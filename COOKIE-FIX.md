# Cookie 解析修复记录（历史存档）

> **⚠️ 已废弃 —— 仅供考古。**
> 自 **v0.2.0** 起，本插件改用 OpenCode 官方配额接口
> `GET https://opencode.ai/zen/go/v1/usage`（`Authorization: Bearer <OPENCODE_GO_API_KEY>`），
> 浏览器会话 cookie、workspace id、SSR 页面抓取与解析整条链路都已删除。
> 下面记录的那个 bug 及修复**在今天的代码里已经不存在**（连 `normalizeCookie` 函数本身都没有了）。
> 保留这份文档只是为了不让这段排查过程随 git 历史一起消失。

## 当年修的是什么

原 `normalizeCookie`（`src/config.ts`）用 `/^auth=/` 判断整个字符串是否以 `auth=` 开头：

- 以 `auth=` 开头 → 正常透传。
- 否则 → **把第一个分号段当成 auth 值**，拼成 `auth=<第一段>; ...`。

真实浏览器拷出的 cookie 通常带 locale，且 locale 可能排在前：

```
oc_locale=zh; desktop_promo_dismissed=1; auth=Fe26.2*...
```

它不以 `auth=` 开头 → 原代码把 `oc_locale=zh` 当成了 auth → 写入
`auth=oc_locale=zh; oc_locale=en` → opencode.ai 拒绝 → 跳登录页 → 插件报
`<err:http302>`（"页面解析空"）。

这个 bug 与解析层是否支持中文**无关**：任何"auth 不在第一段"的 cookie 都会被写坏。

## 当年的修复

`normalizeCookie` 重写为**顺序无关 + 拒绝假值 + 保留用户 locale**：

1. **顺序无关**：在整串中查找 `auth=` 段，而不是假设它在第一段。
2. **拒绝假 cookie**：既没有 `auth=` 也没有裸 opaque token 时返回 `undefined`，调用方拒绝写入，绝不拼出 `auth=oc_locale=zh`。
3. **保留用户 locale**：提取 `oc_locale` 原样保留，缺省或非法时回退 `en`。
4. 分隔符 `;` 与 `,` 都支持；丢弃无关 UI 段（`desktop_promo_dismissed` 等）。

## 为什么这段历史仍然值得记一笔

它解释了本仓库为什么在很长一段时间里把 cookie 当作唯一数据来源，以及丑事是怎么暴露的：
**cookie 是会过期的完整用户会话**，签发一年后（或被吊销）就静默失效，插件只能显示一个
`<err:http302>`，用户除了重新登录并手工粘贴新 cookie 之外无计可施。

v0.2.0 的 API Key 方案正是对这个结构性问题的回答：改用作用域受限、与模型 provider
共用同一份凭据的 API Key，不再需要从浏览器里搬运任何会话材料。
