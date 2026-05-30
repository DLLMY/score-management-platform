import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initVitalsMonitor } from './utils/webVitals';

const isDev = process.env.REACT_APP_ENABLE_DEV_TOOLS === 'true';

if (isDev) {
  initVitalsMonitor();
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
