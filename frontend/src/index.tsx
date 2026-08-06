import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initVitalsMonitor } from './utils/webVitals';
import { config } from './config';
import './utils/errorMonitor';

if (config.devTools.enabled) {
  initVitalsMonitor();
}

const rootElement = document.getElementById('root') as HTMLElement;
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);