import { describe, it, expect, vi } from "vitest";
import type { ExtensionClient } from "@player-devtools/client";
import { FlipperServerTransport } from "@player-devtools/client-flipper";
import type { Transport } from "@player-devtools/types";

import {
  handleGetFlipperStatus,
  handleGetFlipperConsumers,
  handleRestartFlipperServer,
  handleGetFlipperPluginInstallStatus,
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
    it("reports refcount and active client ids", () => {
      const transport = makeFlipperTransport();
      (
        transport as unknown as { activeClientIds: Set<string> }
      ).activeClientIds = new Set(["client-a", "client-b"]);

      const result = handleGetFlipperConsumers(client, {}, transport);
      expect(parse(result)).toEqual({
        owns: false,
        refs: null,
        activeClientIds: ["client-a", "client-b"],
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
});
