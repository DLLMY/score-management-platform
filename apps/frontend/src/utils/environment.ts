import { config } from '../config';

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

export default environment;
