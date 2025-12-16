import { DevtoolsPlugin, DevtoolsPluginOptions, genDataChangeTransaction, generateUUID } from "@player-devtools/plugin";
import type { DevtoolsPluginInteractionEvent, PluginData} from "@player-devtools/types";
import type {
    DataController,
    ExpressionEvaluator,
    Flow,
    Player,
    ViewInstance,
    Logger,
} from "@player-ui/player";
import { dequal } from "dequal";
import { dset } from "dset/merge";
import { produce } from "immer";

import {BASE_PLUGIN_DATA, INTERACTIONS} from "./constants";
import { Evaluation } from "./types"
import flow from "../_generated/content/index.json";

/** This package is not targeting web environments: shadow global localStorage to force a TS error if used. */
declare const localStorage: never;
declare const window: never;
declare const document: never;
// We do not set console to never, since it may be polyfilled. The player logger is preferred though.

// interface BasicDevtoolsPluginOptions {
//     id?: string;
//     checkIfDevtoolsIsActive: () => boolean;
// }

const pluginData: PluginData = {
    ...BASE_PLUGIN_DATA,
    flow: flow as Flow,
};

const pluginID = pluginData.id;

/** Taps into the Player and ReactPlayer hooks and leverage the WrapperComponent to define and process the content. */
export class BasicDevtoolsPlugin extends DevtoolsPlugin {
    constructor(options: Omit<DevtoolsPluginOptions, 'pluginData'>) {
        super({
            ...options,
            pluginData,
        });
    }

    name = "BasicDevtoolsPlugin";

    data: Record<string, unknown> = {};

    playerConfig: Record<string, unknown> = {};

    logs: {
        severity: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message: any;
    }[] = [];

    flow?: Flow;

    // TODO: Potentially push up?
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

        const playerID = this.playerID;

        // Config
        this.playerConfig = {
            version: player.getVersion(),
            plugins: player.getPlugins().map((plugin) => plugin.name),
        };

        // const newState = produce(this.store.getState(), (draft) => {
        //     try {
        //         dset(draft, ["plugins", pluginID, "flow", "data", "playerConfig"], this.playerConfig);
        //     } catch {
        //         player.logger.error(this.name, "Error setting the following data: ", this.playerConfig);
        //         return;
        //     }
        // });
        //
        // const transaction = genDataChangeTransaction({
        //     playerID,
        //     data: newState.plugins[pluginID]!.flow.data,
        //     pluginID: pluginID,
        // });
        //
        // this.store.dispatch(transaction);

        // Data
        player.hooks.dataController.tap(this.name, (dataController) => {
            dataController.hooks.onUpdate.tap(this.name, (updates) => {
                // TODO: Do I even need to store this anymore?
                this.data = produce(this.data, (draft) => {
                    updates.forEach(({ binding, newValue }) => {
                        dset(draft, ["data", ...binding.asArray()], newValue);
                    });
                });

                const state = this.store.getState();
                if (dequal(state.plugins[pluginID]?.flow?.data?.data, this.data)) return;

                const newState = produce(state, (draft) => {
                    try {
                        dset(draft, ["plugins", pluginID, "flow", "data", "data"], this.data);
                    } catch {
                        player.logger.error(this.name, "Error setting the following data: ", this.data);
                        return;
                    }
                });

                const transaction = genDataChangeTransaction({
                    playerID,
                    data: newState.plugins[pluginID]!.flow.data,
                    pluginID: pluginID,
                });

                this.store.dispatch(transaction);
            });
        });

        player.logger.hooks.log.tap(this.name, (severity, message) => {
            this.logs = [...this.logs, { severity, message }];

            const state = this.store.getState();
            if (dequal(state.plugins[pluginID]?.flow?.data?.logs, this.logs)) return;

            const newState = produce(state, (draft) => {
                try {
                    dset(draft, ["plugins", pluginID, "flow", "data", "logs"], this.logs);
                } catch {
                    player.logger.error(this.name, "Error setting the following log: ", this.logs);
                }
            });

            const transaction = genDataChangeTransaction({
                playerID,
                data: newState.plugins[pluginID]!.flow.data,
                pluginID: pluginID,
            });

            this.store.dispatch(transaction);
        });

        // Flow
        player.hooks.onStart.tap(this.name, (f) => {
            this.flow = JSON.parse(JSON.stringify(f));

            const state = this.store.getState();
            if (dequal(state.plugins[pluginID]?.flow?.data?.flow, this.flow)) return;
            const newState = produce(state, (draft) => {
                try {
                    dset(draft, ["plugins", pluginID, "flow", "data", "flow"], this.flow);
                } catch {
                    player.logger.error(this.name, "Error setting the following flow:", this.flow);
                    return;
                }
            });

            const transaction = genDataChangeTransaction({
                playerID,
                data: newState.plugins[pluginID]!.flow.data,
                pluginID: pluginID,
            });

            this.store.dispatch(transaction);
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

    // TODO: Maybe move to helper
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
            const message = error instanceof Error ? error.message : String(error ?? "Something went wrong");
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
        super.processInteraction(interaction)

        const {
            payload: { type, payload },
        } = interaction;
        if (
            type === INTERACTIONS.EVALUATE_EXPRESSION &&
            this.expressionEvaluator &&
            payload
        ) {
            const result = this.evaluateExpression(payload);
            const newState = produce(this.store.getState(), (draft) => {
                const current: Array<Evaluation> =
                    // TODO: Verify draft works here instead of getState()
                    (draft?.plugins?.[pluginID]?.flow?.data
                        ?.history as Array<Evaluation>) || [];
                dset(
                    draft,
                    ["plugins", pluginID, "flow", "data", "history"],
                    [...current, result],
                );
            });

            this.store.dispatch({
                id: -1,
                type: "PLAYER_DEVTOOLS_PLUGIN_DATA_CHANGE",
                payload: {
                    pluginID: pluginID,
                    data: newState.plugins[pluginID]!.flow.data,
                },
                sender: this.playerID,
                context: "player",
                target: this.playerID,
                timestamp: Date.now(),
                _messenger_: true,
            });

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
