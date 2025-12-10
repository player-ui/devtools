import PlayerUI
import JavaScriptCore
import SwiftFlipper
import PlayerUIDevToolsTypes
import PlayerUIDevToolsMessenger
import PlayerUILogger

public protocol BaseDevtoolsPlugin: JSBasePlugin {
    /// The id of the plugin
    var pluginID: String { get throws }

    /// The id of the player
    var playerID: String { get throws }

    /// The store for this plugin
    var store: PluginStore { get throws }

    /// Whether or not devtools is active
    var isActive: Bool { get } // Used to make the DevtoolsHandler

    /// Register new messagers
    func registerMessenger(messenger: Messenger) -> Unsubscribe

    /// Process new messages received
    func processInteraction(interaction: Message) // Used to make the DevtoolsHandler
}

/// A wrapper around the core for DevTools plugins that provides Flipper integration.
/// Mirrors the Android AndroidDevtoolsPlugin implementation
public extension BaseDevtoolsPlugin {
    /// The id of the plugin
    var pluginID: String {
        get throws {
            guard let id = pluginRef?.forProperty("pluginID")?.toString() else {
                throw DevtoolsError.notFoundInCore(fnName: "pluginID")
            }
            return id
        }
    }

    /// The id of the player
    var playerID: String {
        get throws {
            guard let id = pluginRef?.forProperty("playerID")?.toString() else {
                throw DevtoolsError.notFoundInCore(fnName: "playerID")
            }
            return id
        }
    }

    var store: PluginStore {
        get throws {
            guard let jsStore = pluginRef?.forProperty("store") else {
                throw DevtoolsError.notFoundInCore(fnName: "store")
            }
            return PluginStore(jsValue: jsStore)
        }
    }

    var isActive: Bool {
        get {
            pluginRef?.invokeMethodSafely("checkIfDevtoolsIsActive")?.toBool() ?? true
        }
    }

    func registerMessenger(messenger: Messenger) -> Unsubscribe {
        let unsubscribe = pluginRef?.invokeMethodSafely("registerMessenger", withArguments: [messenger.jsCompatible])
        return { unsubscribe?.call(withArguments: []) }
    }

    func processInteraction(interaction: Message) {
        _ = pluginRef?.invokeMethodSafely("processInteraction", withArguments: [interaction])
    }
}

public struct DevtoolsPluginOptions {
    let playerID: String
    let handler: DevtoolsHandler
    let pluginData: PluginData?
    public let jsCompatible: [String: Any]

    public init(
        in context: JSContext,
        playerID: String,
        handler: DevtoolsHandler,
        pluginData: PluginData? = nil
    ) {
        self.playerID = playerID
        self.handler = handler
        self.pluginData = pluginData
        var jsCompatible: [String: Any] = [
            "playerID": playerID,
            "handler": handler.jsCompatible(context: context)
        ]
        if let pluginData {
            jsCompatible["pluginData"] = pluginData.jsCompatible
        }
        self.jsCompatible = jsCompatible
    }
}

public struct PluginData {
    let id: String
    let version: String
    let name: String
    let description: String
    let flow: [String: Any]

    public init(id: String, version: String, name: String, description: String, flow: [String: Any]) {
        self.id = id
        self.version = version
        self.name = name
        self.description = description
        self.flow = flow
    }

    var jsCompatible: [String: Any] {
        [
            "id": id,
            "version": version,
            "name": name,
            "description": description,
            "flow": flow
        ]
    }
}

public struct PluginStore { // TODO: finish implementing
    // TODO: check if the functions exist first
    // TODO: add errors to match android
    let jsValue: JSValue

    public func dispatch(event: Message) {
        _ = jsValue.invokeMethodSafely("dispatch", withArguments: [event])
    }

    func getState() -> JSPluginStore? {
        jsValue.invokeMethodSafely("getState")?.toObject()
    }

    func subscribe(subscriber: @escaping (JSPluginStore) -> Void) -> Unsubscribe {
        let objcSubscriber: @convention(block) (JSValue) -> Void = { jsStore in
            guard let store = jsStore.toObject() else { return }
            subscriber(store)
        }
        guard let context = jsValue.context else { return { } }
        let jsSubscriber = JSValue(object: objcSubscriber, in: context) as Any
        let unsubscribe = jsValue.invokeMethodSafely("subscribe", withArguments: [jsSubscriber])
        return { unsubscribe?.call(withArguments: []) }
    }

    typealias JSPluginStore = Any
}

public enum DevtoolsError: LocalizedError {
    case jsContextNotFound
    case notFoundInCore(fnName: String)

    public var errorDescription: String? {
        switch self {
        case .jsContextNotFound:
            return "Did not receive non-nil JSContext from Player. Devtools will not be initialized."
          case .notFoundInCore(let fnName):
            return "Did not find function with name '\(fnName)' in JS core."
        }
    }
}
