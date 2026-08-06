import { useEffect, useState } from 'react';

type PWAStatus = 'unsupported' | 'not_installed' | 'installed' | 'update_available';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAReturnValue {
  status: PWAStatus;
  updateAvailable: boolean;
  installPWA: () => Promise<boolean>;
  updatePWA: () => void;
  dismissUpdate: () => void;
  isInstalled: boolean;
  hasUpdate: boolean;
}

const PWA_STATUS: Record<string, PWAStatus> = {
  UNSUPPORTED: 'unsupported',
  NOT_INSTALLED: 'not_installed',
  INSTALLED: 'installed',
  UPDATE_AVAILABLE: 'update_available',
};

export const usePWA = (): PWAReturnValue => {
  const [status, setStatus] = useState<PWAStatus>(PWA_STATUS.NOT_INSTALLED);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

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

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    registerServiceWorker();

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const registerServiceWorker = async (): Promise<void> => {
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

  const installPWA = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      return true;
    }

    return false;
  };

  const updatePWA = (): void => {
    window.location.reload();
  };

  const dismissUpdate = (): void => {
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