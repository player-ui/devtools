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
// Not `dset/merge`: merging arrays by index never shrinks them, which leaves stale nodes behind
// whenever a shorter tree replaces a longer one (reset, restart, dropped root nodes).
import { dset } from "dset";
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

/**
 * Publishing the tree to devtools clones and re-merges all of it, so a publish costs time
 * proportional to everything recorded so far. Recording itself is cheap. Publishing after every
 * hook made the total work quadratic: minutes of main-thread time on iOS, where JavaScriptCore
 * runs without a JIT. So recording happens on every hook, but publishing is rate limited:
 */

/** Never publish more often than this (ms), however many hooks fire. */
const MIN_PUBLISH_INTERVAL_MS = 250;

/**
 * After a publish, wait at least this many times as long as it took before publishing again.
 * Publishing then uses at most ~1/(1 + factor) of the main thread, however big the tree gets.
 */
const PUBLISH_BACKOFF_FACTOR = 10;

/** How many top-level nodes to keep, so a profiler that is never stopped can't grow forever. */
const MAX_ROOT_NODES = 1000;

export class ProfilerDevtoolsPlugin extends DevtoolsPlugin {
  name = "ProfilerDevtoolsPlugin";

  private readonly profilerObj: Profiler;

  /** The profiler tree changed since the last publish */
  private publishPending = false;

  /** True while a publish is running, to ignore updates that it triggers itself */
  private publishing = false;

  /** Earliest time (Date.now) at which the next publish may run */
  private nextPublishAt = 0;

  /** Trailing publish for updates that arrived while we were waiting */
  private publishTimer: ReturnType<typeof setTimeout> | undefined;

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

    this.profilerObj = new Profiler(() => this.requestPublish(), {
      maxRootNodes: MAX_ROOT_NODES,
    });
  }

  /** Clone the recorded tree and send it to devtools. Cost grows with the size of the tree. */
  private publishSnapshot(): void {
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
  }

  /**
   * The recorded tree changed. Publish it now if we are allowed to, otherwise make sure a single
   * trailing publish happens once we are, so the latest state is never left unpublished.
   */
  private requestPublish(): void {
    this.publishPending = true;

    if (this.publishing || this.publishTimer !== undefined) return;

    const wait = this.nextPublishAt - Date.now();
    if (wait <= 0) {
      this.flushPublish();
    } else if (typeof setTimeout === "function") {
      this.publishTimer = setTimeout(() => {
        this.publishTimer = undefined;
        this.flushPublish();
      }, wait);
    }
  }

  /** Publish now if anything changed since the last publish, and set when the next one may run. */
  private flushPublish(): void {
    if (!this.publishPending || this.publishing) return;

    this.cancelScheduledPublish();
    this.publishPending = false;
    this.publishing = true;

    const start = Date.now();
    try {
      this.publishSnapshot();
    } finally {
      this.publishing = false;
    }
    const end = Date.now();

    this.nextPublishAt =
      end +
      Math.max(MIN_PUBLISH_INTERVAL_MS, PUBLISH_BACKOFF_FACTOR * (end - start));

    // Something changed while we were publishing
    if (this.publishPending) this.requestPublish();
  }

  private cancelScheduledPublish(): void {
    if (this.publishTimer !== undefined) {
      clearTimeout(this.publishTimer);
      this.publishTimer = undefined;
    }
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
    // Explicit user action: show the reset tree now rather than when the rate limit allows
    this.flushPublish();
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
    // Explicit user action: show the cleared tree now rather than when the rate limit allows
    this.flushPublish();
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
    // This publish already contains everything that was recorded, so nothing is left pending
    this.publishPending = false;
    this.cancelScheduledPublish();
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

  teardown(): void {
    this.cancelScheduledPublish();
    super.teardown();
  }
}
