//
//  Store.swift
//  DemoProject
//
//  Created by Koriann South on 2025-11-05.
//

typealias Reducer<State, Action> = (State, Action) -> State
typealias Dispatch<Action> = (Action) -> Void
typealias Subscriber<State> = (State) -> Void
typealias Subscribe<State> = (Subscriber<State>) -> Unsubscribe
public typealias Unsubscribe = () -> Void

/// Used to store values
struct Store<State, Action> { // TODO: remove if unused
    /// The state of the plugin
    let state: State
    /// Subscribe to changes in the store
    let subscribe: Subscribe<State>
    /// Take a certain action?
    let dispatch: Dispatch<Action> // TODO: make comments more accurate?
}
