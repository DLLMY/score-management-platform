import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  connectionType: 'slow-2g' | '2g' | '3g' | '4g' | '5g' | 'unknown' | null;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
}

interface NetworkConnection {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
}

const useNetworkStatus = (): NetworkStatus => {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    connectionType: null,
    effectiveType: null,
    downlink: null,
    rtt: null,
  });

  const updateConnectionInfo = useCallback(() => {
    const nav = navigator as unknown as {
      connection?: NetworkConnection;
      mozConnection?: NetworkConnection;
      webkitConnection?: NetworkConnection;
    };
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (connection) {
      setStatus((prev) => ({
        ...prev,
        connectionType: (connection.effectiveType as NetworkStatus['connectionType']) || 'unknown',
        effectiveType: connection.effectiveType || null,
        downlink: connection.downlink || null,
        rtt: connection.rtt || null,
      }));
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    const handleConnectionChange = () => {
      updateConnectionInfo();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const nav = navigator as unknown as {
      connection?: NetworkConnection;
      mozConnection?: NetworkConnection;
      webkitConnection?: NetworkConnection;
    };
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
      updateConnectionInfo();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [updateConnectionInfo]);

  return status;
};

export { useNetworkStatus };
export type { NetworkStatus };
