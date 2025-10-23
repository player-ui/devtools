//
//  SharedMessengerLayer.swift
//
//  Created by Koriann South on 2025-10-17.
//

import JavaScriptCore
import PlayerUIDevToolsTypes

/// The shared details of all Swift Messengers.
public class SharedMessengerLayer {
    /// Shared singleton instance for sync interval manager
    internal static let syncIntervalManager = SynchronousIntervalManager()
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

/// `SynchronousIntervalManager` wraps the async `AsynchronousIntervalManager` to allow synchronous access.
///
/// In order to avoid race conditions, the `AsynchronousIntervalManager` is a protected actor that prevents multiple threads
/// from accessing it at once. This means we can only access `AsynchronousIntervalManager` values asynchronously.
///
/// However, the `AsynchronousIntervalManager` is the backbone of the poylfills we pass to the JSLayer. The polyfills are
/// converted to Obj-C blocks using `@convention(block)` annotation. These blocks must be synchronous.
///
/// `SynchronousIntervalManager` wraps the async `AsynchronousIntervalManager` to allow synchronous access.
/// This uses a semaphore to force Swift to wait for the async value.
///
/// ## ⚠️ Warning
/// This isn't the best, but doesn't seem avoidable right now. In anticipation of a better strategy being introduced one day, I'm leaving the
/// full actor implementation intact underneath.
class SynchronousIntervalManager {
    /// A sync wrapper for the async cancelTimer
    func cancelTimer(id: Int) {
        Task {
            await SharedMessengerLayer.asyncIntervalManager.cancelTimer(id: id)
            DispatchSemaphore.intervals.signal()
        }
        DispatchSemaphore.intervals.wait()
    }

    /// A sync wrapper for the async createTimer
    func createTimer(callback: JSValue, delay: Int) -> Int {
        var timerId: Int = 0
        Task {
            timerId = await SharedMessengerLayer.asyncIntervalManager.createTimer(callback: callback, delay: delay)
            DispatchSemaphore.intervals.signal()
        }
        DispatchSemaphore.intervals.wait()
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

private extension DispatchSemaphore {
    static let intervals = DispatchSemaphore(value: 0)
}
