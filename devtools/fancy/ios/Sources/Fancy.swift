//
// Messenger.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation
import PlayerUI
import JavaScriptCore

public class Fancy {
    private let fancyRef: JSValue

    public init(name: String) throws {
        guard let url = Bundle.module.url(forResource: "Fancy.native", withExtension: "js") else {
            throw FancyError.failedToMakeURL
        }
        guard let script = try? String(contentsOf: url, encoding: .utf8) else {
            throw FancyError.failedToParseScript
        }
        guard let context = JSContext() else {
            throw FancyError.failedToMakeContext
        }

        print("KORITEST: \(script)")
        context.evaluateScript(script)

        print("KORITEST: \(context.description)")
        guard let global = context.globalObject,
              let object = global.objectForKeyedSubscript("Fancy"),
              let constructed = object.construct(withArguments: [name]),
              !constructed.isUndefined
        else {
            throw FancyError.couldNotMakePlugin
        }

        self.fancyRef = constructed
    }

    public func getName() throws -> String {
        guard let name = fancyRef.invokeMethod("getName", withArguments: []),
                !name.isUndefined
        else { throw FancyError.noSuchMethod }
        return name.toString()
    }

    public func getCount() throws -> Double {
        guard let count = fancyRef.invokeMethod("getCount", withArguments: []),
                !count.isUndefined
        else { throw FancyError.noSuchMethod }
        return count.toDouble()
    }

    public func addToCount(n: Int) {
        fancyRef.invokeMethod("addToCount", withArguments: [n])
    }
}

/*
/// Swift wrapper for the JavaScript Messenger implementation
/// Provides a native Swift API while delegating to the JS implementation
public class Fancy: JSBasePlugin {
    private let name: String
    
    public init(name: String) {
        self.name = name
        super.init(fileName: "Fancy.native", pluginName: "Fancy")
    }

    public override func getArguments() -> [Any] {
        return [name]
    }

    public func getName() -> String {
        return pluginRef?.invokeMethod("getName", withArguments: []) as? String ?? ""
    }

    public func getCount() -> Int {
        return pluginRef?.invokeMethod("getCount", withArguments: []) as? Int ?? 0
    }

    public func addToCount(n: Int) {
        pluginRef?.invokeMethod("addToCount", withArguments: [n])
    }

    public override func getUrlForFile(fileName: String) -> URL? {
        Bundle.module.url(forResource: fileName, withExtension: "js")
    }
}
*/

enum FancyError: Error {
    case couldNotMakePlugin
    case noSuchMethod
    case failedToMakeURL
    case failedToParseScript
    case failedToMakeContext
}
