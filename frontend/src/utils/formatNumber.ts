/**
 * 统一数字格式化工具（F6 公共组件提取 2026-08-22）
 *
 * 收敛散落各页面的 toFixed / Intl.NumberFormat / 百分比 / 货币 内联写法
 * （原 ~30 文件各自实现，如 AlgorithmAnalysis 39 处、NLPManagement 33 处）。
 *
 * 设计原则（与 format.ts 一致）：
 * - drop-in 替代 `(n).toFixed(d)`：非法值（null/undefined/''/NaN）统一回退占位符，不抛异常
 * - 不引入 locale 千分位副作用（formatCompact 单独提供），保证替换后输出与原 toFixed 一致
 */

/** 空值回退占位符 */
const NUM_FALLBACK = '--';

function toFinite(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

/**
 * 数字格式化：drop-in 替代 (n).toFixed(decimals)
 * @example formatNumber(3.14159, 2) === '3.14'；formatNumber(null) === '--'
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals = 0,
  fallback: string = NUM_FALLBACK
): string {
  const n = toFinite(value);
  if (n === null) return fallback;
  return n.toFixed(decimals);
}

/**
 * 百分比：drop-in 替代 (n).toFixed(d) + '%'
 * @example formatPercent(0.857, 1) === '85.7%'
 */
export function formatPercent(
  value: number | string | null | undefined,
  decimals = 1,
  fallback: string = NUM_FALLBACK
): string {
  const s = formatNumber(value, decimals, fallback);
  return s === fallback ? fallback : `${s}%`;
}

/**
 * 货币（人民币）：¥ + 千分位
 * @example formatCurrency(1234.5) === '¥1,234.50'
 */
export function formatCurrency(
  value: number | string | null | undefined,
  decimals = 2,
  fallback: string = NUM_FALLBACK
): string {
  const n = toFinite(value);
  if (n === null) return fallback;
  return `¥${n.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * 千分位整数（用于大数展示，如学生数、访问量）
 * @example formatCompact(12345) === '12,345'
 */
export function formatCompact(
  value: number | string | null | undefined,
  fallback: string = NUM_FALLBACK
): string {
  const n = toFinite(value);
  if (n === null) return fallback;
  return n.toLocaleString('zh-CN');
}

/**
 * 分数：默认保留 1 位小数，drop-in 替代 score.toFixed(1)
 */
export function formatScore(
  value: number | string | null | undefined,
  decimals = 1,
  fallback: string = NUM_FALLBACK
): string {
  return formatNumber(value, decimals, fallback);
}
