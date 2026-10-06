import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 主题状态 - Theme Store
interface ThemeState {
  theme: 'light' | 'dark';
  initTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  applyTheme: () => void;
  isDark: () => boolean;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light' as const,

      initTheme: () => {
        const saved = localStorage.getItem('theme-storage');
        if (saved) {
          const parsed = JSON.parse(saved);
          set({ theme: parsed.state?.theme || 'light' });
        } else {
          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          set({ theme: systemDark ? 'dark' : 'light' });
        }
        get().applyTheme();
      },

      setTheme: (theme) => {
        set({ theme });
        get().applyTheme();
      },

      toggleTheme: () => {
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        }));
        get().applyTheme();
      },

      applyTheme: () => {
        const { theme } = get();
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },

      isDark: () => get().theme === 'dark',
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
