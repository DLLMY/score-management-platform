import { useState } from 'react';
import { KeyRound, Copy, Check, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge, Button, PermissionButton } from '../../components';
import { formatDateTime } from '../../utils/format';

/** 密钥状态（由 GET /api/devices/<id>/secret 返回，不含明文）。 */
export interface DeviceSecretStatus {
  has_secret: boolean;
  secret_issued_at: string | null;
  last_seen_ts: number | null;
}

interface DeviceSecretPanelProps {
  /** 密钥签发/吊销进行中（由父级 submitting 透传，用于禁用按钮）。 */
  submitting: boolean;
  /** null = 状态未加载或加载失败。 */
  status: DeviceSecretStatus | null;
  statusLoading: boolean;
  /** 签发成功后返回的明文，仅此一次可见；null = 尚未签发过。 */
  issuedSecret: string | null;
  onIssue: () => void;
  onRevoke: () => void;
}

/**
 * 设备密钥管理面板（差异 #4 阶段 3 前端）。
 *
 * 契约（对应后端 `DeviceSecret` Resource）：
 * - 明文 `device_secret` **仅在签发响应中出现一次**，后端/前端均不再回显；
 * - 吊销 ≠ 封禁 —— 吊销后设备回到「未发放密钥」状态（验签放行），
 *   若要拒绝未登记设备，需另开系统配置 `device_whitelist_enabled`。
 */
export function DeviceSecretPanel({
  submitting,
  status,
  statusLoading,
  issuedSecret,
  onIssue,
  onRevoke,
}: DeviceSecretPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!issuedSecret) return;
    try {
      await navigator.clipboard.writeText(issuedSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用（非 HTTPS / 权限拒绝）时静默失败，明文仍可直接选中复制
      setCopied(false);
    }
  };

  const hasSecret = status?.has_secret ?? false;

  return (
    <div className='border-t border-gray-200 pt-4 mt-4'>
      <div className='flex items-center gap-2 mb-1'>
        <KeyRound className='w-4 h-4 text-gray-500' />
        <span className='text-sm font-medium text-gray-700'>设备密钥（HMAC 验签）</span>
        {statusLoading ? (
          <span className='text-xs text-gray-400'>加载中…</span>
        ) : status === null ? (
          <Badge variant='default'>状态未加载</Badge>
        ) : hasSecret ? (
          <Badge variant='success'>
            <ShieldCheck className='w-3 h-3 mr-1' />
            已签发
          </Badge>
        ) : (
          <Badge variant='default'>
            <ShieldAlert className='w-3 h-3 mr-1' />
            未签发
          </Badge>
        )}
      </div>

      <p className='text-xs text-gray-500 mb-3'>
        未签发密钥的设备**不校验签名**（宽容放行）。签发后该设备的上行须携带 ts / nonce / sig。
      </p>

      {status?.secret_issued_at && (
        <p className='text-xs text-gray-500 mb-2'>
          签发时间：{formatDateTime(status.secret_issued_at, '-')}
        </p>
      )}

      <div className='flex gap-2'>
        <PermissionButton
          permission='device.edit'
          variant={hasSecret ? 'secondary' : 'primary'}
          size='sm'
          disabled={submitting || statusLoading}
          onClick={onIssue}
        >
          {hasSecret ? '重置密钥' : '签发密钥'}
        </PermissionButton>
        <PermissionButton
          permission='device.edit'
          variant='danger'
          size='sm'
          disabled={submitting || statusLoading || !hasSecret}
          onClick={onRevoke}
        >
          吊销密钥
        </PermissionButton>
      </div>

      {issuedSecret && (
        <div className='mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200'>
          <p className='text-xs font-medium text-amber-800 mb-2'>
            ⚠️ 明文仅此一次可见，请立即复制并烧录到设备 NVS。关闭后将无法再次查看。
          </p>
          <div className='flex items-center gap-2'>
            <code className='flex-1 px-2 py-1.5 text-xs font-mono bg-white border border-amber-300 rounded break-all select-all'>
              {issuedSecret}
            </code>
            <Button variant='secondary' size='sm' onClick={handleCopy}>
              {copied ? <Check className='w-4 h-4' /> : <Copy className='w-4 h-4' />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
