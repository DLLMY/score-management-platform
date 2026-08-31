/**
 * 共享运维页数据获取工具（T11 收敛）
 *
 * 消除 OpsCenter / SystemMetrics / SecurityAudit / FrontendTelemetry 四页逐字相同的
 * fetchJson<T> 抄本，以及 OpsCenter 内联的 operation-logs IIFE 抄本。
 *
 * 设计约定（与历史四页保持一致，零行为漂移）：
 *  - 统一走 services/api 的 getAuthHeaders（携带认证头）与 parseEnvelopeSafe（信封单一真相源）。
 *  - 非 2xx 与网络/解析异常均返回 null；调用方以 `if (!data)` 判定失败并置 error state。
 *  - 失败不再静默吞掉：非 2xx 与 catch 内的异常均 console.error 记录 URL 与错误详情
 *    （T11 #959 静默失败改造，对齐后端 T9 日志化约定），便于运维排查，不改变返回契约。
 *  - 历史四页已各自渲染 role=alert 错误态（FrontendTelemetry 经 DataTable 带 onRetry），
 *    本模块只负责去重与统一实现，不改动任何页面的错误 UI 文案。
 */
import { useState, useCallback, useEffect } from 'react';
import { getAuthHeaders, parseEnvelopeSafe } from '../services/api';

export interface ApiResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

/** 命令式获取：返回解析后的 data，失败（非 2xx / 异常 / 信封业务失败）返回 null 并日志化。 */
export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
    if (!res.ok) {
      // T11 #959：非 2xx 不再静默吞掉，记录状态码与 URL 便于运维排查
      console.error(`[fetchJson] 请求返回非 2xx 状态: ${res.status} ${res.statusText} <- ${url}`);
      return null;
    }
    const env = await res.json();
    // 统一信封解析（单一真相源：services/api.ts 的 parseEnvelopeSafe），消除各页重复实现 / 假成功漂移
    return parseEnvelopeSafe<T>(env);
  } catch (err) {
    // T11 #959：网络/解析异常不再静默吞掉，记录错误详情与 URL（对齐后端 T9 日志化约定）
    console.error(`[fetchJson] 请求失败（网络/解析异常）: ${url}`, err);
    return null;
  }
}

/**
 * 声明式单资源获取 hook（供未来单接口页复用；四运维页当前沿用命令式 fetchJson 以适配分页 / 聚合）。
 * 返回 { data, error, loading, retry }，调用方据此渲染错误态与重试。
 */
export function useApiFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    const res = await fetchJson<T>(url);
    if (res === null) {
      setError('数据加载失败，请重试');
    } else {
      setData(res);
    }
    setLoading(false);
  }, [url]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, error, loading, retry: run };
}
