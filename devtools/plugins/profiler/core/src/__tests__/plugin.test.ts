import { Flow, InProgressState, Player } from "@player-ui/player";
import { describe, expect, test, vi } from "vitest";
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
          ?.lastUpdate
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
      storeState.plugins["player-ui-profiler-plugin"]?.flow.data
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
          ?.lastUpdate
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
