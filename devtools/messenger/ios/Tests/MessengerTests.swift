//
//  MessengerTests.swift
//  MessengerTests
//
//  Generated with Cursor by Koriann South - September 23, 2025
//

import XCTest
import JavaScriptCore
@testable import PlayerUIDevtoolsMessenger
@preconcurrency import PlayerUIDevtoolsTypes
@testable import PlayerUIDevtoolsUtils
import PlayerUIDevtoolsUtilsSwiftUI

final class MessengerTests: XCTestCase {

    let jsContext: JSContext = JSContext()
    var tracker: MockMessageStore = MockMessageStore()
    var mockAPI: MockMessagingAPI!
    var mockLogger: MockLogger!

    var defaultOptions: MessengerOptions { makeOptions() }

    func makeOptions(
        id: String = "test-id"
    ) -> MessengerOptions {
        MessengerOptions(
            id: id,
            jsContext: jsContext,
            context: .devtools,
            beaconIntervalMS: .avoidIAmHereBeacons,
            isDebug: true,
            logger: mockLogger,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in }
        )
    }

    override func setUpWithError() throws {
        mockAPI = MockMessagingAPI(tracker: tracker)
        mockLogger = MockLogger(tracker: tracker)

        // Set up polyfills for setInterval, clearInterval, and console
        jsContext.polyfill()
    }

    override func tearDown() async throws {
        await tracker.reset()
    }

    // MARK: - Basic Functionality Tests

    func testSendMessage() async throws {
        let messenger = try Messenger(options: defaultOptions)
        try await messenger.sendMessage(.testMessage)

        // Expect 2 messages: the "I am here" beacon followed by the actual message
        let numMessages = await tracker.sentMessages.count
        XCTAssertGreaterThanOrEqual(numMessages, 1)
        let message = await tracker.sentMessages.first { $0["type"] as? String == "TEST" }
        XCTAssertNotNil(message)
        XCTAssertEqual(message?["target"] as? String, "test-target")
        if let payload = message?["payload"] as? [String: Any] {
            XCTAssertEqual(payload["count"] as? Int, 42)
        } else {
            XCTFail("Payload not found")
        }
    }

    func testSendMessageAsString() async throws {
        let messenger = try Messenger(options: defaultOptions)
        let jsonString = """
        {
            "type": "TEST",
            "payload": {
                "count": 99
            },
            "target": "string-target"
        }
        """
        try await messenger.sendMessage(jsonString)

        // Expect 2 messages: the "I am here" beacon followed by the actual message
        let numMessages = await tracker.sentMessages.count
        XCTAssertGreaterThanOrEqual(numMessages, 1)
        let message = await tracker.sentMessages.first { $0["type"] as? String == "TEST" }
        XCTAssertNotNil(message)
        XCTAssertEqual(message?["target"] as? String, "string-target")
        if let payload = message?["payload"] as? [String: Any] {
            XCTAssertEqual(payload["count"] as? Int, 99)
        } else {
            XCTFail("Payload not found")
        }
    }

    func testLogs() async throws {
        let messenger = try Messenger(options: defaultOptions)
        await fulfillment(for: "Logs sent, if enabled", delay: 0.5)

        // Catch the error so we can check the logs
        do { try await messenger.sendMessage("i am invalid") } catch {}
        let loggedMessages = await tracker.loggedMessages

        // The number of logs may vary. But we expect at least one
        XCTAssertGreaterThanOrEqual(loggedMessages.count, 1)
        XCTAssert(loggedMessages.contains("[MESSENGER-test-id](devtools): Failed to parse message to JSON. Message: i am invalid"))
    }

    func testDestroy() async throws {
        let messenger = try Messenger(options: defaultOptions)
        messenger.destroy()
        await fulfillment(for: "Logs sent, if enabled", delay: 0.5)

        let loggedMessages = await tracker.loggedMessages
        XCTAssertGreaterThanOrEqual(loggedMessages.count, 1)
        XCTAssert(
            loggedMessages.contains("[MESSENGER-test-id](devtools): destroyed"),
            "Did not find destroy message in logged messages: \(loggedMessages)"
        )
    }

    // MARK: - Edge Cases

    func testMultipleMessengerInstances() async throws {
        let messenger1 = try Messenger(options: makeOptions(id: "test-0"))
        let messenger2 = try Messenger(options: makeOptions(id: "test-1"))

        // Send messages from both
        try await messenger1.sendMessage(.testMessageWithCount(1))
        try await messenger2.sendMessage(.testMessageWithCount(2))

        // Verify specific messages were sent by checking payload content
        let sentMessages = await tracker.sentMessages
        let sentCounts = sentMessages.compactMap { ($0["payload"] as? [String: Any])?["count"] as? Int }
        XCTAssertTrue(sentCounts.contains(1), "Message from messenger1 should be sent")
        XCTAssertTrue(sentCounts.contains(2), "Message from messenger2 should be sent")
    }

    /// Check that `sendMessage(_ messageString:)` throws an error if the message is not a valid JSON string
    func testInvalidJsonThrows() async throws {
        let messenger = try Messenger(options: defaultOptions)

        var isErrorThrown = false
        do {
            try await messenger.sendMessage("undefined")
        } catch {
            XCTAssertEqual(error.localizedDescription, "[JS SAFETY] Failed to send message: promise rejected with error='SyntaxError: JSON Parse error: Unexpected identifier \"undefined\"'")
            isErrorThrown = true
        }
        XCTAssert(isErrorThrown, "Error was not thrown as expected")
    }

    // MARK: - Listener Callback Tests (Type Conversion)

    /// Test that listeners receive properly converted dictionary messages
    func testListenerReceivesDictionaryMessage() async throws {
        var receivedMessage: Message?

        // Add a listener that captures the message
        mockAPI.addListener { message in
            receivedMessage = message
        }

        // Simulate receiving a message from JavaScript
        let testMessage: Message = [
            "type": "TEST_EVENT",
            "payload": ["data": "test-value"],
            "target": "test-target"
        ]

        // Call the listener callback directly to simulate JS calling it
        if let listenerCallback = mockAPI.lastAddedListener {
            listenerCallback(testMessage)
        }

        await fulfillment(for: "Listener received dictionary message")

        // Verify the message was received correctly
        XCTAssertNotNil(receivedMessage)
        XCTAssertEqual(receivedMessage?["type"] as? String, "TEST_EVENT")
        XCTAssertEqual(receivedMessage?["target"] as? String, "test-target")
        if let payload = receivedMessage?["payload"] as? [String: Any] {
            XCTAssertEqual(payload["data"] as? String, "test-value")
        } else {
            XCTFail("Payload not properly converted to dictionary")
        }
    }

    /// Test that listeners can handle complex nested structures
    func testListenerHandlesComplexNestedStructures() async throws {
        var receivedMessage: Message?

        mockAPI.addListener { message in
            receivedMessage = message
        }

        // Create a complex nested message
        let complexMessage: Message = [
            "type": "COMPLEX",
            "payload": [
                "nested": [
                    "level1": [
                        "level2": "deep-value"
                    ]
                ],
                "array": [1, 2, 3]
            ]
        ]

        if let listenerCallback = mockAPI.lastAddedListener {
            listenerCallback(complexMessage)
        }

        await fulfillment(for: "Listener handled complex nested structures")

        // Verify nested structure is preserved
        XCTAssertNotNil(receivedMessage)
        if let payload = receivedMessage?["payload"] as? [String: Any],
           let nested = payload["nested"] as? [String: Any],
           let level1 = nested["level1"] as? [String: Any],
           let level2Value = level1["level2"] as? String {
            XCTAssertEqual(level2Value, "deep-value")
        } else {
            XCTFail("Complex nested structure not properly converted")
        }
    }

    /// Test that listeners properly convert array values in messages
    func testListenerHandlesArraysInMessages() async throws {
        var receivedMessage: Message?

        mockAPI.addListener { message in
            receivedMessage = message
        }

        let messageWithArray: Message = [
            "type": "ARRAY_TEST",
            "items": [
                ["id": 1, "name": "item1"],
                ["id": 2, "name": "item2"],
                ["id": 3, "name": "item3"]
            ]
        ]

        if let listenerCallback = mockAPI.lastAddedListener {
            listenerCallback(messageWithArray)
        }

        await fulfillment(for: "Listener handled arrays in messages")

        // Verify array is properly converted
        XCTAssertNotNil(receivedMessage)
        if let items = receivedMessage?["items"] as? [[String: Any]] {
            XCTAssertEqual(items.count, 3)
            XCTAssertEqual(items[0]["name"] as? String, "item1")
            XCTAssertEqual(items[1]["id"] as? Int, 2)
        } else {
            XCTFail("Array in message not properly converted")
        }
    }

    /// Test that forEach operations work on arrays passed through listeners
    func testListenerArrayForEachOperation() async throws {
        var receivedMessage: Message?

        mockAPI.addListener { message in
            receivedMessage = message
        }

        let messageWithArray: Message = [
            "type": "FOREACH_TEST",
            "items": ["a", "b", "c"]
        ]

        if let listenerCallback = mockAPI.lastAddedListener {
            listenerCallback(messageWithArray)
        }

        await fulfillment(for: "Listener handled forEach operation")

        // Verify array can be iterated (this would fail if NSArray wasn't converted)
        XCTAssertNotNil(receivedMessage)
        if let items = receivedMessage?["items"] as? [String] {
            var itemCount = 0
            items.forEach { _ in itemCount += 1 }
            XCTAssertEqual(itemCount, 3)
        } else {
            XCTFail("Array not properly converted for forEach operation")
        }
    }
}

// MARK: - Test Message Helpers

extension Message {
    /// Standard test message with count of 42
    static let testMessage: Message = [
        "type": "TEST",
        "payload": ["count": 42],
        "target": "test-target"
    ]

    /// Create a test message with a specific count
    static func testMessageWithCount(_ count: Int) -> Message {
        return [
            "type": "TEST",
            "payload": ["count": count]
        ]
    }
}

// MARK: - Mock Implementations

/// Mock logger implementation for testing
class MockLogger: MessengerLogger {
    let tracker: MockMessageStore
    init(tracker: MockMessageStore) {
        self.tracker = tracker
    }

    /// Logs a message by storing it in the loggedMessages array
    /// - Parameter args: Variable arguments to log
    func log(_ args: Any...) {
        let message = args.map { "\($0)" }.joined(separator: " ")
        Task(priority: .high) {
            await tracker.logMessage(message)
        }
    }
}

/// Mock messaging API for testing Messenger functionality
/// This is an actor to ensure that all of the values are kept thread-safe.
/// An actor that tracks messages, listeners, and logs for Messenger tests.
/// This can be used as a mock message store for assertions and state tracking.
actor MockMessageStore {
    /// Array of all logged messages for test assertions
    private(set) var loggedMessages: [String] = []
    private(set) var sentMessages: [Message] = []
    private(set) var listeners: [MessageListener] = []
    private(set) var sendMessageCallCount = 0
    private(set) var addListenerCallCount = 0
    private(set) var removeListenerCallCount = 0
    /// Messages received by `messageCallback`
    private(set) var incomingMessages: [Message] = []

    /// Resets all tracked state and counters
    func reset() {
        loggedMessages.removeAll()
        sentMessages.removeAll()
        listeners.removeAll()
        incomingMessages.removeAll()
        sendMessageCallCount = 0
        addListenerCallCount = 0
        removeListenerCallCount = 0
    }

    /// Sends a message and notifies all registered listeners
    /// - Parameter message: The message to send
    func sendMessage(_ message: Message) {
        sendMessageCallCount += 1
        sentMessages.append(message)
        listeners.forEach { $0(message) }
    }

    /// Registers a new message listener
    /// - Parameter callback: The callback to invoke when messages are received
    func addListener(_ callback: @escaping MessageListener) {
        addListenerCallCount += 1
        listeners.append(callback)
    }

    /// Removes a message listener
    /// In a real implementation, we'd remove the specific callback. For testing purposes, we'll just track the call count
    /// - Parameter callback: The callback to remove from the listeners list
    func removeListener(_ callback: @escaping MessageListener) {
        removeListenerCallCount += 1
    }

    /// Log the message from the mock logger
    func logMessage(_ message: String) {
        loggedMessages.append(message)
    }
}

/// A wrapper for `MockMessageTracker`.
///
/// This allows us to access the isolated values. We use high priority tasks to ensure the tasks happen asap
class MockMessagingAPI {
    private let tracker: MockMessageStore
    /// Stores the last listener added for direct testing
    var lastAddedListener: MessageListener?

    init(tracker: MockMessageStore) {
        self.tracker = tracker
    }

    /// Sends a message and notifies all registered listeners
    /// - Parameter message: The message to send
    /// - Throws: Any errors that occur during message processing
    func sendMessage(_ message: Message) async {
        await tracker.sendMessage(message)
    }

    /// Registers a new message listener
    /// - Parameter callback: The callback to invoke when messages are received
    func addListener(_ callback: @escaping MessageListener) {
        self.lastAddedListener = callback
        Task(priority: .high) { await tracker.addListener(callback) }
    }

    /// Removes a message listener
    /// In a real implementation, we'd remove the specific callback. For testing purposes, we'll just track the call count
    /// - Parameter callback: The callback to remove from the listeners list
    func removeListener(_ callback: @escaping MessageListener) {
        Task(priority: .high) { await tracker.removeListener(callback) }
    }
}

private extension Int {
    /// A super high beacon interval that prevents the "I am here"-type beacons from being sent out.
    /// (I.e. it makes it so only 1 will ever trigger in a typical test.)
    static let avoidIAmHereBeacons = 3_000_000 // 50 mins
}

extension XCTestCase {
    func fulfillment(for description: String, delay: TimeInterval = 0.2) async {
        let expectation = XCTestExpectation(description: description)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            expectation.fulfill()
        }
        await fulfillment(of: [expectation], timeout: delay + 1)
    }
}
