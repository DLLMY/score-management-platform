import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadBlob, downloadTextAsFile } from '../download';

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
});
