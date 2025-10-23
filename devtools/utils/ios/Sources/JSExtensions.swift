//
// Messenger.swift
// Generated with Cursor by Koriann South - September 23, 2025

import Foundation
import PlayerUI
import JavaScriptCore

public extension JSContext {
    /// Construct a JS class from a file
    /// - Parameters:
    ///   - className: The name of the class to construct
    ///   - jsModule: The name of the module to construct the class from. (I.e. the same as `"native_bundle"` in the BUILD file.)
    ///   If nil, the class will be constructed from the module of the same name as the class.
    ///   - fileName: The name of the file to load the module from. Do not include the ".js" extension. If this is nil, the filename will
    ///   default to `"\(jsModule).native"`
    ///   - bundle: The bundle containing the JavaScript file
    ///   - args: The arguments to pass to the constructor. These should be valid JSValues or an equivalent
    ///   - polyfill: A closure that can be used to add polyfills to the context before evaluating the script
    /// - Returns: The instantiated JS class as a JSValue
    ///
    /// ## 🛑 WARNING
    /// While this method is public, it is only intended to be used within DevTools.
    /// Please exercise caution when using this extension outside of DevTools.
    ///
    func construct(
        className: String,
        inModule jsModule: String? = nil,
        fromFile fileName: String? = nil,
        inBundle bundle: Bundle,
        withArguments args: [Any] = [],
        withPolyfill polyfill: @escaping (JSContext) -> Void = { _ in }
    ) throws -> JSValue {
        let jsModule = jsModule ?? className
        let fileName = fileName ?? "\(jsModule).native"
        guard let url = bundle.url(forResource: fileName, withExtension: "js") else {
            throw JSBaseError.noSuchFile
        }
        guard let script = try? String(contentsOf: url, encoding: .utf8) else {
            throw JSBaseError.failedToParseScript
        }

        polyfill(self)
        evaluateScript(script)

        guard let module = objectForKeyedSubscript(jsModule) else {
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
}

public extension JSValue {
    /// A wrapper function that mainly catches "undefined" results and replaces them with nil.
    /// This wraps `invokeMethod`.
    ///
    /// ## 🛑 WARNING
    /// While this method is public, it is only intended to be used within DevTools.
    /// Please exercise caution when using this extension outside of DevTools.
    func invokeClassMethod(
        _ method: String,
        withArguments arguments: [Any] = []
    ) -> JSValue? {
        let result = invokeMethod(method, withArguments: arguments)
        guard let result, !result.isUndefined else { return nil }
        return result
    }
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
