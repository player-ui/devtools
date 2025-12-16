//
//  DevtoolsHandler.swift
//  DemoProject
//
//  Created by Koriann South on 2025-11-05.
//

import JavaScriptCore
import PlayerUIDevtoolsTypes

public protocol DevtoolsHandler {
    /// Whether devtools is active or not
    var isActive: Bool { get }

    /// Process messages received
    func processInteraction(interaction: Message)
}

extension DevtoolsHandler {
    /// Format the handler into a JS compatible format
    func jsCompatible(context: JSContext) -> [String: Any] {
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
        return [
            "checkIfDevtoolsIsActive": JSValue(object: isActiveFn, in: context) as Any,
            "processInteraction": JSValue(object: processInteractionFn, in: context) as Any
        ]
    }
}
