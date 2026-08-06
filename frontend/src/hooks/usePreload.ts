import { useCallback, useState } from 'react';
import { preloadService, PreloadConfig } from '../services/preloadService';

export function usePreload(enabled = true) {
  const [isPreloading, setIsPreloading] = useState(false);

  const preloadRoute = useCallback((route: string) => {
    if (!enabled) return;
    preloadService.preload(route);
  }, [enabled]);

  const preloadOnHover = useCallback((route: string) => {
    if (!enabled) return;
    preloadService.preloadOnHover(route);
  }, [enabled]);

  const registerRoutes = useCallback((configs: PreloadConfig[]) => {
    configs.forEach((config) => preloadService.register(config));
  }, []);

  const preloadPriorityRoutes = useCallback(async () => {
    if (!enabled) return;
    setIsPreloading(true);
    try {
      await preloadService.preloadPriorityRoutes();
    } finally {
      setIsPreloading(false);
    }
  }, [enabled]);

  return {
    isPreloading,
    preloadRoute,
    preloadOnHover,
    registerRoutes,
    preloadPriorityRoutes,
    getStats: preloadService.getStats.bind(preloadService),
  };
}
