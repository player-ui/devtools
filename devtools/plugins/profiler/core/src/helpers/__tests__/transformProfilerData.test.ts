import { describe, expect, test } from "vitest";
import { transformProfilerData } from "../transformProfilerData";
import type { ProfilerNode } from "../../types";

const node = (
  name: string,
  startTime: number,
  endTime: number,
  children: ProfilerNode[] = [],
): ProfilerNode => ({
  name,
  startTime,
  endTime,
  value: Math.ceil((endTime - startTime) * 1000),
  children,
});

describe("transformProfilerData", () => {
  test("returns root with transformed children, preserving root fields", () => {
    const root = node("root", 0, 1, [node("a", 0, 1)]);
    const result = transformProfilerData(root);

    expect(result.name).toBe("root");
    expect(result.startTime).toBe(0);
    expect(result.endTime).toBe(1);
  });

  test("nodes with no gap between them produce no spacers", () => {
    const root = node("root", 0, 2, [node("a", 0, 1), node("b", 1, 2)]);
    const { children } = transformProfilerData(root);

    expect(children).toHaveLength(2);
    expect(children[0]!.name).toBe("a");
    expect(children[1]!.name).toBe("b");
  });

  test("gap before first child inserts a spacer", () => {
    const root = node("root", 0, 2, [node("a", 1, 2)]);
    const { children } = transformProfilerData(root);

    expect(children).toHaveLength(2);
    expect(children[0]!.name).toBe("(work)");
    expect(children[0]!.value).toBe(1000);
    expect(children[1]!.name).toBe("a");
  });

  test("gap between children inserts a spacer between them", () => {
    const root = node("root", 0, 3, [node("a", 0, 1), node("b", 2, 3)]);
    const { children } = transformProfilerData(root);

    expect(children).toHaveLength(3);
    expect(children[0]!.name).toBe("a");
    expect(children[1]!.name).toBe("(work)");
    expect(children[1]!.value).toBe(1000);
    expect(children[2]!.name).toBe("b");
  });

  test("spacer value is gap duration in milliseconds (ceil)", () => {
    // gap of 0.0015 seconds → ceil(0.0015 * 1000) = ceil(1.5) = 2
    const root = node("root", 0, 2, [node("a", 0.0015, 2)]);
    const { children } = transformProfilerData(root);

    expect(children[0]!.name).toBe("(work)");
    expect(children[0]!.value).toBe(2);
  });

  test("spacer has correct styling fields", () => {
    const root = node("root", 0, 2, [node("a", 1, 2)]);
    const { children } = transformProfilerData(root);
    const spacer = children[0]!;

    expect(spacer.backgroundColor).toBe("#000000");
    expect(spacer.color).toBe("#000000");
    expect(spacer.tooltip).toBe("Placeholder time between hooks");
    expect(spacer.children).toHaveLength(0);
  });

  test("nodes missing startTime, endTime, or value are filtered out", () => {
    const root: ProfilerNode = {
      name: "root",
      startTime: 0,
      endTime: 2,
      value: 2000,
      children: [
        { name: "no-start", endTime: 1, value: 1000, children: [] },
        { name: "no-end", startTime: 0, value: 1000, children: [] },
        { name: "no-value", startTime: 0, endTime: 1, children: [] },
        node("valid", 0, 1),
      ],
    };

    const { children } = transformProfilerData(root);
    expect(children).toHaveLength(1);
    expect(children[0]!.name).toBe("valid");
  });

  test("nodes with value of zero are filtered out", () => {
    const root: ProfilerNode = {
      name: "root",
      startTime: 0,
      endTime: 2,
      value: 2000,
      children: [
        {
          name: "zero-value",
          startTime: 0,
          endTime: 0,
          value: 0,
          children: [],
        },
        node("valid", 0, 1),
      ],
    };

    const { children } = transformProfilerData(root);
    expect(children).toHaveLength(1);
    expect(children[0]!.name).toBe("valid");
  });

  test("root with no children returns empty children array", () => {
    const root = node("root", 0, 1);
    const { children } = transformProfilerData(root);
    expect(children).toHaveLength(0);
  });

  test("nested children are recursively transformed", () => {
    const inner = node("inner", 1.5, 2, []);
    const outer = node("outer", 0, 2, [inner]);
    const root = node("root", 0, 2, [outer]);

    const result = transformProfilerData(root);
    const outerResult = result.children[0]!;

    // gap before inner inside outer → spacer inserted
    expect(outerResult.children[0]!.name).toBe("(work)");
    expect(outerResult.children[1]!.name).toBe("inner");
  });

  test("multiple gaps each produce their own spacer", () => {
    const root = node("root", 0, 6, [node("a", 1, 2), node("b", 4, 5)]);

    const { children } = transformProfilerData(root);

    // spacer(0→1), a, spacer(2→4), b
    expect(children).toHaveLength(4);
    expect(children[0]!.name).toBe("(work)");
    expect(children[1]!.name).toBe("a");
    expect(children[2]!.name).toBe("(work)");
    expect(children[3]!.name).toBe("b");
  });
});
