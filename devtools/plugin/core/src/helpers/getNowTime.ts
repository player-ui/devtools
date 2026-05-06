export const getNowTime = globalThis.performance
  ? () => globalThis.performance.now()
  : () => Date.now();
