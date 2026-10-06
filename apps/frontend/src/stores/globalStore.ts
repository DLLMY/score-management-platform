import { create } from 'zustand';
import { useToastStore } from './toastStore';

interface GlobalState {
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  isOnline: boolean;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setOnline: (status: boolean) => void;
  initNetworkListener: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const useGlobalStore = create<GlobalState>()((set) => ({
  isLoading: false,
  loadingMessage: '',
  error: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  showLoading: (message = '加载中...') => set({ isLoading: true, loadingMessage: message }),
  hideLoading: () => set({ isLoading: false, loadingMessage: '' }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setOnline: (status) => set({ isOnline: status }),
  initNetworkListener: () => {
    window.addEventListener('online', () => {
      set({ isOnline: true });
      useToastStore.getState().addToast('网络连接已恢复', 'success');
    });
    window.addEventListener('offline', () => {
      set({ isOnline: false });
      useToastStore.getState().addToast('网络连接已断开，请检查网络', 'error');
    });
  },
  showToast: (message, type = 'success') => {
    useToastStore.getState().addToast(message, type);
  },
}));
