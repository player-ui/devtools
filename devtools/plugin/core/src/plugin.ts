import type { Messenger } from "@player-devtools/messenger";
import {
    PluginData, DevtoolsPluginsStore, PlayerInitEvent, ExtensionSupportedEvents, Transaction, DevtoolsPluginInteractionEvent,
} from "@player-devtools/types";
import type { Player, PlayerPlugin } from "@player-ui/player"
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

    store: PluginStore = useStateReducer(reducer, INITIAL_STATE);
    protected lastProcessedInteraction = 0;

    get pluginID(): string {
        return this.options.pluginData.id
    }

    get playerID(): string {
        return this.options.playerID
    }

    constructor(protected options: DevtoolsPluginOptions) {
        this.store.subscribe(({ interactions }) => {
            if (this.lastProcessedInteraction < (interactions.length ?? 0)) {
                interactions
                    .slice(this.lastProcessedInteraction)
                    // TODO: Is binding necessary? Verify this calls the super
                    .forEach(this.processInteraction.bind(this));
            }
        })
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
        // Propagate new messages from state to devtools via the messenger
        let lastMessageIndex = -1;
        return this.store.subscribe(({ messages }) => {
            const start = lastMessageIndex + 1;
            if (messages.length > start) {
                const newlyAdded = messages.slice(start);
                lastMessageIndex = messages.length - 1;
                for (const msg of newlyAdded) {
                    messenger.sendMessage(msg);
                }
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
        this.options.handler.processInteraction(interaction);

        const {
            payload: { type, payload },
        } = interaction;

        if (type === INTERACTIONS.PLAYER_SELECTED && payload) {
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
        }

        this.lastProcessedInteraction += 1;
    }

    apply(player: Player): void {
        if (!this.checkIfDevtoolsIsActive()) return;

        this.dispatchPlayerInit()
    }
}