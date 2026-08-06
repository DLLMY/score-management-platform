/**
 * 统一环境变量访问器
 * =====================
 * 同时兼容两种构建工具：
 *  - CRA (react-scripts)：通过 webpack DefinePlugin 注入 process.env（含 REACT_APP_*）
 *  - Vite：通过 import.meta.env 暴露变量，并在 vite.config.ts 用 envPrefix 包含 REACT_APP_*
 *
 * 任何读取环境变量的代码都应从这里导入，避免浏览器环境下直接访问 process.env 报错。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>;

// Vite 的 import.meta.env 在 CRA 构建时不存在，使用 any 兜底，并用 typeof 守卫。
const metaEnv: AnyRecord | undefined =
  typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;

// 浏览器环境中 process 不一定存在，typeof 守卫确保安全。
const procEnv: AnyRecord =
  typeof process !== 'undefined' ? (process as any).env : {};

export const isDevelopment: boolean = metaEnv
  ? Boolean(metaEnv.DEV) || metaEnv.MODE === 'development'
  : procEnv.NODE_ENV === 'development';

export const isProduction: boolean = metaEnv
  ? Boolean(metaEnv.PROD) || metaEnv.MODE === 'production'
  : procEnv.NODE_ENV === 'production';

// 合并两条来源；Vite 的 import.meta.env 优先级更高（同源变量以后者为准）。
const mergedEnv: AnyRecord = { ...procEnv, ...metaEnv };

export const getEnv = (key: string, defaultValue?: string): string =>
  (mergedEnv[key] as string | undefined) || defaultValue || '';

export const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = mergedEnv[key];
  return value ? parseInt(String(value), 10) : defaultValue;
};

export const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = mergedEnv[key];
  if (value === undefined || value === null) return defaultValue;
  return String(value).toLowerCase() === 'true';
};
/* eslint-enable @typescript-eslint/no-explicit-any */
