/**
 * 文件下载公共工具
 *
 * 收敛前端散落的 `fetch -> blob -> URL.createObjectURL -> <a download>` 样板，
 * 统一触发浏览器下载。各页面 / 服务层（api.ts）/ ImportExportPanel 均复用此处，
 * 避免重复实现导致的样式与行为不一致。
 */

/**
 * 触发一次浏览器下载（内存安全：自动创建/移除 <a> 并 revoke objectURL）。
 * @param blob 待下载的二进制内容
 * @param filename 下载文件名（含扩展名）
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * 以指定文本/类型构造 Blob 并触发下载，常用于 CSV / JSON 导出。
 */
export function downloadTextAsFile(
  content: string,
  filename: string,
  mime = 'text/csv;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mime });
  downloadBlob(blob, filename);
}
