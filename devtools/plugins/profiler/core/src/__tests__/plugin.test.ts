import { Flow, InProgressState, Player } from "@player-ui/player";
import { SyncHook } from "tapable-ts";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ProfilerDevtoolsPlugin } from "../plugin";

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

describe("Plugin", () => {
  // This test is being used to setup a baseline snapshot of perf on a basic player flow.
  test("should profile player hooks when navigating through a flow", async () => {
    const profilerPlugin = new ProfilerDevtoolsPlugin({
      handler: {
        checkIfDevtoolsIsActive: () => true,
        processInteraction: () => {},
      },
      playerID: "ID",
    });

    const player = new Player({ plugins: [profilerPlugin] });

    // This flow is used to navigate through common player steps.
    const flow: Flow = {
      id: "flow",
      views: [
        {
          id: "view1",
          type: "foo",
          value: "bar",
        },
      ],
      navigation: {
        BEGIN: "FLOW_1",
        FLOW_1: {
          startState: "VIEW_1",
          VIEW_1: {
            state_type: "VIEW",
            ref: "view1",
            transitions: {
              "*": "ACTION_1",
            },
          },
          ACTION_1: {
            state_type: "ACTION",
            exp: "{{a}} = 1",
            transitions: {
              "*": "END_DONE",
            },
          },
          END_DONE: {
            state_type: "END",
            outcome: "done",
          },
        },
      },
    };
    const playerPromise = player.start(flow);

    // Wait for first view update to complete.
    await vi.waitFor(() => {
      const playerState = player.getState();
      expect(playerState.status).toBe("in-progress");
      expect(
        (playerState as InProgressState).controllers.view.currentView
          ?.lastUpdate,
      ).toBeDefined();
    });

    // Live update: profiling is active
    const liveData =
      profilerPlugin.store.getState().plugins["player-ui-profiler-plugin"]?.flow
        .data;
    expect(liveData?.profiling).toBe(true);

    // Transition to action state
    (player.getState() as InProgressState).controllers.flow.transition("go");

    // Wait for action state to transition to end state and complete
    await playerPromise;
    profilerPlugin.processInteraction({
      payload: {
        type: "stop-profiling",
      },
      type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
    });

    const storeState = profilerPlugin.store.getState();
    expect(
      storeState.plugins["player-ui-profiler-plugin"]?.flow.data,
    ).toMatchSnapshot();
  });

  test("stop-profiling marks profiling complete; start-profiling resets state", async () => {
    const profilerPlugin = new ProfilerDevtoolsPlugin({
      handler: {
        checkIfDevtoolsIsActive: () => true,
        processInteraction: () => {},
      },
      playerID: "ID",
    });

    const player = new Player({ plugins: [profilerPlugin] });

    const flow: Flow = {
      id: "flow2",
      views: [{ id: "view1", type: "foo" }],
      navigation: {
        BEGIN: "FLOW_1",
        FLOW_1: {
          startState: "VIEW_1",
          VIEW_1: {
            state_type: "VIEW",
            ref: "view1",
            transitions: { "*": "END_DONE" },
          },
          END_DONE: { state_type: "END", outcome: "done" },
        },
      },
    };

    const playerPromise = player.start(flow);

    // Wait for the view to render so hooks have fired
    await vi.waitFor(() => {
      const playerState = player.getState();
      expect(playerState.status).toBe("in-progress");
      expect(
        (playerState as InProgressState).controllers.view.currentView
          ?.lastUpdate,
      ).toBeDefined();
    });

    profilerPlugin.processInteraction({
      payload: { type: "stop-profiling" },
      type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
    });

    const dataAfterStop =
      profilerPlugin.store.getState().plugins["player-ui-profiler-plugin"]?.flow
        .data;
    expect(dataAfterStop?.profiling).toBe(false);
    expect(dataAfterStop?.displayFlameGraph).toBe(true);

    // Restart — state should flip back to active profiling
    profilerPlugin.processInteraction({
      payload: { type: "start-profiling" },
      type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
    });

    const dataAfterRestart =
      profilerPlugin.store.getState().plugins["player-ui-profiler-plugin"]?.flow
        .data;
    expect(dataAfterRestart?.profiling).toBe(true);
    expect(dataAfterRestart?.displayFlameGraph).toBe(false);

    // Clean up
    (player.getState() as InProgressState).controllers.flow.transition("go");
    await playerPromise;
  });
});

/**
 * Publishing the profiler tree is expensive: every publish clones and re-merges the whole recorded
 * tree, and the tree only grows. Publishing after every hook therefore makes total work quadratic
 * in the number of hooks (minutes of main-thread time on iOS, where JavaScriptCore has no JIT).
 * Recording is cheap, so these tests pin down when we publish instead.
 */
describe("snapshot publishing", () => {
  const PLUGIN = "player-ui-profiler-plugin";

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createPlugin = () =>
    new ProfilerDevtoolsPlugin({
      handler: {
        checkIfDevtoolsIsActive: () => true,
        processInteraction: () => {},
      },
      playerID: "ID",
    });

  const setup = (plugin = createPlugin()) => {
    const hook = new SyncHook<[]>();
    plugin.apply({ hooks: { tick: hook } } as unknown as Player);

    return {
      hook,
      plugin,
      /** How many data-change snapshots have been published so far */
      dataChanges: () =>
        plugin.store
          .getState()
          .messages.filter(
            (m) => m.type === "PLAYER_DEVTOOLS_PLUGIN_DATA_CHANGE",
          ).length,
      /** The top-level profiler nodes devtools can currently see */
      publishedRootNodes: () =>
        plugin.store.getState().plugins[PLUGIN]?.flow.data?.rawNodes as
          | unknown[]
          | undefined,
    };
  };

  const interact = (plugin: ProfilerDevtoolsPlugin, type: string) =>
    plugin.processInteraction({
      payload: { type },
      type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
    });

  test("does not publish a snapshot for every hook call", () => {
    const { hook, dataChanges } = setup();
    const before = dataChanges();

    for (let i = 0; i < 500; i++) hook.call();

    expect(dataChanges() - before).toBeLessThanOrEqual(1);
  });

  test("publishes everything that was recorded once the interval has passed", () => {
    const { hook, publishedRootNodes } = setup();

    for (let i = 0; i < 500; i++) hook.call();
    vi.advanceTimersByTime(1_000);

    expect(publishedRootNodes()).toHaveLength(500);
  });

  test("backs off after a slow publish", () => {
    const plugin = createPlugin();
    // Make every store update "cost" 500ms of wall-clock time, like publishing a huge tree.
    plugin.store.subscribe(() => {
      vi.setSystemTime(Date.now() + 500);
    });
    const { hook, dataChanges } = setup(plugin);
    const before = dataChanges();

    hook.call();
    vi.advanceTimersByTime(2_000);
    // The last publish was slow, so the next one has to wait much longer than that.
    expect(dataChanges()).toBe(before);

    vi.advanceTimersByTime(10_000);
    expect(dataChanges()).toBe(before + 1);
  });

  /** Let devtools see a non-empty tree, then record more hooks that are still waiting to publish. */
  const publishThenRecordMore = (hook: SyncHook<[]>) => {
    for (let i = 0; i < 50; i++) hook.call();
    vi.advanceTimersByTime(1_000);
    for (let i = 0; i < 50; i++) hook.call();
  };

  test("start-profiling publishes the reset tree immediately, even while throttled", () => {
    const { plugin, hook, publishedRootNodes } = setup();
    publishThenRecordMore(hook);
    // Sanity: devtools currently shows a tree, so an empty one is a real change
    expect(publishedRootNodes()!.length).toBeGreaterThan(0);

    interact(plugin, "start-profiling");

    expect(publishedRootNodes()).toHaveLength(0);
  });

  test("reset-profiling publishes the cleared tree immediately, even while throttled", () => {
    const { plugin, hook, publishedRootNodes } = setup();
    publishThenRecordMore(hook);
    // Sanity: devtools currently shows a tree, so an empty one is a real change
    expect(publishedRootNodes()!.length).toBeGreaterThan(0);

    interact(plugin, "reset-profiling");

    expect(publishedRootNodes()).toHaveLength(0);
  });

  test("stop-profiling publishes the complete tree and cancels the pending publish", () => {
    const { plugin, hook, dataChanges, publishedRootNodes } = setup();
    for (let i = 0; i < 100; i++) hook.call();

    interact(plugin, "stop-profiling");

    expect(publishedRootNodes()).toHaveLength(100);
    const afterStop = dataChanges();
    vi.advanceTimersByTime(10_000);
    expect(dataChanges()).toBe(afterStop);
  });

  test("teardown cancels a pending publish", () => {
    const { plugin, hook, dataChanges } = setup();
    hook.call();

    plugin.teardown();
    const afterTeardown = dataChanges();
    vi.advanceTimersByTime(10_000);

    expect(dataChanges()).toBe(afterTeardown);
  });
});
