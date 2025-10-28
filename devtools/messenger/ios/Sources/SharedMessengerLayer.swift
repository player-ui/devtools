//
//  SharedMessengerLayer.swift
//
//  Created by Koriann South on 2025-10-17.
//

import JavaScriptCore
import PlayerUIDevToolsTypes

/// The shared details of all Swift Messengers.
public class SharedMessengerLayer {
    /// Shared singleton instance for async interval manager
    internal static let asyncIntervalManager = AsynchronousIntervalManager()

    /// Reset all Messenger connections and events outstanding (bridges to JavaScript implementation).
    ///
    /// **Important:** This method calls the static `Messenger.reset()` method in JavaScript,
    /// which clears ALL static state (events and connections) for ALL messenger instances
    /// that share the same JSContext.
    ///
    /// This can't live on Messenger because generic types cannot have static functions
    static func reset(context: JSContext, logger: MessengerLogger?) {
        context.staticMessenger(logger: logger)?.invokeMethod("reset", withArguments: [])
    }
}

/// Manages JavaScript timer storage and lifecycle. This is shared across all Messengers.
///
/// This is used for to provide the  "interval" functions / polyfills for the JS layer.
actor AsynchronousIntervalManager {
    var timers: [Int: DispatchSourceTimer] = [:]
    var timerCounter = 0

    init() {}

    /// Cancels an active timer
    ///
    /// - Parameter id: The timer ID returned from `createTimer`
    func cancelTimer(id: Int) {
        if let timer = timers[id] {
            timer.cancel()
            timers.removeValue(forKey: id)
        }
    }

    /// Creates a new repeating timer with the given callback
    ///
    /// - Parameters:
    ///   - callback: JavaScript function to call on each timer fire
    ///   - delay: Interval in milliseconds between timer fires
    /// - Returns: Unique timer ID that can be used to cancel the timer
    func createTimer(callback: JSValue, delay: Int) -> Int {
        let timer = DispatchSource.makeTimerSource(queue: .intervals)
        timer.schedule(deadline: .now(), repeating: .milliseconds(delay))
        let onInterval = DispatchWorkItem { callback.call(withArguments: []) }
        timer.setEventHandler(handler: onInterval)
        timer.resume()

        timerCounter += 1
        let timerId = timerCounter
        timers[timerId] = timer
        return timerId
    }
}

private extension JSContext {
    /// A shorthand for accessing the static methods on the Messenger class
    func staticMessenger(logger: MessengerLogger?) -> JSValue? {
        guard let messengerClass = objectForKeyedSubscript("Messenger")
            .objectForKeyedSubscript("Messenger")
        else {
            logger?.log("Swift DevTools:", "Warning: Messenger class not found in JavaScript context")
            return nil
        }
        return messengerClass
    }
}

private extension DispatchQueue {
    /// The DispatchQueue to use for timer events mimicing JS's "interval" functionality.
    /// This will be used by the polyfills.
    static let intervals = DispatchQueue(label: "intervals")
}
