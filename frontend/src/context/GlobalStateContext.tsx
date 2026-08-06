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
  refreshToken: string | null;
  setRefreshToken: (token: string | null) => void;
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

  const [refreshToken, setRefreshTokenState] = useState<string | null>(() => {
    return localStorage.getItem('refresh_token');
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('admin', JSON.stringify(user));
    } else {
      localStorage.removeItem('admin');
    }
  }, [user]);

  useEffect(() => {
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      localStorage.removeItem('refresh_token');
    }
  }, [refreshToken]);

  const setUser = useCallback((newUser: UserInfo | null) => {
    setUserState(newUser);
  }, []);

  const setRefreshToken = useCallback((token: string | null) => {
    setRefreshTokenState(token);
  }, []);

  const clearAuth = useCallback(() => {
    setUserState(null);
    setRefreshTokenState(null);
    localStorage.removeItem('token');
    localStorage.removeItem('csrf_token');
  }, []);

  const value: GlobalStateContextValue = {
    user,
    setUser,
    isLoading,
    setIsLoading,
    refreshToken,
    setRefreshToken,
    clearAuth,
  };

  return (
    <GlobalStateContext.Provider value={value}>
      {children}
    </GlobalStateContext.Provider>
  );
}

export function useGlobalState(): GlobalStateContextValue {
  const context = useContext(GlobalStateContext);
  if (!context) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
}

export default GlobalStateContext;
