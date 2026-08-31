/* eslint-disable no-console */
import { performanceReportingService } from '../services/performanceReportingService';
import { isDevelopment } from '../config/env';

interface ErrorContext {
  component?: string;
  action?: string;
  url?: string;
  method?: string;
  status?: number;
  timestamp?: string;
  user_agent?: string;
}

class ErrorMonitor {
  private readonly isDev: boolean;
  private errorCount = 0;
  private maxErrorsPerSession = 50;
  private isReporting = false;
  private originalConsoleError: (...args: unknown[]) => void;
  private ignoredErrors: Set<string> = new Set([
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Script error.',
  ]);
  // 同错误去重节流：轮询/重试场景同一错误会高频重复（如后端重启窗口期
  // /api/devices 超时每 10s 一次），30s 窗口内同 key 只上报一次，避免刷屏。
  private dedupeWindowMs = 30000;
  private recentlyReported: Map<string, number> = new Map();

  constructor() {
    this.isDev = isDevelopment;
    this.originalConsoleError = console.error.bind(console);
    this.init();
  }

  private init(): void {
    this.setupGlobalErrorHandler();
    this.setupPromiseRejectionHandler();
    this.setupConsoleErrorHook();
  }

  private setupGlobalErrorHandler(): void {
    const originalHandler = window.onerror;

    window.onerror = (message, source, lineno, colno, error): boolean => {
      const messageStr = String(message);
      if (this.isIgnoredError(messageStr)) {
        return originalHandler?.(message, source, lineno, colno, error) ?? false;
      }

      if (this.errorCount < this.maxErrorsPerSession) {
        this.reportError({
          type: 'global_error',
          message: messageStr,
          stack: error?.stack,
          file: source,
          line: lineno,
          column: colno,
        });
      }

      return originalHandler?.(message, source, lineno, colno, error) ?? false;
    };
  }

  private setupPromiseRejectionHandler(): void {
    const originalHandler = window.onunhandledrejection;

    const handler = (event: PromiseRejectionEvent): void => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);

      if (this.isIgnoredError(message)) {
        originalHandler?.call(window, event);
        return;
      }

      if (this.errorCount < this.maxErrorsPerSession) {
        this.reportError({
          type: 'unhandled_rejection',
          message,
          stack: reason instanceof Error ? reason.stack : undefined,
        });
      }

      originalHandler?.call(window, event);
    };

    window.addEventListener('unhandledrejection', handler);
  }

  private setupConsoleErrorHook(): void {
    const originalError = console.error;

    console.error = (...args: unknown[]): void => {
      originalError.apply(console, args);

      if (this.isReporting) {
        return;
      }

      const message = args
        .map((arg) => {
          if (arg instanceof Error) {
            return arg.message;
          }
          if (arg instanceof Object) {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      if (this.isIgnoredError(message)) {
        return;
      }

      if (message.includes('[ErrorMonitor]')) {
        return;
      }

      if (this.errorCount < this.maxErrorsPerSession) {
        let stack: string | undefined;
        for (const arg of args) {
          if (arg instanceof Error && arg.stack) {
            stack = arg.stack;
            break;
          }
        }

        this.reportError({
          type: 'console_error',
          message,
          stack,
        });
      }
    };
  }

  private isIgnoredError(message: string): boolean {
    return this.ignoredErrors.has(message) || this.ignoredErrors.has(String(message).trim());
  }

  /**
   * 去重节流：同一错误（type+url+method+status+message 摘要）在 dedupeWindowMs 内
   * 已上报过则跳过（静默，不重复打印/上报），避免轮询风暴刷屏。
   */
  private isDuplicated(data: {
    type: string;
    message: string;
    url?: string;
    method?: string;
    status?: number;
  }): boolean {
    const now = Date.now();
    const key = [
      data.type,
      data.url || '',
      data.method || '',
      data.status ?? '',
      String(data.message).slice(0, 80),
    ].join('|');
    const last = this.recentlyReported.get(key);
    if (last !== undefined && now - last < this.dedupeWindowMs) {
      return true;
    }
    // 定期清理过期 key，避免 Map 无限增长
    if (this.recentlyReported.size > 200) {
      for (const [k, ts] of this.recentlyReported) {
        if (now - ts >= this.dedupeWindowMs) {
          this.recentlyReported.delete(k);
        }
      }
    }
    this.recentlyReported.set(key, now);
    return false;
  }

  reportError(errorData: {
    type: string;
    message: string;
    stack?: string;
    file?: string;
    line?: number;
    column?: number;
    url?: string;
    method?: string;
    status?: number;
    data?: Record<string, unknown>;
  }): void {
    if (this.isReporting) {
      return;
    }

    if (this.errorCount >= this.maxErrorsPerSession) {
      if (this.isDev) {
        this.originalConsoleError('[ErrorMonitor] 错误上报已达到上限');
      }
      return;
    }

    // 同错误 30s 去重：轮询/重试导致的重复错误不再刷屏
    if (this.isDuplicated(errorData)) {
      return;
    }

    this.isReporting = true;
    this.errorCount++;

    try {
      performanceReportingService.reportError({
        type: errorData.type,
        message: errorData.message,
        stack: errorData.stack,
        file: errorData.file,
        line: errorData.line,
        column: errorData.column,
        url: errorData.url,
        method: errorData.method,
        status: errorData.status,
        data: errorData.data,
      });

      if (this.isDev) {
        this.originalConsoleError(
          `[ErrorMonitor] [${errorData.type}] ${errorData.message}`,
          errorData
        );
      }
    } finally {
      this.isReporting = false;
    }
  }

  reportApiError(url: string, method: string, status: number, message: string): void {
    this.reportError({
      type: 'api_error',
      message,
      url,
      method,
      status,
    });
  }

  reportReactError(error: Error, info: { componentStack?: string }): void {
    this.reportError({
      type: 'react_error',
      message: error.message,
      stack: info.componentStack || error.stack,
    });
  }

  reportValidationError(field: string, message: string, context?: ErrorContext): void {
    this.reportError({
      type: 'validation_error',
      message: `${field}: ${message}`,
      data: { field, context },
    });
  }

  reportNetworkError(url: string, error: Error): void {
    this.reportError({
      type: 'network_error',
      message: error.message,
      url,
      stack: error.stack,
    });
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  resetErrorCount(): void {
    this.errorCount = 0;
  }

  addIgnoredError(message: string): void {
    this.ignoredErrors.add(message);
  }

  removeIgnoredError(message: string): void {
    this.ignoredErrors.delete(message);
  }
}

export const errorMonitor = new ErrorMonitor();
