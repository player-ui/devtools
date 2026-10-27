import type React from "react";
import { ConfigView } from "./ConfigView";
import { ConsoleView } from "./ConsoleView";
import { FlowView } from "./FlowView";
import { LogsView } from "./LogsView";
import { EditorView } from "./EditorView";

export const views: React.JSX.Element[] = [
  ConfigView,
  FlowView,
  LogsView,
  ConsoleView,
  EditorView,
];
