import { isRecordType } from "./isRecordType";

export type ObjectWithHooks = {
  hooks: Record<PropertyKey, unknown>;
};

export const hasHooks = (obj: unknown): obj is ObjectWithHooks => {
  return isRecordType(obj) && "hooks" in obj && isRecordType(obj.hooks);
};
