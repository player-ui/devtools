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
    expression: "",
    flow: {},
    history: [],
    logs: [],
    playerConfig: {},
  },
};
