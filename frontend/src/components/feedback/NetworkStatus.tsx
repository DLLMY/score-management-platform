import { useEffect, useState } from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

function NetworkStatus() {
  const { isOnline, connectionType, downlink } = useNetworkStatus();
  const [showBanner, setShowBanner] = useState(!isOnline);

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
    } else {
      const timer = setTimeout(() => setShowBanner(false), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOnline]);

  if (!showBanner && isOnline) return null;

  const getConnectionLabel = () => {
    if (!isOnline) return '离线';
    switch (connectionType) {
      case 'slow-2g':
      case '2g':
        return '网络较慢';
      case '3g':
        return '3G网络';
      case '4g':
      case '5g':
        return '网络良好';
      default:
        return '网络稳定';
    }
  };

  const getConnectionColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (connectionType === 'slow-2g' || connectionType === '2g' || (downlink && downlink < 1)) {
      return 'bg-yellow-500';
    }
    return 'bg-green-500';
  };

  const getIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4" />;
    if (connectionType === 'slow-2g' || connectionType === '2g' || (downlink && downlink < 1)) {
      return <AlertTriangle className="w-4 h-4" />;
    }
    return <Wifi className="w-4 h-4" />;
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${getConnectionColor()} text-white py-2 px-4 shadow-lg transition-all duration-300 ${
        showBanner ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
        {getIcon()}
        <span className="text-sm font-medium">{getConnectionLabel()}</span>
        {isOnline && downlink && (
          <span className="text-xs opacity-80">{downlink.toFixed(1)} Mbps</span>
        )}
      </div>
    </div>
  );
}

export default NetworkStatus;