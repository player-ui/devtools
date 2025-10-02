//
// Messenger.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation
import PlayerUI
import JavaScriptCore

// While this is public, it is only intended to be used within the devtools bundle.
// Do not export this extension outside of the devtools bundle.
public extension JSValue {
    /// Construct a JS class from a file using an existing JSContext
    /// - Parameters:
    ///   - className: The name of the class to construct
    ///   - jsModule: The name of the module to construct the class from. (I.e. the same as "native_bundle" in the BUILD file.)
    ///   If nil, the class will be constructed from the module of the same name as the class.
    ///   - context: The existing JSContext to use
    ///   - bundle: The bundle containing the JavaScript file
    ///   - args: The arguments to pass to the constructor
    /// - Returns: The constructed JS class as a JSValue
    static func construct(
        className: String,
        inModule jsModule: String? = nil,
        fromFile fileName: String? = nil,
        inBundle bundle: Bundle,
        withArguments args: [Any] = [],
        inContext context: JSContext,
        withPolyfill polyfill: @escaping () -> Void = {}
    ) throws -> JSValue {
        let jsModule = jsModule ?? className
        let fileName = fileName ?? "\(jsModule).native"
        guard let url = bundle.url(forResource: fileName, withExtension: "js") else {
            throw JSBaseError.noSuchFile
        }
        guard let script = try? String(contentsOf: url, encoding: .utf8) else {
            throw JSBaseError.failedToParseScript
        }

        polyfill()
        context.evaluateScript(script)

        guard let module = context.objectForKeyedSubscript(jsModule) else {
            throw JSBaseError.noSuchJSModule
        }
        guard let jsClass = module.objectForKeyedSubscript(className) else {
            throw JSBaseError.noSuchJSClass
        }
        guard let constructedClass = jsClass.construct(withArguments: args), !constructedClass.isUndefined else {
            throw JSBaseError.couldNotInstantiateClass
        }
        return constructedClass
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
        case noSuchJSModule
        case noSuchJSClass
        case couldNotInstantiateClass
    }
}
