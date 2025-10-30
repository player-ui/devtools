//
//  MessengerTests.swift
//  MessengerTests
//
//  Generated with Cursor by Koriann South - September 23, 2025
//

import XCTest
import JavaScriptCore
@testable import PlayerUIDevToolsMessenger
@preconcurrency import PlayerUIDevToolsTypes
@testable import PlayerUIDevToolsUtils

final class MessengerTests: XCTestCase {

    let jsContext: JSContext = JSContext()
    var tracker: MockMessageTracker = MockMessageTracker()
    var mockAPI: MockMessagingAPI!
    var mockLogger: MockLogger!

    var defaultOptions: MessengerOptions<TestEvent> { makeOptions() }

    func makeOptions(
        id: String = "test-id",
        isDebug: Bool = false
    ) -> MessengerOptions<TestEvent> {
        MessengerOptions(
            id: id,
            jsContext: jsContext,
            context: .devtools,
            beaconIntervalMS: .avoidIAmHereBeacons,
            isDebug: isDebug,
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
    }

    override func tearDown() async throws {
        await tracker.reset()
    }

    // MARK: - Basic Functionality Tests

    func testInitializesNormally() async throws {
        let messenger = try Messenger(options: defaultOptions)

        // Check that the messenger has been registered with the interval manager
        await fulfillment(for: "Initialized")
        let numTimers = await SharedMessengerLayer.asyncIntervalManager.timers.count
        XCTAssertEqual(numTimers, 1)

        // Prevents the de-init from triggering and unregistering the messenger
        XCTAssertNotNil(messenger)
    }

    func testDeinitializesNormally() async throws {
        let foo: () throws -> Void = {
            let messenger = try Messenger(options: self.defaultOptions)
            XCTAssertNotNil(messenger)
        }
        try foo()

        // The Messenger should have been de-inited because it's now out-of-scope.
        // So the deinit should have triggered and "destroy"ed this Messenger,
        // removing it from the timers
        await fulfillment(for: "Deinited")
        let numTimers = await SharedMessengerLayer.asyncIntervalManager.timers.count
        XCTAssertEqual(numTimers, 0)
    }

    func testSendMessage() async throws {
        let messenger = try Messenger(options: defaultOptions)
        let testMessage = TestEvent(
            payload: TestPayload(count: 42),
            target: "test-target"
        )
        try await messenger.sendMessage(testMessage)

        // Expect 2 messages: the "I am here" beacon followed by the actual message
        let numMessages = await tracker.sentMessages.count
        XCTAssertGreaterThanOrEqual(numMessages, 1)
        let message = await tracker.sentMessages.first { $0.type == "TEST" }
        XCTAssertEqual(message, testMessage)
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
        let message = await tracker.sentMessages.first { $0.type == "TEST" }
        XCTAssertEqual(message?.payload?.count, 99)
        XCTAssertEqual(message?.target, "string-target")
    }

    func testLogsWhenDebugTrue() async throws {
        let _ = try Messenger(options: makeOptions(isDebug: true))
        await fulfillment(for: "Logs sent, if enabled", delay: 0.5)
        let loggedMessages = await tracker.loggedMessages

        // The number of logs may vary. But we expect at least one
        XCTAssertGreaterThanOrEqual(loggedMessages.count, 1)
        XCTAssert(loggedMessages.contains("[MESSENGER-test-id](devtools): destroyed"))
    }

    func testDoesNotLogWhenDebugFalse() async throws {
        let _ = try Messenger(options: self.makeOptions(isDebug: false))
        await fulfillment(for: "Logs sent, if enabled", delay: 0.5)
        let loggedMessages = await tracker.loggedMessages
        XCTAssertEqual(loggedMessages.count, 0)
    }

    // MARK: - Edge Cases

    func testMultipleMessengerInstances() async throws {
        let messenger1 = try Messenger(options: makeOptions(id: "test-0"))
        let messenger2 = try Messenger(options: makeOptions(id: "test-1"))

        // Send messages from both
        try await messenger1.sendMessage(TestEvent(payload: TestPayload(count: 1)))
        try await messenger2.sendMessage(TestEvent(payload: TestPayload(count: 2)))

        // Verify specific messages were sent by checking payload content
        let sentMessages = await tracker.sentMessages
        let sentCounts = sentMessages.compactMap { $0.payload?.count }
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
            XCTAssertEqual(error.localizedDescription, "Failed to send message: JS messenger did not return Promise")
            isErrorThrown = true
        }
        XCTAssert(isErrorThrown, "Error was not thrown as expected")
    }
}

// MARK: - Test Event Types

/// A test event type used for unit testing the Messenger
struct TestEvent: BaseEvent {
    typealias Payload = TestPayload

    let type: String
    let payload: TestPayload?
    let target: String?

    init(type: String = "TEST", payload: TestPayload? = nil, target: String? = nil) {
        self.type = type
        self.payload = payload
        self.target = target
    }
}

/// A test payload structure for testing message serialization
struct TestPayload: Codable, Equatable {
    let count: Int
}

// MARK: - Mock Implementations

/// Mock logger implementation for testing
class MockLogger: MessengerLogger {
    let tracker: MockMessageTracker
    init(tracker: MockMessageTracker) {
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
actor MockMessageTracker {
    /// Array of all logged messages for test assertions
    private(set) var loggedMessages: [String] = []
    private(set) var sentMessages: [TestEvent] = []
    private(set) var listeners: [(MessengerTransaction<TestEvent>) -> Void] = []
    private(set) var sendMessageCallCount = 0
    private(set) var addListenerCallCount = 0
    private(set) var removeListenerCallCount = 0
    /// Messages received by `messageCallback`
    private(set) var incomingMessages: [MessengerTransaction<TestEvent>] = []

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
    /// - Parameter message: The test event to send
    /// - Throws: Any errors that occur during message processing
    func sendMessage(_ message: TestEvent) {
        sendMessageCallCount += 1
        sentMessages.append(message)

        let metadata = TransactionMetaData(
            id: sendMessageCallCount,
            timestamp: Int(Date().timeIntervalSince1970 * 1000),
            sender: "mock-sender",
            context: .player,
            isMessenger: true
        )

        let transaction = MessengerTransaction<TestEvent>(message: message, metaData: metadata)
        listeners.forEach { $0(transaction) }
    }

    /// Registers a new message listener
    /// - Parameter callback: The callback to invoke when messages are received
    func addListener(_ callback: @escaping (MessengerTransaction<TestEvent>) -> Void) {
        addListenerCallCount += 1
        listeners.append(callback)
    }

    /// Removes a message listener
    /// In a real implementation, we'd remove the specific callback. For testing purposes, we'll just track the call count
    /// - Parameter callback: The callback to remove from the listeners list
    func removeListener(_ callback: @escaping (MessengerTransaction<TestEvent>) -> Void) {
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
    private let tracker: MockMessageTracker

    init(tracker: MockMessageTracker) {
        self.tracker = tracker
    }

    /// Sends a message and notifies all registered listeners
    /// - Parameter message: The test event to send
    /// - Throws: Any errors that occur during message processing
    func sendMessage(_ message: TestEvent) async {
        await tracker.sendMessage(message)
    }

    /// Registers a new message listener
    /// - Parameter callback: The callback to invoke when messages are received
    func addListener(_ callback: @escaping (MessengerTransaction<TestEvent>) -> Void) {
        Task(priority: .high) { await tracker.addListener(callback) }
    }

    /// Removes a message listener
    /// In a real implementation, we'd remove the specific callback. For testing purposes, we'll just track the call count
    /// - Parameter callback: The callback to remove from the listeners list
    func removeListener(_ callback: @escaping (MessengerTransaction<TestEvent>) -> Void) {
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
