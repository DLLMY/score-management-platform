import logger from './logger';
/* eslint-disable no-console */
import { performanceReportingService } from '../services/performanceReportingService';
import { config } from '../config';

interface Vitals {
  CLS: number;
  FID: number;
  LCP: number;
  FCP: number;
  TTFB: number;
}

interface LayoutShift {
  value: number;
  hadRecentInput: boolean;
  startTime: number;
}

interface FirstInputEntry {
  processingStart: number;
  startTime: number;
}

let vitals: Vitals = {
  CLS: 0,
  FID: 0,
  LCP: 0,
  FCP: 0,
  TTFB: 0,
};

type VitalsCallback = (vitals: Vitals) => void;

const observers: VitalsCallback[] = [];

type ReportingServiceType =
  typeof import('../services/performanceReportingService').performanceReportingService;

let reportingService: ReportingServiceType | null = null;

const lazyLoadReportingService = (): ReportingServiceType => {
  if (!reportingService) {
    reportingService = performanceReportingService;
  }
  return reportingService!;
};

export const observeVitals = (callback: VitalsCallback): (() => void) => {
  observers.push(callback);
  return () => {
    const index = observers.indexOf(callback);
    if (index > -1) observers.splice(index, 1);
  };
};

const notifyObservers = (): void => {
  observers.forEach((cb) => cb(vitals));
};

const reportVital = (name: string, value: number): void => {
  try {
    const service = lazyLoadReportingService();
    service.reportWebVital(name, value);
  } catch (e) {
    logger.warn('上报Web Vitals失败:', e);
  }
};

const measureTTFB = (): void => {
  try {
    const [entry] = performance.getEntriesByType('navigation');
    if (entry) {
      vitals.TTFB = (entry as PerformanceNavigationTiming).responseStart;
      notifyObservers();
      reportVital('TTFB', vitals.TTFB);
      logger.log(`📊 TTFB: ${vitals.TTFB.toFixed(2)}ms`);
    }
  } catch (e) {}
};

const measureFCP = (): void => {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          vitals.FCP = entry.startTime;
          notifyObservers();
          reportVital('FCP', vitals.FCP);
          logger.log(`📊 FCP: ${vitals.FCP.toFixed(2)}ms`);
          observer.disconnect();
        }
      }
    });
    observer.observe({ entryTypes: ['paint'] });
  } catch (e) {}
};

const measureLCP = (): (() => void) | undefined => {
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      vitals.LCP = lastEntry.startTime;
      notifyObservers();
      reportVital('LCP', vitals.LCP);
      logger.log(`📊 LCP: ${vitals.LCP.toFixed(2)}ms`);
    });
    observer.observe({ entryTypes: ['largest-contentful-paint'] });
    return () => observer.disconnect();
  } catch (e) {
    return undefined;
  }
};

const measureCLS = (): (() => void) | undefined => {
  try {
    let clsValue = 0;
    let sessionValue = 0;
    let sessionEntries: PerformanceEntry[] = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutEntry = entry as unknown as LayoutShift;
        if (!layoutEntry.hadRecentInput) {
          const firstSessionEntry = sessionEntries[0];
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

          if (
            sessionValue &&
            entry.startTime - lastSessionEntry.startTime < 1000 &&
            entry.startTime - firstSessionEntry.startTime < 5000
          ) {
            sessionValue += layoutEntry.value;
            sessionEntries.push(entry);
          } else {
            sessionValue = layoutEntry.value;
            sessionEntries = [entry];
          }

          if (sessionValue > clsValue) {
            clsValue = sessionValue;
            vitals.CLS = clsValue;
            notifyObservers();
            reportVital('CLS', vitals.CLS);
            logger.log(`📊 CLS: ${vitals.CLS.toFixed(4)}`);
          }
        }
      }
    });
    observer.observe({ entryTypes: ['layout-shift'] });
    return () => observer.disconnect();
  } catch (e) {
    return undefined;
  }
};

const measureFID = (): (() => void) | undefined => {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const inputEntry = entry as unknown as FirstInputEntry;
        vitals.FID = inputEntry.processingStart - inputEntry.startTime;
        notifyObservers();
        reportVital('FID', vitals.FID);
        logger.log(`📊 FID: ${vitals.FID.toFixed(2)}ms`);
        observer.disconnect();
      }
    });
    observer.observe({ entryTypes: ['first-input'] });
    return () => observer.disconnect();
  } catch (e) {
    return undefined;
  }
};

const measureINP = (): (() => void) | undefined => {
  try {
    let inpValue = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const inputEntry = entry as unknown as { processingEnd: number; startTime: number };
        const duration = inputEntry.processingEnd - inputEntry.startTime;
        if (duration > inpValue) {
          inpValue = duration;
          reportVital('INP', inpValue);
          logger.log(`📊 INP: ${inpValue.toFixed(2)}ms`);
        }
      }
    });
    observer.observe({ entryTypes: ['event'] });
    return () => observer.disconnect();
  } catch (e) {
    return undefined;
  }
};

export const initVitalsMonitor = (): (() => void) | undefined => {
  try {
    if (!config.devTools.enabled) return undefined;

    console.group('🔍 Web Vitals Monitor');
    measureTTFB();
    measureFCP();
    const cleanupLCP = measureLCP();
    const cleanupCLS = measureCLS();
    const cleanupFID = measureFID();
    const cleanupINP = measureINP();
    console.groupEnd();

    return () => {
      cleanupLCP?.();
      cleanupCLS?.();
      cleanupFID?.();
      cleanupINP?.();
    };
  } catch (error) {
    logger.warn('初始化Web Vitals监控失败:', error);
    return undefined;
  }
};

export const getVitals = (): Vitals => ({ ...vitals });
