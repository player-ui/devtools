import { describe, it, expect, vi } from "vitest";
import type { ExtensionClient } from "@player-devtools/client";
import { FlipperServerTransport } from "@player-devtools/client-flipper";
import type { Transport } from "@player-devtools/types";

import {
  handleGetFlipperStatus,
  handleGetFlipperConsumers,
  handleRestartFlipperServer,
  handleGetFlipperPluginInstallStatus,
  handleGetFlipperPluginActivationStatus,
  handleEnableFlipperPlugin,
  handleDisableFlipperPlugin,
} from "../flipper";

const client = {} as ExtensionClient;

function parse(result: { content: Array<{ text?: string }> }): unknown {
  return JSON.parse(result.content[0]?.text ?? "{}");
}

/**
 * A bare, unconnected transport — never calls `connect()`, no real sockets.
 * The refcount is stubbed to `null` so tests don't depend on (or race) a real
 * `flipper-server.refcount` file possibly left on disk by other processes.
 */
function makeFlipperTransport(): FlipperServerTransport {
  const transport = new FlipperServerTransport();
  (transport as unknown as { refcount: { peek: () => unknown } }).refcount = {
    peek: () => null,
  };
  return transport;
}

const nonFlipperTransport = {
  connect: vi.fn(),
  close: vi.fn(),
  sendMessage: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
} as unknown as Transport;

describe("flipper diagnostic tools", () => {
  describe("when the transport is not a FlipperServerTransport", () => {
    it("get_flipper_status soft-errors", () => {
      const result = handleGetFlipperStatus(client, {}, nonFlipperTransport);
      expect(parse(result)).toEqual({ error: "not using a Flipper transport" });
    });

    it("get_flipper_consumers soft-errors", () => {
      const result = handleGetFlipperConsumers(client, {}, nonFlipperTransport);
      expect(parse(result)).toEqual({ error: "not using a Flipper transport" });
    });

    it("restart_flipper_server soft-errors", async () => {
      const result = await handleRestartFlipperServer(
        client,
        {},
        nonFlipperTransport,
      );
      expect(parse(result)).toEqual({ error: "not using a Flipper transport" });
    });

    it("get_flipper_plugin_install_status soft-errors", async () => {
      const result = await handleGetFlipperPluginInstallStatus(
        client,
        {},
        nonFlipperTransport,
      );
      expect(parse(result)).toEqual({ error: "not using a Flipper transport" });
    });

    it("get_flipper_plugin_activation_status soft-errors", () => {
      const result = handleGetFlipperPluginActivationStatus(
        client,
        {},
        nonFlipperTransport,
      );
      expect(parse(result)).toEqual({ error: "not using a Flipper transport" });
    });

    it("enable_flipper_plugin soft-errors", async () => {
      const result = await handleEnableFlipperPlugin(
        client,
        {},
        nonFlipperTransport,
      );
      expect(parse(result)).toEqual({ error: "not using a Flipper transport" });
    });

    it("disable_flipper_plugin soft-errors", async () => {
      const result = await handleDisableFlipperPlugin(
        client,
        {},
        nonFlipperTransport,
      );
      expect(parse(result)).toEqual({ error: "not using a Flipper transport" });
    });

    it("soft-errors when no transport is provided at all", () => {
      const result = handleGetFlipperStatus(client, {}, undefined);
      expect(parse(result)).toEqual({ error: "not using a Flipper transport" });
    });
  });

  describe("get_flipper_status", () => {
    it("reports diagnostics from an unconnected transport", () => {
      const transport = makeFlipperTransport();
      const result = handleGetFlipperStatus(client, {}, transport);
      expect(parse(result)).toEqual({
        connected: false,
        host: "localhost",
        port: 52342,
        owns: false,
        refs: null,
      });
    });
  });

  describe("get_flipper_consumers", () => {
    it("reports refcount, active client ids, and connected client ids", () => {
      const transport = makeFlipperTransport();
      const state = transport as unknown as {
        activeClientIds: Set<string>;
        connectedClientIds: Set<string>;
      };
      state.activeClientIds = new Set(["client-a", "client-b"]);
      state.connectedClientIds = new Set(["client-a", "client-b", "client-c"]);

      const result = handleGetFlipperConsumers(client, {}, transport);
      expect(parse(result)).toEqual({
        owns: false,
        refs: null,
        activeClientIds: ["client-a", "client-b"],
        connectedClientIds: ["client-a", "client-b", "client-c"],
      });
    });
  });

  describe("restart_flipper_server", () => {
    it("soft-errors when this instance does not own the daemon", async () => {
      const transport = makeFlipperTransport();
      const result = await handleRestartFlipperServer(client, {}, transport);
      expect(parse(result)).toEqual({
        error: "this instance does not own the flipper-server daemon",
      });
    });

    it("soft-errors when other consumers are attached", async () => {
      const transport = makeFlipperTransport();
      (transport as unknown as { owns: boolean }).owns = true;
      (transport as unknown as { refcount: { peek: () => unknown } }).refcount =
        { peek: () => ({ pid: 1, refs: 2 }) };

      const result = await handleRestartFlipperServer(client, {}, transport);
      expect(parse(result)).toEqual({
        error: "other consumers are attached to this daemon",
      });
    });
  });

  describe("get_flipper_plugin_install_status", () => {
    it("soft-errors when the transport is not connected", async () => {
      const transport = makeFlipperTransport();
      const result = await handleGetFlipperPluginInstallStatus(
        client,
        {},
        transport,
      );
      expect(parse(result)).toEqual({
        error: "flipper transport not connected",
      });
    });

    it("returns the plugin install status when connected", async () => {
      const transport = makeFlipperTransport();
      const exec = vi
        .fn()
        .mockResolvedValue([{ id: "player-ui-devtools", version: "1.2.3" }]);
      (transport as unknown as { server: unknown }).server = { exec };

      const result = await handleGetFlipperPluginInstallStatus(
        client,
        {},
        transport,
      );
      expect(parse(result)).toEqual({ installed: true, version: "1.2.3" });
    });

    it("returns a soft error (not an unhandled rejection) when exec() rejects", async () => {
      const transport = makeFlipperTransport();
      const exec = vi.fn().mockRejectedValue(new Error("daemon dropped"));
      (transport as unknown as { server: unknown }).server = { exec };

      const result = await handleGetFlipperPluginInstallStatus(
        client,
        {},
        transport,
      );
      expect(parse(result)).toEqual({ error: "daemon dropped" });
    });
  });

  describe("get_flipper_plugin_activation_status", () => {
    it("soft-errors when the transport is not connected", () => {
      const transport = makeFlipperTransport();
      const result = handleGetFlipperPluginActivationStatus(
        client,
        {},
        transport,
      );
      expect(parse(result)).toEqual({
        error: "flipper transport not connected",
      });
    });

    it("splits connected clients into active and inactive", () => {
      const transport = makeFlipperTransport();
      const state = transport as unknown as {
        server: unknown;
        activeClientIds: Set<string>;
        connectedClientIds: Set<string>;
      };
      state.server = {};
      state.activeClientIds = new Set(["a"]);
      state.connectedClientIds = new Set(["a", "b", "c"]);

      const result = handleGetFlipperPluginActivationStatus(
        client,
        {},
        transport,
      );
      expect(parse(result)).toEqual({
        activeClientIds: ["a"],
        inactiveClientIds: ["b", "c"],
      });
    });
  });

  describe("enable_flipper_plugin", () => {
    it("calls enablePlugin with the given clientId and reports it back", async () => {
      const transport = makeFlipperTransport();
      const enablePlugin = vi
        .spyOn(transport, "enablePlugin")
        .mockResolvedValue(undefined);

      const result = await handleEnableFlipperPlugin(
        client,
        { clientId: "a" },
        transport,
      );

      expect(enablePlugin).toHaveBeenCalledWith("a");
      expect(parse(result)).toEqual({ enabled: true, clientId: "a" });
    });

    it("calls enablePlugin with undefined and reports 'all' when no clientId is given", async () => {
      const transport = makeFlipperTransport();
      const enablePlugin = vi
        .spyOn(transport, "enablePlugin")
        .mockResolvedValue(undefined);

      const result = await handleEnableFlipperPlugin(client, {}, transport);

      expect(enablePlugin).toHaveBeenCalledWith(undefined);
      expect(parse(result)).toEqual({ enabled: true, clientId: "all" });
    });

    it("returns a soft error (not an unhandled rejection) when enablePlugin() rejects", async () => {
      const transport = makeFlipperTransport();
      vi.spyOn(transport, "enablePlugin").mockRejectedValue(
        new Error("FlipperServerTransport is not connected"),
      );

      const result = await handleEnableFlipperPlugin(client, {}, transport);
      expect(parse(result)).toEqual({
        error: "FlipperServerTransport is not connected",
      });
    });
  });

  describe("disable_flipper_plugin", () => {
    it("calls disablePlugin with the given clientId and reports it back", async () => {
      const transport = makeFlipperTransport();
      const disablePlugin = vi
        .spyOn(transport, "disablePlugin")
        .mockResolvedValue(undefined);

      const result = await handleDisableFlipperPlugin(
        client,
        { clientId: "a" },
        transport,
      );

      expect(disablePlugin).toHaveBeenCalledWith("a");
      expect(parse(result)).toEqual({ disabled: true, clientId: "a" });
    });

    it("calls disablePlugin with undefined and reports 'all' when no clientId is given", async () => {
      const transport = makeFlipperTransport();
      const disablePlugin = vi
        .spyOn(transport, "disablePlugin")
        .mockResolvedValue(undefined);

      const result = await handleDisableFlipperPlugin(client, {}, transport);

      expect(disablePlugin).toHaveBeenCalledWith(undefined);
      expect(parse(result)).toEqual({ disabled: true, clientId: "all" });
    });

    it("returns a soft error (not an unhandled rejection) when disablePlugin() rejects", async () => {
      const transport = makeFlipperTransport();
      vi.spyOn(transport, "disablePlugin").mockRejectedValue(
        new Error("FlipperServerTransport is not connected"),
      );

      const result = await handleDisableFlipperPlugin(client, {}, transport);
      expect(parse(result)).toEqual({
        error: "FlipperServerTransport is not connected",
      });
    });
  });
});
