export const isRecordType = <T>(obj: unknown): obj is Record<PropertyKey, T> =>
  typeof obj === "object" && obj !== null && !Array.isArray(obj);
