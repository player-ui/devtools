import type { Messenger } from "@player-devtools/messenger";
import {
    PluginData, DevtoolsPluginsStore, PlayerInitEvent, ExtensionSupportedEvents, Transaction, DevtoolsPluginInteractionEvent,
} from "@player-devtools/types";
import type { Player, PlayerPlugin, Logger } from "@player-ui/player"
import { dset } from "dset/merge";
import { produce } from "immer";
import { useStateReducer , type Store, type Unsubscribe } from "./state";
import { reducer } from "./reducer";
import { PLUGIN_INACTIVE_WARNING, INTERACTIONS } from "./constants";

export interface DevtoolsHandler {
    // TODO: Could return bool to signifiy handled to avoid double processing?
    processInteraction(interaction: DevtoolsPluginInteractionEvent): void
    checkIfDevtoolsIsActive(): boolean
    log?(message: string): void
}

export interface DevtoolsPluginOptions {
    playerID: string,
    pluginData: PluginData,
    handler: DevtoolsHandler,
}

const INITIAL_STATE: DevtoolsPluginsStore = {
    messages: [],
    plugins: {},
    interactions: [],
    currentPlayer: "",
};


// TODO: Rename to DevtoolsPluginStore? Need to rename DevtoolsPluginsStore to DevtoolsPluginState
export type PluginStore = Store<DevtoolsPluginsStore, Transaction<ExtensionSupportedEvents>>

/** Entrypoint for devtools plugins with platform-agnostic components */
export class DevtoolsPlugin implements PlayerPlugin, DevtoolsHandler {
    name: string = "DevtoolsPlugin";

    private loggedWarning = false;
    private logger?: Logger;

    store: PluginStore = useStateReducer(reducer, INITIAL_STATE);
    protected lastProcessedInteraction = 0;

    constructor(protected options: DevtoolsPluginOptions, logger?: Logger) {
        this.logger = logger;
        console.log("[DevtoolsPlugin Constructor] logger parameter received:", logger);
        console.log("[DevtoolsPlugin Constructor] typeof logger:", typeof logger);
        logger?.debug("[DevtoolsPlugin Constructor] Called");
        logger?.debug("[DevtoolsPlugin Constructor] this.store =", this.store);
        logger?.debug("[DevtoolsPlugin Constructor] typeof this.store =", typeof this.store);
        logger?.debug("[DevtoolsPlugin Constructor] this.store is undefined?", this.store === undefined);
        logger?.debug("[DevtoolsPlugin Constructor] this.store is null?", this.store === null);

        if (this.store) {
            logger?.debug("[DevtoolsPlugin Constructor] this.store keys:", Object.keys(this.store));
            logger?.debug("[DevtoolsPlugin Constructor] Setting up interactions subscription");
            this.store.subscribe(({ interactions }) => {
                console.log("[CONSTRUCTOR SUBSCRIPTION] Called with interactions:", interactions);
                console.log("[CONSTRUCTOR SUBSCRIPTION] lastProcessedInteraction:", this.lastProcessedInteraction);
                console.log("[CONSTRUCTOR SUBSCRIPTION] interactions.length:", interactions.length);
                if (this.lastProcessedInteraction < (interactions.length ?? 0)) {
                    const newInteractions = interactions.slice(this.lastProcessedInteraction);
                    console.log("[CONSTRUCTOR SUBSCRIPTION] Processing", newInteractions.length, "new interactions");
                    newInteractions
                        // TODO: Is binding necessary? Verify this calls the super
                        .forEach(this.processInteraction.bind(this));
                } else {
                    console.log("[CONSTRUCTOR SUBSCRIPTION] No new interactions to process");
                }
            })
            logger?.debug("[DevtoolsPlugin Constructor] Interactions subscription set up successfully");
        } else {
            logger?.debug("[DevtoolsPlugin Constructor] ERROR: this.store is undefined!");
        }
    }

    get pluginID(): string {
        return this.options.pluginData.id
    }

    get playerID(): string {
        return this.options.playerID
    }

    /** Helper for applying mutations to produce a new immutable plugin state. Note, this does not update state in the store, the result should be dispatched in an appropriate event */
    // TODO: Pull out into generic helper, but still expose here curried for DevtoolsPluginStore for use on mobile
    // TODO: Consider simple setPluginFlowData() API for mobile -- the most common use case for plugins is to update the data so that devtools responds accordingly
    //  Maybe we just end up with a function for each reducer handled event?
    produceState(...mutations: [path: string[], update: any][]): DevtoolsPluginsStore {
        return produce(this.store.getState(), (draft) => {
            for (const [path, update] of mutations) {
                dset(draft, path, update);
            }
        })
    }

    registerMessenger(messenger: Messenger<ExtensionSupportedEvents>): Unsubscribe {
        this.logger?.debug("[registerMessenger] Entering registerMessenger.");
        this.logger?.debug("[registerMessenger] this.store =", this.store);
        this.logger?.debug("[registerMessenger] typeof this.store =", typeof this.store);
        this.logger?.debug("[registerMessenger] this.store.subscribe =", this.store.subscribe);
        this.logger?.debug("[registerMessenger] typeof this.store.subscribe =", typeof this.store.subscribe);

        // Propagate new messages from state to devtools via the messenger
        let lastMessageIndex = -1;

        if (!this.store) {
            this.logger?.debug("[registerMessenger] ERROR: this.store is undefined or null!");
            return () => {};
        }

        if (!this.store.subscribe) {
            this.logger?.debug("[registerMessenger] ERROR: this.store.subscribe is undefined or null!");
            this.logger?.debug("[registerMessenger] this.store keys:", Object.keys(this.store));
            return () => {};
        }

        this.logger?.debug("[registerMessenger] About to call this.store.subscribe");
        return this.store.subscribe(({ messages }) => {
            this.logger?.debug("[registerMessenger] Checking for new messages to send.");
            const start = lastMessageIndex + 1;
            if (messages.length > start) {
                const newlyAdded = messages.slice(start);
                lastMessageIndex = messages.length - 1;
                this.logger?.debug(`[registerMessenger] Sending ${newlyAdded.length} new message(s) via messenger.`);
                for (const msg of newlyAdded) {
                    this.logger?.debug("[registerMessenger] Sending message:", msg);
                    messenger.sendMessage(msg);
                }
            } else {
                this.logger?.debug("[DevtoolsPlugin] No new messages to send.");
            }
        })
    }

    protected dispatchPlayerInit(): void {
        // Initial plugin content
        const transaction: Transaction<PlayerInitEvent> = {
            id: -1,
            type: "PLAYER_DEVTOOLS_PLAYER_INIT",
            payload: {
                plugins: {
                    [this.pluginID]: this.options.pluginData
                },
            },
            sender: this.options.playerID,
            context: "player",
            target: "player",
            timestamp: Date.now(),
            _messenger_: true,
        };

        this.store.dispatch(transaction);
    }

    checkIfDevtoolsIsActive(): boolean {
        const isActive = this.options.handler.checkIfDevtoolsIsActive();
        if (!isActive && !this.loggedWarning) {
            this.options.handler.log?.(PLUGIN_INACTIVE_WARNING);
            this.loggedWarning = true;
        }

        return isActive
    }

    processInteraction(interaction: DevtoolsPluginInteractionEvent): void {
        console.log("[PROCESS INTERACTION] Called with interaction:", interaction);
        this.options.handler.processInteraction(interaction);

        const {
            payload: { type, payload },
        } = interaction;

        console.log("[PROCESS INTERACTION] type:", type, "payload:", payload);
        if (type === INTERACTIONS.PLAYER_SELECTED && payload) {
            console.log("[PROCESS INTERACTION] Handling PLAYER_SELECTED");
            this.store.dispatch({
                id: -1,
                type: "PLAYER_DEVTOOLS_SELECTED_PLAYER_CHANGE",
                payload: { playerID: payload },
                sender: this.playerID,
                context: "player",
                target: this.playerID,
                timestamp: Date.now(),
                _messenger_: true,
            });

            this.lastProcessedInteraction += 1;
        } else {
            console.log("[PROCESS INTERACTION] Unhandled interaction type");
        }
    }

    apply(player: Player): void {
        if (!this.checkIfDevtoolsIsActive()) return;

        this.dispatchPlayerInit()
    }
}
