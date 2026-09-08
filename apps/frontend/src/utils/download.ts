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

/**
 * 从给定 URL 拉取并下载（携带 cookie 鉴权头，可校验服务端返回）。
 * 替代裸 `window.open(url)`（后者不带 token 易 401 打开错误页且无失败反馈）。
 *
 * @param url       后端下载接口地址（相对或绝对均可；相对路径会自动拼 API_BASE）
 * @param filename  下载文件名
 * @param options   可选：method / headers / body（默认 GET + credentials: include）
 */
export async function fetchAndDownload(
  url: string,
  filename: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
  } = {}
): Promise<void> {
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: options.headers,
    body: options.body,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(errText || `下载失败 (${response.status})`);
  }

  const blob = await response.blob();
  downloadBlob(blob, filename);
}

/**
 * 从响应头 Content-Disposition 解析服务端建议的文件名（兼容 UTF-8'' 与 ASCII 两种编码）。
 * 解析失败回退到调用方传入的 fallback。
 */
export function resolveFilenameFromResponse(
  response: Response,
  fallback: string
): string {
  const contentDisposition = response.headers.get('Content-Disposition');
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
  if (utf8Match) {
    return decodeURIComponent(utf8Match[1]);
  }
  const asciiMatch = contentDisposition.match(/filename="?([^"]+)"?/);
  if (asciiMatch) {
    return asciiMatch[1];
  }
  return fallback;
}
