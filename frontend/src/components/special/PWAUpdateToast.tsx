import { CSSProperties } from 'react';
import { usePWA } from '../../hooks/usePWA';
import Button from '../ui/Button';

const PWAUpdateToast = () => {
  const { hasUpdate, updatePWA, dismissUpdate } = usePWA();

  if (!hasUpdate) return null;

  const containerStyle: CSSProperties = {
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
  };

  const headerStyle: CSSProperties = {
    marginBottom: '12px',
  };

  const titleContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  };

  const emojiStyle: CSSProperties = {
    fontSize: '18px',
  };

  const titleStyle: CSSProperties = {
    fontWeight: 600,
    fontSize: '14px',
    color: '#1F2937',
  };

  const descriptionStyle: CSSProperties = {
    fontSize: '13px',
    color: '#6B7280',
    lineHeight: 1.5,
    margin: 0,
  };

  const buttonContainerStyle: CSSProperties = {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  };

  const buttonStyle: CSSProperties = {
    fontSize: '12px',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleContainerStyle}>
          <span style={emojiStyle}>🚀</span>
          <span style={titleStyle}>发现新版本</span>
        </div>
        <p style={descriptionStyle}>
          积分管理平台已更新到最新版本，包含性能优化和新功能。
        </p>
      </div>
      <div style={buttonContainerStyle}>
        <Button variant='ghost' size='sm' onClick={dismissUpdate} style={buttonStyle}>
          稍后
        </Button>
        <Button variant='primary' size='sm' onClick={updatePWA} style={buttonStyle}>
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