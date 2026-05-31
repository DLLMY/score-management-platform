import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      login: (token, user) => set({
        token,
        user,
        isAuthenticated: true,
      }),

      logout: () => set({
        token: null,
        user: null,
        isAuthenticated: false,
      }),

      updateUser: (userData) => set({
        user: { ...get().user, ...userData },
      }),

      getToken: () => get().token,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export const useUserStore = create((set, get) => ({
  users: [],
  selectedUser: null,
  loading: false,
  error: null,

  setUsers: (users) => set({ users }),

  addUser: (user) => set((state) => ({
    users: [...state.users, user],
  })),

  updateUser: (userId, updates) => set((state) => ({
    users: state.users.map((u) =>
      u.id === userId ? { ...u, ...updates } : u
    ),
  })),

  deleteUser: (userId) => set((state) => ({
    users: state.users.filter((u) => u.id !== userId),
  })),

  setSelectedUser: (user) => set({ selectedUser: user }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}));

export const useDeviceStore = create((set, get) => ({
  devices: [],
  selectedDevice: null,
  deviceStatuses: {},
  loading: false,
  error: null,

  setDevices: (devices) => set({ devices }),

  addDevice: (device) => set((state) => ({
    devices: [...state.devices, device],
  })),

  updateDevice: (deviceId, updates) => set((state) => ({
    devices: state.devices.map((d) =>
      d.id === deviceId ? { ...d, ...updates } : d
    ),
  })),

  deleteDevice: (deviceId) => set((state) => ({
    devices: state.devices.filter((d) => d.id !== deviceId),
  })),

  setDeviceStatus: (deviceId, status) => set((state) => ({
    deviceStatuses: {
      ...state.deviceStatuses,
      [deviceId]: status,
    },
  })),

  setSelectedDevice: (device) => set({ selectedDevice: device }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}));

export const useScoreStore = create((set, get) => ({
  rules: [],
  records: [],
  selectedRule: null,
  loading: false,
  error: null,

  setRules: (rules) => set({ rules }),

  addRule: (rule) => set((state) => ({
    rules: [...state.rules, rule],
  })),

  updateRule: (ruleId, updates) => set((state) => ({
    rules: state.rules.map((r) =>
      r.id === ruleId ? { ...r, ...updates } : r
    ),
  })),

  deleteRule: (ruleId) => set((state) => ({
    rules: state.rules.filter((r) => r.id !== ruleId),
  })),

  setRecords: (records) => set({ records }),

  addRecord: (record) => set((state) => ({
    records: [record, ...state.records],
  })),

  setSelectedRule: (rule) => set({ selectedRule: rule }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}));

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications],
    unreadCount: state.unreadCount + 1,
  })),

  markAsRead: (notificationId) => set((state) => ({
    notifications: state.notifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1),
  })),

  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0,
  })),

  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
  }),

  clearNotifications: () => set({
    notifications: [],
    unreadCount: 0,
  }),
}));

export const useUIStore = create(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      theme: 'light',
      compactMode: false,

      toggleSidebar: () => set((state) => ({
        sidebarOpen: !state.sidebarOpen,
      })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setTheme: (theme) => set({ theme }),

      toggleCompactMode: () => set((state) => ({
        compactMode: !state.compactMode,
      })),
    }),
    {
      name: 'ui-settings',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        compactMode: state.compactMode,
      }),
    }
  )
);

export const useDashboardStore = create((set) => ({
  stats: null,
  recentActivity: [],
  loading: false,
  error: null,

  setStats: (stats) => set({ stats }),

  setRecentActivity: (activity) => set({ recentActivity: activity }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),
}));
