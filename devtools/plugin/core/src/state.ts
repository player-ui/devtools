export type Reducer<T, A> = (state: T, action: A) => T;
export type Dispatch<A> = (action: A) => void;
export type Subscriber<T> = (state: T) => void;
export type Subscribe<T> = (subscriber: Subscriber<T>) => Unsubscribe;
export type Unsubscribe = () => void;

export interface Store<State, Action> {
    getState: () => State;
    subscribe: Subscribe<State>;
    dispatch: Dispatch<Action>;
}

export const useStateReducer = <State, Action>(reducer: Reducer<State, Action>, initialState: State): Store<State, Action> => {
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
            console.log("[DISPATCH] Called with action type:", (action as any)?.type);
            console.log("[DISPATCH] Full action:", action);
            const prevState = state;
            const nextState = reducer(prevState, action);
            console.log("[DISPATCH] prevState:", prevState);
            console.log("[DISPATCH] nextState:", nextState);
            console.log("[DISPATCH] State changed:", nextState !== prevState);

            // Only proceed if state actually changed by reference
            if (nextState !== prevState) {
                state = nextState;
                console.log("[DISPATCH] Notifying", subscribers.size, "subscribers");

                // Notify subscribers
                for (const sub of subscribers) sub(state);
            } else {
                console.log("[DISPATCH] State did not change, skipping subscriber notification");
            }
        }
    }
}
