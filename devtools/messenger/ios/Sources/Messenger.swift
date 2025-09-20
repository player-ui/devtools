//
// Messenger.swift
// Generated with Cursor by Koriann South, September 20, 2025
//
// This implementation wraps the devtools/messenger/core/index.ts Messenger class
// and provides a Swift interface for iOS. It uses JavaScriptCore to bridge between Swift and JS.
//
// NOTE: This code assumes that the JS bundle (containing Messenger) is available and loaded into the JSContext.
// You may need to adjust the JS loading mechanism for your app's needs.

import Foundation
import JavaScriptCore

public class Messenger {
    private let jsContext: JSContext
    private let jsMessenger: JSValue
    private var messageCallback: (([String: Any]) -> Void)?

    /// Initialize a Messenger instance.
    /// - Parameters:
    ///   - context: The JSContext containing the Messenger class.
    ///   - options: Dictionary of options to pass to Messenger (see TS docs).
    ///   - messageCallback: Called when a message is received from JS Messenger.
    public init?(jsContext: JSContext, options: [String: Any], messageCallback: (([String: Any]) -> Void)? = nil) {
        self.jsContext = jsContext
        self.messageCallback = messageCallback

        // Get Messenger constructor from JS first
        guard let messengerConstructor = jsContext.objectForKeyedSubscript("Messenger") else {
            print("Messenger class not found in JSContext")
            return nil
        }

        // Expose a Swift callback to JS for messageCallback
        let swiftCallback: @convention(block) (JSValue) -> Void = { jsValue in
            if let dict = jsValue.toDictionary() as? [String: Any] {
                messageCallback?(dict)
            }
        }

        // Prepare options, injecting the callback
        var jsOptions = options
        jsOptions["messageCallback"] = JSValue(object: swiftCallback, in: jsContext)

        // Create Messenger instance
        guard let messengerInstance = messengerConstructor.construct(withArguments: [jsOptions]) else {
            print("Failed to construct Messenger instance")
            return nil
        }

        self.jsMessenger = messengerInstance
    }

    /// Send an event to the Messenger.
    public func send(event: [String: Any]) {
        let jsEvent = JSValue(object: event, in: jsContext)
        _ = jsMessenger.invokeMethod("send", withArguments: [jsEvent as Any])
    }

    /// Disconnect the Messenger.
    public func disconnect() {
        _ = jsMessenger.invokeMethod("disconnect", withArguments: [])
    }

    // Add more wrapper methods as needed (e.g., for beacon, etc.)
}
