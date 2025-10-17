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
            const prevState = state;
            const nextState = reducer(prevState, action);

            // Only proceed if state actually changed by reference
            if (nextState !== prevState) {
                state = nextState;

                // Notify subscribers
                for (const sub of subscribers) sub(state);
            }
        }
    }
}
