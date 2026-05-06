import { describe, expect, test, vi } from "vitest";
import { profiler } from "../profiler";

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
    const { startTimer, endTimer, stopProfiler, start } = profiler();

    start();

    startTimer("hookA");
    endTimer({ hookName: "hookA" });

    startTimer("hookB");
    endTimer({ hookName: "hookB" });

    const { rootNodes, durations } = stopProfiler();

    expect(rootNodes).toHaveLength(2);
    expect(rootNodes[0]!.name).toBe("hookA");
    expect(rootNodes[1]!.name).toBe("hookB");
    expect(durations).toHaveLength(2);
  });

  test("nested timers become children of the outer timer", () => {
    const { startTimer, endTimer, stopProfiler, start } = profiler();

    start();

    startTimer("outer");
    startTimer("inner1");
    endTimer({ hookName: "inner1" });
    startTimer("inner2");
    endTimer({ hookName: "inner2" });
    endTimer({ hookName: "outer" });

    const { rootNodes } = stopProfiler();

    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0]!.name).toBe("outer");
    const realChildren = rootNodes[0]!.children.filter(
      (c) => c.name !== "(work)",
    );
    expect(realChildren).toHaveLength(2);
    expect(realChildren[0]!.name).toBe("inner1");
    expect(realChildren[1]!.name).toBe("inner2");
  });

  test("endTimer for unknown name warns and does nothing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { startTimer, endTimer, stopProfiler, start } = profiler();

    start();
    startTimer("hookA");
    endTimer({ hookName: "unknown" });

    const { rootNodes } = stopProfiler();

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
    const { startTimer, endTimer, stopProfiler, start } = profiler();

    start();

    startTimer("outer");
    startTimer("middle");
    startTimer("inner");
    // End "outer" without ending "inner" or "middle" first
    endTimer({ hookName: "outer" });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("popping 'inner'"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("popping 'middle'"),
    );

    const { rootNodes, durations } = stopProfiler();

    // All three should be finalized
    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0]!.name).toBe("outer");
    expect(durations).toHaveLength(3);

    warnSpy.mockRestore();
  });

  test("start() resets all state", () => {
    const { startTimer, endTimer, stopProfiler, start } = profiler();

    start();
    startTimer("hookA");
    endTimer({ hookName: "hookA" });

    start();
    const { rootNodes, durations } = stopProfiler();

    expect(rootNodes).toHaveLength(0);
    expect(durations).toHaveLength(0);
  });

  test("calls onUpdate only after endTimer, not startTimer", () => {
    const onUpdate = vi.fn();
    const { startTimer, endTimer, start } = profiler(onUpdate);

    // No auto-start, so no calls yet
    expect(onUpdate.mock.calls.length).toBe(0);

    start();
    expect(onUpdate.mock.calls.length).toBe(0);

    startTimer("hookA");
    expect(onUpdate.mock.calls.length).toBe(0);

    endTimer({ hookName: "hookA" });
    expect(onUpdate.mock.calls.length).toBe(1);

    startTimer("hookB");
    endTimer({ hookName: "hookB" });
    expect(onUpdate.mock.calls.length).toBe(2);
  });

  test("getSnapshot returns sorted durations and a deep clone of rootNodes", () => {
    const { startTimer, endTimer, getSnapshot, start } = profiler();

    start();

    startTimer("slow");
    endTimer({ hookName: "slow" });

    startTimer("fast");
    endTimer({ hookName: "fast" });

    const snap = getSnapshot();

    // Sorted descending by duration — slow was measured first so has larger elapsed
    expect(snap.durations[0]!.name).toBe("slow");
    expect(snap.durations[1]!.name).toBe("fast");

    expect(snap.rootNodes).toHaveLength(2);

    // Snapshot is a clone — adding to live tree doesn't affect it
    startTimer("extra");
    endTimer({ hookName: "extra" });
    expect(snap.rootNodes).toHaveLength(2);
  });

  test("getSnapshot sets endTime and value on in-flight nodes using current time", () => {
    const { startTimer, endTimer, getSnapshot, start } = profiler();

    start();

    // Finish one node so we have a reference
    startTimer("finished");
    endTimer({ hookName: "finished" });

    // Leave this one in-flight
    startTimer("inflight");

    const snap = getSnapshot();

    const finished = snap.rootNodes.find((n) => n.name === "finished");
    const inflight = snap.rootNodes.find((n) => n.name === "inflight");

    // Finished node is unchanged
    expect(finished!.endTime).toBeDefined();
    expect(finished!.value).toBeGreaterThan(0);

    // In-flight node gets a synthetic endTime and value based on snapshot time
    expect(inflight!.endTime).toBeDefined();
    expect(inflight!.value).toBeGreaterThan(0);

    // Live node is not mutated
    const {
      startTimer: s2,
      endTimer: e2,
      getSnapshot: gs2,
      start: st2,
    } = profiler();
    st2();
    s2("live");
    const liveBefore = gs2().rootNodes[0]!;
    expect(liveBefore.endTime).toBeDefined(); // snapshot sets it
    // but the original node in the stack must remain without endTime
    // (verified indirectly: calling endTimer still works normally)
    e2({ hookName: "live" });
    const liveAfter = gs2().rootNodes[0]!;
    expect(liveAfter.endTime).toBeDefined();
    expect(liveAfter.value).toBeGreaterThan(0);
  });

  describe("insertSpacers", () => {
    test("no spacer when child starts exactly at parent startTime", () => {
      const { insertSpacers } = profiler();

      const node = {
        name: "parent",
        startTime: 100,
        endTime: 200,
        value: 100000,
        children: [
          {
            name: "child",
            startTime: 100,
            endTime: 150,
            value: 50000,
            children: [],
          },
        ],
      };

      const result = insertSpacers(node);
      expect(result.children).toHaveLength(1);
      expect(result.children[0]!.name).toBe("child");
    });

    test("leading spacer when first child starts after parent startTime", () => {
      const { insertSpacers } = profiler();

      const node = {
        name: "parent",
        startTime: 100,
        endTime: 200,
        value: 100000,
        children: [
          {
            name: "child",
            startTime: 110,
            endTime: 150,
            value: 40000,
            children: [],
          },
        ],
      };

      const result = insertSpacers(node);
      expect(result.children).toHaveLength(2);
      expect(result.children[0]!.backgroundColor).toBe("#000000");
      expect(result.children[0]!.value).toBe(Math.ceil((110 - 100) * 1000));
      expect(result.children[1]!.name).toBe("child");
    });

    test("spacer between siblings with a gap", () => {
      const { insertSpacers } = profiler();

      const node = {
        name: "parent",
        startTime: 100,
        endTime: 200,
        value: 100000,
        children: [
          {
            name: "child1",
            startTime: 100,
            endTime: 130,
            value: 30000,
            children: [],
          },
          {
            name: "child2",
            startTime: 150,
            endTime: 180,
            value: 30000,
            children: [],
          },
        ],
      };

      const result = insertSpacers(node);
      expect(result.children).toHaveLength(3);
      expect(result.children[0]!.name).toBe("child1");
      expect(result.children[1]!.backgroundColor).toBe("#000000");
      expect(result.children[1]!.value).toBe(Math.ceil((150 - 130) * 1000));
      expect(result.children[2]!.name).toBe("child2");
    });

    test("no spacer between siblings with no gap", () => {
      const { insertSpacers } = profiler();

      const node = {
        name: "parent",
        startTime: 100,
        endTime: 200,
        value: 100000,
        children: [
          {
            name: "child1",
            startTime: 100,
            endTime: 130,
            value: 30000,
            children: [],
          },
          {
            name: "child2",
            startTime: 130,
            endTime: 160,
            value: 30000,
            children: [],
          },
        ],
      };

      const result = insertSpacers(node);
      expect(result.children).toHaveLength(2);
      expect(result.children[0]!.name).toBe("child1");
      expect(result.children[1]!.name).toBe("child2");
    });

    test("spacers are inserted recursively into nested children", () => {
      const { insertSpacers } = profiler();

      const node = {
        name: "parent",
        startTime: 100,
        endTime: 300,
        value: 200000,
        children: [
          {
            name: "child",
            startTime: 100,
            endTime: 300,
            value: 200000,
            children: [
              {
                name: "grandchild",
                startTime: 150,
                endTime: 200,
                value: 50000,
                children: [],
              },
            ],
          },
        ],
      };

      const result = insertSpacers(node);
      const child = result.children[0]!;
      expect(child.name).toBe("child");
      // grandchild has a leading spacer of 50ms
      expect(child.children).toHaveLength(2);
      expect(child.children[0]!.backgroundColor).toBe("#000000");
      expect(child.children[0]!.value).toBe(Math.ceil((150 - 100) * 1000));
      expect(child.children[1]!.name).toBe("grandchild");
    });

    test("no spacers inserted when parent or child lacks timing info", () => {
      const { insertSpacers } = profiler();

      // Parent missing startTime — skip spacer logic, return node unchanged
      const nodeNoStartTime = {
        name: "parent",
        endTime: 200,
        value: 100000,
        children: [
          {
            name: "child",
            startTime: 110,
            endTime: 150,
            value: 40000,
            children: [],
          },
        ],
      };
      const r1 = insertSpacers(nodeNoStartTime);
      expect(r1.children).toHaveLength(1);
      expect(r1.children[0]!.name).toBe("child");

      // Child missing startTime — skip that child's spacer, pass it through
      const nodeChildNoTiming = {
        name: "parent",
        startTime: 100,
        endTime: 200,
        value: 100000,
        children: [{ name: "child", children: [] }],
      };
      const r2 = insertSpacers(nodeChildNoTiming);
      expect(r2.children).toHaveLength(1);
      expect(r2.children[0]!.name).toBe("child");
    });
  });

  test("stopProfiler returns the full rootNodes forest with sorted durations", () => {
    const { startTimer, endTimer, stopProfiler, start } = profiler();

    start();

    startTimer("a");
    startTimer("a.child");
    endTimer({ hookName: "a.child" });
    endTimer({ hookName: "a" });

    startTimer("b");
    endTimer({ hookName: "b" });

    const { rootNodes, durations } = stopProfiler();

    expect(rootNodes).toHaveLength(2);
    expect(
      rootNodes[0]!.children.filter((c) => c.name !== "(work)"),
    ).toHaveLength(1);
    // durations sorted descending
    expect(durations[0]!.name).toBe("a");
    expect(durations).toMatchSnapshot();
  });
});
