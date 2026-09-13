/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useState } from 'react';
import api from '../../../services/api';
import type { DeviceManagementSharedDeps } from './shared';
import type { DeviceSecretStatus } from '../DeviceSecretPanel';

/**
 * 设备密钥域（差异 #4 阶段 3 前端，2026-09-12）。
 *
 * 负责：密钥状态查询、签发（明文一次性留存）、吊销。
 * 状态按 `selectedDevice.id` 变化自动刷新；密钥明文只在本 hook 内驻留，
 * 关闭设置弹窗时清空（避免长期停留在内存 / 被再次渲染）。
 */
export function useDeviceSecretDomain(deps: DeviceManagementSharedDeps) {
  const { showToast, confirmRef, selectedDevice, submitting } = deps;

  const [secretStatus, setSecretStatus] = useState<DeviceSecretStatus | null>(null);
  const [secretStatusLoading, setSecretStatusLoading] = useState<boolean>(false);
  const [issuedSecret, setIssuedSecret] = useState<string | null>(null);

  // Device.id 为 ID（string | number），接口要求 number，统一转换
  const deviceId = selectedDevice ? Number(selectedDevice.id) : null;

  const loadSecretStatus = useCallback(async (id: number) => {
    setSecretStatusLoading(true);
    try {
      const data = await api.devices.getSecretStatus(id);
      setSecretStatus({
        has_secret: data.has_secret,
        secret_issued_at: data.secret_issued_at,
        last_seen_ts: data.last_seen_ts,
      });
    } catch {
      // 状态加载失败不阻塞设备设置主流程：置 null，UI 显示「状态未加载」
      setSecretStatus(null);
    } finally {
      setSecretStatusLoading(false);
    }
  }, []);

  // 设备切换时刷新状态；无选中设备时重置
  useEffect(() => {
    if (deviceId === null) {
      setSecretStatus(null);
      setIssuedSecret(null);
      return;
    }
    setIssuedSecret(null);
    loadSecretStatus(deviceId);
  }, [deviceId, loadSecretStatus]);

  const handleIssueSecret = useCallback(async () => {
    if (deviceId === null) return;

    const isReset = secretStatus?.has_secret ?? false;
    if (isReset) {
      const ok = await confirmRef.current({
        title: '重置设备密钥',
        message: '重置后旧密钥立即失效，该设备必须烧录新密钥才能继续通过验签。确定重置？',
        confirmText: '重置',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
    }

    try {
      const data = await api.devices.issueSecret(deviceId);
      setIssuedSecret(data.device_secret);
      setSecretStatus({
        has_secret: true,
        secret_issued_at: data.secret_issued_at,
        last_seen_ts: secretStatus?.last_seen_ts ?? null,
      });
      showToast('success', '密钥已签发，请立即复制烧录（明文仅此一次可见）');
    } catch (error) {
      showToast('error', '签发密钥失败: ' + (error as Error).message);
    }
  }, [deviceId, secretStatus, showToast]);

  const handleRevokeSecret = useCallback(async () => {
    if (deviceId === null) return;

    const ok = await confirmRef.current({
      title: '吊销设备密钥',
      message:
        '吊销后该设备恢复为「免验签」状态，仍可正常上报数据（吊销不等于封禁）。若要拒绝未登记设备接入，请开启系统配置「设备白名单」。确定吊销？',
      confirmText: '吊销',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;

    try {
      await api.devices.revokeSecret(deviceId);
      setIssuedSecret(null);
      setSecretStatus({ has_secret: false, secret_issued_at: null, last_seen_ts: null });
      showToast('success', '密钥已吊销（该设备恢复为免验签状态）');
    } catch (error) {
      showToast('error', '吊销密钥失败: ' + (error as Error).message);
    }
  }, [deviceId, showToast]);

  /** 视图层包装：走统一提交守卫（避免连点重复签发）。 */
  const submitIssueSecret = useCallback(
    () => deps.runSubmit(handleIssueSecret),
    [deps.runSubmit, handleIssueSecret]
  );
  const submitRevokeSecret = useCallback(
    () => deps.runSubmit(handleRevokeSecret),
    [deps.runSubmit, handleRevokeSecret]
  );

  return {
    secretStatus,
    secretStatusLoading,
    issuedSecret,
    submitting,
    submitIssueSecret,
    submitRevokeSecret,
  };
}
