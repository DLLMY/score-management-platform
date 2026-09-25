import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  downloadBlob,
  downloadTextAsFile,
  fetchAndDownload,
  resolveFilenameFromResponse,
} from '../download';

describe('utils/download', () => {
  let anchor: HTMLAnchorElement;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let appendSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;
  const createObjectURL = vi.fn(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    anchor = document.createElement('a');
    clickSpy = vi.spyOn(anchor, 'click');
    appendSpy = vi.spyOn(document.body, 'appendChild');
    removeSpy = vi.spyOn(document.body, 'removeChild');
    vi.spyOn(document, 'createElement').mockReturnValue(anchor as unknown as HTMLElement);
    (window.URL as unknown as { createObjectURL: typeof createObjectURL }).createObjectURL =
      createObjectURL;
    (window.URL as unknown as { revokeObjectURL: typeof revokeObjectURL }).revokeObjectURL =
      revokeObjectURL;
  });

  it('downloadBlob：创建 objectURL + <a download> + click + revoke', () => {
    const blob = new Blob(['x'], { type: 'text/plain' });
    downloadBlob(blob, 'a.txt');
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchor.href).toBe('blob:mock-url');
    expect(anchor.download).toBe('a.txt');
    expect(appendSpy).toHaveBeenCalledWith(anchor);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('downloadTextAsFile：构造 Blob 并复用 downloadBlob（指定 mime）', () => {
    downloadTextAsFile('hello', 'b.csv', 'text/csv');
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchor.download).toBe('b.csv');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('downloadTextAsFile：默认 mime 也触发下载', () => {
    downloadTextAsFile('x', 'c.json');
    expect(anchor.download).toBe('c.json');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('fetchAndDownload：GET 成功 → 触发下载', async () => {
    const blob = new Blob(['data']);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(blob),
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    await fetchAndDownload('/api/x', 'd.xlsx');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(clickSpy).toHaveBeenCalled();
  });

  it('fetchAndDownload：POST + body + headers 透传', async () => {
    const blob = new Blob(['data']);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(blob),
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    await fetchAndDownload('/api/x', 'e.xlsx', {
      method: 'POST',
      body: '{"k":1}',
      headers: { Authorization: 'Bearer t' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({
        method: 'POST',
        body: '{"k":1}',
        headers: { Authorization: 'Bearer t' },
        credentials: 'include',
      })
    );
  });

  it('fetchAndDownload：非 ok → 抛错（优先用响应文本）', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('boom'),
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    await expect(fetchAndDownload('/api/x', 'f.xlsx')).rejects.toThrow('boom');
  });

  it('fetchAndDownload：非 ok 无文本 → 用状态码', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve(''),
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    await expect(fetchAndDownload('/api/x', 'g.xlsx')).rejects.toThrow('下载失败 (404)');
  });

  it('resolveFilenameFromResponse：UTF-8 星号编码', () => {
    const resp = {
      headers: { get: () => "attachment; filename*=UTF-8''%E6%B5%8B%E8%AF%95.csv" },
    } as unknown as Response;
    expect(resolveFilenameFromResponse(resp, 'fallback.csv')).toBe('测试.csv');
  });

  it('resolveFilenameFromResponse：ASCII filename', () => {
    const resp = {
      headers: { get: () => 'attachment; filename="plain.csv"' },
    } as unknown as Response;
    expect(resolveFilenameFromResponse(resp, 'fallback.csv')).toBe('plain.csv');
  });

  it('resolveFilenameFromResponse：无 header → fallback', () => {
    const resp = { headers: { get: () => null } } as unknown as Response;
    expect(resolveFilenameFromResponse(resp, 'fallback.csv')).toBe('fallback.csv');
  });
});
