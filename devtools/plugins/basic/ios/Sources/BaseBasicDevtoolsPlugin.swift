import PlayerUI
import PlayerUILogger
import Foundation
import PlayerUIDevToolsPlugins
import PlayerUIDevToolsMessenger
import PlayerUIDevToolsTypes
import JavaScriptCore

/// A Player Plugin that provides DevTools capabilities via Flipper
open class BaseBasicDevtoolsPlugin: JSBasePlugin, BaseDevtoolsPlugin {
    let _playerID: String
    // This is a var so a different handler can be provided for testing
    var handler: DevtoolsHandler = Handler()
    // Keep the logger alive so its closures don't get garbage collected
    private let workaroundLogger = WorkaroundLogger()
    // Keep the logger JSValue alive so it doesn't get garbage collected by JavaScriptCore
    // Without this, the logger object passed to JavaScript would be deallocated immediately
    private var loggerJSValue: JSValue?

    // TODO: revisit all the names
    public init(playerID: String) {
        self._playerID = playerID
        super.init(
            fileName: "BasicDevtoolsPlugin.native",
            pluginName: "BasicDevtoolsPlugin.BasicDevtoolsPlugin"
        )
    }

    public override func getUrlForFile(fileName: String) -> URL? {
        Bundle.module.url(forResource: fileName, withExtension: "js")
    }

    public override func getArguments() -> [Any] {
        guard let context else { return [] }
        // PluginData is nil. The core basic plugin provides its own plugin data
        let options = DevtoolsPluginOptions(playerID: _playerID, handler: handler)
        // Create and store the logger to keep it alive
        let loggerDict = workaroundLogger.jsCompatible(context: context)
        loggerJSValue = JSValue(object: loggerDict, in: context)
        return [
            options.jsCompatible(context: context),
            loggerJSValue as Any
        ]
    }

    /// This will process messages. The core plugin augments this handler with some logging and metadata
    struct Handler: DevtoolsHandler {
        var isActive = true

        func processInteraction(interaction: PlayerUIDevToolsTypes.Message) {
            print("[DEVTOOLS] processInteraction called with: \(interaction)")
        }

        func log(message: String) {
            print("[DEVTOOLS] log: \(message)")
        }
    }
}

class WorkaroundLogger {
    // Store closures as properties to keep them alive
    private let traceFn: @convention(block) (JSValue?, JSValue?, JSValue?, JSValue?, JSValue?) -> Void
    private let debugFn: @convention(block) (JSValue?, JSValue?, JSValue?, JSValue?, JSValue?) -> Void
    private let infoFn: @convention(block) (JSValue?, JSValue?, JSValue?, JSValue?, JSValue?) -> Void
    private let warnFn: @convention(block) (JSValue?, JSValue?, JSValue?, JSValue?, JSValue?) -> Void
    private let errorFn: @convention(block) (JSValue?, JSValue?, JSValue?, JSValue?, JSValue?) -> Void

    init() {
        traceFn = { arg1, arg2, arg3, arg4, arg5 in
            Self.baseLog(level: "trace", arg1: arg1, arg2: arg2, arg3: arg3, arg4: arg4, arg5: arg5)
        }
        debugFn = { arg1, arg2, arg3, arg4, arg5 in
            Self.baseLog(level: "debug", arg1: arg1, arg2: arg2, arg3: arg3, arg4: arg4, arg5: arg5)
        }
        infoFn = { arg1, arg2, arg3, arg4, arg5 in
            Self.baseLog(level: "info", arg1: arg1, arg2: arg2, arg3: arg3, arg4: arg4, arg5: arg5)
        }
        warnFn = { arg1, arg2, arg3, arg4, arg5 in
            Self.baseLog(level: "warn", arg1: arg1, arg2: arg2, arg3: arg3, arg4: arg4, arg5: arg5)
        }
        errorFn = { arg1, arg2, arg3, arg4, arg5 in
            Self.baseLog(level: "error", arg1: arg1, arg2: arg2, arg3: arg3, arg4: arg4, arg5: arg5)
        }
    }

    private static func baseLog(level: String, arg1: JSValue?, arg2: JSValue?, arg3: JSValue?, arg4: JSValue?, arg5: JSValue?) {
        let args = [arg1, arg2, arg3, arg4, arg5]
                .compactMap { $0 }
                .filter { !$0.isUndefined }
                .compactMap { $0.toString() }
        print("[CORE] [\(level)] \(args.joined(separator: " "))")
    }

    func jsCompatible(context: JSContext) -> [String: Any] {
        return [
            "trace": JSValue(object: traceFn, in: context) as Any,
            "debug": JSValue(object: debugFn, in: context) as Any,
            "info": JSValue(object: infoFn, in: context) as Any,
            "warn": JSValue(object: warnFn, in: context) as Any,
            "error": JSValue(object: errorFn, in: context) as Any
        ]
    }
}
