import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' },
] as const;

const STORAGE_KEY = 'app_lang';

function getInitialLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh-CN' || stored === 'en-US') {
      return stored;
    }
  } catch {
    // localStorage 可能在隐私模式不可用，忽略
  }
  const nav = navigator.language || 'zh-CN';
  return nav.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
}

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // ignore
  }
});

export default i18n;
