import logger from './logger';
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;

  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const isAndroid = (): boolean => {
  if (typeof window === 'undefined') return false;

  return /Android/i.test(navigator.userAgent);
};

export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;

  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

export const getScreenSize = (): 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' => {
  if (typeof window === 'undefined') return 'lg';

  const width = window.innerWidth;

  if (width < 576) return 'xs';
  if (width < 768) return 'sm';
  if (width < 992) return 'md';
  if (width < 1200) return 'lg';
  if (width < 1400) return 'xl';
  return 'xxl';
};

const isLandscape = (): boolean => {
  if (typeof window === 'undefined') return false;

  return window.innerHeight < window.innerWidth;
};

const isRetina = (): boolean => {
  if (typeof window === 'undefined') return false;

  return !!(window.devicePixelRatio && window.devicePixelRatio >= 2);
};

const getViewportHeight = (): number => {
  if (typeof window === 'undefined') return 0;

  const height = window.innerHeight;
  const outerHeight = window.outerHeight;

  if (outerHeight - height > 0) {
    return height;
  }

  return height;
};

const lockScroll = (): void => {
  if (typeof document === 'undefined') return;

  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
};

const unlockScroll = (): void => {
  if (typeof document === 'undefined') return;

  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.width = '';
};

const formatNumberMobile = (num: number): string => {
  if (num >= 10000000) {
    return `${(num / 10000000).toFixed(1)}千万`;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}千`;
  }
  return num.toString();
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand('copy');
    return true;
  } catch (err) {
    logger.error('Failed to copy:', err);
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};

interface ShareContentOptions {
  title: string;
  text: string;
  url?: string;
}

const shareContent = async ({ title, text, url }: ShareContentOptions): Promise<boolean> => {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        logger.error('Share failed:', err);
      }
      return false;
    }
  }

  if (url) {
    return await copyToClipboard(url);
  }

  return false;
};

const makePhoneCall = (phoneNumber: string): void => {
  if (typeof window === 'undefined') return;

  window.location.href = `tel:${phoneNumber}`;
};

const sendSMS = (phoneNumber: string, message = ''): void => {
  if (typeof window === 'undefined') return;

  window.location.href = `sms:${phoneNumber}${
    message ? `?body=${encodeURIComponent(message)}` : ''
  }`;
};

const openMap = (latitude: number, longitude: number, label = ''): void => {
  if (typeof window === 'undefined') return;

  const isIOSDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isIOSDevice) {
    window.location.href = `maps://?ll=${latitude},${longitude}&q=${encodeURIComponent(label)}`;
  } else {
    window.location.href = `geo:${latitude},${longitude}?q=${encodeURIComponent(label)}`;
  }
};

const vibrate = (pattern: number | number[] = 50): void => {
  if (typeof navigator === 'undefined') return;

  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const getSafeArea = (): SafeArea => {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const computedStyle = getComputedStyle(document.documentElement);

  return {
    top: parseInt(computedStyle.getPropertyValue('--sat') || '0'),
    right: parseInt(computedStyle.getPropertyValue('--sar') || '0'),
    bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0'),
    left: parseInt(computedStyle.getPropertyValue('--sal') || '0'),
  };
};

const preloadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

export const throttle = <T extends (...args: unknown[]) => void>(func: T, limit: number): T => {
  let inThrottle = false;

  return function (this: unknown, ...args: unknown[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  } as T;
};

export const debounce = <T extends (...args: unknown[]) => void>(func: T, wait: number): T => {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return function (this: unknown, ...args: unknown[]) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  } as T;
};

const MobileUtils = {
  isMobileDevice,
  isIOS,
  isAndroid,
  getDeviceType,
  getScreenSize,
  isLandscape,
  isRetina,
  getViewportHeight,
  lockScroll,
  unlockScroll,
  debounce,
  throttle,
  formatNumberMobile,
  copyToClipboard,
  shareContent,
  makePhoneCall,
  sendSMS,
  openMap,
  vibrate,
  getSafeArea,
  preloadImage,
};

export default MobileUtils;
