import { PLUGIN_ID } from "./constants";
import { navigation } from "./navigation";
import { schema } from "./schema";
import { views } from "./views";

const flow: {
  id: string;
  views: typeof views;
  navigation: typeof navigation;
  schema: typeof schema;
  data: {
    expression: string;
    flow: Record<string, unknown>;
    history: unknown[];
    logs: unknown[];
    playerConfig: Record<string, unknown>;
  };
} = {
  id: PLUGIN_ID,
  views,
  navigation,
  schema,
  data: {
    expression: "",
    flow: {},
    history: [],
    logs: [],
    playerConfig: {},
  },
};

export default flow;
