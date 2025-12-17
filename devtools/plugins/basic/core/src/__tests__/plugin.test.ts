import { describe } from "vitest";

describe("BasicDevtoolsPlugin", () => {
  // TODO: Add tests for BasicDevtoolsPlugin
});

// describe("BasicWevDevtoolPlugins", () => {
//   let plugin: BasicWebDevtoolsPlugin;
//   let mockPlayer: Player;
//
//   beforeEach(() => {
//     plugin = new BasicWebDevtoolsPlugin("test-id");
//     mockPlayer = {
//       hooks: {
//         dataController: {
//           tap: vi.fn(),
//         } as any,
//         onStart: {
//           tap: vi.fn(),
//         } as any,
//         view: {
//           tap: vi.fn(),
//         } as any,
//         expressionEvaluator: {
//           tap: vi.fn(),
//         } as any,
//       },
//       logger: {
//         hooks: {
//           log: vi.fn(),
//         },
//       },
//     } as unknown as Player;
//   });
//
//   it("should not apply if devtools are inactive", () => {
//     Object.defineProperty(window, "localStorage", {
//       value: {
//         getItem: vi.fn(() => "false"),
//       },
//       writable: true,
//     });
//
//     const consoleSpy = vi.spyOn(console, "log");
//     plugin.apply(mockPlayer);
//     expect(consoleSpy).toHaveBeenCalledWith(PLUGIN_INACTIVE_WARNING);
//     expect(plugin.playerConfig).toEqual({});
//   });
//
//   it("should initialize with default Values", () => {
//     expect(plugin.name).toBe(PLUGIN_ID);
//     expect(plugin.logs).toEqual([]);
//     expect(plugin.data).toEqual({});
//     expect(plugin.flow).toBeUndefined();
//     expect(plugin.expressionEvaluator).toBeUndefined();
//     expect(plugin.view).toBeUndefined();
//     expect(plugin.dataController).toBeUndefined();
//   });
// });
