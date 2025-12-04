//
//  SharedMessengerLayer.swift
//
//  Created by Koriann South on 2025-10-17.
//

import JavaScriptCore
import PlayerUIDevToolsTypes

/// The shared details of all Swift Messengers.
public class SharedMessengerLayer {
    /// Reset all Messenger connections and events outstanding (bridges to JavaScript implementation).
    ///
    /// **Important:** This method calls the static `Messenger.reset()` method in JavaScript,
    /// which clears ALL static state (events and connections) for ALL messenger instances
    /// that share the same JSContext.
    ///
    /// This can't live on Messenger because generic types cannot have static functions
    static func reset(context: JSContext, logger: MessengerLogger?) {
        _ = context.staticMessenger(logger: logger)?
            .invokeMethodSafely("reset")
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
