import { describe, it, expect, vi } from 'vitest';
import { withOptimisticUpdate } from '../optimisticUpdate';

describe('optimisticUpdate 纯逻辑', () => {
  it('withOptimisticUpdate 成功路径：update→apiCall→onSuccess→返回响应', async () => {
    const update = vi.fn();
    const revert = vi.fn();
    const onSuccess = vi.fn();
    const onComplete = vi.fn();
    const apiCall = vi.fn().mockResolvedValue({ ok: true });

    const res = await withOptimisticUpdate({ v: 1 }, apiCall, {
      update,
      revert,
      onSuccess,
      onComplete,
    });

    expect(update).toHaveBeenCalledWith({ v: 1 });
    expect(apiCall).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ ok: true });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ ok: true });
  });

  it('withOptimisticUpdate 失败路径：revert→onError→rethrow 包装 Error', async () => {
    const update = vi.fn();
    const revert = vi.fn();
    const onError = vi.fn();
    const onComplete = vi.fn();
    const apiCall = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      withOptimisticUpdate({ v: 1 }, apiCall, { update, revert, onError, onComplete })
    ).rejects.toThrow('boom');

    expect(revert).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('withOptimisticUpdate 非 Error 异常被包装为 Error', async () => {
    const onError = vi.fn();
    const apiCall = vi.fn().mockRejectedValue('string-error');

    await expect(
      withOptimisticUpdate({}, apiCall, { update: () => {}, revert: () => {}, onError })
    ).rejects.toBeInstanceOf(Error);

    expect((onError.mock.calls[0][0] as Error).message).toBe('string-error');
  });
});
