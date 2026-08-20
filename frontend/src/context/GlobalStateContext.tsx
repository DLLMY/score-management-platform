import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface UserInfo {
  id: number;
  username: string;
  role: string;
  avatar?: string;
}

interface GlobalStateContextValue {
  user: UserInfo | null;
  setUser: (user: UserInfo | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  clearAuth: () => void;
}

interface GlobalStateProviderProps {
  children: ReactNode;
}

const GlobalStateContext = createContext<GlobalStateContextValue | null>(null);

export function GlobalStateProvider({ children }: GlobalStateProviderProps): ReactNode {
  const [user, setUserState] = useState<UserInfo | null>(() => {
    try {
      const saved = localStorage.getItem('admin');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(false);

  // 十评 P2-1：refresh_token 由后端 HttpOnly cookie 管理，前端不再持有

  useEffect(() => {
    if (user) {
      localStorage.setItem('admin', JSON.stringify(user));
    } else {
      localStorage.removeItem('admin');
    }
  }, [user]);

  const setUser = useCallback((newUser: UserInfo | null) => {
    setUserState(newUser);
  }, []);

  const clearAuth = useCallback(() => {
    setUserState(null);
    // 十评 P2-1：凭证在 HttpOnly cookie，登出走后端 /logout 清除
    localStorage.removeItem('token');
    localStorage.removeItem('csrf_token');
  }, []);

  const value: GlobalStateContextValue = {
    user,
    setUser,
    isLoading,
    setIsLoading,
    clearAuth,
  };

  return <GlobalStateContext.Provider value={value}>{children}</GlobalStateContext.Provider>;
}

export function useGlobalState(): GlobalStateContextValue {
  const context = useContext(GlobalStateContext);
  if (!context) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
}

export default GlobalStateContext;
