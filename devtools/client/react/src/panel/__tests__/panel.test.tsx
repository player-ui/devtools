import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { Panel } from "..";
import { PUBSUB_PLUGIN } from "../../plugins";

// The UI asset library cannot be loaded under vitest (its CommonJS dependency
// `react-copy-to-clipboard` has no named ESM exports). These tests only cover
// how the panel forwards published events, which needs no assets.
vi.mock("@devtools-ui/plugin", () => ({
  default: class {
    name = "devtools-ui-assets";
    apply() {}
    applyReact() {}
  },
}));

type SentMessage = { type: string; payload?: unknown };

const createCommunicationLayer = () => ({
  sendMessage: vi.fn((_message: unknown) => Promise.resolve()),
  addListener: vi.fn(),
  removeListener: vi.fn(),
});

/** Plugin interactions the panel handed to the communication layer. */
const sentInteractions = (
  layer: ReturnType<typeof createCommunicationLayer>,
): SentMessage[] =>
  layer.sendMessage.mock.calls
    .map(([message]) =>
      typeof message === "string"
        ? (JSON.parse(message) as SentMessage)
        : (message as SentMessage),
    )
    .filter((message) => message.type === "PLAYER_DEVTOOLS_PLUGIN_INTERACTION");

describe("Panel", () => {
  afterEach(() => {
    PUBSUB_PLUGIN.clear();
  });

  it.each([{ mounts: 2 }, { mounts: 4 }])(
    "sends once, not once per mount, after $mounts mounts",
    ({ mounts }) => {
      const layer = createCommunicationLayer();

      for (let i = 1; i < mounts; i++) {
        render(<Panel communicationLayer={layer} />).unmount();
      }
      render(<Panel communicationLayer={layer} />);

      PUBSUB_PLUGIN.publish("evaluate-expression", "1 + 1");

      const interactions = sentInteractions(layer);
      expect(interactions).toHaveLength(1);
      expect(interactions[0]?.payload).toEqual({
        type: "evaluate-expression",
        payload: "1 + 1",
      });
    },
  );

  it("sends once, not once per mount, under StrictMode", () => {
    const layer = createCommunicationLayer();

    // StrictMode mounts, unmounts and remounts the panel in development.
    render(
      <React.StrictMode>
        <Panel communicationLayer={layer} />
      </React.StrictMode>,
    );

    PUBSUB_PLUGIN.publish("start-profiling");

    expect(sentInteractions(layer)).toHaveLength(1);
  });

  it("sends nothing once every panel has unmounted", () => {
    const layer = createCommunicationLayer();

    render(<Panel communicationLayer={layer} />).unmount();

    PUBSUB_PLUGIN.publish("reset-profiling");

    expect(sentInteractions(layer)).toHaveLength(0);
  });
});
