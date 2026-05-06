import type { Profiler, ProfilerNode } from "../types";
import { getNowTime } from "@player-devtools/plugin";

export const profiler = (onUpdate?: () => void): Profiler => {
  let rootNodes: ProfilerNode[] = [];
  let stack: ProfilerNode[] = [];
  let durations: { hookName: string; duration: number }[] = [];

  const start = () => {
    rootNodes = [];
    stack = [];
    durations = [];
  };

  const cloneNode = (
    node: ProfilerNode,
    snapshotTime?: number,
  ): ProfilerNode => {
    const children = node.children.map((c) => cloneNode(c, snapshotTime));
    const endTime =
      node.endTime ?? (snapshotTime !== undefined ? snapshotTime : undefined);
    const value =
      node.value ??
      (endTime !== undefined && node.startTime !== undefined
        ? Math.ceil((endTime - node.startTime) * 1000)
        : children.reduce((prev, current) => prev + (current?.value ?? 0), 0));

    return {
      ...node,
      endTime,
      value,
      children,
    };
  };

  /**
   * Inserts synthetic spacer nodes to represent idle time between a parent's
   * startTime and its first child, and between consecutive siblings. This makes
   * the flame graph accurate to the real timeline rather than showing hooks
   * back-to-back regardless of when they fired.
   */
  const insertSpacers = (node: ProfilerNode): ProfilerNode => {
    if (
      node.children.length === 0 ||
      node.startTime === undefined ||
      node.endTime === undefined
    ) {
      return { ...node };
    }

    const spacedChildren: ProfilerNode[] = [];
    let cursor = node.startTime;

    for (const child of node.children) {
      if (child.startTime === undefined || child.endTime === undefined) {
        spacedChildren.push(insertSpacers(child));
        continue;
      }

      const gap = child.startTime - cursor;
      if (gap > 0) {
        spacedChildren.push({
          name: "(work)",
          value: Math.ceil(gap * 1000),
          children: [],
          backgroundColor: "#000000",
          color: "#000000",
          tooltip: "Placeholder time between hooks",
        });
      }

      spacedChildren.push(insertSpacers(child));
      cursor = child.endTime;
    }

    return { ...node, children: spacedChildren };
  };

  const getSnapshot = (): {
    rootNodes: ProfilerNode[];
    durations: { name: string; duration: string }[];
  } => {
    const sorted = [...durations]
      .sort((a, b) => b.duration - a.duration)
      .map(({ hookName, duration }) => ({
        name: hookName,
        duration: `${duration.toFixed(4)} ms`,
      }));
    const now = getNowTime();
    return {
      rootNodes: rootNodes.map((n) => cloneNode(n, now)).map(insertSpacers),
      durations: sorted,
    };
  };

  const startTimer = (hookName: string) => {
    const node: ProfilerNode = {
      name: hookName,
      startTime: getNowTime(),
      children: [],
    };

    if (stack.length > 0) {
      stack[stack.length - 1]!.children.push(node);
    } else {
      rootNodes.push(node);
    }

    stack.push(node);
  };

  const finalizeNode = (node: ProfilerNode, endTime: number) => {
    const duration =
      node.startTime !== undefined ? endTime - node.startTime : 0.01;
    node.endTime = endTime;
    node.value = Math.ceil(duration * 1000);
    node.tooltip = `${node.name}, ${duration.toFixed(4)} (ms)`;
    durations.push({ hookName: node.name, duration });
  };

  const endTimer = ({ hookName }: { hookName: string }) => {
    const idx = [...stack].reverse().findIndex((n) => n.name === hookName);

    if (idx === -1) {
      console.warn(`endTimer: '${hookName}' not found in stack, ignoring`);
      return;
    }

    // stack index of the target (reverse idx → forward idx)
    const targetIdx = stack.length - 1 - idx;
    const endTime = getNowTime();

    // Pop and finalize everything above the target, from top down
    for (let i = stack.length - 1; i > targetIdx; i--) {
      const orphan = stack[i]!;
      console.warn(
        `endTimer: popping '${orphan.name}' — timer was never explicitly ended`,
      );
      finalizeNode(orphan, endTime);
    }

    // Finalize the target
    finalizeNode(stack[targetIdx]!, endTime);

    // Truncate stack
    stack.length = targetIdx;

    onUpdate?.();
  };

  const stopProfiler = (): {
    rootNodes: ProfilerNode[];
    durations: { name: string; duration: string }[];
  } => {
    durations.sort((a, b) => b.duration - a.duration);

    return {
      rootNodes: rootNodes.map(insertSpacers),
      durations: durations.map(({ hookName, duration }) => ({
        name: hookName,
        duration: `${duration.toFixed(4)} ms`,
      })),
    };
  };

  return {
    start,
    startTimer,
    endTimer,
    stopProfiler,
    getSnapshot,
    insertSpacers,
  };
};
