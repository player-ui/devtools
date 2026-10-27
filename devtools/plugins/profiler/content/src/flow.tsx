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
    profiling: boolean;
    displayFlameGraph: boolean;
    rootNode: { value: number };
    rawNodes: unknown[];
  };
} = {
  id: PLUGIN_ID,
  views,
  navigation,
  schema,
  data: {
    profiling: false,
    displayFlameGraph: false,
    rootNode: {
      value: 0,
    },
    rawNodes: [],
  },
};

export default flow;
