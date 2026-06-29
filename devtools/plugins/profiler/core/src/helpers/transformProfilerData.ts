import type { ProfilerNode } from "../types";

const createSpacer = (gap: number) => ({
  name: "(work)",
  value: Math.ceil(gap * 1000),
  children: [],
  backgroundColor: "#000000",
  color: "#000000",
  tooltip: "Placeholder time between hooks",
});

export const transformProfilerData = (root: ProfilerNode): ProfilerNode => {
  return {
    ...root,
    children: transformProfilerDataHelper(root.children, root.startTime),
  };
};

const transformProfilerDataHelper = (
  nodes: ProfilerNode[],
  parentStart: number = 0,
): ProfilerNode[] => {
  const merged: ProfilerNode[] = [];
  let cursor = parentStart;

  for (const node of nodes) {
    if (
      node.startTime === undefined ||
      node.endTime === undefined ||
      node.value === undefined ||
      node.value <= 0
    ) {
      continue;
    }

    const next = {
      ...node,
      children: transformProfilerDataHelper(node.children, node.startTime),
    };

    const gap = node.startTime - cursor;
    if (gap > 0) {
      merged.push(createSpacer(gap));
    }
    cursor = node.endTime;

    merged.push(next);
  }

  return merged;
};
