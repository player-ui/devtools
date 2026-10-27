import {
  describe,
  beforeEach,
  afterEach,
  expect,
  test,
  vi,
  type Mock,
} from "vitest";
import { Messenger } from "../index";
import { createMockContext } from "./helpers";
import {
  BaseEvent,
  type MessengerEvent,
  type Transaction,
  type ExtensionSupportedEvents,
} from "@player-devtools/types";

vi.useFakeTimers();

describe("Messenger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Messenger.reset();
  });

  test("beacons", () => {
    const { spies, mockMessagingAPI } = createMockContext();

    // not assigning to a variable would lead to "new for side effects" error
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const messenger = new Messenger({
      sendMessage: mockMessagingAPI.sendMessage.bind(mockMessagingAPI),
      addListener: mockMessagingAPI.addListener.bind(mockMessagingAPI),
      removeListener: mockMessagingAPI.removeListener.bind(mockMessagingAPI),
      messageCallback: spies.web1.messageCallback,
      context: "devtools",
      id: "test1",
      logger: console,
    });

    vi.advanceTimersByTime(1000);

    expect(spies.web1.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );
  });

  test("queue messages while handshake is in progress, and send them as the connection is established", () => {
    const { spies, mockMessagingAPI } = createMockContext();

    const messenger = new Messenger({
      sendMessage: mockMessagingAPI.sendMessage.bind(mockMessagingAPI),
      addListener: mockMessagingAPI.addListener.bind(mockMessagingAPI),
      removeListener: mockMessagingAPI.removeListener.bind(mockMessagingAPI),
      messageCallback: spies.web1.messageCallback,
      context: "devtools",
      id: "test2",
      logger: console,
    });

    const events: Array<BaseEvent<string, unknown>> = [
      { type: "TEST", payload: { count: 1 } },
      { type: "TEST", payload: { count: 2 } },
      { type: "TEST", payload: { count: 3 } },
    ];

    messenger.sendMessage(events[0]);

    vi.advanceTimersByTime(1000);

    messenger.sendMessage(events[1]);

    vi.advanceTimersByTime(1000);

    messenger.sendMessage(events[2]);

    vi.advanceTimersByTime(1000);

    mockMessagingAPI.sendMessage({
      type: "MESSENGER_BEACON",
      context: "content-script",
      _messenger_: true,
      sender: "test-2",
    });

    expect(spies.web1.sendMessage).toHaveBeenCalledTimes(8);

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ ...events[0], sender: "test2" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ ...events[1], sender: "test2" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ ...events[2], sender: "test2" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      7,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      8,
      expect.objectContaining({
        type: "MESSENGER_EVENT_BATCH",
        target: "test-2",
        payload: {
          events: [
            expect.objectContaining({ ...events[0] }),
            expect.objectContaining({ ...events[1] }),
            expect.objectContaining({ ...events[2] }),
          ],
        },
      }),
    );
  });

  test("messeges sent between two Messenger instances", () => {
    const { spies, mockMessagingAPI } = createMockContext();

    const eventsweb1: Array<BaseEvent<string, unknown>> = [
      { type: "TEST", payload: { count: 1 } },
      { type: "TEST", payload: { count: 2 } },
    ];

    const eventsDevtools: Array<BaseEvent<string, unknown>> = [
      { type: "TEST", payload: { count: 3 } },
      { type: "TEST", payload: { count: 4 } },
    ];

    const messenger1 = new Messenger({
      sendMessage: mockMessagingAPI.sendMessage.bind(mockMessagingAPI),
      addListener: mockMessagingAPI.addListener.bind(mockMessagingAPI),
      removeListener: mockMessagingAPI.removeListener.bind(mockMessagingAPI),
      messageCallback: spies.web1.messageCallback,
      context: "player",
      id: "web1",
      logger: console,
    });

    vi.advanceTimersByTime(1000);

    messenger1.sendMessage(eventsweb1[0]);

    const messenger2 = new Messenger({
      sendMessage: mockMessagingAPI.sendMessage.bind(mockMessagingAPI),
      addListener: mockMessagingAPI.addListener.bind(mockMessagingAPI),
      removeListener: mockMessagingAPI.removeListener.bind(mockMessagingAPI),
      messageCallback: spies.devtools.messageCallback,
      context: "devtools",
      id: "devtools1",
      logger: console,
    });

    vi.advanceTimersByTime(1000);

    messenger2.sendMessage(eventsDevtools[0]);

    vi.advanceTimersByTime(1000);

    messenger1.sendMessage(eventsweb1[1]);

    messenger2.sendMessage(eventsDevtools[1]);

    vi.advanceTimersByTime(1000);

    expect(spies.web1.sendMessage).toHaveBeenCalledTimes(12);

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ ...eventsweb1[0], sender: "web1" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        type: "MESSENGER_EVENT_BATCH",
        target: "devtools1",
        payload: {
          events: [expect.objectContaining({ ...eventsweb1[0] })],
        },
      }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ ...eventsDevtools[0], sender: "devtools1" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      7,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      8,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      9,
      expect.objectContaining({ ...eventsweb1[1], sender: "web1" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      10,
      expect.objectContaining({ ...eventsDevtools[1], sender: "devtools1" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      11,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );

    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      12,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );
  });

  test("messages sent between two web Messenger instances and one devtools instance", () => {
    const { spies, mockMessagingAPI } = createMockContext();

    const eventsWeb1: Array<BaseEvent<string, unknown>> = [
      { type: "TEST", target: "web2", payload: { count: 1 } },
      { type: "TEST", target: "devtools", payload: { count: 2 } },
    ];

    const eventsWeb2: Array<BaseEvent<string, unknown>> = [
      { type: "TEST", target: "web1", payload: { count: 3 } },
      { type: "TEST", target: "devtools", payload: { count: 4 } },
    ];

    const eventsDevtools: Array<BaseEvent<string, unknown>> = [
      { type: "TEST", target: "web1", payload: { count: 5 } },
      { type: "TEST", target: "web2", payload: { count: 6 } },
    ];

    const messengerWeb1 = new Messenger({
      sendMessage: mockMessagingAPI.sendMessage.bind(mockMessagingAPI),
      addListener: mockMessagingAPI.addListener.bind(mockMessagingAPI),
      removeListener: mockMessagingAPI.removeListener.bind(mockMessagingAPI),
      messageCallback: spies.web1.messageCallback,
      id: "web2",
      context: "player",
      logger: console,
    });

    const messengerWeb2 = new Messenger({
      sendMessage: mockMessagingAPI.sendMessage.bind(mockMessagingAPI),
      addListener: mockMessagingAPI.addListener.bind(mockMessagingAPI),
      removeListener: mockMessagingAPI.removeListener.bind(mockMessagingAPI),
      messageCallback: spies.web2.messageCallback,
      id: "web3",
      context: "player",
      logger: console,
    });

    const messengerDevtools = new Messenger({
      sendMessage: mockMessagingAPI.sendMessage.bind(mockMessagingAPI),
      addListener: mockMessagingAPI.addListener.bind(mockMessagingAPI),
      removeListener: mockMessagingAPI.removeListener.bind(mockMessagingAPI),
      messageCallback: spies.devtools.messageCallback,
      id: "devtools2",
      context: "devtools",
      logger: console,
    });

    vi.advanceTimersByTime(1000);

    messengerWeb1.sendMessage(eventsWeb1[0]);
    messengerWeb2.sendMessage(eventsWeb2[0]);
    messengerDevtools.sendMessage(eventsDevtools[0]);

    vi.advanceTimersByTime(1000);

    messengerWeb1.sendMessage(eventsWeb1[1]);
    messengerWeb2.sendMessage(eventsWeb2[1]);
    messengerDevtools.sendMessage(eventsDevtools[1]);

    vi.advanceTimersByTime(1000);

    expect(spies.web1.sendMessage).toHaveBeenCalledTimes(15);
    expect(spies.web2.sendMessage).toHaveBeenCalledTimes(15);
    expect(spies.devtools.sendMessage).toHaveBeenCalledTimes(15);
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ ...eventsWeb1[0], target: "web2" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ ...eventsWeb2[0], target: "web1" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ ...eventsDevtools[0], target: "web1" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      7,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      8,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      9,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      10,
      expect.objectContaining({ ...eventsWeb1[1], target: "devtools" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      11,
      expect.objectContaining({ ...eventsWeb2[1], target: "devtools" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      12,
      expect.objectContaining({ ...eventsDevtools[1], target: "web2" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      13,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      14,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );
    expect(spies.web1.sendMessage).toHaveBeenNthCalledWith(
      15,
      expect.objectContaining({ type: "MESSENGER_BEACON" }),
    );
  });

  // The MCP server addresses outbound actions to a specific player via the
  // `target` field; on the device, each Player runs a Messenger whose `id` is
  // its playerID. This proves the receiving side actually drops messages whose
  // `target` isn't its own id — i.e. a Player only handles actions meant for
  // it, even though every Player sees every message on the shared bus.
  describe("target-based routing", () => {
    /**
     * Wire N player messengers onto one shared bus. Each gets a
     * messageCallback spy; a message is "handled" by a player iff its callback
     * fires.
     */
    function bus(...ids: string[]) {
      type Frame = Transaction<ExtensionSupportedEvents>;
      const listeners = new Set<(event: Frame) => void>();
      const handled: Record<string, Mock> = {};
      const messengers: Array<Messenger<ExtensionSupportedEvents>> = [];

      const api = {
        // the Messenger stamps transaction metadata before it sends
        sendMessage: async (event: MessengerEvent<ExtensionSupportedEvents>) =>
          listeners.forEach((listener) => listener(event as Frame)),
        addListener: (cb: (event: Frame) => void) => {
          listeners.add(cb);
        },
        removeListener: (cb: (event: Frame) => void) => {
          listeners.delete(cb);
        },
      };

      for (const id of ids) {
        const messageCallback = vi.fn();
        handled[id] = messageCallback;
        const messenger = new Messenger<ExtensionSupportedEvents>({
          ...api,
          messageCallback,
          context: "player",
          id,
          logger: console,
        });
        messengers.push(messenger);
      }

      /** Inject a frame as if it arrived from the devtools/MCP side. */
      const inject = (target: string | undefined) =>
        api.sendMessage({
          type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
          payload: { type: "next" },
          context: "devtools",
          sender: "devtools-mcp",
          _messenger_: true,
          ...(target ? { target } : {}),
        } as unknown as Frame);

      return { handled, inject, messengers };
    }

    test("only the targeted player handles the interaction", () => {
      const { handled, inject } = bus("player-a", "player-b");

      inject("player-b");

      expect(handled["player-b"]).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
          target: "player-b",
        }),
      );
      expect(handled["player-a"]).not.toHaveBeenCalled();
    });

    test("an untargeted message is handled by every player", () => {
      const { handled, inject } = bus("player-a", "player-b");

      inject(undefined);

      expect(handled["player-a"]).toHaveBeenCalled();
      expect(handled["player-b"]).toHaveBeenCalled();
    });

    // Regression: a broadcast (no target, id === -1) followed by a targeted
    // message to the SAME player must still deliver the targeted message. The
    // broadcast previously advanced the receiver's `messagesReceived`, so the
    // targeted message's id looked like an already-seen duplicate and was
    // dropped. Drives the real sender `sendMessage` so transaction ids are
    // assigned exactly as in production.
    test("a targeted message after a broadcast is still delivered (not seen as duplicate)", () => {
      type Frame = Transaction<ExtensionSupportedEvents>;
      const listeners = new Set<(event: Frame) => void>();
      const layer = {
        // the Messenger stamps transaction metadata before it sends
        sendMessage: async (event: MessengerEvent<ExtensionSupportedEvents>) =>
          listeners.forEach((l) => l(event as Frame)),
        addListener: (cb: (event: Frame) => void) => {
          listeners.add(cb);
        },
        removeListener: (cb: (event: Frame) => void) => {
          listeners.delete(cb);
        },
      };

      const received = vi.fn();
      const player = new Messenger<ExtensionSupportedEvents>({
        ...layer,
        messageCallback: received,
        context: "player",
        id: "player-a",
        logger: console,
      });
      const devtools = new Messenger<ExtensionSupportedEvents>({
        ...layer,
        messageCallback: () => {},
        context: "devtools",
        id: "devtools",
        logger: console,
      });
      // establish the connection both ways
      vi.advanceTimersByTime(2000);
      received.mockClear();

      // broadcast (no target) — reaches player-a but must not advance its
      // sequence counter for the devtools connection
      devtools.sendMessage({
        type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
        payload: { type: "player-selected", payload: "player-a" },
      } as unknown as ExtensionSupportedEvents);

      // targeted follow-up to the same player
      devtools.sendMessage({
        type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
        payload: { type: "next" },
        target: "player-a",
      } as unknown as ExtensionSupportedEvents);

      const delivered = received.mock.calls
        .map((c) => (c[0] as Frame).payload as { type?: string })
        .map((p) => p?.type);
      expect(delivered).toContain("player-selected");
      expect(delivered).toContain("next");

      // keep a reference so the messengers aren't flagged unused
      expect(player).toBeDefined();
    });

    // Regression: two consecutive TARGETED messages to the same player must
    // both arrive in sequence. `sendMessage` used to increment `messagesSent`
    // a second time (on top of `getTransactionID`), so the second message was
    // stamped id=3 instead of 2 — a gap past the receiver's messagesReceived
    // that triggered lost-event recovery instead of delivery.
    test("consecutive targeted messages keep contiguous ids and both deliver", () => {
      type Frame = Transaction<ExtensionSupportedEvents>;
      const listeners = new Set<(event: Frame) => void>();
      const layer = {
        // the Messenger stamps transaction metadata before it sends
        sendMessage: async (event: MessengerEvent<ExtensionSupportedEvents>) =>
          listeners.forEach((l) => l(event as Frame)),
        addListener: (cb: (event: Frame) => void) => {
          listeners.add(cb);
        },
        removeListener: (cb: (event: Frame) => void) => {
          listeners.delete(cb);
        },
      };

      const received = vi.fn();
      const player = new Messenger<ExtensionSupportedEvents>({
        ...layer,
        messageCallback: received,
        context: "player",
        id: "player-a",
        logger: console,
      });
      const devtools = new Messenger<ExtensionSupportedEvents>({
        ...layer,
        messageCallback: () => {},
        context: "devtools",
        id: "devtools",
        logger: console,
      });
      vi.advanceTimersByTime(2000);
      received.mockClear();

      devtools.sendMessage({
        type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
        payload: { type: "first" },
        target: "player-a",
      } as unknown as ExtensionSupportedEvents);
      devtools.sendMessage({
        type: "PLAYER_DEVTOOLS_PLUGIN_INTERACTION",
        payload: { type: "second" },
        target: "player-a",
      } as unknown as ExtensionSupportedEvents);

      const ids = received.mock.calls.map((c) => (c[0] as Frame).id);
      const delivered = received.mock.calls.map(
        (c) => ((c[0] as Frame).payload as { type?: string })?.type,
      );
      expect(delivered).toContain("first");
      expect(delivered).toContain("second");
      // contiguous ids 1, 2 — no gap that would trip lost-event recovery
      expect(ids).toEqual([1, 2]);
      expect(player).toBeDefined();
    });
  });

  // The events/connections records are static, so every Messenger in the
  // process shares them. Destroying one Messenger (e.g. when a Player unmounts)
  // must only clear its own records and leave the others' intact.
  describe("destroy", () => {
    type Statics = {
      events: Record<string, unknown>;
      connections: Record<string, unknown>;
    };
    const statics = Messenger as unknown as Statics;

    // Other tests in this file never destroy their messengers, so they keep
    // beaconing and writing to the shared records under their own ids. Use ids
    // that no other test uses, and clean up what this block creates.
    const created: Array<Messenger<BaseEvent<string, unknown>>> = [];

    afterEach(() => {
      created.splice(0).forEach((messenger) => messenger.destroy());
    });

    /** Two player messengers and one devtools messenger on a shared bus. */
    function setup() {
      const { spies, mockMessagingAPI } = createMockContext();

      const create = (
        id: string,
        context: "player" | "devtools",
        messageCallback: Mock,
      ) => {
        const messenger = new Messenger<BaseEvent<string, unknown>>({
          sendMessage: mockMessagingAPI.sendMessage.bind(mockMessagingAPI),
          addListener: mockMessagingAPI.addListener.bind(mockMessagingAPI),
          removeListener:
            mockMessagingAPI.removeListener.bind(mockMessagingAPI),
          messageCallback,
          context,
          id,
          logger: console,
        });
        created.push(messenger);
        return messenger;
      };

      const web1 = create("destroy-web1", "player", spies.web1.messageCallback);
      const web2 = create("destroy-web2", "player", spies.web2.messageCallback);
      const devtools = create(
        "destroy-devtools1",
        "devtools",
        spies.devtools.messageCallback,
      );

      // let the beacons go out so every pair is connected
      vi.advanceTimersByTime(1000);

      return { spies, mockMessagingAPI, create, web1, web2, devtools };
    }

    test("only clears the destroyed instance's events and connections", () => {
      const { web1, web2 } = setup();

      web1.sendMessage({ type: "TEST", payload: { from: "web1" } });
      web2.sendMessage({ type: "TEST", payload: { from: "web2" } });

      expect(statics.events).toHaveProperty("destroy-web1");
      expect(statics.events).toHaveProperty("destroy-web2");
      expect(statics.connections).toHaveProperty("destroy-web1");
      expect(statics.connections).toHaveProperty("destroy-web2");

      web1.destroy();

      expect(statics.events).not.toHaveProperty("destroy-web1");
      expect(statics.connections).not.toHaveProperty("destroy-web1");
      expect(statics.events).toHaveProperty("destroy-web2");
      expect(statics.connections).toHaveProperty("destroy-web2");
    });

    test("another instance still replays its buffered events to a new peer", () => {
      const { spies, create, web1, web2 } = setup();

      web2.sendMessage({ type: "TEST", payload: { count: 1 } });

      web1.destroy();
      spies.web2.sendMessage.mockClear();

      // a devtools instance that shows up after web1 is gone
      create("destroy-devtools2", "devtools", vi.fn());
      vi.advanceTimersByTime(1000);

      expect(spies.web2.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "MESSENGER_EVENT_BATCH",
          sender: "destroy-web2",
          target: "destroy-devtools2",
          payload: {
            events: [
              expect.objectContaining({
                type: "TEST",
                payload: { count: 1 },
              }),
            ],
          },
        }),
      );
    });

    test("another instance keeps its established connection and sequencing", () => {
      const { spies, web1, web2 } = setup();

      web2.sendMessage({
        type: "TEST",
        payload: { count: 1 },
        target: "destroy-devtools1",
      });
      web2.sendMessage({
        type: "TEST",
        payload: { count: 2 },
        target: "destroy-devtools1",
      });

      web1.destroy();
      spies.devtools.messageCallback.mockClear();

      web2.sendMessage({
        type: "TEST",
        payload: { count: 3 },
        target: "destroy-devtools1",
      });

      // continues at id 3 rather than restarting at 1 and being dropped as a
      // duplicate by the receiver
      expect(spies.devtools.messageCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "TEST",
          sender: "destroy-web2",
          id: 3,
          payload: { count: 3 },
        }),
      );
    });

    /** targets of the MESSENGER_DISCONNECTs a sender put on the bus */
    const disconnectTargets = (spy: Mock, sender: string) =>
      spy.mock.calls
        .map(([message]) => message)
        .filter(
          (message) =>
            message.type === "MESSENGER_DISCONNECT" &&
            message.sender === sender,
        )
        .map((message) => message.target);

    /** a transaction as it would arrive from another process */
    const remoteTransaction = (
      sender: string,
      type: string,
      target?: string,
    ) => ({
      _messenger_: true,
      id: -1,
      sender,
      context: "player",
      type,
      payload: null,
      timestamp: 0,
      ...(target && { target }),
    });

    test("sends MESSENGER_DISCONNECT to its peers, not to itself or other local players", () => {
      const { spies, web1 } = setup();
      spies.devtools.sendMessage.mockClear();

      web1.destroy();

      expect(
        disconnectTargets(spies.devtools.sendMessage, "destroy-web1"),
      ).toEqual(["destroy-devtools1"]);
    });

    test("peers drop only the destroyed instance from their connections", () => {
      const { web1 } = setup();
      const devtoolsConnections = () =>
        statics.connections["destroy-devtools1"] as Record<string, unknown>;

      expect(Object.keys(devtoolsConnections()).sort()).toEqual([
        "destroy-web1",
        "destroy-web2",
      ]);

      web1.destroy();

      expect(Object.keys(devtoolsConnections())).toEqual(["destroy-web2"]);
    });

    test("a reused id reconnects, is replayed buffered events and is not dropped as a duplicate", () => {
      const { spies, create, web1, devtools } = setup();

      devtools.sendMessage({ type: "TEST", payload: { count: 1 } });
      web1.sendMessage({
        type: "TEST",
        payload: { count: 1 },
        target: "destroy-devtools1",
      });
      web1.sendMessage({
        type: "TEST",
        payload: { count: 2 },
        target: "destroy-devtools1",
      });

      web1.destroy();
      spies.devtools.sendMessage.mockClear();
      spies.devtools.messageCallback.mockClear();

      const reborn = create("destroy-web1", "player", vi.fn());
      vi.advanceTimersByTime(1000);

      // devtools replays its buffered events to the new instance
      expect(spies.devtools.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "MESSENGER_EVENT_BATCH",
          sender: "destroy-devtools1",
          target: "destroy-web1",
        }),
      );

      // sequencing restarts at 1, which must not look like an old message
      reborn.sendMessage({
        type: "TEST",
        payload: { count: 3 },
        target: "destroy-devtools1",
      });

      expect(spies.devtools.messageCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "TEST",
          sender: "destroy-web1",
          payload: { count: 3 },
        }),
      );
    });

    test("a received MESSENGER_DISCONNECT removes only that peer from this instance", () => {
      const { mockMessagingAPI } = setup();
      const devtoolsConnections = () =>
        statics.connections["destroy-devtools1"] as Record<string, unknown>;

      void mockMessagingAPI.sendMessage(
        remoteTransaction("remote-P1", "MESSENGER_BEACON"),
      );
      void mockMessagingAPI.sendMessage(
        remoteTransaction("remote-P2", "MESSENGER_BEACON"),
      );
      expect(devtoolsConnections()).toHaveProperty("remote-P1");
      expect(devtoolsConnections()).toHaveProperty("remote-P2");

      void mockMessagingAPI.sendMessage(
        remoteTransaction(
          "remote-P1",
          "MESSENGER_DISCONNECT",
          "destroy-devtools1",
        ),
      );

      expect(devtoolsConnections()).not.toHaveProperty("remote-P1");
      expect(devtoolsConnections()).toHaveProperty("remote-P2");
    });

    test("a received MESSENGER_DISCONNECT does not touch a same-process sender's own connections", () => {
      const { mockMessagingAPI } = setup();

      void mockMessagingAPI.sendMessage(
        remoteTransaction(
          "destroy-web1",
          "MESSENGER_DISCONNECT",
          "destroy-devtools1",
        ),
      );

      expect(statics.connections).toHaveProperty("destroy-web1");
    });

    test("only targets its own peers when other instances live in another process", () => {
      const { spies, create } = setup();

      // the player's process only knows about the devtools peer
      Messenger.reset();
      const solo = create("destroy-solo", "player", vi.fn());
      statics.connections["destroy-solo"] = {
        "remote-devtools": {
          id: "remote-devtools",
          messagesReceived: 0,
          messagesSent: 0,
          desync: false,
        },
      };
      spies.devtools.sendMessage.mockClear();

      solo.destroy();

      expect(
        disconnectTargets(spies.devtools.sendMessage, "destroy-solo"),
      ).toEqual(["remote-devtools"]);
    });

    test("routes a failed MESSENGER_DISCONNECT to handleFailedMessage", async () => {
      const handleFailedMessage = vi.fn();
      const messenger = new Messenger<BaseEvent<string, unknown>>({
        sendMessage: vi.fn().mockRejectedValue(new Error("transport down")),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        messageCallback: vi.fn(),
        handleFailedMessage,
        context: "player",
        id: "destroy-failing",
        logger: console,
      });
      created.push(messenger);
      statics.connections["destroy-failing"] = {
        "remote-devtools": {
          id: "remote-devtools",
          messagesReceived: 0,
          messagesSent: 0,
          desync: false,
        },
      };

      messenger.destroy();
      await vi.advanceTimersByTimeAsync(0);

      expect(handleFailedMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "MESSENGER_DISCONNECT",
          sender: "destroy-failing",
          target: "remote-devtools",
        }),
      );
    });
  });
});
