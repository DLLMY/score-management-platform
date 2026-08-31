import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { preloadService } from '../services/preloadService';

export function PreloadProvider() {
  const location = useLocation();

  useEffect(() => {
    // 记录当前路由访问
    preloadService.recordVisit(location.pathname);

    // 预加载当前路由的依赖
    preloadService.preloadDependencies(location.pathname);
  }, [location.pathname]);

  return null;
}

export default PreloadProvider;
