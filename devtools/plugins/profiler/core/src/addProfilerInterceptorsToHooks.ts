import {
  AsyncParallelBailHook,
  AsyncParallelHook,
  AsyncSeriesBailHook,
  AsyncSeriesHook,
  AsyncSeriesLoopHook,
  AsyncSeriesWaterfallHook,
  SyncBailHook,
  SyncHook,
  SyncLoopHook,
  SyncWaterfallHook,
} from "tapable-ts";
import { Profiler } from "./helpers";

/* Paths to hooks to ignore.
 * Currently ignoring "view" hook on player since it acts as a shortcut to the viewController's view hook. Including it would duplicate a lot of profiling work.
 */
const IGNORED_PATHS = [["view"]];

// Would love to just check if things are `Hook` but tapable-ts doesn't export the base class ;-;
type AnyHook =
  | AsyncParallelBailHook<unknown[], unknown>
  | AsyncParallelHook<unknown[]>
  | AsyncSeriesBailHook<unknown[], unknown>
  | AsyncSeriesHook<unknown[]>
  | AsyncSeriesLoopHook<unknown[]>
  | AsyncSeriesWaterfallHook<unknown[]>
  | SyncBailHook<unknown[], unknown>
  | SyncHook<unknown[]>
  | SyncLoopHook<unknown[]>
  | SyncWaterfallHook<unknown[]>;

// Note: cannot use instanceof to check against the hook classes due to how JS is loaded in swift and kotlin
const isAnyHook = (obj: unknown): obj is AnyHook => {
  return (
    isRecordType(obj) &&
    "intercept" in obj &&
    typeof obj.intercept === "function"
  );
};

/** Recursively add profiler interceptors to each hook in the "hooks" property of obj. */
export const addProfilerInterceptorsToHooks = (
  obj: unknown,
  profiler: Profiler,
  currentPath: string[] = [],
  intercepted: WeakSet<object> = new WeakSet()
): void => {
  if (!hasHooks(obj)) {
    return;
  }

  Object.entries(obj.hooks).forEach(([key, value]) => {
    const nextPath = [...currentPath, key];
    if (
      !isAnyHook(value) ||
      IGNORED_PATHS.some((path) => isMatchingPaths(path, nextPath)) ||
      intercepted.has(value)
    ) {
      return;
    }

    intercepted.add(value);

    value.intercept({
      call: (...args) => {
        if (args.length > 0) {
          addProfilerInterceptorsToHooks(
            args[0],
            profiler,
            nextPath,
            intercepted
          );
        }

        profiler.startTimer(key);
      },
      done: () => {
        profiler.endTimer({ hookName: key });
      },
      result: () => {
        profiler.endTimer({ hookName: key });
      },
      error: () => {
        profiler.endTimer({ hookName: key });
      },
    });
  });
};

// TODO: Move all these where they should be
export const isMatchingPaths = (path1: string[], path2: string[]): boolean => {
  if (path1.length !== path2.length) return false;

  return path1.every((val, idx) => val === path2[idx]);
};

export type ObjectWithHooks = {
  hooks: Record<PropertyKey, unknown>;
};

export const isRecordType = <T>(obj: unknown): obj is Record<PropertyKey, T> =>
  typeof obj === "object" && obj !== null && !Array.isArray(obj);

export const hasHooks = (obj: unknown): obj is ObjectWithHooks => {
  return isRecordType(obj) && "hooks" in obj && isRecordType(obj.hooks);
};
