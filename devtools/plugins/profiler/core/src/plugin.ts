import {
  DevtoolsPlugin,
  genDataChangeTransaction,
  type DevtoolsPluginOptions,
} from "@player-devtools/plugin";
import type {
  DevtoolsPluginInteractionEvent,
  PluginData,
} from "@player-devtools/types";
import type { Flow, Player } from "@player-ui/player";
import { dset } from "dset/merge";
import { produce } from "immer";
import { BASE_PLUGIN_DATA, INTERACTIONS } from "./constants";
import { Profiler, transformProfilerData } from "./helpers";
import type { ProfilerNode } from "./types";
import { addProfilerInterceptorsToHooks } from "./addProfilerInterceptorsToHooks";
import flow from "./plugin-flow.json";

const wrapInRoot = (nodes: ProfilerNode[]): ProfilerNode => {
  const startTime =
    nodes.reduce<number | undefined>(
      (min, n) =>
        n.startTime !== undefined && (min === undefined || n.startTime < min)
          ? n.startTime
          : min,
      undefined
    ) ?? 0;
  const endTime =
    nodes.reduce<number | undefined>(
      (max, n) =>
        n.endTime !== undefined && (max === undefined || n.endTime > max)
          ? n.endTime
          : max,
      undefined
    ) ?? startTime;
  return {
    name: "root",
    startTime,
    endTime,
    value: Math.ceil((endTime - startTime) * 1000),
    children: nodes,
  };
};

const pluginData: PluginData = {
  ...BASE_PLUGIN_DATA,
  flow: flow as Flow,
};

const pluginID = pluginData.id;

export class ProfilerDevtoolsPlugin extends DevtoolsPlugin {
  name = "ProfilerDevtoolsPlugin";

  private readonly profilerObj: Profiler;

  constructor(options: Omit<DevtoolsPluginOptions, "pluginData">) {
    super({
      ...options,
      pluginData,
    });

    this.profilerObj = new Profiler(() => {
      const { durations, rootNodes } = this.profilerObj.getSnapshot();
      const newState = this.produceState(
        [["plugins", pluginID, "flow", "data", "durations"], durations],
        [
          ["plugins", pluginID, "flow", "data", "rootNode"],
          transformProfilerData(wrapInRoot(rootNodes)),
        ],
        [["plugins", pluginID, "flow", "data", "rawNodes"], rootNodes]
      );
      this.store.dispatch(
        genDataChangeTransaction({
          playerID: this.playerID,
          data: newState.plugins[pluginID]?.flow.data,
          pluginID,
        })
      );
    });
  }

  private startProfiler(): void {
    this.profilerObj.start();
    const newState = produce(this.store.getState(), (draft) => {
      dset(draft, ["plugins", pluginID, "flow", "data", "profiling"], true);
      dset(
        draft,
        ["plugins", pluginID, "flow", "data", "displayFlameGraph"],
        false
      );
    });
    this.store.dispatch(
      genDataChangeTransaction({
        playerID: this.playerID,
        data: newState.plugins[pluginID]?.flow.data,
        pluginID,
      })
    );
  }

  private stopProfiler(): ReturnType<Profiler["stopProfiler"]> {
    const result = this.profilerObj.stopProfiler();
    const { rootNodes, durations } = result;
    const newState = this.produceState(
      [
        ["plugins", pluginID, "flow", "data", "rootNode"],
        transformProfilerData(wrapInRoot(rootNodes)),
      ],
      [["plugins", pluginID, "flow", "data", "rawNodes"], rootNodes],
      [["plugins", pluginID, "flow", "data", "durations"], durations],
      [["plugins", pluginID, "flow", "data", "profiling"], false],
      [["plugins", pluginID, "flow", "data", "displayFlameGraph"], true]
    );
    this.store.dispatch(
      genDataChangeTransaction({
        playerID: this.playerID,
        data: newState.plugins[pluginID]?.flow.data,
        pluginID,
      })
    );
    return result;
  }

  apply(player: Player): void {
    if (!this.checkIfDevtoolsIsActive()) {
      return;
    }

    super.apply(player);

    // Hook once for the lifetime of this Player instance
    addProfilerInterceptorsToHooks(player, this.profilerObj);

    // Start profiling and dispatch initial state
    this.profilerObj.start();
    const initialState = produce(this.store.getState(), (draft) => {
      dset(draft, ["plugins", pluginID, "flow", "data", "profiling"], true);
      dset(
        draft,
        ["plugins", pluginID, "flow", "data", "displayFlameGraph"],
        false
      );
    });

    this.store.dispatch(
      genDataChangeTransaction({
        playerID: this.playerID,
        data: initialState.plugins[pluginID]?.flow.data,
        pluginID,
      })
    );
  }

  processInteraction(interaction: DevtoolsPluginInteractionEvent): void {
    super.processInteraction(interaction);

    const {
      payload: { type },
    } = interaction;

    if (type === INTERACTIONS.START_PROFILING) {
      this.startProfiler();
    }

    if (type === INTERACTIONS.STOP_PROFILING) {
      this.stopProfiler();
    }
  }
}
