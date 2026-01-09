//
//  MessengerOptionsTests.swift
//  MessengerOptionsTests
//
//  Generated with Cursor by Koriann South - October 1, 2025
//

import XCTest
import JavaScriptCore
@testable import PlayerUIDevtoolsTypes

final class MessengerOptionsTests: XCTestCase {

    // Mainly tests for asJSValue since that's the main functionality of MessengerOptions

    func testAsJSValueConvertsSimplePropertiesCorrectly() throws {
        let options = MessengerOptions(
            id: "test-id",
            jsContext: .shared,
            context: .devtools,
            beaconIntervalMS: 3000,
            isDebug: true,
            logger: MockLogger(),
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in }
        )
        let jsValue = options.asJSValue

        // Test that all expected properties exist and are readable
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("id").toString(), "test-id")
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("context").toString(), "devtools")
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("beaconIntervalMS").toInt32(), 3000)
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("debug").toBool(), true)
    }

    func testAsJSValueConvertsLoggerCorrectly() {
        let logger = MockLogger()
        let options = MessengerOptions(
            id: "test-id",
            jsContext: .shared,
            context: .devtools,
            logger: logger,
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in }
        )
        let jsOptions = options.asJSValue

        // Test that the logger function can be called and the message is logged
        // The logger is wrapped to convert variadic arguments to an array,
        // so when JavaScript calls logger.log("msg1", "msg2"), it becomes logger.log(["msg1", "msg2"])
        let logMessage = "test log message"
        jsOptions?.objectForKeyedSubscript("logger")
            .objectForKeyedSubscript("log")
            .call(withArguments: [logMessage])
        // The array is converted to a string representation
        XCTAssertEqual(logger.loggedMessages, ["test log message"])
    }

    func testAsJSValueConvertsSendMessageCorrectly() {
        var actualMessage: Message?
        var isSendMessageTriggered = false
        let options = MessengerOptions(
            id: "test-id",
            jsContext: .shared,
            context: .devtools,
            logger: MockLogger(),
            sendMessage: { message in
                actualMessage = message
                isSendMessageTriggered = true
            },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in }
        )
        let jsOptions = options.asJSValue

        // Test that the function can be called and the callback is executed
        let arg: [String: Any] = [
            "type": "TEST",
            "payload": "test"
        ]
        jsOptions?.objectForKeyedSubscript("sendMessage")
            .call(withArguments: [arg])

        // Allow time for "fire-and-forget" async operations
        wait(for: "Message sent")

        XCTAssert(isSendMessageTriggered)
        XCTAssertNotNil(actualMessage)
        XCTAssertEqual(actualMessage?["type"] as? String, "TEST")
        XCTAssertEqual(actualMessage?["payload"] as? String, "test")
    }

    func testAddListener() throws {
        var isListenerRegistered = false
        var capturedCallback: MessageListener?

        let options = MessengerOptions(
            id: "test-id",
            jsContext: .shared,
            context: .devtools,
            logger: MockLogger(),
            sendMessage: { _ in },
            addListener: { callback in
                isListenerRegistered = true
                capturedCallback = callback
            },
            removeListener: { _ in },
            messageCallback: { _ in }
        )

        guard let jsOptions = options.asJSValue else {
            XCTFail("Could not convert options to JSValue")
            return
        }

        // For keeping track of the callback registered
        var isListenerCalled = false
        var actualCallbackArgument: Message?
        let listener: @convention(block) (JSValue) -> Void = { arg in
            isListenerCalled = true
            actualCallbackArgument = arg.toDictionary() as? Message
        }
        let jsCallbackValue = JSValue(object: listener, in: .shared)

        // Call the addListener function with the mock callback.
        // This should populate "capturedCallback" with the appropriate callback
        jsOptions.objectForKeyedSubscript("addListener")
            .call(withArguments: [jsCallbackValue as Any])

        // Verify that addListener was called
        XCTAssert(isListenerRegistered)

        // Simulate a message being received by calling the captured callback
        let testMessage: Message = ["type": "test", "payload": "data"]
        capturedCallback?(testMessage)

        // Verify that the JS callback was invoked with the message data
        wait(for: "JS callback invoked")
        XCTAssertTrue(isListenerCalled)
        XCTAssertNotNil(actualCallbackArgument)
    }

    func testRemoveListener() {
        var isListenerRegistered = false
        var capturedCallback: MessageListener?

        let options = MessengerOptions(
            id: "test-id",
            jsContext: .shared,
            context: .devtools,
            logger: MockLogger(),
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { callback in
                isListenerRegistered = true
                capturedCallback = callback
            },
            messageCallback: { _ in }
        )

        guard let jsOptions = options.asJSValue else {
            XCTFail("Could not convert options to JSValue")
            return
        }

        // Call the removeListener function with a mock callback
        var isListenerCalled = false
        let listener: @convention(block) (JSValue) -> Void = { _ in
            isListenerCalled = true
        }
        let arg = JSValue(object: listener, in: .shared)
        jsOptions.objectForKeyedSubscript("removeListener")
            .call(withArguments: [arg as Any])

        // Verify that removeListener was called
        XCTAssert(isListenerRegistered)
        XCTAssertNotNil(capturedCallback)

        // Simulate a listener being removed by calling the captured callback
        let testMessage: Message = ["type": "test"]
        capturedCallback?(testMessage)

        // Verify that the JS callback was invoked
        wait(for: "Callback invoked")
        XCTAssertTrue(isListenerCalled)
    }

    func testMessageCallback() {
        var isCalled = false
        var argumentReceived: Message?

        let options = MessengerOptions(
            id: "test-id",
            jsContext: .shared,
            context: .devtools,
            logger: MockLogger(),
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { message in
                isCalled = true
                argumentReceived = message
            }
        )

        guard let jsOptions = options.asJSValue else {
            XCTFail("Could not convert options to JSValue")
            return
        }

        // Call the messageCallback with a test message
        let testMessage: [String: Any] = ["type": "test", "payload": "data"]
        jsOptions.objectForKeyedSubscript("messageCallback")
            .call(withArguments: [testMessage as Any])

        // Verify that the callback was invoked with the correct message
        wait(for: "Callback invoked")
        XCTAssertTrue(isCalled)
        XCTAssertNotNil(argumentReceived)
        XCTAssertEqual(argumentReceived?["type"] as? String, "test")
    }

    func testHandleFailedMessage() {
        var isCalled = false
        var argumentReceived: Message?

        let options = MessengerOptions(
            id: "test-id",
            jsContext: .shared,
            context: .devtools,
            logger: MockLogger(),
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in },
            handleFailedMessage: { message in
                isCalled = true
                argumentReceived = message
            }
        )

        guard let jsOptions = options.asJSValue else {
            XCTFail("Could not convert options to JSValue")
            return
        }

        // Call the handleFailedMessage callback with a test message
        let testMessage: [String: Any] = ["type": "failed", "error": "test error"]
        jsOptions.objectForKeyedSubscript("handleFailedMessage")
            .call(withArguments: [testMessage as Any])

        // Verify that the callback was invoked with the correct message
        wait(for: "Callback invoked")
        XCTAssertTrue(isCalled)
        XCTAssertNotNil(argumentReceived)
        XCTAssertEqual(argumentReceived?["type"] as? String, "failed")
    }
}

// MARK: - Mock Logger

class MockLogger: MessengerLogger {
    var loggedMessages: [String] = []

    func log(_ args: Any...) {
        let message = args.map { "\($0)" }.joined(separator: " ")
        loggedMessages.append(message)
    }
}

private extension JSContext {
    static let shared = JSContext()!
}

extension XCTestCase {
    func wait(for description: String, timeout: TimeInterval = 1) {
        // Allow time for the callback to be invoked
        let expectation = XCTestExpectation(description: description)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: timeout)
    }
}
