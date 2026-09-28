/**
 * dsh-ocgo-usage locale dictionaries (zh/en).
 * @module dsh-ocgo-usage/client/locales
 */
/** Dictionary namespace this package registers. */
export declare const NS = "ocgo";
/** Chinese copy. */
export declare const zh: {
    readonly 'ocgo.unavailable': "用量不可用";
    readonly 'ocgo.error': "查询失败：{code}";
    readonly 'ocgo.noconfig': "未配置：请设置 OPENCODE_GO_API_KEY（环境变量、$DSH_HOME/.credentials.yaml 或 $DSH_HOME/ocgo-usage.json）";
    readonly 'ocgo.apikey': "API Key 无效或已过期";
    readonly 'ocgo.empty': "返回中没有可用用量数据";
    readonly 'ocgo.refresh': "刷新";
    readonly 'ocgo.fetchedAt': "upd {time}";
    readonly 'ocgo.rolling': "5h 滚动";
    readonly 'ocgo.weekly': "每周";
    readonly 'ocgo.monthly': "每月";
    readonly 'ocgo.rateLimited': "已限流";
    readonly 'ocgo.resetsIn': "剩余 {duration}";
    readonly 'ocgo.expand': "展开用量详情";
    readonly 'ocgo.collapse': "收起";
    readonly 'ocgo.sep': "·";
    readonly 'ocgo.set': "设置";
    readonly 'ocgo.save': "保存";
    readonly 'ocgo.apiKeyLabel': "OpenCode Go API Key";
    readonly 'ocgo.configured': "已配置 — 输入新 Key 可替换";
    readonly 'ocgo.setHint': "点击外部或按 Esc 保存";
};
/** English copy. */
export declare const en: {
    readonly 'ocgo.unavailable': "usage unavailable";
    readonly 'ocgo.error': "Query failed: {code}";
    readonly 'ocgo.noconfig': "Not configured: set OPENCODE_GO_API_KEY (env, $DSH_HOME/.credentials.yaml, or $DSH_HOME/ocgo-usage.json)";
    readonly 'ocgo.apikey': "API key invalid or expired";
    readonly 'ocgo.empty': "Response carried no usable usage data";
    readonly 'ocgo.refresh': "Refresh";
    readonly 'ocgo.fetchedAt': "upd {time}";
    readonly 'ocgo.rolling': "5h Rolling";
    readonly 'ocgo.weekly': "Weekly";
    readonly 'ocgo.monthly': "Monthly";
    readonly 'ocgo.rateLimited': "rate-limited";
    readonly 'ocgo.resetsIn': "resets in {duration}";
    readonly 'ocgo.expand': "Show usage details";
    readonly 'ocgo.collapse': "Collapse";
    readonly 'ocgo.sep': "·";
    readonly 'ocgo.set': "Set";
    readonly 'ocgo.save': "Save";
    readonly 'ocgo.apiKeyLabel': "OpenCode Go API Key";
    readonly 'ocgo.configured': "configured — type a new key to replace";
    readonly 'ocgo.setHint': "click outside or press Esc to save";
};
/** Key type of the dictionary (for the LocaleNamespaceMap merge). */
export type OcgoKey = keyof typeof zh;
//# sourceMappingURL=locales.d.ts.map