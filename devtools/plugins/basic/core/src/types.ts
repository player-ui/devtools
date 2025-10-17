export interface Evaluation {
  /** A unique key for this expression */
  id: string;
  /** The expression itself */
  expression: string;
  /** The result for a given expression */
  result?: unknown;
  /** Whether there were any errors with the result */
  severity?: "error" | "warning";
}
