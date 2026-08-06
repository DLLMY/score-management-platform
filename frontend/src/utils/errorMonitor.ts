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
        this.originalConsoleError(`[ErrorMonitor] [${errorData.type}] ${errorData.message}`, errorData);
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
