import uid from "tiny-uid";
import type {
  BaseEvent,
  Connection,
  DisconnectEvent,
  EventsBatchEvent,
  InternalEvent,
  MessengerEvent,
  MessengerOptions,
  RequestLostEventsEvent,
  Transaction,
  TransactionMetadata,
} from "@player-devtools/types";

const internalEvents: Array<InternalEvent<BaseEvent<string, unknown>>["type"]> =
  [
    "MESSENGER_BEACON",
    "MESSENGER_DISCONNECT",
    "MESSENGER_REQUEST_LOST_EVENTS",
    "MESSENGER_EVENT_BATCH",
  ];

/**
 * Messenger<EventsType>
 *
 * Self-sufficient, lossless communication between instances.
 *
 * @param options
 * @param options.context - context to use for this instance
 * @param options.id - unique id for this instance, will be generated if not provided
 * @param options.beaconIntervalMS - time to wait between beacons in milliseconds, defaults to 1000
 * @param options.debug - if true, will log debug messages to console, defaults to false
 * @param options.messageCallback - callback to handle messages
 * @param options.sendMessage - function to send messages
 * @param options.addListener - function to add a listener
 * @param options.removeListener - function to remove a listener
 * @param options.handleFailedMessage - function to handle failed messages
 * @param options.log - function to handle logging
 * @returns Messenger
 * @example
 * ```typescript
 * const messenger = new Messenger({{
 *      context: "devtools",
 *      target: "player",
 *      messageCallback: (message) => dispatch(message),
 *      sendMessage: (message) =>
 *        browser.tabs
 *          ? browser.tabs
 *              .query({ active: true, currentWindow: true })
 *              .then((tabs) => {
 *                if (tabs[0].id) {
 *                  browser.tabs.sendMessage(tabs[0].id, message);
 *                }
 *              })
 *          : browser.runtime.sendMessage(message),
 *      addListener: (callback) => {
 *        browser.runtime.onMessage.addListener(callback);
 *      },
 *      removeListener: (callback) => {
 *        browser.runtime.onMessage.removeListener(callback);
 *      },
 * });
 *  ```
 */
export class Messenger<T extends BaseEvent<string, unknown>> {
  /** static record of events by isntance ID */
  private static events: Record<
    string,
    Array<MessageEvent<BaseEvent<string, unknown>>>
  > = {};

  /** static connections record by instance ID */
  private static connections: Record<string, Record<string, Connection>> = {};

  /** beacon interval */
  private beaconInterval: NodeJS.Timeout | null = null;

  /** time between beacons milliseconds */
  private beaconIntervalMS: number;

  /** callback to handle messages, here for instance binding */
  private handleMessage: (
    message: TransactionMetadata & MessengerEvent<T>,
  ) => void;

  /** unique id */
  private id: string;

  constructor(private options: MessengerOptions<T>) {
    console.log("[MESSENGER CONSTRUCTOR] options received:", options);
    console.log("[MESSENGER CONSTRUCTOR] options.context:", options.context);
    // set defaults:
    this.id = options.id || uid();
    this.beaconIntervalMS = options.beaconIntervalMS || 1000;

    console.log(`[MESSENGER] Initialized messenger with id=${this.id}, context=${this.options.context}`);

    // start beacon interval:
    this.beaconInterval = setInterval(
      this.beacon.bind(this),
      this.beaconIntervalMS,
    );

    console.log(`[MESSENGER] Started beacon interval with ${this.beaconIntervalMS}ms`);

    // bind message handler:
    this.handleMessage = this._handleMessage.bind(this);

    // add listener:
    this.options.addListener(this.handleMessage);
    console.log(`[MESSENGER] Added listener for incoming messages`);
  }

  private log(message: string) {
    if (this.options.debug) {
      this.options.logger.log(
        `[MESSENGER-${this.id}](${this.options.context}): ${message}`,
      );
    }
  }

  private getConnection(id: string) {
    if (!Messenger.connections[this.id]) {
      Messenger.connections[this.id] = {};
    }

    return Messenger.connections[this.id][id];
  }

  private addConnection(id: string) {
    Messenger.connections[this.id][id] = {
      id,
      messagesReceived: 0,
      messagesSent: 0,
      desync: false,
    };
  }

  private getEvents() {
    if (!Messenger.events[this.id]) {
      Messenger.events[this.id] = [];
    }

    return Messenger.events[this.id] as unknown as MessengerEvent<T>[];
  }

  private addEvent(event: MessengerEvent<T>) {
    const events = this.getEvents();
    events.push(event);
  }

  /** generate a sequential id for each non-internal message */
  private getTransactionID(message: MessengerEvent<T>) {
    if (
      !message.target ||
      internalEvents.includes(message.type as InternalEvent<T>["type"])
    ) {
      return -1;
    }

    if (!this.getConnection(message.target)) {
      this.addConnection(message.target);
    }

    const connection = this.getConnection(message.target);
    connection.messagesSent += 1;
    return connection.messagesSent;
  }

  private addTransactionMetadata(event: MessengerEvent<T>): Transaction<T> {
    const metadata = {
      _messenger_: true,
      id: this.getTransactionID(event),
      sender: this.id,
      timestamp: Date.now(),
      context: this.options.context,
      ...(event.target && { target: event.target }),
    };

    return {
      ...metadata,
      ...event,
    };
  }

  /** there is no persistent layer bookkeeping connections,
   * so beacon to inform others of its presence */
  private beacon() {
    this.options.sendMessage(
      this.addTransactionMetadata({
        type: "MESSENGER_BEACON",
        payload: null,
      }),
    );
  }

  private _handleMessage(transaction: Transaction<T>) {
    const parsed: Transaction<T> =
      typeof transaction === "string" ? JSON.parse(transaction) : transaction;

    const isFromMessenger = parsed._messenger_;
    const isFromSelf = parsed.sender === this.id;
    const isFromSameContext = parsed.context === this.options.context;
    const isTargetingOthers = parsed.target ? parsed.target !== this.id : false;
    const connection = this.getConnection(parsed.sender);
    const isKnownConnection = Boolean(connection);

    // Only log non-beacon messages to reduce noise
    const isBeacon = (parsed as any).type === "MESSENGER_BEACON";
    if (!isBeacon) {
      console.log("[MESSENGER FILTER] Message type:", (parsed as any).type);
      console.log("[MESSENGER FILTER] isFromMessenger:", isFromMessenger);
      console.log("[MESSENGER FILTER] isFromSelf:", isFromSelf);
      console.log("[MESSENGER FILTER] isFromSameContext:", isFromSameContext, "(parsed.context:", parsed.context, "this.options.context:", this.options.context + ")");
      console.log("[MESSENGER FILTER] isTargetingOthers:", isTargetingOthers, "(parsed.target:", parsed.target, "this.id:", this.id + ")");
      console.log("[MESSENGER FILTER] isKnownConnection:", isKnownConnection);
    }

    if (
      !isFromMessenger ||
      isFromSelf ||
      isFromSameContext ||
      isTargetingOthers ||
      (isKnownConnection && parsed.type === "MESSENGER_BEACON")
    ) {
      if (!isBeacon) {
        console.log("[MESSENGER FILTER] Message filtered out!");
      }
      return;
    }
    if (!isBeacon) {
      console.log("[MESSENGER FILTER] Message passed filter!");
    }

    const handlers: Record<string, (parsed: Transaction<T>) => void> = {
      MESSENGER_BEACON: this.handleBeaconMessage.bind(this),
      MESSENGER_DISCONNECT: this.handleDisconnectMessage.bind(this),
      MESSENGER_REQUEST_LOST_EVENTS: this.handleLostEventsRequest.bind(this),
    };

    const handler = handlers[(parsed as BaseEvent<string, unknown>).type];

    if (handler) {
      handler(parsed);
      return;
    }

    if (isKnownConnection) {
      const isBatch = parsed.type === "MESSENGER_EVENT_BATCH";

      const transactionID = isBatch
        ? (parsed.payload as EventsBatchEvent<T>["payload"]).events[0].id
        : parsed.id;

      const { messagesReceived, desync } = connection;

      // if we already received this message, ignore:
      if (transactionID > -1 && transactionID <= messagesReceived) {
        return;
      }

      // if we missed messages, request them, unless we already did:
      if (
        !desync &&
        transactionID > -1 &&
        transactionID > messagesReceived + 1
      ) {
        const message: RequestLostEventsEvent = {
          type: "MESSENGER_REQUEST_LOST_EVENTS",
          payload: {
            messagesReceived,
          },
          target: parsed.sender,
        };

        this.options.sendMessage(this.addTransactionMetadata(message));

        this.log(
          `requesting lost messages from ${parsed.context}:${parsed.sender}`,
        );

        // set desync, so we don't request again:
        connection.desync = true;

        // don't process this message, since we requested missing ones:
        return;
      }

      if (isBatch) {
        // clear desync flag on event batch:
        connection.desync = false;
        connection.messagesReceived += (
          parsed.payload as EventsBatchEvent<T>["payload"]
        ).events.length;
      } else {
        connection.messagesReceived += 1;
      }
    }

    this.options.messageCallback(parsed);

    this.log(
      `message received: ${(parsed as BaseEvent<string, unknown>).type}`,
    );
  }

  private handleBeaconMessage(parsed: Transaction<T>) {
    if (this.getConnection(parsed.sender)) {
      return;
    }

    this.addConnection(parsed.sender);
    const events = this.getEvents();

    if (events.length > 0) {
      const message: EventsBatchEvent<T> = {
        type: "MESSENGER_EVENT_BATCH",
        payload: {
          events: events.map((event) => this.addTransactionMetadata(event)),
        },
        target: parsed.sender,
      };

      this.options.sendMessage(this.addTransactionMetadata(message));

      this.log(
        `messages [0 - ${events.length - 1}] sent to ${parsed.context}:${
          parsed.sender
        }`,
      );

      const connection = this.getConnection(parsed.sender);
      connection.messagesSent = events.length;
    }

    this.log(`new connection added - ${parsed.context}:${parsed.sender}`);
  }

  private handleLostEventsRequest(parsed: Transaction<T>) {
    const connection = this.getConnection(parsed.sender);
    const events = this.getEvents();

    if (!connection || events.length === 0) {
      return;
    }

    const missingEvents = events.slice(connection.messagesSent, events.length);

    if (missingEvents.length === 0) {
      return;
    }

    const message: EventsBatchEvent<T> = {
      type: "MESSENGER_EVENT_BATCH",
      payload: {
        events: missingEvents.map((event) =>
          this.addTransactionMetadata(event),
        ),
      },
      target: parsed.sender,
    };

    this.options.sendMessage(this.addTransactionMetadata(message));

    connection.messagesSent = events.length;

    this.log(
      `messages [0 - ${events.length - 1}] sent to ${parsed.context}:${
        parsed.sender
      }`,
    );
  }

  private handleDisconnectMessage(
    parsed: TransactionMetadata & MessengerEvent<T>,
  ) {
    delete Messenger.connections[parsed.sender];

    this.log(`disconnected - ${parsed.context}:${parsed.sender}`);
  }

  public sendMessage(message: T | string): Promise<void> {
    const parsed: T =
      typeof message === "string" ? JSON.parse(message) : message;

    console.log(`[MESSENGER] Sending message type=${(parsed as BaseEvent<string, unknown>).type} from ${this.id}`);

    this.addEvent(parsed);

    const target = parsed.target || null;
    const msg = this.addTransactionMetadata(parsed);
    const connection = target ? this.getConnection(target) : null;

    if (connection) {
      connection.messagesSent += 1;
    }

    return this.options.sendMessage(msg).catch(() => {
      this.options.handleFailedMessage?.(msg);

      console.log(`[MESSENGER] Failed to send message type=${(parsed as BaseEvent<string, unknown>).type} from ${this.id} to ${target || "all"}`);

      this.log(
        `failed to send message: ${
          (parsed as BaseEvent<string, unknown>).type
        } from ${this.id} to ${target || "all"}`,
      );
    });
  }

  public destroy() {
    console.log(`[MESSENGER] Destroying messenger ${this.id}`);

    if (this.beaconInterval) {
      clearInterval(this.beaconInterval);
      console.log(`[MESSENGER] Cleared beacon interval`);
    }

    this.options.removeListener(this.handleMessage);
    console.log(`[MESSENGER] Removed listener`);

    Object.keys(Messenger.connections).forEach((connection) => {
      const event: DisconnectEvent = {
        type: "MESSENGER_DISCONNECT",
        payload: null,
        target: connection,
      };
      const message = this.addTransactionMetadata(event);
      this.options.sendMessage(message);
    });

    Messenger.reset();
    console.log(`[MESSENGER] Messenger ${this.id} destroyed`);
    this.log("destroyed");
  }

  /** reset static records */
  static reset() {
    Messenger.events = {};
    Messenger.connections = {};
  }
}
