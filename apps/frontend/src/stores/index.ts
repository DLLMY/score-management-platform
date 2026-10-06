/**
 * 统一状态管理 - Zustand Stores 聚合出口
 *
 * 各 store 已拆分至独立模块（globalStore / toastStore / themeStore /
 * websocketStore / permissionStore），本文件仅作 barrel 再导出，保持全仓
 * `import { useXStore } from './stores'` 调用方式完全不变。
 */
import { useGlobalStore } from './globalStore';
import { useToastStore } from './toastStore';
import { useThemeStore } from './themeStore';
import { useWebSocketStore } from './websocketStore';
import { usePermissionStore } from './permissionStore';

export { useGlobalStore, useToastStore, useThemeStore, useWebSocketStore, usePermissionStore };

export const stores = {
  global: useGlobalStore,
  toast: useToastStore,
  theme: useThemeStore,
  websocket: useWebSocketStore,
  permission: usePermissionStore,
};

// 初始化所有stores
export const initStores = (): void => {
  useThemeStore.getState().initTheme();
  useGlobalStore.getState().initNetworkListener();

  const adminStr = localStorage.getItem('admin');
  if (adminStr) {
    try {
      const admin = JSON.parse(adminStr);
      usePermissionStore.getState().loadPermissions(admin.id);
    } catch {}
  }
};
