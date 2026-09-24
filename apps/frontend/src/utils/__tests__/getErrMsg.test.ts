import { describe, it, expect } from 'vitest';
import { getErrMsg } from '../getErrMsg';

describe('getErrMsg · 错误文案提取（#981 统一）', () => {
  it('null/undefined → fallback', () => {
    expect(getErrMsg(null)).toBe('操作失败');
    expect(getErrMsg(undefined, '自定义兜底')).toBe('自定义兜底');
  });

  it('string → 原样返回', () => {
    expect(getErrMsg('网络异常')).toBe('网络异常');
    expect(getErrMsg('网络异常', '兜底')).toBe('网络异常');
  });

  it('Error 实例 → message（空 message 用 fallback）', () => {
    expect(getErrMsg(new Error('具体错误'))).toBe('具体错误');
    expect(getErrMsg(new Error(''))).toBe('操作失败');
  });

  it('含非空 message 字段的对象 → 取 message', () => {
    expect(getErrMsg({ message: '后端报错', code: 500 })).toBe('后端报错');
  });

  it('无 message / 非字符串 message → fallback', () => {
    expect(getErrMsg({ code: 500 })).toBe('操作失败');
    expect(getErrMsg({ message: 123 })).toBe('操作失败');
    expect(getErrMsg({ message: '' })).toBe('操作失败');
    expect(getErrMsg(42)).toBe('操作失败');
  });
});
