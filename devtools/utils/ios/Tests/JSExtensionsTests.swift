//
// JSExtensionsTests.swift
//
// Generated with Cursor by Koriann South - September 30, 2025

import XCTest
import JavaScriptCore
@testable import PlayerUIDevtoolsUtils

final class JSExtensionsTests: XCTestCase {

    // MARK: - construct method tests

    func testConstructWithValidClassAndFile() throws {
        // Test constructing the Fancy class from the Utils bundle
        let fancyInstance = try JSContext().construct(
            className: "Fancy",
            inModule: "Utils",
            fromFile: "Utils.native",
            inBundle: Bundle.module,
            withArguments: ["TestName"],
        )

        XCTAssertFalse(fancyInstance.isUndefined, "Fancy instance should not be undefined")

        // Test that we can call methods on the constructed instance
        let name = fancyInstance.invokeMethodSafely("getName")
        XCTAssertNotNil(name, "getName should return a value")
        XCTAssertEqual(name?.toString(), "TestName", "getName should return the constructor argument")

        let initialCount = fancyInstance.invokeMethodSafely("getCount")
        XCTAssertNotNil(initialCount, "getCount should return a value")
        XCTAssertEqual(initialCount?.toInt32(), 0, "Initial count should be 0")
    }

    func testConstructWithNonExistentFile() {
        XCTAssertThrowsError(try JSContext().construct(
            className: "TestClass",
            fromFile: "NonExistentFile",
            inBundle: Bundle.module,
        )) { error in
            XCTAssertEqual(error.localizedDescription, "[JS SAFETY] Could not find file='NonExistentFile.js' in bundle. Available files: [\"/Utils.native.js.map\", \"/Utils.native.js\"]")
        }
    }

    func testConstructWithNonExistentClass() {
        // Test trying to construct a class that doesn't exist in the Utils bundle
        // This should now throw a jsContextException with the actual JavaScript error
        XCTAssertThrowsError(try JSContext().construct(
            className: "NonExistentClass",
            inModule: "Utils",
            fromFile: "Utils.native",
            inBundle: Bundle.module
        )) { error in
            // The error should contain the JavaScript exception message
            let errorDescription = error.localizedDescription
            XCTAssertTrue(errorDescription.contains("[JS SAFETY] JavaScript exception"), "Error should be a JS context exception")
            XCTAssertTrue(errorDescription.contains("NonExistentClass"), "Error should mention the class name")
            XCTAssertTrue(errorDescription.contains("Utils.native.js"), "Error should mention the file name")
        }
    }

    func testConstructWithArguments() throws {
        // Test that constructor arguments are passed correctly
        let fancyInstance = try JSContext().construct(
            className: "Fancy",
            inModule: "Utils",
            fromFile: "Utils.native",
            inBundle: Bundle.module,
            withArguments: ["ArgumentTest"]
        )

        let name = fancyInstance.invokeMethodSafely("getName")
        XCTAssertEqual(name?.toString(), "ArgumentTest", "Constructor argument should be passed correctly")
    }

    func testConstructWithMethodInvocation() throws {
        // Test a complete workflow: construct, invoke methods, verify state changes
        let fancyInstance = try JSContext().construct(
            className: "Fancy",
            inModule: "Utils",
            fromFile: "Utils.native",
            inBundle: Bundle.module,
            withArguments: ["WorkflowTest"]
        )

        // Test initial state
        let initialCount = fancyInstance.invokeMethodSafely("getCount")
        XCTAssertEqual(initialCount?.toInt32(), 0, "Initial count should be 0")

        // Test method that modifies state (addToCount doesn't return a value)
        let addResult = fancyInstance.invokeMethodSafely("addToCount", withArguments: [5])
        XCTAssertNil(addResult, "addToCount should return undefined/nil")

        // Verify state change
        let newCount = fancyInstance.invokeMethodSafely("getCount")
        XCTAssertEqual(newCount?.toInt32(), 5, "Count should be updated to 5")

        // Test multiple additions
        _ = fancyInstance.invokeMethodSafely("addToCount", withArguments: [3])
        let finalCount = fancyInstance.invokeMethodSafely("getCount")
        XCTAssertEqual(finalCount?.toInt32(), 8, "Count should be updated to 8")
    }

    // MARK: - invokeClassMethod tests

    func testInvokeMethodSafelyWithValidMethod() {
        // Create a JSValue with a method to test
        let context: JSContext = JSContext()
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
        let result = testObject.invokeMethodSafely("testMethod", withArguments: [5, 3])
        XCTAssertEqual(result?.toInt32(), 8)
    }

    func testInvokeMethodSafelyWithUndefinedResult() {
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
        let result = testObject.invokeMethodSafely("undefinedMethod")
        XCTAssertNil(result)
    }

    func testInvokeMethodSafelyWithNonExistentMethod() {
        let context: JSContext = JSContext()
        let script = "var testObject = {};"
        context.evaluateScript(script)
        guard let testObject = context.objectForKeyedSubscript("testObject") else {
            XCTFail("Failed to get test object")
            return
        }

        // Test that non-existent methods return nil
        let result = testObject.invokeMethodSafely("nonExistentMethod")
        XCTAssertNil(result)
    }

    func testInvokeMethodSafelyWithArguments() {
        let context: JSContext = JSContext()
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
        let result = testObject.invokeMethodSafely("concatenate", withArguments: ["Hello", "World", " "])
        XCTAssertEqual(result?.toString(), "Hello World")
    }
}
