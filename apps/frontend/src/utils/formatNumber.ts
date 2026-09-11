/**
 * 兼容桥接：原 formatNumber 工具已合并至 format.ts（D6 重构 2026-09-08）
 * 保留本文件作为 re-export，避免调用方一次性迁移；新代码请直接 import from './format'。
 */
export { formatNumber, formatPercent, formatCurrency, formatCompact, formatScore } from './format';
