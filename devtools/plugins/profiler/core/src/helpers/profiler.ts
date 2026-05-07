import type { ProfilerNode } from "../types";
import { getNowTime } from "@player-devtools/plugin";

export class Profiler {
  private rootNodes: ProfilerNode[] = [];
  private stack: ProfilerNode[] = [];
  private durations: { hookName: string; duration: number }[] = [];

  constructor(private readonly onUpdate?: () => void) {}

  start(): void {
    this.rootNodes = [];
    this.stack = [];
    this.durations = [];
  }

  private cloneNode(node: ProfilerNode, snapshotTime?: number): ProfilerNode {
    const children = node.children.map((c) => this.cloneNode(c, snapshotTime));
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
  }

  getSnapshot(): {
    rootNodes: ProfilerNode[];
    durations: { name: string; duration: string }[];
  } {
    const sorted = [...this.durations]
      .sort((a, b) => b.duration - a.duration)
      .map(({ hookName, duration }) => ({
        name: hookName,
        duration: `${duration.toFixed(4)} ms`,
      }));
    const now = getNowTime();
    return {
      rootNodes: this.rootNodes.map((n) => this.cloneNode(n, now)),
      durations: sorted,
    };
  }

  startTimer(hookName: string): void {
    const node: ProfilerNode = {
      name: hookName,
      startTime: getNowTime(),
      children: [],
    };

    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1]!.children.push(node);
    } else {
      this.rootNodes.push(node);
    }

    this.stack.push(node);
  }

  private finalizeNode(node: ProfilerNode, endTime: number): void {
    const duration =
      node.startTime !== undefined ? endTime - node.startTime : 0.01;
    node.endTime = endTime;
    node.value = Math.ceil(duration * 1000);
    node.tooltip = `${node.name}, ${duration.toFixed(4)} (ms)`;
    this.durations.push({ hookName: node.name, duration });
  }

  endTimer({ hookName }: { hookName: string }): void {
    const idx = [...this.stack].reverse().findIndex((n) => n.name === hookName);

    if (idx === -1) {
      console.warn(`endTimer: '${hookName}' not found in stack, ignoring`);
      return;
    }

    // stack index of the target (reverse idx → forward idx)
    const targetIdx = this.stack.length - 1 - idx;
    const endTime = getNowTime();

    // Pop and finalize everything above the target, from top down
    for (let i = this.stack.length - 1; i > targetIdx; i--) {
      const orphan = this.stack[i]!;
      console.warn(
        `endTimer: popping '${orphan.name}' — timer was never explicitly ended`,
      );
      this.finalizeNode(orphan, endTime);
    }

    // Finalize the target
    this.finalizeNode(this.stack[targetIdx]!, endTime);

    // Truncate stack
    this.stack.length = targetIdx;

    this.onUpdate?.();
  }

  stopProfiler(): {
    rootNodes: ProfilerNode[];
    durations: { name: string; duration: string }[];
  } {
    this.durations.sort((a, b) => b.duration - a.duration);

    return {
      rootNodes: [...this.rootNodes],
      durations: this.durations.map(({ hookName, duration }) => ({
        name: hookName,
        duration: `${duration.toFixed(4)} ms`,
      })),
    };
  }
}
