/**
 * 统一错误文案提取工具（#981 操作反馈统一）。
 *
 * 从 unknown 类型错误中提取可读字符串，供错误 toast 统一使用：
 *   showToast('error', getErrMsg(error, '删除活动失败'));
 *
 * 提取优先级：
 *   - Error 实例          → error.message
 *   - string              → 原样返回
 *   - 含非空 message 字段 → (message as string)
 *   - 其余 / 无 message    → fallback
 *
 * 这样无论后端返回的是 Error、字符串还是 { message } 结构，前端都能稳定透出真实错误，
 * 同时保留业务上下文作为兜底文案，避免一半页面透出详情、一半只写死文案的不一致。
 */
export function getErrMsg(error: unknown, fallback = '操作失败'): string {
  if (error == null) {
    return fallback;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  if (typeof error === 'object') {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.length > 0) {
      return msg;
    }
  }
  return fallback;
}
