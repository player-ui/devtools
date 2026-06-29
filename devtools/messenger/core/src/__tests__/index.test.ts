import { describe, beforeEach, expect, test, vi, type Mock } from "vitest";
import { Messenger } from "../index";
import { createMockContext } from "./helpers";
import {
  BaseEvent,
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
        sendMessage: async (event: Frame) =>
          listeners.forEach((listener) => listener(event)),
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
        sendMessage: async (event: Frame) => listeners.forEach((l) => l(event)),
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
        sendMessage: async (event: Frame) => listeners.forEach((l) => l(event)),
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
});
