/**
 * dsh-ocgo-usage locale dictionaries (zh/en).
 * @module dsh-ocgo-usage/client/locales
 */
/** Dictionary namespace this package registers. */
export const NS = 'ocgo';
/** Chinese copy. */
export const zh = {
    'ocgo.unavailable': '用量不可用',
    'ocgo.error': '查询失败：{code}',
    'ocgo.noconfig': '未配置：请设置 OPENCODE_GO_API_KEY（环境变量、$DSH_HOME/.credentials.yaml 或 $DSH_HOME/ocgo-usage.json）',
    'ocgo.apikey': 'API Key 无效或已过期',
    'ocgo.empty': '返回中没有可用用量数据',
    'ocgo.refresh': '刷新',
    'ocgo.fetchedAt': 'upd {time}',
    'ocgo.rolling': '5h 滚动',
    'ocgo.weekly': '每周',
    'ocgo.monthly': '每月',
    'ocgo.rateLimited': '已限流',
    'ocgo.resetsIn': '剩余 {duration}',
    'ocgo.expand': '展开用量详情',
    'ocgo.collapse': '收起',
    'ocgo.sep': '·',
    'ocgo.set': '设置',
    'ocgo.save': '保存',
    'ocgo.apiKeyLabel': 'OpenCode Go API Key',
    'ocgo.configured': '已配置 — 输入新 Key 可替换',
    'ocgo.setHint': '点击外部或按 Esc 保存',
};
/** English copy. */
export const en = {
    'ocgo.unavailable': 'usage unavailable',
    'ocgo.error': 'Query failed: {code}',
    'ocgo.noconfig': 'Not configured: set OPENCODE_GO_API_KEY (env, $DSH_HOME/.credentials.yaml, or $DSH_HOME/ocgo-usage.json)',
    'ocgo.apikey': 'API key invalid or expired',
    'ocgo.empty': 'Response carried no usable usage data',
    'ocgo.refresh': 'Refresh',
    'ocgo.fetchedAt': 'upd {time}',
    'ocgo.rolling': '5h Rolling',
    'ocgo.weekly': 'Weekly',
    'ocgo.monthly': 'Monthly',
    'ocgo.rateLimited': 'rate-limited',
    'ocgo.resetsIn': 'resets in {duration}',
    'ocgo.expand': 'Show usage details',
    'ocgo.collapse': 'Collapse',
    'ocgo.sep': '·',
    'ocgo.set': 'Set',
    'ocgo.save': 'Save',
    'ocgo.apiKeyLabel': 'OpenCode Go API Key',
    'ocgo.configured': 'configured — type a new key to replace',
    'ocgo.setHint': 'click outside or press Esc to save',
};
