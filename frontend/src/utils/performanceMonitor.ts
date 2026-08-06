interface PerformanceEntry {
  id: string;
  type: 'api' | 'component' | 'render';
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  details?: Record<string, unknown>;
}

interface PerformanceStats {
  totalRequests: number;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  slowRequests: number;
  errors: number;
  cacheHits: number;
  coalescedRequests: number;
}

class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private stats: PerformanceStats = {
    totalRequests: 0,
    avgResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
    slowRequests: 0,
    errors: 0,
    cacheHits: 0,
    coalescedRequests: 0,
  };
  private slowThreshold = 3000;
  private maxEntries = 1000;
  private listeners: Set<(stats: PerformanceStats) => void> = new Set();

  start(name: string, type: PerformanceEntry['type'], details?: Record<string, unknown>): string {
    const id = `${type}:${name}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const entry: PerformanceEntry = {
      id,
      type,
      name,
      duration: 0,
      startTime: performance.now(),
      endTime: 0,
      details,
    };
    this.entries.push(entry);
    return id;
  }

  end(id: string): PerformanceEntry | undefined {
    const entry = this.entries.find((e) => e.id === id);
    if (entry) {
      entry.endTime = performance.now();
      entry.duration = entry.endTime - entry.startTime;

      if (entry.type === 'api') {
        this.updateApiStats(entry);
      }

      if (this.entries.length > this.maxEntries) {
        this.entries.shift();
      }

      this.notifyListeners();
      return entry;
    }
    return undefined;
  }

  private updateApiStats(entry: PerformanceEntry): void {
    this.stats.totalRequests++;
    this.stats.avgResponseTime = (this.stats.avgResponseTime * (this.stats.totalRequests - 1) + entry.duration) / this.stats.totalRequests;
    this.stats.maxResponseTime = Math.max(this.stats.maxResponseTime, entry.duration);
    this.stats.minResponseTime = Math.min(this.stats.minResponseTime, entry.duration);

    if (entry.duration > this.slowThreshold) {
      this.stats.slowRequests++;
    }

    if (entry.details?.cacheHit) {
      this.stats.cacheHits++;
    }

    if (entry.details?.coalesced) {
      this.stats.coalescedRequests++;
    }
  }

  recordError(name: string): void {
    this.stats.errors++;
    this.notifyListeners();
  }

  recordCacheHit(): void {
    this.stats.cacheHits++;
    this.notifyListeners();
  }

  recordCoalescedRequest(): void {
    this.stats.coalescedRequests++;
    this.notifyListeners();
  }

  getStats(): PerformanceStats {
    return { ...this.stats };
  }

  getRecentEntries(count: number = 20): PerformanceEntry[] {
    return [...this.entries].reverse().slice(0, count);
  }

  getSlowRequests(): PerformanceEntry[] {
    return this.entries.filter((e) => e.duration > this.slowThreshold).sort((a, b) => b.duration - a.duration);
  }

  subscribe(listener: (stats: PerformanceStats) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener({ ...this.stats });
      } catch (error) {
        console.error('Performance monitor listener error:', error);
      }
    });
  }

  reset(): void {
    this.entries = [];
    this.stats = {
      totalRequests: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      slowRequests: 0,
      errors: 0,
      cacheHits: 0,
      coalescedRequests: 0,
    };
    this.notifyListeners();
  }

  logSummary(): void {
    const stats = this.getStats();
    console.log('[Performance Monitor Summary]');
    console.log(`  Total Requests: ${stats.totalRequests}`);
    console.log(`  Average Response Time: ${stats.avgResponseTime.toFixed(2)}ms`);
    console.log(`  Max Response Time: ${stats.maxResponseTime.toFixed(2)}ms`);
    console.log(`  Min Response Time: ${stats.minResponseTime.toFixed(2)}ms`);
    console.log(`  Slow Requests (>${this.slowThreshold}ms): ${stats.slowRequests}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Cache Hits: ${stats.cacheHits}`);
    console.log(`  Coalesced Requests: ${stats.coalescedRequests}`);
  }

  getSlowThreshold(): number {
    return this.slowThreshold;
  }

  setSlowThreshold(threshold: number): void {
    this.slowThreshold = threshold;
  }
}

export const performanceMonitor = new PerformanceMonitor();

export const monitorApiRequest = <T>(name: string, fetcher: () => Promise<T>): Promise<T> => {
  const id = performanceMonitor.start(name, 'api');
  return fetcher().then(
    (result) => {
      performanceMonitor.end(id);
      return result;
    },
    (error) => {
      performanceMonitor.end(id);
      performanceMonitor.recordError(name);
      throw error;
    }
  );
};

export const withPerformanceMonitoring = <T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  name: string
): T => {
  return ((...args: unknown[]) => {
    const id = performanceMonitor.start(name, 'api');
    return fn(...args).then(
      (result) => {
        performanceMonitor.end(id);
        return result;
      },
      (error) => {
        performanceMonitor.end(id);
        performanceMonitor.recordError(name);
        throw error;
      }
    );
  }) as T;
};

export { PerformanceMonitor };