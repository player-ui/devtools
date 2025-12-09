//
// MessengerOptions.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation
import JavaScriptCore
import PlayerUI
import PlayerUIDevToolsUtils

/// Context for the messenger instance. This is where the messages are coming from
public enum MessengerContext: String, Codable, CaseIterable {
    /// This Messenger lives inside the player and is SENDING info
    case player
    /// This Messenger lives outside the player and is RECEIVING info from the player
    case devtools
}

/// Logger protocol for handling log messages
public protocol MessengerLogger {
    func log(_ args: Any...)
}

/// A message that can be sent or received by the Messenger. This includes messages with transaction metaData
public typealias Message = [String: Any]
public typealias MessageListener = ([String: Any]) -> Void

/// Swift implementation of MessengerOptions matching the TypeScript interface
///
/// ## ⚠️ Note
/// All instances of MessengerOptions will share the same JSContext
public class MessengerOptions {
    /// Unique id (required)
    public let id: String

    /// Context (player or devtools)
    public let context: MessengerContext

    /// Logger for handling log messages
    public let logger: MessengerLogger

    /// Time between beacons in milliseconds (defaults to 1000)
    public let beaconIntervalMS: Int

    /// Debug mode (defaults to false)
    public let isDebug: Bool

    /// API to send messages.
    ///
    /// The JS layer expects a Promise. So this can be an async function, which we convert to a Promise under the hood.
    public let sendMessage: (Message) async -> Void

    /// API to add a listener.
    ///
    /// This must be synchronous, because the JS layer expects a sync callback. It can call "fire-and-forget" Tasks though.
    public let addListener: (@escaping MessageListener) -> Void

    /// API to remove a listener.
    ///
    /// This must be synchronous, because the JS layer expects a sync callback. It can call "fire-and-forget" Tasks though.
    public let removeListener: (@escaping MessageListener) -> Void

    /// Callback to handle messages
    public let messageCallback: MessageListener

    /// Handle failed message (optional)
    public let handleFailedMessage: MessageListener?

    /// The JSContext to construct any needed JSValues in
    private let jsContext: JSContext

    /// Initialize MessengerOptions
    /// - Parameters:
    ///   - id: Required unique identifier
    ///   - jsContext: The JSContext to construct any needed JSValues in
    ///   - context: Messenger context (player or devtools)
    ///   - logger: Logger instance for handling log output
    ///   - beaconIntervalMS: Beacon interval in milliseconds (defaults to 1000). This is how often this Messenger will
    ///   send out a beacon to let other Messengers know it exists.
    ///   - debug: Debug mode flag (defaults to false). If this is true, we will log debug messages with the provided logger.
    ///   If it is not, we will not log messages.
    ///   - sendMessage: Function to send messages
    ///   - addListener: Function to add message listeners
    ///   - removeListener: Function to remove message listeners
    ///   - messageCallback: Callback to handle incoming messages
    ///   - handleFailedMessage: Optional failed message handler
    public init(
        id: String,
        jsContext: JSContext,
        context: MessengerContext,
        beaconIntervalMS: Int = 1000,
        isDebug: Bool = false,
        logger: MessengerLogger,
        sendMessage: @escaping (Message) async -> Void,
        addListener: @escaping (@escaping MessageListener) -> Void,
        removeListener: @escaping (@escaping MessageListener) -> Void,
        messageCallback: @escaping MessageListener,
        handleFailedMessage: MessageListener? = nil
    ) {
        self.id = id
        self.jsContext = jsContext
        self.context = context
        self.logger = logger
        self.beaconIntervalMS = beaconIntervalMS
        self.isDebug = isDebug
        self.sendMessage = sendMessage
        self.addListener = addListener
        self.removeListener = removeListener
        self.messageCallback = messageCallback
        self.handleFailedMessage = handleFailedMessage
    }

    deinit { // TODO: remove
        print("[DEINIT] MessengerOptions.swift")
    }
}

public extension MessengerOptions {
    /// Convert MessengerOptions to a JSValue for use in JavaScript context
    /// Uses the shared JSContext from SharedMessengerLayer
    var asJSValue: JSValue? {
        print("[MessengerOptions] Converting to JSValue")
        print("[MessengerOptions] context:", context)
        print("[MessengerOptions] context.rawValue:", context.rawValue)
        var jsOptions: [String: Any] = [
            "id": id,
            "context": context.rawValue,
            "beaconIntervalMS": beaconIntervalMS,
            "debug": isDebug,
            "sendMessage": sendMessageCallback as Any,
            "messageCallback": messageCallbackValue as Any,
            "addListener": addListenerCallback as Any,
            "removeListener": removeListenerCallback as Any,
            "logger": loggerValue
        ]

        if let failedMessageCallback {
            jsOptions["handleFailedMessage"] = failedMessageCallback
        }

        print("[MessengerOptions] jsOptions before JSValue:", jsOptions)
        return JSValue(object: jsOptions, in: jsContext)
    }

    // MARK: - Callback Creators

    /// The sendMessage callback that returns a Promise
    private var sendMessageCallback: JSValue? {
        let callback: @convention(block) (JSValue) -> JSValue? = { jsValue in
            return JSUtilities.createPromise(context: self.jsContext) { resolve, reject in
                Task {
                    guard let dict = jsValue.toDictionary(), let message = dict as? Message else{
                        reject("Failed to decode message")
                        return
                    }
                    await self.sendMessage(message)
                    resolve()
                }
            }
        }
        return JSValue(object: callback, in: jsContext)
    }

    /// The messageCallback that handles incoming messages
    private var messageCallbackValue: JSValue? {
        let callback: @convention(block) (JSValue) -> Void = { jsValue in
            guard let message = jsValue.asMessage else { return }
            self.messageCallback(message)
        }
        return JSValue(object: callback, in: jsContext)
    }

    /// The addListener callback
    private var addListenerCallback: JSValue? {
        let callback: @convention(block) (JSValue) -> Void = { jsCallback in
            let listener: MessageListener = { jsCallback.call(withArguments: [$0]) }
            self.addListener(listener)
        }
        return JSValue(object: callback, in: jsContext)
    }

    /// The removeListener callback
    private var removeListenerCallback: JSValue? {
        let callback: @convention(block) (JSValue) -> Void = { jsCallback in
            let listener: MessageListener = { jsCallback.call(withArguments: [$0]) }
            self.removeListener(listener)
        }
        return JSValue(object: callback, in: jsContext)
    }

    /// The logger object with log function
    private var loggerValue: [String: JSValue?] {
        let logFunction: @convention(block) (JSValue) -> Void = { log in
            guard !log.isUndefined, let logAsString = log.toString() else { return}
            self.logger.log(logAsString)
        }
        return ["log": JSValue(object: logFunction, in: jsContext)]
    }

    /// The handleFailedMessage callback if one was provided
    private var failedMessageCallback: JSValue? {
        guard let handleFailedMessage else { return nil }
        let callback: @convention(block) (JSValue) -> Void = { jsValue in
            guard let message = jsValue.asMessage else { return }
            handleFailedMessage(message)
        }
        return JSValue(object: callback, in: jsContext)
    }
}

extension JSValue {
    /// Convert the JSValue to the Message type
    var asMessage: Message? {
        guard let dict = toDictionary() else { return nil }
        return dict as? Message
    }
}
