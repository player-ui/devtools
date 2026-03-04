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
import { Profiler, ProfilerNode } from "./types";

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

const isAnyHook = (obj: unknown): obj is AnyHook => {
  return (
    obj instanceof AsyncParallelBailHook ||
    obj instanceof AsyncParallelHook ||
    obj instanceof AsyncSeriesBailHook ||
    obj instanceof AsyncSeriesHook ||
    obj instanceof AsyncSeriesLoopHook ||
    obj instanceof AsyncSeriesWaterfallHook ||
    obj instanceof SyncBailHook ||
    obj instanceof SyncHook ||
    obj instanceof SyncLoopHook ||
    obj instanceof SyncWaterfallHook
  );
};

/** Recursively add profiler interceptors to each hook in the "hooks" property of obj. */
export const addProfilerInterceptorsToHooks = (
  obj: unknown,
  profiler: Profiler,
  getParent?: () => ProfilerNode,
  currentPath: string[] = []
): void => {
  if (!hasHooks(obj)) {
    return;
  }

  const { startTimer, endTimer } = profiler;

  Object.entries(obj.hooks).forEach(([key, value]) => {
    const nextPath = [...currentPath, key];
    if (
      !isAnyHook(value) ||
      IGNORED_PATHS.some((path) => isMatchingPaths(path, nextPath))
    ) {
      return;
    }

    let profilerNode: ProfilerNode = {
      name: key,
      children: [],
    };

    /** Since the object reference changing with `endTimer` calls needs to be kept for future parent references, use a function to get it. */
    const getNode = () => profilerNode;

    value.intercept({
      call: (...args) => {
        // Might want to also check if `value` is specifically a `SyncHook` since other hooks aren't providing anything with more tapable stuff.
        if (args.length > 0) {
          addProfilerInterceptorsToHooks(args[0], profiler, getNode, nextPath);
        }

        startTimer(key);
      },
      done: () => {
        profilerNode = endTimer({
          hookName: key,
          parentNode: getParent?.(),
          children: profilerNode.children,
        });
      },
      result: () => {
        profilerNode = endTimer({
          hookName: key,
          parentNode: getParent?.(),
          children: profilerNode.children,
        });
      },
      error: () => {
        // TODO: Can we mark this as "interrupted" instead of ending the timer as normal?
        profilerNode = endTimer({
          hookName: key,
          parentNode: getParent?.(),
          children: profilerNode.children,
        });
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
