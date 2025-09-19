import { PLUGIN_ID } from "../constants/index";
import { navigation } from "./navigation/index";
import { schema } from "./schema/index";
import { views } from "./views/index";

export default {
  id: PLUGIN_ID,
  views,
  navigation,
  schema,
  data: {
    rootNode: {
      name: "profiler time span",
      value: 0,
    },
    displayFlameGraph: false,
    profiling: false,
  },
};
