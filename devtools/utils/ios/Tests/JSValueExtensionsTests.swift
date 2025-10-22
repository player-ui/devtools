//
// JSValueExtensionsTests.swift
//
// Generated with Cursor by Koriann South - September 30, 2025

import XCTest
import JavaScriptCore
@testable import PlayerUIDevToolsUtils

final class JSValueExtensionsTests: XCTestCase {

    // MARK: - construct method tests

    func testConstructWithValidClassAndFile() throws {
        // Test constructing the Fancy class from the Utils bundle
        guard let context = JSContext() else {
            XCTFail("Failed to create JSContext")
            return
        }

        let fancyInstance = try JSValue.construct(
            className: "Fancy",
            inModule: "Utils",
            fromFile: "Utils.native",
            inBundle: Bundle.module,
            withArguments: ["TestName"],
            inContext: context
        )

        XCTAssertFalse(fancyInstance.isUndefined, "Fancy instance should not be undefined")

        // Test that we can call methods on the constructed instance
        let name = fancyInstance.invokeClassMethod("getName")
        XCTAssertNotNil(name, "getName should return a value")
        XCTAssertEqual(name?.toString(), "TestName", "getName should return the constructor argument")

        let initialCount = fancyInstance.invokeClassMethod("getCount")
        XCTAssertNotNil(initialCount, "getCount should return a value")
        XCTAssertEqual(initialCount?.toInt32(), 0, "Initial count should be 0")
    }

    func testConstructWithNonExistentFile() {
        guard let context = JSContext() else {
            XCTFail("Failed to create JSContext")
            return
        }

        XCTAssertThrowsError(try JSValue.construct(
            className: "TestClass",
            fromFile: "NonExistentFile",
            inBundle: Bundle.module,
            inContext: context
        )) { error in
            XCTAssertEqual(error as? JSValue.JSBaseError, .noSuchFile)
        }
    }

    func testConstructWithNonExistentClass() {
        // Test trying to construct a class that doesn't exist in the Utils bundle
        guard let context = JSContext() else {
            XCTFail("Failed to create JSContext")
            return
        }

        XCTAssertThrowsError(try JSValue.construct(
            className: "NonExistentClass",
            inModule: "Utils",
            fromFile: "Utils.native",
            inBundle: Bundle.module,
            inContext: context
        )) { error in
            XCTAssertEqual(error as? JSValue.JSBaseError, .couldNotInstantiateClass)
        }
    }

    func testConstructWithArguments() throws {
        // Test that constructor arguments are passed correctly
        guard let context = JSContext() else {
            XCTFail("Failed to create JSContext")
            return
        }

        let fancyInstance = try JSValue.construct(
            className: "Fancy",
            inModule: "Utils",
            fromFile: "Utils.native",
            inBundle: Bundle.module,
            withArguments: ["ArgumentTest"],
            inContext: context
        )

        let name = fancyInstance.invokeClassMethod("getName")
        XCTAssertEqual(name?.toString(), "ArgumentTest", "Constructor argument should be passed correctly")
    }

    func testConstructWithMethodInvocation() throws {
        // Test a complete workflow: construct, invoke methods, verify state changes
        guard let context = JSContext() else {
            XCTFail("Failed to create JSContext")
            return
        }

        let fancyInstance = try JSValue.construct(
            className: "Fancy",
            inModule: "Utils",
            fromFile: "Utils.native",
            inBundle: Bundle.module,
            withArguments: ["WorkflowTest"],
            inContext: context
        )

        // Test initial state
        let initialCount = fancyInstance.invokeClassMethod("getCount")
        XCTAssertEqual(initialCount?.toInt32(), 0, "Initial count should be 0")

        // Test method that modifies state (addToCount doesn't return a value)
        let addResult = fancyInstance.invokeClassMethod("addToCount", withArguments: [5])
        XCTAssertNil(addResult, "addToCount should return undefined/nil")

        // Verify state change
        let newCount = fancyInstance.invokeClassMethod("getCount")
        XCTAssertEqual(newCount?.toInt32(), 5, "Count should be updated to 5")

        // Test multiple additions
        _ = fancyInstance.invokeClassMethod("addToCount", withArguments: [3])
        let finalCount = fancyInstance.invokeClassMethod("getCount")
        XCTAssertEqual(finalCount?.toInt32(), 8, "Count should be updated to 8")
    }

    // MARK: - invokeClassMethod tests

    func testInvokeClassMethodWithValidMethod() {
        // Create a JSValue with a method to test
        guard let context = JSContext() else {
            XCTFail("Failed to create JSContext")
            return
        }

        let script = """
        var testObject = {
            testMethod: function(arg1, arg2) {
                return arg1 + arg2;
            },
            undefinedMethod: function() {
                return undefined;
            }
        };
        """

        context.evaluateScript(script)
        guard let testObject = context.objectForKeyedSubscript("testObject") else {
            XCTFail("Failed to get test object")
            return
        }

        // Test successful method invocation
        let result = testObject.invokeClassMethod("testMethod", withArguments: [5, 3])
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.toInt32(), 8)
    }

    func testInvokeClassMethodWithUndefinedResult() {
        guard let context = JSContext() else {
            XCTFail("Failed to create JSContext")
            return
        }

        let script = """
        var testObject = {
            undefinedMethod: function() {
                return undefined;
            }
        };
        """

        context.evaluateScript(script)
        guard let testObject = context.objectForKeyedSubscript("testObject") else {
            XCTFail("Failed to get test object")
            return
        }

        // Test that undefined results return nil
        let result = testObject.invokeClassMethod("undefinedMethod")
        XCTAssertNil(result)
    }

    func testInvokeClassMethodWithNonExistentMethod() {
        guard let context = JSContext() else {
            XCTFail("Failed to create JSContext")
            return
        }

        let script = "var testObject = {};"
        context.evaluateScript(script)
        guard let testObject = context.objectForKeyedSubscript("testObject") else {
            XCTFail("Failed to get test object")
            return
        }

        // Test that non-existent methods return nil
        let result = testObject.invokeClassMethod("nonExistentMethod")
        XCTAssertNil(result)
    }

    func testInvokeClassMethodWithArguments() {
        guard let context = JSContext() else {
            XCTFail("Failed to create JSContext")
            return
        }

        let script = """
        var testObject = {
            concatenate: function(str1, str2, separator) {
                return str1 + (separator || '') + str2;
            }
        };
        """

        context.evaluateScript(script)
        guard let testObject = context.objectForKeyedSubscript("testObject") else {
            XCTFail("Failed to get test object")
            return
        }

        // Test method with multiple arguments
        let result = testObject.invokeClassMethod("concatenate", withArguments: ["Hello", "World", " "])
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.toString(), "Hello World")
    }
}
