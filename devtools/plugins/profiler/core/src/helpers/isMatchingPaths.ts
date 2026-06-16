export const isMatchingPaths = (path1: string[], path2: string[]): boolean => {
  if (path1.length !== path2.length) return false;

  return path1.every((val, idx) => val === path2[idx]);
};
