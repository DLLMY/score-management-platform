import { useEffect, useState } from 'react';

const PWA_STATUS = {
  UNSUPPORTED: 'unsupported',
  NOT_INSTALLED: 'not_installed',
  INSTALLED: 'installed',
  UPDATE_AVAILABLE: 'update_available',
};

export const usePWA = () => {
  const [status, setStatus] = useState(PWA_STATUS.NOT_INSTALLED);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setStatus(PWA_STATUS.UNSUPPORTED);
      return;
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setStatus(PWA_STATUS.INSTALLED);
    }

    const handleAppInstalled = () => {
      setStatus(PWA_STATUS.INSTALLED);
      setDeferredPrompt(null);
    };

    navigator.webdriver?.addEventListener('appinstalled', handleAppInstalled);

    registerServiceWorker();

    return () => {
      navigator.webdriver?.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
              setStatus(PWA_STATUS.UPDATE_AVAILABLE);
            }
          });
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  };

  const installPWA = async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      return true;
    }

    return false;
  };

  const updatePWA = () => {
    window.location.reload();
  };

  const dismissUpdate = () => {
    setUpdateAvailable(false);
    setStatus(PWA_STATUS.INSTALLED);
  };

  return {
    status,
    updateAvailable,
    installPWA,
    updatePWA,
    dismissUpdate,
    isInstalled: status === PWA_STATUS.INSTALLED || status === PWA_STATUS.UPDATE_AVAILABLE,
    hasUpdate: status === PWA_STATUS.UPDATE_AVAILABLE,
  };
};

export default usePWA;
