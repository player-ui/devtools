//
//  PolyfillPlugin.swift
//  DemoProject
//
//  Created by Koriann South on 2025-12-01.
//
import JavaScriptCore
import PlayerUI
import PlayerUILogger

// TODO: move out to its own folder in utils or something?
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
    // TODO: Apply through the plugin. Making this public so we can apply it through a JSBasePlugin
    /* 
    TODO: Copied context to clean up later.

    We allow a mobile logger to be explicitly provided because of an iOS limitation.
    In detail: there are 2 options for logging on iOS:
    1. Use the Player logger and PrintLoggerPlugin().
    2. Use console.log, which is polyfilled via the PolyfillPlugin().

    Neither of these will work because both ios plugins are NOT JSBasePlugins, but 
    BasicDevtoolsPlugin is. On iOS, JSBasePlugins will be loaded (i.e. `apply`ed)
    first. So this plugin's ios wrapper and its apply are called before either the 
    logger or polyfill are available. This results in the logs working unreliably.
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
        setObject(["log": jsConsole], forKeyedSubscript: "console" as NSString)
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
            // TODO: check if these are actually getting called
            print("[INTERVAL] [debug] Created timer with id='\(timerId)'")
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
