import { describe, expect, test, vi } from "vitest";
import { Profiler } from "../profiler";

let count = 2490.0;
vi.mock("@player-devtools/plugin", async () => {
  const actual = await vi.importActual("@player-devtools/plugin");
  return {
    ...actual,
    getNowTime: vi.fn(() => {
      count += 0.1;
      return count;
    }),
  };
});

describe("Profiler", () => {
  test("sequential top-level timers each become a separate rootNodes entry", () => {
    const p = new Profiler();

    p.start();

    p.startTimer("hookA");
    p.endTimer({ hookName: "hookA" });

    p.startTimer("hookB");
    p.endTimer({ hookName: "hookB" });

    const { rootNodes, durations } = p.stopProfiler();

    expect(rootNodes).toHaveLength(2);
    expect(rootNodes[0]!.name).toBe("hookA");
    expect(rootNodes[1]!.name).toBe("hookB");
    expect(durations).toHaveLength(2);
  });

  test("nested timers become children of the outer timer", () => {
    const p = new Profiler();

    p.start();

    p.startTimer("outer");
    p.startTimer("inner1");
    p.endTimer({ hookName: "inner1" });
    p.startTimer("inner2");
    p.endTimer({ hookName: "inner2" });
    p.endTimer({ hookName: "outer" });

    const { rootNodes } = p.stopProfiler();

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0]!.name).toBe("outer");
    expect(rootNodes[0]!.children).toHaveLength(2);
    expect(rootNodes[0]!.children[0]!.name).toBe("inner1");
    expect(rootNodes[0]!.children[1]!.name).toBe("inner2");
  });

  test("endTimer for unknown name warns and does nothing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = new Profiler();

    p.start();
    p.startTimer("hookA");
    p.endTimer({ hookName: "unknown" });

    const { rootNodes } = p.stopProfiler();

    // hookA is still on the stack — not finalized, so rootNodes has it but without endTime
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("'unknown' not found in stack"),
    );
    // hookA was started but never ended — it's still a root node (was pushed to rootNodes on start)
    expect(rootNodes[0]!.name).toBe("hookA");
    expect(rootNodes[0]!.endTime).toBeUndefined();

    warnSpy.mockRestore();
  });

  test("endTimer for buried name pops and warns about intermediate timers", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = new Profiler();

    p.start();

    p.startTimer("outer");
    p.startTimer("middle");
    p.startTimer("inner");
    // End "outer" without ending "inner" or "middle" first
    p.endTimer({ hookName: "outer" });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("popping 'inner'"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("popping 'middle'"),
    );

    const { rootNodes, durations } = p.stopProfiler();

    // All three should be finalized
    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0]!.name).toBe("outer");
    expect(durations).toHaveLength(3);

    warnSpy.mockRestore();
  });

  test("start() resets all state", () => {
    const p = new Profiler();

    p.start();
    p.startTimer("hookA");
    p.endTimer({ hookName: "hookA" });

    p.start();
    const { rootNodes, durations } = p.stopProfiler();

    expect(rootNodes).toHaveLength(0);
    expect(durations).toHaveLength(0);
  });

  test("calls onUpdate only after endTimer, not startTimer", () => {
    const onUpdate = vi.fn();
    const p = new Profiler(onUpdate);

    // No auto-start, so no calls yet
    expect(onUpdate.mock.calls.length).toBe(0);

    p.start();
    expect(onUpdate.mock.calls.length).toBe(0);

    p.startTimer("hookA");
    expect(onUpdate.mock.calls.length).toBe(0);

    p.endTimer({ hookName: "hookA" });
    expect(onUpdate.mock.calls.length).toBe(1);

    p.startTimer("hookB");
    p.endTimer({ hookName: "hookB" });
    expect(onUpdate.mock.calls.length).toBe(2);
  });

  test("getSnapshot returns sorted durations and a deep clone of rootNodes", () => {
    const p = new Profiler();

    p.start();

    p.startTimer("slow");
    p.endTimer({ hookName: "slow" });

    p.startTimer("fast");
    p.endTimer({ hookName: "fast" });

    const snap = p.getSnapshot();

    // Sorted descending by duration — slow was measured first so has larger elapsed
    expect(snap.durations[0]!.name).toBe("slow");
    expect(snap.durations[1]!.name).toBe("fast");

    expect(snap.rootNodes).toHaveLength(2);

    // Snapshot is a clone — adding to live tree doesn't affect it
    p.startTimer("extra");
    p.endTimer({ hookName: "extra" });
    expect(snap.rootNodes).toHaveLength(2);
  });

  test("getSnapshot sets endTime and value on in-flight nodes using current time", () => {
    const p = new Profiler();

    p.start();

    // Finish one node so we have a reference
    p.startTimer("finished");
    p.endTimer({ hookName: "finished" });

    // Leave this one in-flight
    p.startTimer("inflight");

    const snap = p.getSnapshot();

    const finished = snap.rootNodes.find((n) => n.name === "finished");
    const inflight = snap.rootNodes.find((n) => n.name === "inflight");

    // Finished node is unchanged
    expect(finished!.endTime).toBeDefined();
    expect(finished!.value).toBeGreaterThan(0);

    // In-flight node gets a synthetic endTime and value based on snapshot time
    expect(inflight!.endTime).toBeDefined();
    expect(inflight!.value).toBeGreaterThan(0);

    // Live node is not mutated
    const p2 = new Profiler();
    p2.start();
    p2.startTimer("live");
    const liveBefore = p2.getSnapshot().rootNodes[0]!;
    expect(liveBefore.endTime).toBeDefined(); // snapshot sets it
    // but the original node in the stack must remain without endTime
    // (verified indirectly: calling endTimer still works normally)
    p2.endTimer({ hookName: "live" });
    const liveAfter = p2.getSnapshot().rootNodes[0]!;
    expect(liveAfter.endTime).toBeDefined();
    expect(liveAfter.value).toBeGreaterThan(0);
  });

  test("stopProfiler returns the full rootNodes forest with sorted durations", () => {
    const p = new Profiler();

    p.start();

    p.startTimer("a");
    p.startTimer("a.child");
    p.endTimer({ hookName: "a.child" });
    p.endTimer({ hookName: "a" });

    p.startTimer("b");
    p.endTimer({ hookName: "b" });

    const { rootNodes, durations } = p.stopProfiler();

    expect(rootNodes).toHaveLength(2);
    expect(rootNodes[0]!.children).toHaveLength(1);
    // durations sorted descending
    expect(durations[0]!.name).toBe("a");
    expect(durations).toMatchSnapshot();
  });
});
