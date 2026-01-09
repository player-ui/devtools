//
//  PolyfillPlugin.swift
//  Generated with Cursor by Koriann South - December 16, 2025
//
import JavaScriptCore
import PlayerUI
import PlayerUILogger

/**
 Sets up polyfills for JavaScript APIs. This plugin must be added BEFORE any plugins that need it.

 Provides setInterval, clearInterval, and console.log implementations for JSBase plugins,
 which will not have access to the browser APIs.

 The polyfills enable:
 - `setInterval`: Registers repeating timers for periodic tasks (e.g., beacon messages)
 - `clearInterval`: Cancels active timers
 - `console.log`: Provides debug logging output
 */
public class PolyfillPlugin: NativePlugin {
    /* TODO: actually use this plugin after https://github.com/player-ui/player/issues/773 is fixed.
     This plugin currently does not work for the same reason the PrintLoggerPlugin doesn't work here:
     https://github.com/player-ui/player/issues/772
     */
    public var pluginName: String = "PolyfillPlugin"
    // Exposed for testing
    internal var context: JSContext?

    public init() {}

    public func apply<P>(player: P) where P: HeadlessPlayer {
        guard let context = player.jsPlayerReference?.context else { return }
        self.context = context
        context.polyfill()
    }
}

extension JSContext {
    /*
     TODO: make this private once https://github.com/player-ui/player/issues/773 is addressed
     */
    public func polyfill() {
        guard let jsSetInterval = JSValue(object: setInterval, in: self),
              let jsClearInterval = JSValue(object: clearInterval, in: self),
              let jsConsole = JSValue(object: console, in: self)
        else {
            return
        }
        setObject(jsSetInterval, forKeyedSubscript: "setInterval" as NSString)
        setObject(jsClearInterval, forKeyedSubscript: "clearInterval" as NSString)
        setObject([
            "log": jsConsole,
            "error": jsConsole
        ], forKeyedSubscript: "console" as NSString)
    }

    // Use print because the logger might not exist yet
    // Also, we can't actually polyfill console exactly. This has a limit of 5 arguments
    private var console: @convention(block) (JSValue?, JSValue?, JSValue?, JSValue?, JSValue?) -> Void {
        { arg1, arg2, arg3, arg4, arg5 in
            let args = [arg1, arg2, arg3, arg4, arg5]
                .compactMap { $0 }
                .filter { !$0.isUndefined }
                .compactMap { $0.toString() }
            print("[CORE CONSOLE] \(args.joined(separator: " "))")
        }
    }

    /// Registers a repeating job that happens every `delay` milliseconds. This is a Swift-native polyfill for JS's `setInterval`.
    private var setInterval: @convention(block) (JSValue?, JSValue?) -> JSValue? {
        { (callback, delay) in
            guard let callback, let delayInt32 = delay?.toInt32() else { return nil }

            let timerId = AsynchronousIntervalManager.shared
                .createTimer(callback: callback, delay: Int(delayInt32))
            return JSValue(int32: Int32(timerId), in: self)
        }
    }

    /// Cancels the repeating job. This is a Swift-native polyfill for JS's `clearInterval`.
    private var clearInterval: @convention(block) (JSValue?) -> Void {
        { timerId in
            guard let timerId = timerId?.toInt32() else { return }
            AsynchronousIntervalManager.shared.cancelTimer(id: Int(timerId))
        }
    }
}

