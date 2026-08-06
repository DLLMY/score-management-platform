interface RequestConfig {
  url: string;
  method: string;
  params?: Record<string, unknown>;
  body?: unknown;
}

interface CoalescedRequest<T> {
  promise: Promise<T>;
  resolvers: ((data: unknown) => void)[];
  rejectors: ((error: unknown) => void)[];
  createdAt: number;
  config: RequestConfig;
}

class RequestCoalescer {
  private pendingRequests = new Map<string, CoalescedRequest<unknown>>();
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
  private maxCacheTTL = 60000;
  private cleanupInterval: number | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = window.setInterval(() => {
      const now = Date.now();
      this.cache.forEach((entry, key) => {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      });
    }, 30000);
  }

  private getRequestKey(config: RequestConfig): string {
    const { url, method, params, body } = config;
    const paramsStr = params ? JSON.stringify(params) : '';
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${paramsStr}:${bodyStr}`;
  }

  coalesce<T>(
    config: RequestConfig,
    fetcher: () => Promise<T>,
    ttl: number = 5000
  ): Promise<T> {
    const key = this.getRequestKey(config);

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return Promise.resolve(cached.data as T);
    }

    const existing = this.pendingRequests.get(key);
    if (existing) {
      return new Promise<T>((resolve, reject) => {
        existing.resolvers.push(resolve as (data: unknown) => void);
        existing.rejectors.push(reject as (error: unknown) => void);
      });
    }

    const resolvers: ((data: unknown) => void)[] = [];
    const rejectors: ((error: unknown) => void)[] = [];

    const promise = fetcher().then(
      (data) => {
        this.cache.set(key, { data, timestamp: Date.now(), ttl });
        
        resolvers.forEach((resolve) => resolve(data));
        return data;
      },
      (error) => {
        rejectors.forEach((reject) => reject(error));
        throw error;
      }
    ).finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, {
      promise,
      resolvers,
      rejectors,
      createdAt: Date.now(),
      config,
    });

    return promise;
  }

  invalidateCache(url: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(url)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  clearAll(): void {
    this.pendingRequests.clear();
    this.cache.clear();
  }

  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clearAll();
  }
}

export const requestCoalescer = new RequestCoalescer();

export const coalesceRequest = <T>(
  config: RequestConfig,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> => {
  return requestCoalescer.coalesce(config, fetcher, ttl);
};

export const invalidateRequestCache = (url: string): void => {
  requestCoalescer.invalidateCache(url);
};

export const clearAllRequestCache = (): void => {
  requestCoalescer.clearAll();
};

export { RequestCoalescer };