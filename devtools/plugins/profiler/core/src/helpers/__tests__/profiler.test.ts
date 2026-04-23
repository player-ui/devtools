import { describe, expect, test, vi } from "vitest";
import { profiler } from "../profiler";
import { ProfilerNode } from "../../types";

// mock performance.now
let count = 2490.0;
const now = vi.fn(() => {
  count += 0.1;
  return count;
});
global.performance = { ...global.performance, now };

describe("Profiler", () => {
  test("starts the profiler, keep track of the events, and return the profiler tree", () => {
    const { startTimer, endTimer, stopProfiler, start } = profiler();

    start();

    // process with no children
    startTimer("process1");
    endTimer({ hookName: "process1" });

    // process with children
    const parentNode: ProfilerNode = {
      name: "process2",
      children: [],
    };

    startTimer("process2");
    startTimer("process2.1");
    startTimer("process2.2");
    endTimer({ hookName: "process2.1", parentNode });
    endTimer({ hookName: "process2.2", parentNode });
    endTimer({ hookName: "process2", children: parentNode.children });

    const rootNode = stopProfiler();

    expect(rootNode).toMatchSnapshot();

    // (re)start
    start();
    const { rootNode: rootNode2, durations } = stopProfiler();

    expect(durations).toStrictEqual([]);
    expect(rootNode2.children).toStrictEqual([]);
    expect(rootNode2.tooltip).toMatch(/^Profiler total time span/);
  });

  test("calls onUpdate only after endTimer, not startTimer", () => {
    const onUpdate = vi.fn();
    const { startTimer, endTimer, start } = profiler(onUpdate);

    // startTimer("profiler") fires at construction but no longer triggers onUpdate
    const callsAfterConstruction = onUpdate.mock.calls.length;
    expect(callsAfterConstruction).toBe(0);

    start();
    // start() resets state but doesn't call onUpdate itself
    expect(onUpdate.mock.calls.length).toBe(callsAfterConstruction);

    startTimer("hookA");
    // startTimer no longer calls onUpdate
    expect(onUpdate.mock.calls.length).toBe(callsAfterConstruction);

    endTimer({ hookName: "hookA" });
    expect(onUpdate.mock.calls.length).toBe(callsAfterConstruction + 1);

    startTimer("hookB");
    endTimer({ hookName: "hookB" });
    expect(onUpdate.mock.calls.length).toBe(callsAfterConstruction + 2);
  });

  test("getSnapshot returns incrementally sorted durations without finalizing rootNode", () => {
    const { startTimer, endTimer, getSnapshot, start } = profiler();

    start();

    startTimer("slow");
    endTimer({ hookName: "slow" });

    startTimer("fast");
    endTimer({ hookName: "fast" });

    const snap = getSnapshot();

    // Should be sorted descending by duration — slow was first so it has a longer duration
    expect(snap.durations[0]!.name).toBe("slow");
    expect(snap.durations[1]!.name).toBe("fast");

    // rootNode should not have endTime/tooltip set yet (not finalized)
    expect(snap.rootNode.tooltip).toBeUndefined();
    expect(snap.rootNode.endTime).toBeUndefined();
    expect(snap.rootNode.children).toHaveLength(2);

    // Snapshot is a clone — mutating the live tree doesn't affect it
    startTimer("extra");
    endTimer({ hookName: "extra" });
    expect(snap.rootNode.children).toHaveLength(2);
  });
});
