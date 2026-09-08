import { config, getApiUrl, getWebSocketUrl } from '../config';

interface Environment {
  isElectron: boolean;
  isWeb: boolean;
  isProduction: boolean;
  isDevelopment: boolean;
}

const isElectron = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { electronAPI?: unknown }).electronAPI !== 'undefined'
  );
};

const isWeb = (): boolean => {
  return !isElectron();
};

export const environment: Environment = {
  isElectron: isElectron(),
  isWeb: isWeb(),
  isProduction: config.app.isProduction,
  isDevelopment: config.app.isDevelopment,
};

export const getBaseURL = (): string => {
  if (isElectron()) {
    return 'http://localhost:5000';
  }
  return getApiUrl();
};

export const getWebSocketURL = (): string => {
  if (isElectron()) {
    return 'ws://localhost:5000';
  }
  return getWebSocketUrl();
};

export default environment;
