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
import { profiler } from "./helpers";
import type { Profiler } from "./types";
import { addProfilerInterceptorsToHooks } from "./addProfilerInterceptorsToHooks";

// TODO: Import content
const flow: Flow = {} as Flow;

const pluginData: PluginData = {
  ...BASE_PLUGIN_DATA,
  flow: flow as Flow,
};

const pluginID = pluginData.id;

export class ProfilerDevtoolsPlugin extends DevtoolsPlugin {
  constructor(options: Omit<DevtoolsPluginOptions, "pluginData">) {
    super({
      ...options,
      pluginData,
    });
  }

  name = "ProfilerDevtoolsPlugin";

  startProfiler?: Profiler["start"];
  stopProfiler?: Profiler["stopProfiler"];

  apply(player: Player): void {
    if (!this.checkIfDevtoolsIsActive()) {
      return;
    }

    super.apply(player);

    const profilerObj = profiler();

    this.stopProfiler = this.createProfilerStopFunction(profilerObj);
    /** function to tap into hooks and start the profiler */
    this.startProfiler = this.createProfileStartFunction(player, profilerObj);
  }

  private createProfileStartFunction = (
    player: Player,
    profilerObj: Profiler
  ): Profiler["start"] => {
    const { start } = profilerObj;

    return () => {
      start();

      addProfilerInterceptorsToHooks(player, profilerObj);

      const newState = produce(this.store.getState(), (draft) => {
        dset(draft, ["plugins", pluginID, "flow", "data", "rootNode"], {
          name: "root",
          children: [],
        });
        dset(draft, ["plugins", pluginID, "flow", "data", "durations"], []);
        dset(draft, ["plugins", pluginID, "flow", "data", "profiling"], true);
        dset(
          draft,
          ["plugins", pluginID, "flow", "data", "displayFlameGraph"],
          false
        );
      });

      const transaction = genDataChangeTransaction({
        playerID: this.playerID,
        data: newState.plugins[pluginID]?.flow.data,
        pluginID,
      });

      this.store.dispatch(transaction);

      this.lastProcessedInteraction += 1;
    };
  };

  private createProfilerStopFunction = (
    profiler: Profiler
  ): Profiler["stopProfiler"] => {
    return () => {
      const { stopProfiler } = profiler;
      const stopProfilerResult = stopProfiler();
      const { rootNode, durations } = stopProfilerResult;

      const newState = this.produceState(
        [["plugins", pluginID, "flow", "data", "rootNode"], rootNode],
        [["plugins", pluginID, "flow", "data", "durations"], durations],
        [["plugins", pluginID, "flow", "data", "profiling"], false],
        [["plugins", pluginID, "flow", "data", "displayFlameGraph"], true]
      );

      const transaction = genDataChangeTransaction({
        playerID: this.playerID,
        data: newState.plugins[pluginID]?.flow.data,
        pluginID,
      });

      this.store.dispatch(transaction);

      this.lastProcessedInteraction += 1;
      return stopProfilerResult;
    };
  };

  processInteraction(interaction: DevtoolsPluginInteractionEvent): void {
    const {
      payload: { type },
    } = interaction;
    if (type === INTERACTIONS.START_PROFILING && this.startProfiler) {
      this.startProfiler();
    }

    if (type === INTERACTIONS.STOP_PROFILING && this.stopProfiler) {
      this.stopProfiler();
    }
  }
}
