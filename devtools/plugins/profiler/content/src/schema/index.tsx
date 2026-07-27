import { dataTypes } from "@player-ui/common-types-plugin";
import type { Schema } from "@player-ui/types";
import { makeBindingsForObject } from "@player-lang/react-dsl";

const RecordType: Schema.DataType<Record<string, unknown>> = {
  type: "RecordType",
};

export const schema = {
  profiling: dataTypes.BooleanType,
  displayFlameGraph: dataTypes.BooleanType,
  rootNode: RecordType,
  rootNodes: RecordType,
  rawNodes: RecordType,
};

export const bindings = makeBindingsForObject(schema);
