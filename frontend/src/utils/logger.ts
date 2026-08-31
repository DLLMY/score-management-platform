/* eslint-disable no-console */
// 统一日志出口：当前直接代理 console，便于后续集中接入分级/远端上报，
// 而不在前端各文件散落 console.* 调用（保持 no-console 规则为 warn 时的整洁）。
const logger = {
  log: (...args: unknown[]): void => console.log(...args),
  info: (...args: unknown[]): void => console.info(...args),
  warn: (...args: unknown[]): void => console.warn(...args),
  error: (...args: unknown[]): void => console.error(...args),
  debug: (...args: unknown[]): void => console.debug(...args),
};

export default logger;
