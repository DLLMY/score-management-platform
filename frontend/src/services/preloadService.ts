import { ComponentType } from 'react';

export interface PreloadConfig {
  route: string;
  component: React.FC & { preload?: () => Promise<ComponentType> };
  priority: 'high' | 'medium' | 'low';
  preloadOnHover?: boolean;
  preloadOnVisit?: boolean;
  dependencies?: string[];
}

export interface PreloadStats {
  route: string;
  loaded: boolean;
  loadTime: number;
  visitCount: number;
  lastVisitTime: number | null;
}

interface PreloadEntry {
  config: PreloadConfig;
  stats: PreloadStats;
}

class PreloadService {
  private preloadMap = new Map<string, PreloadEntry>();
  private loadingPromises = new Map<string, Promise<unknown>>();
  private enabled = true;

  register(config: PreloadConfig): void {
    if (this.preloadMap.has(config.route)) {
      return;
    }

    this.preloadMap.set(config.route, {
      config,
      stats: {
        route: config.route,
        loaded: false,
        loadTime: 0,
        visitCount: 0,
        lastVisitTime: null,
      },
    });

    // 如果设置了 preloadOnVisit，且该路由已被访问过，立即预加载
    if (config.preloadOnVisit) {
      const visitCount = this.getVisitCount(config.route);
      if (visitCount > 0) {
        this.preload(config.route);
      }
    }
  }

  preload(route: string): Promise<unknown> | null {
    if (!this.enabled) return null;

    const entry = this.preloadMap.get(route);
    if (!entry) return null;

    if (entry.stats.loaded) return Promise.resolve(null);
    if (this.loadingPromises.has(route)) {
      return this.loadingPromises.get(route) || null;
    }

    const { preload } = entry.config.component;
    if (!preload) return null;

    const startTime = performance.now();
    const promise = preload()
      .then(() => {
        entry.stats.loaded = true;
        entry.stats.loadTime = performance.now() - startTime;
        this.loadingPromises.delete(route);
      })
      .catch(() => {
        this.loadingPromises.delete(route);
      });

    this.loadingPromises.set(route, promise);
    return promise;
  }

  preloadOnHover(route: string): void {
    const entry = this.preloadMap.get(route);
    if (!entry || !entry.config.preloadOnHover) return;

    this.preload(route);
  }

  recordVisit(route: string): void {
    const entry = this.preloadMap.get(route);
    if (!entry) return;

    entry.stats.visitCount++;
    entry.stats.lastVisitTime = Date.now();

    // 更新本地存储
    const visits = this.getVisits();
    visits[route] = (visits[route] || 0) + 1;
    localStorage.setItem('route_visits', JSON.stringify(visits));

    // 如果设置了 preloadOnVisit，下次访问前预加载
    if (entry.config.preloadOnVisit && !entry.stats.loaded) {
      this.preload(route);
    }
  }

  async preloadPriorityRoutes(): Promise<void> {
    if (!this.enabled) return;

    const priorityRoutes = Array.from(this.preloadMap.values())
      .filter((entry) => entry.config.priority === 'high')
      .map((entry) => entry.config.route);

    for (const route of priorityRoutes) {
      await this.preload(route);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  preloadDependencies(route: string): void {
    const entry = this.preloadMap.get(route);
    if (!entry || !entry.config.dependencies) return;

    entry.config.dependencies.forEach((depRoute) => {
      this.preload(depRoute);
    });
  }

  getStats(route?: string): PreloadStats | PreloadStats[] {
    if (route) {
      const entry = this.preloadMap.get(route);
      return entry ? entry.stats : this.createEmptyStats(route);
    }

    return Array.from(this.preloadMap.values()).map((entry) => entry.stats);
  }

  private createEmptyStats(route: string): PreloadStats {
    return {
      route,
      loaded: false,
      loadTime: 0,
      visitCount: 0,
      lastVisitTime: null,
    };
  }

  private getVisitCount(route: string): number {
    try {
      const visits = JSON.parse(localStorage.getItem('route_visits') || '{}');
      return visits[route] || 0;
    } catch {
      return 0;
    }
  }

  private getVisits(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem('route_visits') || '{}');
    } catch {
      return {};
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  clearCache(): void {
    this.loadingPromises.clear();
    this.preloadMap.forEach((entry) => {
      entry.stats.loaded = false;
      entry.stats.loadTime = 0;
    });
  }
}

export const preloadService = new PreloadService();
