import type { ProfilerNode } from "../types";
import { getNowTime } from "@player-devtools/plugin";

export class Profiler {
  private rootNodes: ProfilerNode[] = [];
  private stack: ProfilerNode[] = [];

  constructor(private readonly onUpdate?: () => void) {}

  start(): void {
    this.rootNodes = [];
    this.stack = [];
    this.onUpdate?.();
  }

  clear(): void {
    const now = getNowTime();
    // Reset each in-progress node: fresh startTime, no accumulated children
    for (const node of this.stack) {
      node.startTime = now;
      node.children = node.children.filter((x) => x.endTime === undefined);
    }
    // Re-wire parent→child links through the stack chain
    for (let i = 1; i < this.stack.length; i++) {
      this.stack[i - 1]!.children = [this.stack[i]!];
    }
    // rootNodes keeps only the outermost in-progress node (if any)
    this.rootNodes = this.stack.slice(0, 1);
    this.onUpdate?.();
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

  getSnapshot(): { rootNodes: ProfilerNode[] } {
    const now = getNowTime();
    return {
      rootNodes: this.rootNodes.map((n) => this.cloneNode(n, now)),
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

  stopProfiler(): { rootNodes: ProfilerNode[] } {
    return { rootNodes: [...this.rootNodes] };
  }
}
