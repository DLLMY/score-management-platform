import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import type { ClassNowStatus } from '../services/api';

/**
 * 拦截口径，必须逐条对应后端：
 * - 'broadcast' → is_broadcast_blocked()：全局 TimeRule 时段 或 任意班级在上课
 * - 'class'     → is_notification_allowed(target_class_info_id)：全局时段 或 该班在上课
 * - 'global'    → is_notification_allowed(None)：仅全局时段（如 /test、无设备的积分变化通知）
 */
export type BlockScope = 'broadcast' | 'class' | 'global';

export interface ClassNowStatusResult {
  /** 后端返回的原始实时状态（首次加载完成前为 null） */
  status: ClassNowStatus | null;
  /** 首次加载中 */
  loading: boolean;
  /** 拉取失败的原因（失败时不阻断页面，仅置灰徽章） */
  error: string | null;
  /** 当前下发是否会被后端拦截（与后端判定口径一致） */
  blocked: boolean;
  /** 徽章文案，例如「高一(3)班 第3节《数学》上课中」 */
  label: string;
  /** 手动立即刷新一次 */
  refresh: () => void;
}

const DEFAULT_INTERVAL_MS = 60_000;

/**
 * 轮询「班级实时上课状态」。
 *
 * 拦截口径必须与后端一致：
 * - scope='class'（指定班级/设备）→ 全局 TimeRule 时段 或 该班课表在上课
 * - scope='broadcast'（广播）      → 全局 TimeRule 时段 或 任意班级在上课
 *
 * 进页面查一次 + 每 60s 轮询 + classInfoId 变化立即重查 + unmount 清定时器。
 */
export function useClassNowStatus(
  classInfoId?: number,
  options?: { scope?: BlockScope; enabled?: boolean; intervalMs?: number; deviceId?: string },
): ClassNowStatusResult {
  const deviceId = options?.deviceId;
  const scope: BlockScope = options?.scope ?? (classInfoId || deviceId ? 'class' : 'broadcast');
  const enabled = options?.enabled ?? true;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  const [status, setStatus] = useState<ClassNowStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  // 避免卸载后 setState，以及并发请求乱序覆盖
  const mountedRef = useRef(true);
  const reqSeqRef = useRef(0);

  const fetchStatus = useCallback(async () => {
    if (!enabled) return;
    const seq = ++reqSeqRef.current;
    try {
      const data = await api.courseSchedules.getNow(classInfoId, deviceId);
      if (!mountedRef.current || seq !== reqSeqRef.current) return;
      setStatus(data);
      setError(null);
    } catch (e) {
      if (!mountedRef.current || seq !== reqSeqRef.current) return;
      setError((e as Error)?.message || '获取上课状态失败');
    } finally {
      if (mountedRef.current && seq === reqSeqRef.current) setLoading(false);
    }
  }, [classInfoId, deviceId, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    setLoading(true);
    fetchStatus();
    const timer = window.setInterval(fetchStatus, intervalMs);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
    };
  }, [fetchStatus, enabled, intervalMs]);

  const blocked = (() => {
    if (!status) return false;
    if (status.is_during_class_time) return true;
    if (scope === 'global') return false;
    return scope === 'broadcast' ? !!status.any_in_session : !!status.in_session;
  })();

  const label = (() => {
    if (!enabled) return '';
    if (loading) return '正在获取上课状态…';
    if (error) return '上课状态未知';
    if (!status) return '上课状态未知';

    if (status.is_during_class_time) {
      const ruleName = status.global_rule?.name;
      return ruleName ? `全校${ruleName}，下发已暂停` : '当前处于限制时段，下发已暂停';
    }

    if (scope === 'class' && status.in_session) {
      const cls = status.class_name || '该班级';
      const subject = status.subject_name || '自习';
      const period = status.period ? `第${status.period.period_number}节` : '';
      return `${cls} ${period}《${subject}》上课中`;
    }

    if (scope === 'broadcast' && status.any_in_session) {
      const period = status.period ? `第${status.period.period_number}节` : '';
      return `有班级${period}正在上课，广播已暂停`;
    }

    if (scope === 'class' && !status.in_session) {
      return status.period ? `目标班级当前${status.period.name}未排课，可正常下发` : '目标班级当前不在上课，可正常下发';
    }

    return status.period ? `当前${status.period.name}（非上课），可正常下发` : '当前非上课时间，可正常下发';
  })();

  return { status, loading, error, blocked, label, refresh: fetchStatus };
}

export default useClassNowStatus;
