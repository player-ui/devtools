//
// Messenger.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation
import PlayerUI
import JavaScriptCore

// While this is public, it is only intended to be used within the devtools bundle.
// Do not export this extension outside of the devtools bundle.
public extension JSValue {
    /// Construct a JS class from a file
    /// - Parameters:
    ///   - className: The name of the class to construct
    ///   - jsModule: The name of the module to construct the class from. (I.e. the same as "native_bundle" in the BUILD file.)
    ///   If nil, the class will be constructed from the module of the same name as the class.
    ///   - filename: The name of the file to construct the class from
    ///   - args: The arguments to pass to the constructor
    /// - Returns: The constructed JS class as a JSValue
    static func construct(
        className: String,
        inModule jsModule: String? = nil,
        fromFile filename: String,
        withArguments args: [Any] = []
    ) throws -> JSValue {
        guard let url = Bundle.module.url(forResource: filename, withExtension: "js") else {
            throw JSBaseError.noSuchFile
        }
        guard let script = try? String(contentsOf: url, encoding: .utf8) else {
            throw JSBaseError.failedToParseScript
        }
        guard let context = JSContext() else {
            throw JSBaseError.failedToMakeContext
        }

        context.evaluateScript(script)

        guard let jsClass = context.objectForKeyedSubscript(jsModule ?? className)
            .objectForKeyedSubscript(className)
            .construct(withArguments: args),
              !jsClass.isUndefined
        else {
            throw JSBaseError.noSuchClass
        }

        return jsClass
    }

    /// A wrapper function that mainly catches "undefined" results and replaces them with nil.
    /// This wraps `invokeMethod`.
    func invokeClassMethod(
        _ method: String,
        withArguments arguments: [Any] = []
    ) -> JSValue? {
        let result = invokeMethod(method, withArguments: arguments)
        guard let result, !result.isUndefined else { return nil }
        return result
    }


    /// Errors that can occur when trying to load a JS class that will be referenced by a Swift wrapper
    enum JSBaseError: Error {
        case noSuchFile
        case failedToParseScript
        case failedToMakeContext
        case noSuchClass
    }
}
