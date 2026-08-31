import { describe, it, expect } from 'vitest';
import {
  getErrorMessage,
  unwrapEnvelope,
  parseEnvelopeSafe,
} from '../../services/api';

// T2-④：api.ts 信封归一化单测（最高风险盲区，此前无覆盖）。
// 覆盖 M2 约定的三件套：getErrorMessage（友好文案优先级）/ unwrapEnvelope（解包与业务失败抛错）/ parseEnvelopeSafe（只读页安全解析）。

describe('getErrorMessage (M2 信封归一化 · 友好文案优先级)', () => {
  it('error_code 命中友好文案表 → 返回稳定文案（最高优先级，高于后端 message）', () => {
    expect(getErrorMessage(500, { error_code: 'FORBIDDEN' })).toBe(
      '您没有权限执行此操作',
    );
    expect(getErrorMessage(403, { error_code: 'TOKEN_EXPIRED' })).toBe(
      '登录状态已过期，请重新登录',
    );
    expect(getErrorMessage(400, { error_code: 'DUPLICATE_RECORD' })).toBe(
      '记录已存在，请勿重复提交',
    );
  });

  it('后端 message 为业务文案（非技术报错）→ 透传给用户', () => {
    expect(getErrorMessage(400, { message: '积分不足，无法兑换' })).toBe(
      '积分不足，无法兑换',
    );
    expect(getErrorMessage(422, { error: '手机号格式不正确' })).toBe(
      '手机号格式不正确',
    );
  });

  it('后端 message 含技术细节（Traceback / 异常类 / SQL）→ 屏蔽，回退 HTTP 状态文案', () => {
    expect(
      getErrorMessage(500, { message: 'Traceback (most recent call last): ...' }),
    ).toBe('服务器内部错误，请稍后重试');
    expect(
      getErrorMessage(500, { message: 'RuntimeError: division by zero' }),
    ).toBe('服务器内部错误，请稍后重试');
    expect(
      getErrorMessage(500, { message: 'sqlalchemy.exc.OperationalError: ...' }),
    ).toBe('服务器内部错误，请稍后重试');
  });

  it('既无 error_code 也无 message → 兜底 HTTP 状态文案；未知状态用通用文案', () => {
    expect(getErrorMessage(404, {})).toBe('请求的资源不存在');
    expect(getErrorMessage(429, {})).toBe('请求过于频繁，请稍后再试');
    expect(getErrorMessage(418, {})).toBe('请求失败 (418)');
  });
});

describe('unwrapEnvelope (M2 信封解包)', () => {
  it('skipDataExtract=true → 原样返回完整信封，由调用方自行判断', () => {
    const env = { success: false, message: '导入存在冲突', data: { conflicts: 2 } };
    expect(unwrapEnvelope(env, true)).toEqual(env);
  });

  it('success=false（HTTP 2xx 但业务失败）→ 抛 ApiError(business, status=200)，避免调用方把失败当成功', () => {
    expect(() =>
      unwrapEnvelope({ success: false, message: '余额不足', data: null }),
    ).toThrow();
  });

  it('success=true 且含 data → 返回 data', () => {
    const data = { id: 1, name: '张三' };
    expect(unwrapEnvelope({ success: true, code: 200, data })).toEqual(data);
  });

  it('无 success 字段的直出对象（非信封）→ 原样返回', () => {
    const raw = { foo: 'bar' };
    expect(unwrapEnvelope(raw)).toEqual(raw);
  });
});

describe('parseEnvelopeSafe (M2 只读页安全解析 · 不抛)', () => {
  it('success=true → 返回 data', () => {
    expect(
      parseEnvelopeSafe<{ id: number }>({ success: true, data: { id: 1 } }),
    ).toEqual({ id: 1 });
  });

  it('success=false（业务失败）→ null，不抛（OpsCenter/SystemMetrics 等只读页不会假成功）', () => {
    expect(parseEnvelopeSafe({ success: false, message: '无权限' })).toBeNull();
  });

  it('无 success 字段的直出对象 → 原样返回（非 null）', () => {
    const raw = { foo: 'bar' };
    expect(parseEnvelopeSafe(raw)).toEqual(raw);
  });
});
