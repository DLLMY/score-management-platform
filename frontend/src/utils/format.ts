/**
 * 统一格式化工具（F1 公共组件提取 2026-08-22）
 *
 * 收敛散落各页面的内联格式化函数（formatTime/formatDate/formatUptime/formatFileSize/
 * formatLastSeen 等，原 8 个页面各自实现、格式不统一），统一语义与边界处理：
 * - 空值统一回退占位符（默认 '--'，与多数页面一致）
 * - 非法日期统一回退占位符，不抛 NaN
 */

/** 空值回退占位符 */
const FALLBACK = '--';

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 相对时间：刚刚 / N分钟前 / N小时前 / N天前 / 超过7天显示具体日期
 * 语义与 Dashboard.formatDate / DeviceManagement.formatTime / Notifications.formatTime 一致
 */
export function formatRelativeTime(
  value?: string | number | Date | null,
  fallback: string = FALLBACK
): string {
  const date = toDate(value);
  if (!date) return fallback;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

/**
 * 完整日期时间：2026/08/22 21:30
 * 语义与 FirmwareManagement.formatTime / RemoteNotify.formatLastSeen 一致
 */
export function formatDateTime(
  value?: string | number | Date | null,
  fallback: string = FALLBACK
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 日期：默认 yyyy/MM/dd；withWeekday 时附星期（语义同 Dashboard.formatDateFull）
 */
export function formatDate(value?: string | number | Date | null, withWeekday = false): string {
  const date = toDate(value);
  if (!date) return FALLBACK;
  if (withWeekday) {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  }
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * 运行时长：X天 X小时 / X小时 X分钟 / X分钟（语义同 DeviceManagement.formatUptime）
 */
export function formatUptime(seconds?: number | null, fallback: string = '-'): string {
  if (!seconds || seconds <= 0) return fallback;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
}

/**
 * 文件大小：B / KB / MB / GB（语义同 FirmwareManagement.formatFileSize）
 */
export function formatFileSize(bytes?: number | null, fallback: string = '-'): string {
  if (!bytes || bytes < 0) return fallback;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * 时:分：HH:mm（语义同 PhoneBoxPolicy.formatTime / ClassPeriodSettings.formatTime）
 */
export function formatHourMinute(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
