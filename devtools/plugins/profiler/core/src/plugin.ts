import {
  DevtoolsPlugin,
  genDataChangeTransaction,
  type DevtoolsPluginOptions,
} from "@player-devtools/plugin";
import type {
  DevtoolsPluginInteractionEvent,
  DevtoolsPluginsStore,
} from "@player-devtools/types";
import type { Player } from "@player-ui/player";
import {
  INTERACTIONS,
  ProfilerPluginData,
} from "@player-devtools/profiler-plugin-content";
import { dset } from "dset/merge";
import { produce } from "immer";
import { Profiler, transformProfilerData } from "./helpers";
import type { ProfilerNode } from "./types";
import { addProfilerInterceptorsToHooks } from "./addProfilerInterceptorsToHooks";

const wrapInRoot = (nodes: ProfilerNode[]): ProfilerNode => {
  const startTime =
    nodes.reduce<number | undefined>(
      (min, n) =>
        n.startTime !== undefined && (min === undefined || n.startTime < min)
          ? n.startTime
          : min,
      undefined,
    ) ?? 0;
  const endTime =
    nodes.reduce<number | undefined>(
      (max, n) =>
        n.endTime !== undefined && (max === undefined || n.endTime > max)
          ? n.endTime
          : max,
      undefined,
    ) ?? startTime;
  return {
    name: "root",
    startTime,
    endTime,
    value: Math.ceil((endTime - startTime) * 1000),
    children: nodes,
  };
};

const pluginData = ProfilerPluginData;

const pluginID = pluginData.id;

export class ProfilerDevtoolsPlugin extends DevtoolsPlugin {
  name = "ProfilerDevtoolsPlugin";

  private readonly profilerObj: Profiler;

  private readonly interactionMap: Map<string, () => void> = new Map([
    [INTERACTIONS.START_PROFILING, () => this.startProfiler()],
    [INTERACTIONS.STOP_PROFILING, () => this.stopProfiler()],
    [INTERACTIONS.RESET_PROFILING, () => this.clearProfiler()],
  ]);

  constructor(options: Omit<DevtoolsPluginOptions, "pluginData">) {
    super({
      ...options,
      pluginData,
    });

    this.profilerObj = new Profiler(() => {
      const { rootNodes } = this.profilerObj.getSnapshot();
      const newState = this.produceState(
        [
          ["plugins", pluginID, "flow", "data", "rootNode"],
          transformProfilerData(wrapInRoot(rootNodes)),
        ],
        [["plugins", pluginID, "flow", "data", "rawNodes"], rootNodes],
      );
      this.store.dispatch(
        genDataChangeTransaction({
          playerID: this.playerID,
          data: newState.plugins[pluginID]?.flow.data,
          pluginID,
        }),
      );
    });
  }

  /**
   * Produces a new store state with each `[path, value]` pair written into the
   * draft via `dset`, leaving the live store untouched.
   */
  private produceState(
    ...updates: Array<[path: Array<string>, value: unknown]>
  ): DevtoolsPluginsStore {
    return produce(this.store.getState(), (draft) => {
      updates.forEach(([path, value]) => {
        dset(draft, path, value);
      });
    });
  }

  private startProfiler(): void {
    this.profilerObj.start();
    const newState = produce(this.store.getState(), (draft) => {
      dset(draft, ["plugins", pluginID, "flow", "data", "profiling"], true);
      dset(
        draft,
        ["plugins", pluginID, "flow", "data", "displayFlameGraph"],
        false,
      );
    });
    this.store.dispatch(
      genDataChangeTransaction({
        playerID: this.playerID,
        data: newState.plugins[pluginID]?.flow.data,
        pluginID,
      }),
    );
  }

  private clearProfiler(): void {
    this.profilerObj.clear();
  }

  private stopProfiler(): ReturnType<Profiler["stopProfiler"]> {
    const result = this.profilerObj.stopProfiler();
    const { rootNodes } = result;
    const newState = this.produceState(
      [
        ["plugins", pluginID, "flow", "data", "rootNode"],
        transformProfilerData(wrapInRoot(rootNodes)),
      ],
      [["plugins", pluginID, "flow", "data", "rawNodes"], rootNodes],
      [["plugins", pluginID, "flow", "data", "profiling"], false],
      [["plugins", pluginID, "flow", "data", "displayFlameGraph"], true],
    );
    this.store.dispatch(
      genDataChangeTransaction({
        playerID: this.playerID,
        data: newState.plugins[pluginID]?.flow.data,
        pluginID,
      }),
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
        false,
      );
    });

    this.store.dispatch(
      genDataChangeTransaction({
        playerID: this.playerID,
        data: initialState.plugins[pluginID]?.flow.data,
        pluginID,
      }),
    );
  }

  processInteraction(interaction: DevtoolsPluginInteractionEvent): void {
    super.processInteraction(interaction);

    const {
      payload: { type },
    } = interaction;

    this.interactionMap.get(type)?.();
  }
}
