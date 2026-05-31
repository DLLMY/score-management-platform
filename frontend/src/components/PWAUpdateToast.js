import { usePWA } from '../hooks/usePWA';
import Button from './Button';

const PWAUpdateToast = () => {
  const { hasUpdate, updatePWA, dismissUpdate } = usePWA();

  if (!hasUpdate) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        background: 'white',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        maxWidth: '320px',
        animation: 'slideIn 0.3s ease',
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          <span style={{ fontSize: '18px' }}>🚀</span>
          <span
            style={{
              fontWeight: 600,
              fontSize: '14px',
              color: '#1F2937',
            }}
          >
            发现新版本
          </span>
        </div>
        <p
          style={{
            fontSize: '13px',
            color: '#6B7280',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          积分管理平台已更新到最新版本，包含性能优化和新功能。
        </p>
      </div>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}
      >
        <Button variant='ghost' size='small' onClick={dismissUpdate} style={{ fontSize: '12px' }}>
          稍后
        </Button>
        <Button variant='primary' size='small' onClick={updatePWA} style={{ fontSize: '12px' }}>
          立即更新
        </Button>
      </div>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default PWAUpdateToast;
