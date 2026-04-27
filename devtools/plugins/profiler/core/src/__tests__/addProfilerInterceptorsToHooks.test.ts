import { SyncHook } from "tapable-ts";
import { describe, expect, test } from "vitest";
import { addProfilerInterceptorsToHooks } from "../addProfilerInterceptorsToHooks";
import { profiler } from "../helpers";

describe("addProfilerInterceptorsToHooks", () => {
  /**
   * When a parent hook's call interceptor fires, it recursively calls
   * addProfilerInterceptorsToHooks on args[0] to discover nested hooks.
   * If the parent hook fires again with the same child object, the intercepted
   * WeakSet prevents a second interceptor from being added — so the child hook
   * always fires exactly once per call regardless of how many times the parent
   * hook has fired.
   */
  test("re-intercepting the same child object on repeated parent calls does not duplicate timers", () => {
    const profilerInstance = profiler();
    profilerInstance.start();

    // Child object whose hooks get discovered lazily via the parent's call arg
    const childObj = {
      hooks: {
        afterTransition: new SyncHook<[]>(),
      },
    };

    // Parent hook that passes childObj as its argument (mirrors Player's "flow" hook
    // passing a FlowInstance, which carries its own hooks like afterTransition)
    const parentObj = {
      hooks: {
        flow: new SyncHook<[typeof childObj]>(),
      },
    };

    addProfilerInterceptorsToHooks(parentObj, profilerInstance);

    // First parent call: wires one interceptor onto childObj.hooks.afterTransition
    parentObj.hooks.flow.call(childObj);
    childObj.hooks.afterTransition.call();

    const snapAfterFirst = profilerInstance.getSnapshot();
    expect(snapAfterFirst.rootNodes).toHaveLength(2);
    expect(snapAfterFirst.rootNodes[0]!.name).toBe("flow");
    expect(snapAfterFirst.rootNodes[1]!.name).toBe("afterTransition");
    expect(snapAfterFirst.rootNodes[1]!.children).toHaveLength(0);

    profilerInstance.start();

    // Second parent call with the same childObj: the WeakSet guard prevents a second
    // interceptor from being added to afterTransition — it fires exactly once.
    parentObj.hooks.flow.call(childObj);
    childObj.hooks.afterTransition.call();

    const snapAfterSecond = profilerInstance.getSnapshot();
    const afterTransitionNode = snapAfterSecond.rootNodes.find(
      (n) => n.name === "afterTransition",
    );
    expect(afterTransitionNode).toBeDefined();
    expect(afterTransitionNode!.children).toHaveLength(0);
  });
});
