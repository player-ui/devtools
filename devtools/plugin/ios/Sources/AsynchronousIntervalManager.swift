//
//  AsynchronousIntervalManager.swift
//  DemoProject
//
//  Created by Koriann South on 2025-12-01.
//
import Foundation
import JavaScriptCore

/// Manages JavaScript timer storage and lifecycle. This is shared across all Messengers.
///
/// This is used for to provide the  "interval" functions / polyfills for the JS layer.
final class AsynchronousIntervalManager {
    /// Shared singleton instance for async interval manager
    static let shared = AsynchronousIntervalManager()

    private var timers: [Int: DispatchSourceTimer] = [:]
    private var timerCounter = 0
    private let lock = NSLock()

    init() {}

    /// Cancels an active timer
    ///
    /// - Parameter id: The timer ID returned from `createTimer`
    func cancelTimer(id: Int) {
        lock.lock()
        defer { lock.unlock() }

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
        lock.lock()
        defer { lock.unlock() }

        let timer = DispatchSource.makeTimerSource(queue: .intervals)
        timer.schedule(deadline: .now(), repeating: .milliseconds(delay))
        let onInterval = DispatchWorkItem {
            callback.call(withArguments: [])
        }
        timer.setEventHandler(handler: onInterval)
        timer.resume()

        timerCounter += 1
        let timerId = timerCounter
        timers[timerId] = timer
        return timerId
    }

    /// Returns the current number of active timers
    /// - Returns: The count of active timers
    internal var timerCount: Int {
        lock.lock()
        defer { lock.unlock() }
        let count = timers.count
        return count
    }
}

private extension DispatchQueue {
    /// The DispatchQueue to use for timer events mimicing JS's "interval" functionality.
    /// This will be used by the polyfills.
    static let intervals = DispatchQueue(label: "intervals")
}
