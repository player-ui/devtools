export interface Profiler {
  start(): void;
  startTimer(hookName: string): void;
  endTimer(args: {
    hookName: string;
    parentNode?: ProfilerNode;
    children?: ProfilerNode[];
  }): ProfilerNode;
  stopProfiler(): {
    rootNode: ProfilerNode;
    durations: { name: string; duration: string }[];
  };
}

export type ProfilerNode = {
  /** hook name */
  name: string;
  /* startTime of the hook */
  startTime?: number;
  /** endTime of the hook */
  endTime?: number;
  /** duration casted to a positive integer (multiplied by 1000) */
  value?: number;
  /** tooltip to be shown on hover */
  tooltip?: string;
  /** subhook profiler nodes */
  children: ProfilerNode[];
};
