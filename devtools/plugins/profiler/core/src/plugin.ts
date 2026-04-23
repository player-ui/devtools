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
import flow from "./plugin-flow.json";

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

  private profilerObj?: Profiler;

  startProfiler?: () => void;
  stopProfiler?: Profiler["stopProfiler"];

  apply(player: Player): void {
    if (!this.checkIfDevtoolsIsActive()) {
      return;
    }

    super.apply(player);

    // Wire live updates: dispatch to store on every startTimer/endTimer call
    this.profilerObj = profiler(() => {
      if (!this.profilerObj) return;
      const { durations, rootNode } = this.profilerObj.getSnapshot();
      const newState = this.produceState(
        [["plugins", pluginID, "flow", "data", "durations"], durations],
        [["plugins", pluginID, "flow", "data", "rootNode"], rootNode]
      );
      this.store.dispatch(
        genDataChangeTransaction({
          playerID: this.playerID,
          data: newState.plugins[pluginID]?.flow.data,
          pluginID,
        })
      );
    });

    this.startProfiler = this.createProfileStartFunction(player);
    this.stopProfiler = this.createProfilerStopFunction(player);

    // Hook once for the lifetime of this Player instance
    addProfilerInterceptorsToHooks(
      player,
      this.profilerObj,
      undefined,
      undefined
    );

    // Dispatch initial profiling-active state
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

  private createProfileStartFunction = (player: Player): (() => void) => {
    return () => {
      if (!this.profilerObj) return;

      // Reset internal profiler state; interceptors remain on the hooks
      this.profilerObj.start();
      this.profilerObj.startTimer("profiler");

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
    };
  };

  private createProfilerStopFunction = (
    player: Player
  ): Profiler["stopProfiler"] => {
    return () => {
      if (!this.profilerObj)
        return { rootNode: { name: "root", children: [] }, durations: [] };
      const { stopProfiler, endTimer } = this.profilerObj;
      endTimer({ hookName: "profiler" });
      const stopProfilerResult = stopProfiler();
      const { rootNode, durations } = stopProfilerResult;

      const newState = this.produceState(
        [["plugins", pluginID, "flow", "data", "rootNode"], rootNode],
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

      return stopProfilerResult;
    };
  };

  processInteraction(interaction: DevtoolsPluginInteractionEvent): void {
    super.processInteraction(interaction);

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
