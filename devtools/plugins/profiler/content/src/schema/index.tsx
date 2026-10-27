import { dataTypes } from "@player-ui/common-types-plugin";
import type { Schema } from "@player-ui/types";
import { makeBindingsForObject } from "@player-lang/react-dsl";
import type { MakeBindingRefable } from "@player-lang/react-dsl";

const RecordType: Schema.DataType<Record<string, unknown>> = {
  type: "RecordType",
};

export const schema: {
  profiling: Schema.DataType<boolean>;
  displayFlameGraph: Schema.DataType<boolean>;
  rootNode: Schema.DataType<Record<string, unknown>>;
  rootNodes: Schema.DataType<Record<string, unknown>>;
  rawNodes: Schema.DataType<Record<string, unknown>>;
} = {
  profiling: dataTypes.BooleanType,
  displayFlameGraph: dataTypes.BooleanType,
  rootNode: RecordType,
  rootNodes: RecordType,
  rawNodes: RecordType,
};

export const bindings: MakeBindingRefable<typeof schema> =
  makeBindingsForObject(schema);
