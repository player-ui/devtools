//
//  DevtoolsHandler.swift
//  DemoProject
//
//  Created by Koriann South on 2025-11-05.
//

import JavaScriptCore
import PlayerUIDevToolsTypes

public protocol DevtoolsHandler {
    /// Whether devtools is active or not
    var isActive: Bool { get set }

    func processInteraction(interaction: Message)

    /// Used to handle messages from errors/warnings/etc during debugging
    func log(message: String)
}

extension DevtoolsHandler {
    // If the user does not supply a logger, this one that does nothing
    // will be provided for them
    public func log(message: String) {}

    /// Format the handler into a JS compatible format
    var jsCompatible: [String: Any] {
        let isActiveFn: @convention(block) () -> Bool = { return self.isActive }
        let processInteractionFn: @convention(block) (JSValue) -> Void = {  jsValue in
            /// Rather than converting this to a strict type, do a minor check to ensure it's of the correct event type
            guard let dict = jsValue.toDictionary(),
                  let interaction = dict as? Message,
                  let type = interaction["type"] as? String,
                  type == InternalEventType.devtoolsPluginInteraction.rawValue
            else { return }
            self.processInteraction(interaction: interaction)
        }
        let logFn: @convention(block) (JSValue) -> Void = {
            guard let message = $0.toString() else { return }
            self.log(message: message)
        }
        return [
            "checkIfDevtoolsIsActive": isActiveFn,
            "processInteraction": processInteractionFn,
            "log": logFn
        ]
    }
}
