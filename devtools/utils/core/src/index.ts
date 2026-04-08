export type Reducer<State, Action> = (state: State, action: Action) => State;
export type Dispatch<Action> = (action: Action) => void;
export type Subscriber<State> = (state: State) => void;
export type Subscribe<State> = (subscriber: Subscriber<State>) => Unsubscribe;
export type Unsubscribe = () => void;

export interface Store<State, Action> {
  getState: () => State;
  subscribe: Subscribe<State>;
  dispatch: Dispatch<Action>;
}

export const useStateReducer = <State, Action>(
  reducer: Reducer<State, Action>,
  initialState: State,
): Store<State, Action> => {
  let state = initialState;
  const subscribers = new Set<Subscriber<State>>();
  return {
    getState: () => state,

    /** Subscribe to state changes; returns an unsubscribe function. */
    subscribe(subscriber: Subscriber<State>): Unsubscribe {
      subscribers.add(subscriber);
      subscriber(state);
      return () => subscribers.delete(subscriber);
    },

    /** Dispatch an action through the reducer, then run side-effects. */
    dispatch(action: Action): void {
      const prevState = state;
      const nextState = reducer(prevState, action);

      if (nextState !== prevState) {
        state = nextState;
        for (const sub of subscribers) sub(state);
      }
    },
  };
};

/**
 * Recursively assigns the contents of `source` into `target`, preserving
 * existing object and array references to maintain key insertion order.
 *
 * - **Objects**: keys present in `target` but absent in `source` are deleted
 *   (unless `merge` is true), then each source entry is recursed into.
 * - **Arrays**: target is truncated or extended to match source length
 *   (unless `merge` is true), then each element is recursed into.
 * - **Primitives / type mismatch**: source is returned directly; the caller
 *   is responsible for assigning the return value.
 *
 * @param target - The existing value to assign into.
 * @param source - The new value to assign from.
 * @param merge - When true, stale keys and excess array elements are preserved
 *   rather than deleted. Defaults to false.
 * @returns The mutated `target`, or `source` if types are incompatible.
 */
function deepAssign<T, V>(target: T, source: V, merge: boolean = false) {
  if (Array.isArray(target) && Array.isArray(source)) {
    while (!merge && target.length > source.length) target.pop();
    // recurse and assign new values
    for (const [index, item] of source.entries()) {
      target[index] = deepAssign(target[index], item, merge);
    }
  } else if (
    target &&
    typeof target === "object" &&
    source &&
    typeof source === "object"
  ) {
    const record = target as Record<string, unknown>;

    // clear stale keys
    if (!merge)
      for (const key of Object.keys(target)) {
        if (!(key in source)) delete record[key];
      }
    // recurse and assign new values
    for (const [key, item] of Object.entries(source)) {
      record[key] = deepAssign(record[key], item, merge);
    }
  } else {
    // new data doesn't match the types, so there is no referential equality to retain
    return source;
  }

  return target;
}

type Index = string | number;

/**
 * Deep-sets a value at a key path on an object, preserving existing nested
 * object and array references to maintain key insertion order.
 *
 * Intermediate objects are auto-vivified as needed. The final assignment is
 * handled by {@link deepAssign}, which mutates the existing value in place
 * rather than replacing it wholesale.
 *
 * @param obj - The root object to assign into.
 * @param keys - Path of keys leading to the target location.
 * @param value - The value to assign at the path.
 * @param merge - When true, stale keys and excess array elements are preserved
 *   rather than deleted. Defaults to false.
 * @throws If `keys` is empty or contains an undefined key.
 *
 * @see {@link https://github.com/lukeed/dset} for the original dset implementation that inspired this API
 */
export function dsetAssign<V>(
  obj: Record<Index, unknown>,
  keys: Array<Index>,
  value: V,
  merge: boolean = false,
): void {
  const key = keys[keys.length - 1];
  if (!key) throw Error("Unable to assign at path containing undefined keys");

  // Walk the path, auto-vivifying intermediate objects when necessary
  const target = keys
    .slice(0, -1)
    .reduce(
      (acc, key) => (acc[key] ??= {}) as Record<string | number, unknown>,
      obj,
    );

  // Deep assign the value into the target object for key
  target[key] = deepAssign(target[key], value, merge);
}
