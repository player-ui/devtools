export const getNowTime: () => number = globalThis.performance
  ? () => globalThis.performance.now()
  : () => Date.now();
