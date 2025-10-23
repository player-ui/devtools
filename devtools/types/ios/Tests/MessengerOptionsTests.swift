//
//  MessengerOptionsTests.swift
//  MessengerOptionsTests
//
//  Generated with Cursor by Koriann South - October 1, 2025
//

import XCTest
import JavaScriptCore
@testable import PlayerUIDevToolsTypes

final class MessengerOptionsTests: XCTestCase {

    // Mainly tests for asJSValue since that's the main functionality of MessengerOptions

    func testAsJSValueConvertsSimplePropertiesCorrectly() throws {
        let options = MessengerOptions<TestEvent>(
            context: .devtools,
            beaconIntervalMS: 3000,
            isDebug: true, // false tests can lead to false positives, so test true
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
        let options = MessengerOptions<TestEvent>(logger: logger)
        let jsOptions = options.asJSValue

        // Test that the logger function can be called and the message is logged
        let logMessage = "test log message"
        jsOptions?.objectForKeyedSubscript("logger")
            .objectForKeyedSubscript("log")
            .call(withArguments: [logMessage])
        XCTAssertEqual(logger.loggedMessages, [logMessage])
    }

    func testAsJSValueConvertsSendMessageCorrectly() {
        var actualMessage: TestEvent?
        var isSendMessageTriggered = false
        let options = MessengerOptions<TestEvent>(
            sendMessage: { message in
                actualMessage = message
                isSendMessageTriggered = true
            }
        )
        let jsOptions = options.asJSValue

        // Test that the function can be called and the callback is executed
        let expectedMessage = TestEvent(payload: "test")
        let arg = [
            "type": expectedMessage.type,
            "payload": expectedMessage.payload,
            "target": expectedMessage.target
        ]
        jsOptions?.objectForKeyedSubscript("sendMessage")
            .call(withArguments: [arg])

        // Allow time for "fire-and-forget" async operations
        wait(for: "Message sent")

        XCTAssert(isSendMessageTriggered)
        XCTAssertEqual(actualMessage, expectedMessage)
    }

    func testAddListener() throws {
        var isListeneredRegistered = false
        var isListenerCalled = false
        var capturedCallback: ((MTransaction) -> Void)?

        guard let options = MessengerOptions(
            addListener: { callback in
                isListeneredRegistered = true
                capturedCallback = callback
            }
        ).asJSValue else {
            XCTFail("Could not convert options to JSValue")
            return
        }

        // For keeping track of the callback registered
        var actualCallbackArgument: MTransaction?
        let listener: @convention(block) (JSValue) -> Void = { arg in
            isListenerCalled = true
            do {
                let data = Data(arg.toString().utf8)
                actualCallbackArgument = try JSONDecoder().decode(
                    MTransaction.self,
                    from: data
                )
            } catch {
                XCTFail("Could not decode callback: \(error)")
            }
        }
        let jsCallbackValue = JSValue(object: listener, in: options.context)

        // Call the addListener function with the mock callback.
        // This should populated "capturedCallback" with the appopriate callback
        options.objectForKeyedSubscript("addListener")
            .call(withArguments: [jsCallbackValue as Any])

        // Verify that addListener was called
        XCTAssert(isListeneredRegistered)

        // Simulate a message being received by calling the captured callback
        capturedCallback?(.simple)

        // Verify that the JS callback was invoked with the transaction data
        wait(for: "JS callback invoked")
        XCTAssertTrue(isListenerCalled)
        XCTAssertEqual(actualCallbackArgument, .simple)
    }

    /// Check that:
    /// 1. removeListener is triggered through the JS layer
    /// 2. removeListener is called with a valid Swift callback even when called from the JS layer
    func testRemoveListener() {
        var isListenerRegistered = false
        var isListenerCalled = false
        var capturedCallback: ((MessengerTransaction<TestEvent>) -> Void)?

        guard let options = MessengerOptions<TestEvent>(
            removeListener: { callback in
                isListenerRegistered = true
                capturedCallback = callback
            }
        ).asJSValue else {
            XCTFail("Could not convert options to JSValue")
            return
        }

        // Call the removeListener function with a mock callback
        let listener: @convention(block) (JSValue) -> Void = { _ in
            isListenerCalled = true
        }
        let arg = JSValue(object: listener, in: options.context)
        options.objectForKeyedSubscript("removeListener")
            .call(withArguments: [arg as Any])

        // Verify that removeListener was called
        XCTAssert(isListenerRegistered)
        XCTAssertNotNil(capturedCallback)

        // Simulate a listener being removed by calling the captured callback
        capturedCallback?(.simple)

        // Verify that the JS callback was invoked
        wait(for: "Callback invoked")
        XCTAssertTrue(isListenerCalled)
    }

    /// Check that:
    /// 1. The messageCallback is triggered through the JS layer
    /// 2. The messageCallback receives a valid Swift transaction even when called from the JS layer
    func testMessageCallback() {
        var isCalled = false
        var argumentReceived: MTransaction?

        guard let options = MessengerOptions<TestEvent>(
            messageCallback: { transaction in
                isCalled = true
                argumentReceived = transaction
            }
        ).asJSValue else {
            XCTFail("Could not convert options to JSValue")
            return
        }

        // Call the handleFailedMessage callback with the test value
        let expectedArgument = MTransaction.simple
        let arg: [String: Any] = .simple
        options.objectForKeyedSubscript("messageCallback")
            .call(withArguments: [arg as Any])

        // Verify that the callback was invoked with the correct transaction
        wait(for: "Callback invoked")
        XCTAssertTrue(isCalled)
        XCTAssertEqual(argumentReceived, expectedArgument)
    }

    /// Check that:
    /// 1. The handleFailedMessage is triggered through the JS layer
    /// 2. The handleFailedMessage receives a valid Swift transaction even when called from the JS layer
    func testHandleFailedMessage() {
        var isCalled = false
        var argumentReceived: MTransaction?

        guard let options = MessengerOptions<TestEvent>(
            handleFailedMessage: { transaction in
                isCalled = true
                argumentReceived = transaction
            }
        ).asJSValue else {
            XCTFail("Could not convert options to JSValue")
            return
        }


        // Call the handleFailedMessage callback with the test value
        let expectedArgument = MTransaction.simple
        let arg: [String: Any] = .simple
        options.objectForKeyedSubscript("handleFailedMessage")
            .call(withArguments: [arg as Any])

        // Verify that the callback was invoked with the correct transaction
        wait(for: "Callback invoked")
        XCTAssertTrue(isCalled)
        XCTAssertEqual(argumentReceived, expectedArgument)
    }
}

extension MessengerOptions {
    /// Convenience init for testing. Provides a default ID and JSContext
    convenience init(
        id: String = "test-id",
        context: MessengerContext = .devtools,
        beaconIntervalMS: Int = 1000,
        isDebug: Bool = false,
        logger: MessengerLogger = MockLogger(),
        sendMessage: @escaping (Message) async throws -> Void = { _ in },
        addListener: @escaping (@escaping (MessengerTransaction<Message>) -> Void) -> Void = { _ in },
        removeListener: @escaping (@escaping (MessengerTransaction<Message>) -> Void) -> Void = { _ in },
        messageCallback: @escaping (MessengerTransaction<Message>) -> Void = { _ in },
        handleFailedMessage: ((MessengerTransaction<Message>) -> Void)? = nil
    ) {
        self.init(
            id: id,
            jsContext: .shared,
            context: context,
            beaconIntervalMS: beaconIntervalMS,
            isDebug: isDebug,
            logger: logger,
            sendMessage: sendMessage,
            addListener: addListener,
            removeListener: removeListener,
            messageCallback: messageCallback,
            handleFailedMessage: handleFailedMessage
        )
    }
}

typealias MTransaction = MessengerTransaction<TestEvent>
extension MTransaction {
    static let simple = MTransaction(
        message: .init(type: "test"),
        metaData: .init(
            id: 1234,
            timestamp: 5678,
            sender: "test",
            context: .player,
            isMessenger: true
        )
    )
}

extension [String: Any] {
    static let simple: Self = [
        "type": "test",
        "id": 1234,
        "timestamp": 5678,
        "sender": "test",
        "context": "player",
        "_messenger_": true,
    ]
}

// MARK: - Test Event Types

struct TestEvent: BaseEvent {
    typealias Payload = String

    let type: String
    let payload: String?
    let target: String?

    init(type: String = "TEST", payload: String? = nil, target: String? = nil) {
        self.type = type
        self.payload = payload
        self.target = target
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
