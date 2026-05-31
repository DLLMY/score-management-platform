let vitals = {
  CLS: 0,
  FID: 0,
  LCP: 0,
  FCP: 0,
  TTFB: 0,
};

const observers = [];

export const observeVitals = (callback) => {
  observers.push(callback);
  return () => {
    const index = observers.indexOf(callback);
    if (index > -1) observers.splice(index, 1);
  };
};

const notifyObservers = () => {
  observers.forEach((cb) => cb(vitals));
};

const measureTTFB = () => {
  try {
    const [entry] = performance.getEntriesByType('navigation');
    if (entry) {
      vitals.TTFB = entry.responseStart;
      notifyObservers();
    }
  } catch (e) {}
};

const measureFCP = () => {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          vitals.FCP = entry.startTime;
          notifyObservers();
          observer.disconnect();
        }
      }
    });
    observer.observe({ entryTypes: ['paint'] });
  } catch (e) {}
};

const measureLCP = () => {
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      vitals.LCP = lastEntry.startTime;
      notifyObservers();
    });
    observer.observe({ entryTypes: ['largest-contentful-paint'] });
    return () => observer.disconnect();
  } catch (e) {}
};

const measureCLS = () => {
  try {
    let clsValue = 0;
    let sessionValue = 0;
    let sessionEntries = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          const firstSessionEntry = sessionEntries[0];
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

          if (
            sessionValue &&
            entry.startTime - lastSessionEntry.startTime < 1000 &&
            entry.startTime - firstSessionEntry.startTime < 5000
          ) {
            sessionValue += entry.value;
            sessionEntries.push(entry);
          } else {
            sessionValue = entry.value;
            sessionEntries = [entry];
          }

          if (sessionValue > clsValue) {
            clsValue = sessionValue;
            vitals.CLS = clsValue;
            notifyObservers();
          }
        }
      }
    });
    observer.observe({ entryTypes: ['layout-shift'] });
    return () => observer.disconnect();
  } catch (e) {}
};

const measureFID = () => {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        vitals.FID = entry.processingStart - entry.startTime;
        notifyObservers();
        observer.disconnect();
      }
    });
    observer.observe({ entryTypes: ['first-input'] });
    return () => observer.disconnect();
  } catch (e) {}
};

export const initVitalsMonitor = () => {
  if (process.env.REACT_APP_ENABLE_DEV_TOOLS !== 'true') return;

  console.group('🔍 Web Vitals Monitor');
  measureTTFB();
  measureFCP();
  const cleanupLCP = measureLCP();
  const cleanupCLS = measureCLS();
  const cleanupFID = measureFID();
  console.groupEnd();

  return () => {
    cleanupLCP?.();
    cleanupCLS?.();
    cleanupFID?.();
  };
};

export const getVitals = () => ({ ...vitals });
