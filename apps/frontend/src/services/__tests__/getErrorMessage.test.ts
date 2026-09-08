import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../api';

describe('getErrorMessage (M2 错误文案优先级)', () => {
  it('error_code 命中友好文案表 → 展示友好文案（最高优先级）', () => {
    expect(
      getErrorMessage(400, { success: false, message: 'raw', error_code: 'BAD_REQUEST' })
    ).toBe('请求参数错误，请检查输入内容');
    expect(
      getErrorMessage(403, { success: false, message: 'raw', error_code: 'FORBIDDEN' })
    ).toBe('您没有权限执行此操作');
    expect(
      getErrorMessage(500, { success: false, message: 'raw', error_code: 'INTERNAL_ERROR' })
    ).toBe('服务器内部错误，请稍后重试');
  });

  it('error_code 未知但 message 为业务文案 → 透传 message', () => {
    expect(
      getErrorMessage(400, { success: false, message: '该学号已注册，请检查后重试' })
    ).toBe('该学号已注册，请检查后重试');
    expect(getErrorMessage(400, { message: '设备不存在' })).toBe('设备不存在');
  });

  it('message 为技术性报错（Python 异常/SQL）→ 屏蔽，用状态码兜底', () => {
    expect(getErrorMessage(500, { message: 'sqlalchemy.exc.IntegrityError: (sqlite3.IntegrityError) UNIQUE constraint failed' })).toBe(
      '服务器内部错误，请稍后重试'
    );
    expect(getErrorMessage(400, { message: 'TypeError: string indices must be integers' })).toBe(
      '请求参数错误，请检查输入内容'
    );
    expect(
      getErrorMessage(500, { message: 'File "/backend/api/algorithm/algorithm_routes.py", line 47, in get' })
    ).toBe('服务器内部错误，请稍后重试');
  });

  it('message 缺失 → 按 HTTP 状态码兜底', () => {
    expect(getErrorMessage(404, {})).toBe('请求的资源不存在');
    expect(getErrorMessage(504, null)).toBe('请求超时，请检查网络或稍后重试');
    expect(getErrorMessage(418, null)).toBe('请求失败 (418)');
  });

  it('error 字段作为 message 的备选（同样过技术识别）', () => {
    expect(getErrorMessage(400, { error: '班级名称不能为空' })).toBe('班级名称不能为空');
    expect(getErrorMessage(500, { error: 'NameError: name x is not defined' })).toBe(
      '服务器内部错误，请稍后重试'
    );
  });
});
