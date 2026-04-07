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
import { dsetAssign } from "@player-devtools/utils";
import type {
  DataController,
  ExpressionEvaluator,
  Flow,
  Player,
  ViewInstance,
  Logger,
} from "@player-ui/player";
import { produce } from "immer";

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

  playerConfig: Record<string, unknown> = {};

  logs: {
    severity: string;
    message: unknown;
  }[] = [];

  flow?: Flow;

  logger?: WeakRef<Logger>;

  expressionEvaluator?: WeakRef<ExpressionEvaluator>;

  view?: WeakRef<ViewInstance>;

  dataController?: WeakRef<DataController>;

  overrideFlow?: Player["start"];

  apply(player: Player): void {
    this.logger = new WeakRef(player.logger);

    if (!this.checkIfDevtoolsIsActive()) return;

    this.options.pluginData.flow.data!.playerConfig = {
      version: player.getVersion(),
      plugins: player.getPlugins().map((plugin) => plugin.name),
    };

    super.apply(player);

    // Config
    this.playerConfig = {
      version: player.getVersion(),
      plugins: player.getPlugins().map((plugin) => plugin.name),
    };

    this.dispatchDataUpdate({ playerConfig: this.playerConfig });

    // Data
    player.hooks.dataController.tap(this.name, (dataController) => {
      dataController.hooks.onUpdate.tap(this.name, (updates) => {
        this.data = produce(this.data, (draft) => {
          updates.forEach(({ binding, newValue }) => {
            dsetAssign(draft, ["data", ...binding.asArray()], newValue);
          });
        });

        this.dispatchDataUpdate({ data: this.data });
      });
    });

    player.logger.hooks.log.tap(this.name, (severity, message) => {
      this.logs = [...this.logs, { severity, message }];

      this.dispatchDataUpdate({ logs: this.logs });
    });

    // Flow
    player.hooks.onStart.tap(this.name, (f) => {
      this.flow = JSON.parse(JSON.stringify(f));

      this.dispatchDataUpdate({ flow: this.flow });
    });

    // View
    player.hooks.view.tap(this.name, (view) => {
      this.view = new WeakRef(view);
    });

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
