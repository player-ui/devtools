import {
  INTERACTIONS,
  BasicPluginData,
} from "@player-devtools/basic-plugin-content";
import {
  DevtoolsPlugin,
  DevtoolsPluginOptions,
  generateUUID,
} from "@player-devtools/plugin";
import type { DevtoolsPluginInteractionEvent } from "@player-devtools/types";
import {
  StateContextPlugin,
  dataContextKey,
  getContextPlugin,
  type ContextPlugin,
  type SubscriptionToken,
} from "@player-ui/context-plugin";
import type {
  ExpressionEvaluator,
  Flow,
  Player,
  Logger,
} from "@player-ui/player";

import { playerConfigContextKey, type PlayerConfig } from "./context";
import { Evaluation } from "./types";

/** Taps into the Player and ReactPlayer hooks and leverage the WrapperComponent to define and process the content. */
export class BasicDevtoolsPlugin extends DevtoolsPlugin {
  constructor(options: Omit<DevtoolsPluginOptions, "pluginData">) {
    super({
      ...options,
      pluginData: BasicPluginData,
    });
  }

  name = "BasicDevtoolsPlugin";

  data: Record<string, unknown> = {};

  playerConfig: Partial<PlayerConfig> = {};

  logs: {
    severity: string;
    message: unknown;
  }[] = [];

  flow?: Flow;

  logger?: WeakRef<Logger>;

  expressionEvaluator?: WeakRef<ExpressionEvaluator>;

  /** Subscriptions are tied to the context plugin they were made on, which differs per Player */
  private subscriptions: Array<{
    context: ContextPlugin;
    token: SubscriptionToken;
  }> = [];

  overrideFlow?: Player["start"];

  apply(player: Player): void {
    this.logger = new WeakRef(player.logger);

    if (!this.checkIfDevtoolsIsActive()) return;

    super.apply(player);

    // State is read from the context plugin rather than tapping Player hooks directly
    const context = getContextPlugin(player);

    if (!player.getPlugins().some((p) => p.name === "state-context")) {
      player.registerPlugin(new StateContextPlugin());
    }

    // Subscriptions persist across flows on the context plugin, so drop any
    // left by an earlier apply of this plugin, on whichever Player it was.
    this.subscriptions.forEach(({ context: previous, token }) =>
      previous.unsubscribe(token),
    );

    this.subscriptions = [
      {
        context,
        token: context.subscribe(playerConfigContextKey, (playerConfig) => {
          // The context clears at flow end; keep the last known config until republished
          if (!playerConfig) return;

          this.playerConfig = { ...playerConfig };
          this.dispatchDataUpdate({ playerConfig: this.playerConfig });
        }),
      },
      {
        context,
        token: context.subscribe(dataContextKey, (model) => {
          // The model is Player's live data model, so clone it rather than let immer freeze it
          this.data = {
            data:
              model === undefined ? model : JSON.parse(JSON.stringify(model)),
          };
          this.dispatchDataUpdate({ data: this.data });
        }),
      },
    ];

    // The context store is reset when a flow ends, so republish on each start
    const publishConfig = () =>
      context.set(playerConfigContextKey, {
        version: player.getVersion(),
        plugins: player.getPlugins().map((plugin) => plugin.name),
      });

    publishConfig();

    player.logger.hooks.log.tap(this.name, (severity, message) => {
      this.logs = [...this.logs, { severity, message }];

      this.dispatchDataUpdate({ logs: this.logs });
    });

    // Flow
    player.hooks.onStart.tap(this.name, (f) => {
      this.flow = JSON.parse(JSON.stringify(f));

      this.dispatchDataUpdate({ flow: this.flow });
    });

    player.hooks.onStart.tap(this.name, publishConfig);

    // Expression evaluator
    player.hooks.expressionEvaluator.tap(this.name, (evaluator) => {
      this.expressionEvaluator = new WeakRef(evaluator);
    });

    // Override flow
    this.overrideFlow = player.start.bind(player);
  }

  private evaluateExpression(expression: string): Evaluation {
    const evaluator = this.expressionEvaluator?.deref();

    if (!evaluator) {
      return {
        id: generateUUID(),
        severity: "error",
        result: "Expression evaluator not available",
        expression,
      };
    }

    try {
      evaluator.hooks.onError.intercept({
        call: (error: Error) => {
          throw error;
        },
      });

      const evaluatorResult = evaluator.evaluate(expression);

      return {
        id: generateUUID(),
        result: evaluatorResult,
        expression,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? "Something went wrong");
      return {
        id: generateUUID(),
        severity: "error",
        result: message,
        expression,
      };
    }
  }

  processInteraction(interaction: DevtoolsPluginInteractionEvent): void {
    // invokes mobile specific handlers
    super.processInteraction(interaction);

    const {
      payload: { type, payload },
    } = interaction;
    if (
      type === INTERACTIONS.EVALUATE_EXPRESSION &&
      this.expressionEvaluator &&
      payload
    ) {
      const result = this.evaluateExpression(payload);
      const current: Array<Evaluation> =
        (this.store.getState()?.plugins?.[this.pluginID]?.flow?.data
          ?.history as Array<Evaluation>) || [];

      this.dispatchDataUpdate({ history: [...current, result] });

      return;
    }

    if (type === INTERACTIONS.OVERRIDE_FLOW && payload && this.overrideFlow) {
      let newFlow: Flow | undefined;

      try {
        newFlow = JSON.parse(payload);
      } catch (e) {
        this.logger?.deref()?.error(this.name, "Error parsing new flow", e);
      }

      if (newFlow) {
        this.overrideFlow(newFlow);
      }

      return;
    }
  }
}
