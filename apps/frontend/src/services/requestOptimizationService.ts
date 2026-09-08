/**
 * 请求优化服务
 * 提供请求优先级队列、防抖、节流、批量合并等功能
 */

// ============================================
// 请求优先级定义
// ============================================
export enum RequestPriority {
  HIGH = 1, // 高优先级：用户交互、关键数据
  NORMAL = 2, // 正常优先级：常规数据请求
  LOW = 3, // 低优先级：预加载、后台数据
  BACKGROUND = 4, // 后台优先级：统计分析、日志上报
}

// ============================================
// 请求队列配置
// ============================================
interface RequestQueueConfig {
  maxConcurrent: number; // 最大并发数
  highPrioritySlots: number; // 高优先级预留槽位
  queueTimeout: number; // 队列等待超时时间(ms)
}

const DEFAULT_QUEUE_CONFIG: RequestQueueConfig = {
  maxConcurrent: 6,
  highPrioritySlots: 2,
  queueTimeout: 30000,
};

// ============================================
// 防抖/节流配置
// ============================================
interface DebounceConfig {
  delay: number; // 防抖延迟时间(ms)
  maxWait?: number; // 最大等待时间(ms)
}

interface ThrottleConfig {
  interval: number; // 节流间隔时间(ms)
  leading?: boolean; // 是否在开始时立即执行
  trailing?: boolean; // 是否在结束时执行
}

// ============================================
// 请求队列项
// ============================================
interface QueueItem {
  id: string;
  priority: RequestPriority;
  request: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timestamp: number;
  timeoutId?: number;
}

// ============================================
// 请求优化服务类
// ============================================
class RequestOptimizationService {
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private config: RequestQueueConfig;
  private debounceMap = new Map<
    string,
    {
      timeoutId: number;
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      request: () => Promise<unknown>;
      maxWaitTimeoutId?: number;
    }
  >();
  private throttleMap = new Map<
    string,
    { lastExecuteTime: number; timeoutId?: number; pendingRequest?: () => Promise<unknown> }
  >();
  private batchMap = new Map<
    string,
    {
      requests: Array<{
        data: unknown;
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
      }>;
      timeoutId: number;
      batchHandler: (items: unknown[]) => Promise<unknown[]>;
    }
  >();

  constructor(config: RequestQueueConfig = DEFAULT_QUEUE_CONFIG) {
    this.config = config;
  }

  // ============================================
  // 请求优先级队列
  // ============================================

  /**
   * 将请求加入优先级队列
   */
  enqueue<T>(
    request: () => Promise<T>,
    priority: RequestPriority = RequestPriority.NORMAL,
    timeout?: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const item: QueueItem = {
        id,
        priority,
        request: request as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: Date.now(),
      };

      // 设置超时
      const queueTimeout = timeout || this.config.queueTimeout;
      item.timeoutId = window.setTimeout(() => {
        this.removeFromQueue(id);
        reject(new Error(`请求队列超时 (${queueTimeout}ms)`));
      }, queueTimeout);

      // 按优先级插入队列
      this.insertByPriority(item);

      // 尝试执行队列中的请求
      this.processQueue();
    });
  }

  /**
   * 按优先级插入队列
   */
  private insertByPriority(item: QueueItem): void {
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (item.priority < this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    this.queue.splice(insertIndex, 0, item);
  }

  /**
   * 从队列移除请求
   */
  private removeFromQueue(id: string): void {
    const index = this.queue.findIndex((item) => item.id === id);
    if (index !== -1) {
      const item = this.queue[index];
      if (item.timeoutId) {
        clearTimeout(item.timeoutId);
      }
      this.queue.splice(index, 1);
    }
  }

  /**
   * 处理队列中的请求
   */
  private processQueue(): void {
    // 计算可用槽位
    const availableSlots = this.config.maxConcurrent - this.activeCount;
    if (availableSlots <= 0) return;

    // 优先处理高优先级请求
    const highPriorityItems = this.queue.filter(
      (item) => item.priority === RequestPriority.HIGH || item.priority === RequestPriority.NORMAL
    );

    // 限制每次处理的数量
    const itemsToProcess = highPriorityItems.slice(0, availableSlots);

    for (const item of itemsToProcess) {
      this.executeQueueItem(item);
    }
  }

  /**
   * 执行队列项
   */
  private executeQueueItem(item: QueueItem): void {
    this.removeFromQueue(item.id);
    this.activeCount++;

    item
      .request()
      .then((result) => {
        item.resolve(result);
      })
      .catch((error) => {
        item.reject(error);
      })
      .finally(() => {
        this.activeCount--;
        this.processQueue();
      });
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueLength: number;
    activeCount: number;
    highPriorityCount: number;
    lowPriorityCount: number;
  } {
    return {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
      highPriorityCount: this.queue.filter((item) => item.priority <= RequestPriority.NORMAL)
        .length,
      lowPriorityCount: this.queue.filter((item) => item.priority >= RequestPriority.LOW).length,
    };
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    for (const item of this.queue) {
      if (item.timeoutId) {
        clearTimeout(item.timeoutId);
      }
      item.reject(new Error('队列已清空'));
    }
    this.queue = [];
  }

  // ============================================
  // 防抖
  // ============================================

  /**
   * 防抖请求
   * 在指定延迟时间内，如果再次调用，则重新计时
   */
  debounce<T>(
    key: string,
    request: () => Promise<T>,
    config: DebounceConfig = { delay: 300 }
  ): Promise<T> {
    // 清除之前的定时器
    const existing = this.debounceMap.get(key);
    if (existing) {
      clearTimeout(existing.timeoutId);
      if (existing.maxWaitTimeoutId) {
        clearTimeout(existing.maxWaitTimeoutId);
      }
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.debounceMap.delete(key);
        request().then(resolve).catch(reject);
      }, config.delay);

      // 最大等待时间配置
      let maxWaitTimeoutId: number | undefined;
      if (config.maxWait) {
        maxWaitTimeoutId = window.setTimeout(() => {
          this.debounceMap.delete(key);
          clearTimeout(timeoutId);
          request().then(resolve).catch(reject);
        }, config.maxWait);
      }

      this.debounceMap.set(key, {
        timeoutId,
        maxWaitTimeoutId,
        resolve: resolve as (value: unknown) => void,
        reject,
        request: request as () => Promise<unknown>,
      });
    });
  }

  /**
   * 立即执行防抖请求
   */
  flushDebounce(key: string): void {
    const existing = this.debounceMap.get(key);
    if (existing) {
      clearTimeout(existing.timeoutId);
      if (existing.maxWaitTimeoutId) {
        clearTimeout(existing.maxWaitTimeoutId);
      }
      this.debounceMap.delete(key);
      existing.request().then(existing.resolve).catch(existing.reject);
    }
  }

  /**
   * 取消防抖请求
   */
  cancelDebounce(key: string): void {
    const existing = this.debounceMap.get(key);
    if (existing) {
      clearTimeout(existing.timeoutId);
      if (existing.maxWaitTimeoutId) {
        clearTimeout(existing.maxWaitTimeoutId);
      }
      this.debounceMap.delete(key);
      existing.reject(new Error('防抖请求已取消'));
    }
  }

  // ============================================
  // 节流
  // ============================================

  /**
   * 节流请求
   * 在指定间隔时间内，只执行一次请求
   */
  throttle<T>(
    key: string,
    request: () => Promise<T>,
    config: ThrottleConfig = { interval: 1000, leading: true, trailing: false }
  ): Promise<T> {
    const now = Date.now();
    const existing = this.throttleMap.get(key);

    // 如果在间隔时间内，且leading为false，则跳过首次执行
    if (existing && now - existing.lastExecuteTime < config.interval) {
      // trailing模式：保存待执行的请求
      if (config.trailing) {
        existing.pendingRequest = request as () => Promise<unknown>;

        // 清除之前的trailing定时器
        if (existing.timeoutId) {
          clearTimeout(existing.timeoutId);
        }

        // 设置trailing定时器
        existing.timeoutId = window.setTimeout(() => {
          if (existing.pendingRequest) {
            existing.lastExecuteTime = Date.now();
            existing
              .pendingRequest()
              .then(() => {
                existing.pendingRequest = undefined;
              })
              .catch(() => {
                existing.pendingRequest = undefined;
              });
          }
        }, config.interval - (now - existing.lastExecuteTime));
      }

      // 返回一个等待的Promise（使用上次的结果或等待新结果）
      return new Promise<T>((resolve, reject) => {
        // 如果有pending请求，等待它完成
        if (config.trailing && existing.pendingRequest) {
          existing
            .pendingRequest()
            .then((result: unknown) => resolve(result as T))
            .catch(reject);
        } else {
          // 否则立即返回（跳过本次请求）
          resolve(undefined as T);
        }
      });
    }

    // 可以执行请求
    return new Promise((resolve, reject) => {
      // 更新执行时间
      this.throttleMap.set(key, {
        lastExecuteTime: now,
        timeoutId: undefined,
        pendingRequest: undefined,
      });

      // leading模式：立即执行
      if (config.leading) {
        request().then(resolve).catch(reject);
      } else {
        // 非leading模式：延迟执行
        const timeoutId = window.setTimeout(() => {
          request().then(resolve).catch(reject);
          this.throttleMap.get(key)?.timeoutId &&
            clearTimeout(this.throttleMap.get(key)!.timeoutId!);
        }, config.interval);

        this.throttleMap.set(key, {
          lastExecuteTime: now,
          timeoutId,
          pendingRequest: undefined,
        });
      }
    });
  }

  /**
   * 取消节流请求
   */
  cancelThrottle(key: string): void {
    const existing = this.throttleMap.get(key);
    if (existing) {
      if (existing.timeoutId) {
        clearTimeout(existing.timeoutId);
      }
      this.throttleMap.delete(key);
    }
  }

  // ============================================
  // 批量请求合并
  // ============================================

  /**
   * 批量请求合并
   * 在指定窗口时间内，将多个相同类型的请求合并为一个批量请求
   */
  batch<T>(
    key: string,
    data: unknown,
    batchHandler: (items: unknown[]) => Promise<T[]>,
    windowMs: number = 100
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // 获取或创建批量队列
      let batch = this.batchMap.get(key);

      if (!batch || batch.timeoutId === 0) {
        // 创建新的批量队列
        const timeoutId = window.setTimeout(() => {
          this.executeBatch(key);
        }, windowMs);

        batch = {
          requests: [],
          timeoutId,
          batchHandler,
        };
        this.batchMap.set(key, batch);
      }

      // 将请求加入批量队列
      batch.requests.push({
        data,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });
  }

  /**
   * 执行批量请求
   */
  private async executeBatch(key: string): Promise<void> {
    const batch = this.batchMap.get(key);
    if (!batch || batch.requests.length === 0) {
      this.batchMap.delete(key);
      return;
    }

    // 清除定时器
    clearTimeout(batch.timeoutId);

    // 提取所有数据
    const items = batch.requests.map((r) => r.data);

    try {
      // 执行批量请求
      const results = await batch.batchHandler(items);

      // 分发结果
      batch.requests.forEach((request, index) => {
        request.resolve(results[index]);
      });
    } catch (error) {
      // 分发错误
      batch.requests.forEach((request) => {
        request.reject(error as Error);
      });
    }

    // 清除批量队列
    this.batchMap.delete(key);
  }

  /**
   * 立即执行批量请求
   */
  flushBatch(key: string): void {
    this.executeBatch(key);
  }

  /**
   * 取消批量请求
   */
  cancelBatch(key: string): void {
    const batch = this.batchMap.get(key);
    if (batch) {
      clearTimeout(batch.timeoutId);
      batch.requests.forEach((request) => {
        request.reject(new Error('批量请求已取消'));
      });
      this.batchMap.delete(key);
    }
  }

  // ============================================
  // 清理所有待处理请求
  // ============================================

  /**
   * 清理所有待处理的请求
   */
  cleanup(): void {
    this.clearQueue();

    // 清理所有防抖请求
    this.debounceMap.forEach((_, key) => {
      this.cancelDebounce(key);
    });

    // 清理所有节流请求
    this.throttleMap.forEach((_, key) => {
      this.cancelThrottle(key);
    });

    // 清理所有批量请求
    this.batchMap.forEach((_, key) => {
      this.cancelBatch(key);
    });
  }
}

// ============================================
// 全局实例和导出
// ============================================
export const requestOptimizationService = new RequestOptimizationService();

// ============================================
// 便捷函数
// ============================================

/**
 * 高优先级请求
 */
export const highPriorityRequest = <T>(request: () => Promise<T>): Promise<T> => {
  return requestOptimizationService.enqueue(request, RequestPriority.HIGH);
};

/**
 * 低优先级请求（适合预加载）
 */
export const lowPriorityRequest = <T>(request: () => Promise<T>): Promise<T> => {
  return requestOptimizationService.enqueue(request, RequestPriority.LOW);
};

/**
 * 后台请求（适合日志上报、统计分析）
 */
export const backgroundRequest = <T>(request: () => Promise<T>): Promise<T> => {
  return requestOptimizationService.enqueue(request, RequestPriority.BACKGROUND);
};

/**
 * 防抖请求便捷函数
 */
export const debounceRequest = <T>(
  key: string,
  request: () => Promise<T>,
  delay: number = 300
): Promise<T> => {
  return requestOptimizationService.debounce(key, request, { delay });
};

/**
 * 节流请求便捷函数
 */
export const throttleRequest = <T>(
  key: string,
  request: () => Promise<T>,
  interval: number = 1000
): Promise<T> => {
  return requestOptimizationService.throttle(key, request, {
    interval,
    leading: true,
    trailing: false,
  });
};

/**
 * 批量请求便捷函数
 */
export const batchRequest = <T>(
  key: string,
  data: unknown,
  batchHandler: (items: unknown[]) => Promise<T[]>,
  windowMs: number = 100
): Promise<T> => {
  return requestOptimizationService.batch(key, data, batchHandler, windowMs);
};

export default requestOptimizationService;
