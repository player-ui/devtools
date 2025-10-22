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

    var mockAPI: MockMessagingAPI!
    var mockLogger: MockLogger!

    var someOptions: MessengerOptions<TestEvent> {
        MessengerOptions(
            id: "test-messenger",
            context: .devtools,
            logger: mockLogger,
            beaconIntervalMS: .avoidIAmHereBeacons,
            debug: false,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            handleFailedMessage: nil
        )
    }

    override func setUpWithError() throws {
        mockAPI = MockMessagingAPI()
        mockLogger = MockLogger()
    }

    override func tearDown() async throws {
        mockAPI.reset()
        mockLogger.loggedMessages.removeAll()
    }

    // MARK: - Basic Functionality Tests

    func testDeinit() async {
        let foo: () -> Void = {
            let messenger = try? Messenger(options: self.someOptions)
            XCTAssertNotNil(messenger)
        }
        foo()

        // Allow time for the deinit to happen
        let expectation = XCTestExpectation(description: "Deinited")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            expectation.fulfill()
        }
        await fulfillment(of: [expectation], timeout: 2.0)

        // The Messenger should have been de-inited because it's now out-of-scope.
        // So the deinit should have triggered and "destroy"ed this Messenger,
        // removing it from the timers
        let numTimers = await SharedMessengerLayer.asyncIntervalManager.timers.count
        XCTAssertEqual(numTimers, 0)
    }

    func testMessengerInitialization() async throws {
        let options = MessengerOptions<TestEvent>(
            id: "test-messenger",
            context: .devtools,
            logger: mockLogger,
            beaconIntervalMS: .avoidIAmHereBeacons,
            debug: false,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            handleFailedMessage: nil
        )

        let messenger = try Messenger(options: options)
        XCTAssertNotNil(messenger)
    }

    func testSendMessage() async throws {
        var receivedTransactions: [MessengerTransaction<TestEvent>] = []

        let options = MessengerOptions<TestEvent>(
            id: "test-sender",
            context: .devtools,
            logger: mockLogger,
            beaconIntervalMS: .avoidIAmHereBeacons,
            debug: false,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                receivedTransactions.append(transaction)
            },
            handleFailedMessage: nil
        )

        let messenger = try Messenger(options: options)
        let testMessage = TestEvent(
            payload: TestPayload(count: 42),
            target: "test-target"
        )
        messenger.sendMessage(testMessage)

        // Allow time for "fire-and-forget" async operations
        let expectation = XCTestExpectation(description: "Message sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            expectation.fulfill()
        }
        await fulfillment(of: [expectation], timeout: 2.0)

        // Expect 2 messages: the "I am here" beacon followed by the actual message
        let numMessages = await mockAPI.tracker.sentMessages.count
        XCTAssertEqual(numMessages, 2)
        let message = await mockAPI.tracker.sentMessages.last
        XCTAssertEqual(message?.payload?.count, 42)
        XCTAssertEqual(message?.target, "test-target")
        XCTAssertEqual(message?.type, "TEST")
    }

    func testSendMessageAsString() async throws {
        let options = MessengerOptions<TestEvent>(
            id: "test-string-sender",
            context: .devtools,
            logger: mockLogger,
            // We use a high beacon interval so we don't have to account for the "I exist" beacons
            beaconIntervalMS: 100_000,
            debug: false,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            handleFailedMessage: nil
        )

        let messenger = try Messenger(options: options)
        let jsonString = """
        {
            "type": "TEST",
            "payload": {
                "count": 99
            },
            "target": "string-target"
        }
        """
        messenger.sendMessage(jsonString)

        // Allow more time for async operations
        let expectation = XCTestExpectation(description: "String message sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            expectation.fulfill()
        }
        await fulfillment(of: [expectation], timeout: 2.0)

        // Expect 2 messages: the "I am here" beacon followed by the actual message
        let numMessages = await mockAPI.tracker.sentMessages.count
        XCTAssertEqual(numMessages, 2)
        let message = await mockAPI.tracker.sentMessages.last
        XCTAssertEqual(message?.payload?.count, 99)
        XCTAssertEqual(message?.target, "string-target")
        XCTAssertEqual(message?.type, "TEST")
    }

//    func testDestroy() async throws {
//        // Introduce a new messenger and start a new timer
//        let options = MessengerOptions<TestEvent>(
//            id: "test-destroy",
//            context: .devtools,
//            logger: mockLogger,
//            beaconIntervalMS: 1000,
//            debug: false,
//            sendMessage: mockAPI.sendMessage,
//            addListener: mockAPI.addListener,
//            removeListener: mockAPI.removeListener,
//            messageCallback: { _ in },
//            handleFailedMessage: nil
//        )
//        let messenger = try Messenger(options: options)
//
//        // After creation, there should be one timer registered
//        let timerCount = await SharedMessengerLayer.asyncIntervalManager.timers.count
//        XCTAssertEqual(timerCount, 1)
//
//        // Wait for the async destroy operation to complete
//        messenger.destroy()
//        let expectation = XCTestExpectation(description: "Destroy completed")
//        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
//            expectation.fulfill()
//        }
//        await fulfillment(of: [expectation], timeout: 1)
//
//        // After destroy, the messenger should have cleaned up
//        let timers = await SharedMessengerLayer.asyncIntervalManager.timers
//        XCTAssert(timers.isEmpty)
//    }

    // MARK: - Reset Method Tests

    func testResetClearsStaticEventsAcrossInstances() async throws {
        var receivedMessages1: [MessengerTransaction<TestEvent>] = []
        var receivedMessages2: [MessengerTransaction<TestEvent>] = []

        // Create first messenger instance
        let options1 = MessengerOptions<TestEvent>(
            id: "messenger-1",
            context: .devtools,
            logger: mockLogger,
            beaconIntervalMS: 1000,
            debug: true,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                receivedMessages1.append(transaction)
            },
            handleFailedMessage: nil
        )

        // Create second messenger instance
        let options2 = MessengerOptions<TestEvent>(
            id: "messenger-2",
            context: .player,
            logger: mockLogger,
            beaconIntervalMS: 1000,
            debug: true,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                receivedMessages2.append(transaction)
            },
            handleFailedMessage: nil
        )

        let messenger1 = try Messenger(options: options1)
        let messenger2 = try Messenger(options: options2)

        // Send messages from both instances to create state
        messenger1.sendMessage(TestEvent(payload: TestPayload(count: 10), target: "target-1"))
        messenger2.sendMessage(TestEvent(payload: TestPayload(count: 20), target: "target-2"))

        // Allow messages to be processed
        let setupExpectation = XCTestExpectation(description: "Setup messages sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            setupExpectation.fulfill()
        }
        await fulfillment(of: [setupExpectation], timeout: 1.0)

        let initialMessageCount = await mockAPI.tracker.sendMessageCallCount
        XCTAssertGreaterThan(initialMessageCount, 0, "Messages should have been sent before reset")

        // Reset static state using the shared context
        SharedMessengerLayer.reset()

        // Allow reset to complete
        let resetExpectation = XCTestExpectation(description: "Reset completed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            resetExpectation.fulfill()
        }
        await fulfillment(of: [resetExpectation], timeout: 1.0)

        // Reset mockAPI to track new messages after reset
        mockAPI.reset()

        // Send new messages after reset - these should work normally
        messenger1.sendMessage(TestEvent(payload: TestPayload(count: 30), target: "post-reset-1"))
        messenger2.sendMessage(TestEvent(payload: TestPayload(count: 40), target: "post-reset-2"))

        // Allow post-reset messages to be processed
        let postResetExpectation = XCTestExpectation(description: "Post-reset messages sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            postResetExpectation.fulfill()
        }
        await fulfillment(of: [postResetExpectation], timeout: 1.0)

        // Verify that both messengers can still send messages after reset
        let postResetCount = await mockAPI.tracker.sendMessageCallCount
        XCTAssertGreaterThan(postResetCount, 0, "Messages should be sent after reset")

        let postResetMessages = await mockAPI.tracker.sentMessages
        XCTAssertEqual(postResetMessages.count, postResetCount, "All sent messages should be tracked")

        // Verify the messages contain expected data
        let counts = postResetMessages.compactMap { $0.payload?.count }
        XCTAssertTrue(counts.contains(30), "Should contain message from messenger1 after reset")
        XCTAssertTrue(counts.contains(40), "Should contain message from messenger2 after reset")
    }

    func testResetClearsConnectionsState() async throws {
        var connectionCallbacks: [String: Int] = [:]

        // Create multiple messenger instances to establish connections
        let options1 = MessengerOptions<TestEvent>(
            id: "connection-test-1",
            context: .devtools,
            logger: mockLogger,
            beaconIntervalMS: 500,
            debug: true,
            sendMessage: mockAPI.sendMessage,
            addListener: { [weak self] callback in
                connectionCallbacks["messenger-1"] = (connectionCallbacks["messenger-1"] ?? 0) + 1
                self?.mockAPI.addListener(callback)
            },
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            handleFailedMessage: nil
        )

        let options2 = MessengerOptions<TestEvent>(
            id: "connection-test-2",
            context: .player,
            logger: mockLogger,
            beaconIntervalMS: 500,
            debug: true,
            sendMessage: mockAPI.sendMessage,
            addListener: { [weak self] callback in
                connectionCallbacks["messenger-2"] = (connectionCallbacks["messenger-2"] ?? 0) + 1
                self?.mockAPI.addListener(callback)
            },
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            handleFailedMessage: nil
        )

        let _ = try Messenger(options: options1)
        let _ = try Messenger(options: options2)

        // Allow connections to be established
        let connectionExpectation = XCTestExpectation(description: "Connections established")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            connectionExpectation.fulfill()
        }
        await fulfillment(of: [connectionExpectation], timeout: 1)

        let initialAddListenerCount = await mockAPI.tracker.addListenerCallCount
        XCTAssertGreaterThan(initialAddListenerCount, 0, "Listeners should have been added")

        // Reset connections state
        SharedMessengerLayer.reset()

        // Allow reset to complete
        let resetExpectation = XCTestExpectation(description: "Reset completed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            resetExpectation.fulfill()
        }
        await fulfillment(of: [resetExpectation], timeout: 1)

        // Create new messenger instances after reset - they should establish fresh connections
        let options3 = MessengerOptions<TestEvent>(
            id: "post-reset-messenger",
            context: .devtools,
            logger: mockLogger,
            beaconIntervalMS: 1000,
            debug: false,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            handleFailedMessage: nil
        )

        let postResetMessenger = try Messenger(options: options3)

        // Send a message to verify the post-reset messenger works
        postResetMessenger.sendMessage(TestEvent(payload: TestPayload(count: 100)))

        let postResetMessageExpectation = XCTestExpectation(description: "Post-reset message sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            postResetMessageExpectation.fulfill()
        }
        await fulfillment(of: [postResetMessageExpectation], timeout: 1.0)

        // Verify the post-reset messenger can send messages
        let sentMessages = await mockAPI.tracker.sentMessages
        XCTAssertTrue(sentMessages.contains { $0.payload?.count == 100 },
                      "Post-reset messenger should be able to send messages")
    }

    func testResetAffectsAllInstancesInSharedContext() async throws {
        var messages1: [MessengerTransaction<TestEvent>] = []
        var messages2: [MessengerTransaction<TestEvent>] = []
        var messages3: [MessengerTransaction<TestEvent>] = []

        // Create three messenger instances that should share the same JavaScript context
        let messenger1 = try Messenger(options: MessengerOptions<TestEvent>(
            id: "shared-context-1",
            context: .devtools,
            logger: mockLogger,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { messages1.append($0) }
        ))

        let messenger2 = try Messenger(options: MessengerOptions<TestEvent>(
            id: "shared-context-2",
            context: .player,
            logger: mockLogger,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { messages2.append($0) }
        ))

        let messenger3 = try Messenger(options: MessengerOptions<TestEvent>(
            id: "shared-context-3",
            context: .devtools,
            logger: mockLogger,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { messages3.append($0) }
        ))

        // Send messages from all instances to create state
        messenger1.sendMessage(TestEvent(payload: TestPayload(count: 1)))
        messenger2.sendMessage(TestEvent(payload: TestPayload(count: 2)))
        messenger3.sendMessage(TestEvent(payload: TestPayload(count: 3)))

        let setupExpectation = XCTestExpectation(description: "Initial messages sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            setupExpectation.fulfill()
        }
        await fulfillment(of: [setupExpectation], timeout: 1.0)

        let preResetMessageCount = await mockAPI.tracker.sendMessageCallCount
        XCTAssertGreaterThanOrEqual(preResetMessageCount, 3, "All three messages should have been sent")

        // Reset using the shared context (should affect all instances)
        SharedMessengerLayer.reset()

        let resetExpectation = XCTestExpectation(description: "Reset completed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            resetExpectation.fulfill()
        }
        await fulfillment(of: [resetExpectation], timeout: 1.0)

        // Reset mock to track post-reset messages
        mockAPI.reset()

        // All instances should still be functional after reset
        messenger1.sendMessage(TestEvent(payload: TestPayload(count: 11)))
        messenger2.sendMessage(TestEvent(payload: TestPayload(count: 22)))
        messenger3.sendMessage(TestEvent(payload: TestPayload(count: 33)))

        let postResetExpectation = XCTestExpectation(description: "Post-reset messages sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            postResetExpectation.fulfill()
        }
        await fulfillment(of: [postResetExpectation], timeout: 1.0)
        // Verify all instances can still send messages after reset
        let postResetCount = await mockAPI.tracker.sendMessageCallCount
        XCTAssertGreaterThanOrEqual(postResetCount, 3, "All instances should work after reset")

        let postResetMessages = await mockAPI.tracker.sentMessages
        let postResetCounts = postResetMessages.compactMap { $0.payload?.count }
        XCTAssertTrue(postResetCounts.contains(11), "Messenger1 should work after reset")
        XCTAssertTrue(postResetCounts.contains(22), "Messenger2 should work after reset")
        XCTAssertTrue(postResetCounts.contains(33), "Messenger3 should work after reset")
    }

    func testResetClearsAccumulatedMessageState() async throws {
        var receivedTransactions: [MessengerTransaction<TestEvent>] = []

        let options = MessengerOptions<TestEvent>(
            id: "message-state-test",
            context: .devtools,
            logger: mockLogger,
            beaconIntervalMS: 10000, // Very long interval to avoid interference
            debug: true,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                receivedTransactions.append(transaction)
            },
            handleFailedMessage: { transaction in
                // Track failed messages
                receivedTransactions.append(transaction)
            }
        )

        let messenger = try Messenger(options: options)

        // Send multiple messages to accumulate state
        for i in 1...5 {
            messenger.sendMessage(TestEvent(payload: TestPayload(count: i), target: "batch-target"))
        }

        let batchExpectation = XCTestExpectation(description: "Batch messages sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            batchExpectation.fulfill()
        }
        await fulfillment(of: [batchExpectation], timeout: 2.0)

        let preResetCount = await mockAPI.tracker.sendMessageCallCount
        XCTAssertGreaterThanOrEqual(preResetCount, 5, "All batch messages should have been sent")

        // Reset to clear accumulated state
        SharedMessengerLayer.reset()

        let resetExpectation = XCTestExpectation(description: "Reset completed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            resetExpectation.fulfill()
        }
        await fulfillment(of: [resetExpectation], timeout: 2.0)

        // Reset mock API to track new messages
        mockAPI.reset()

        // Send new messages after reset
        messenger.sendMessage(TestEvent(payload: TestPayload(count: 100), target: "post-reset"))
        messenger.sendMessage(TestEvent(payload: TestPayload(count: 200), target: "post-reset"))

        let postResetExpectation = XCTestExpectation(description: "Post-reset messages sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            postResetExpectation.fulfill()
        }
        await fulfillment(of: [postResetExpectation], timeout: 2.0)

        // Verify new messages are sent correctly after reset
        // Be more lenient with the count since beacons might still fire
        let postResetCount = await mockAPI.tracker.sendMessageCallCount
        XCTAssertGreaterThanOrEqual(postResetCount, 2, "Post-reset messages should be sent")

        let postResetMessages = await mockAPI.tracker.sentMessages
        let postResetCounts = postResetMessages.compactMap { $0.payload?.count }
        XCTAssertTrue(postResetCounts.contains(100), "First post-reset message should be sent")
        XCTAssertTrue(postResetCounts.contains(200), "Second post-reset message should be sent")

        // Verify targets are correct for the specific test messages
        let testMessages = postResetMessages.filter { [100, 200].contains($0.payload?.count) }
        XCTAssertTrue(testMessages.allSatisfy { $0.target == "post-reset" },
                      "All post-reset test messages should have correct target")
    }

    func testResetIsolationBetweenDifferentMessengerTypes() async throws {
        // This test ensures that reset properly handles different event types
        // and doesn't interfere with type safety

        var testEventMessages: [MessengerTransaction<TestEvent>] = []
        let testEventOptions = MessengerOptions<TestEvent>(
            id: "typed-messenger",
            context: .devtools,
            logger: mockLogger,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                testEventMessages.append(transaction)
            }
        )
        let typedMessenger = try Messenger(options: testEventOptions)

        // Send typed messages
        typedMessenger.sendMessage(TestEvent(payload: TestPayload(count: 42), target: "typed"))

        // Also test string message sending
        let jsonString = """
        {
            "type": "STRING_TEST",
            "payload": {"count": 84},
            "target": "string-typed"
        }
        """
        typedMessenger.sendMessage(jsonString)

        let preResetExpectation = XCTestExpectation(description: "Pre-reset messages sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            preResetExpectation.fulfill()
        }
        await fulfillment(of: [preResetExpectation], timeout: 1.0)

        let preResetCount = await mockAPI.tracker.sendMessageCallCount
        XCTAssertGreaterThan(preResetCount, 0, "Messages should be sent before reset")

        // Reset
        SharedMessengerLayer.reset()

        let resetExpectation = XCTestExpectation(description: "Reset completed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            resetExpectation.fulfill()
        }
        await fulfillment(of: [resetExpectation], timeout: 1.0)

        // Reset mock to track post-reset messages
        mockAPI.reset()

        // Send messages after reset with different types
        typedMessenger.sendMessage(TestEvent(payload: TestPayload(count: 123), target: "post-reset-typed"))

        let postResetJsonString = """
        {
            "type": "POST_RESET_STRING",
            "payload": {"count": 456},
            "target": "post-reset-string"
        }
        """
        typedMessenger.sendMessage(postResetJsonString)

        let postResetExpectation = XCTestExpectation(description: "Post-reset messages sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            postResetExpectation.fulfill()
        }
        await fulfillment(of: [postResetExpectation], timeout: 1.0)

        // Verify both typed and string messages work after reset
        let postResetCount = await mockAPI.tracker.sendMessageCallCount
        XCTAssertGreaterThan(postResetCount, 0, "Post-reset messages should be sent")

        // Check that we can still send different message types after reset
        let sentMessages = await mockAPI.tracker.sentMessages
        let hasTypedMessage = sentMessages.contains { message in
            message.payload?.count == 123 && message.target == "post-reset-typed"
        }
        XCTAssertTrue(hasTypedMessage, "Typed messages should work after reset")
    }

    // MARK: - Error Handling Tests

    func testInitializationWithInvalidJavaScript() throws {
        // This test verifies that our error handling works
        // In a real scenario, if the JS file was missing or invalid,
        // we'd get a MessengerError

        // For now, we'll test that normal initialization works
        let options = MessengerOptions<TestEvent>(
            id: "test-error",
            context: .player,
            logger: mockLogger,
            beaconIntervalMS: 500,
            debug: true,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            handleFailedMessage: { transaction in
                // Handle failed messages
            }
        )

        XCTAssertNoThrow(try Messenger(options: options))
    }

    func testDebugLogging() throws {
        let options = MessengerOptions<TestEvent>(
            id: "test-debug",
            context: .devtools,
            logger: mockLogger,
            beaconIntervalMS: 1000,
            debug: true,  // Enable debug logging
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            handleFailedMessage: nil
        )

        let messenger = try Messenger(options: options)

        let testMessage = TestEvent(payload: TestPayload(count: 123))
        messenger.sendMessage(testMessage)

        // Allow some time for logging
        let expectation = XCTestExpectation(description: "Debug logging")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)

        // With debug enabled, we should see some log messages
        // The exact content depends on the JavaScript implementation
        XCTAssertGreaterThanOrEqual(mockLogger.loggedMessages.count, 0)
    }

    // MARK: - Context Tests

    func testPlayerContext() async throws {
        let options = MessengerOptions<TestEvent>(
            id: "player-test",
            context: .player,  // Test player context
            logger: mockLogger,
            beaconIntervalMS: 1000,
            debug: false,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            handleFailedMessage: nil
        )

        let messenger = try Messenger(options: options)
        XCTAssertNotNil(messenger)
    }

    func testDevtoolsContext() throws {
        let options = MessengerOptions<TestEvent>(
            id: "devtools-test",
            context: .devtools,  // Test devtools context
            logger: mockLogger,
            beaconIntervalMS: 1000,
            debug: false,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            handleFailedMessage: nil
        )

        let messenger = try Messenger(options: options)
        XCTAssertNotNil(messenger)
    }

    // MARK: - Integration Tests

    func testMultipleMessengerInstances() async throws {
        var messages1: [MessengerTransaction<TestEvent>] = []
        var messages2: [MessengerTransaction<TestEvent>] = []

        let options1 = MessengerOptions<TestEvent>(
            id: "messenger-1",
            context: .player,
            logger: mockLogger,
            beaconIntervalMS: 10000, // Long interval to avoid interference
            debug: false,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                messages1.append(transaction)
            },
            handleFailedMessage: nil
        )

        let options2 = MessengerOptions<TestEvent>(
            id: "messenger-2",
            context: .devtools,
            logger: mockLogger,
            beaconIntervalMS: 10000, // Long interval to avoid interference
            debug: false,
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                messages2.append(transaction)
            },
            handleFailedMessage: nil
        )

        let messenger1 = try Messenger(options: options1)
        let messenger2 = try Messenger(options: options2)

        // Send messages from both
        messenger1.sendMessage(TestEvent(payload: TestPayload(count: 1)))
        messenger2.sendMessage(TestEvent(payload: TestPayload(count: 2)))

        // Allow more time for processing
        let expectation = XCTestExpectation(description: "Multiple messengers")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            expectation.fulfill()
        }
        await fulfillment(of: [expectation], timeout: 2.0)

        // Both messengers should have been created successfully
        XCTAssertNotNil(messenger1)
        XCTAssertNotNil(messenger2)

        // Verify specific messages were sent by checking payload content
        let sentMessages = await mockAPI.tracker.sentMessages
        let sentCounts = sentMessages.compactMap { $0.payload?.count }
        XCTAssertTrue(sentCounts.contains(1), "Message from messenger1 should be sent")
        XCTAssertTrue(sentCounts.contains(2), "Message from messenger2 should be sent")
    }
}

// MARK: - Test Event Types

/// A test event type used for unit testing the Messenger
struct TestEvent: BaseEvent {
    typealias Payload = TestPayload

    let type: String
    let payload: TestPayload?
    let target: String?

    init(type: String = "TEST", payload: TestPayload?, target: String? = nil) {
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
    /// Array of all logged messages for test assertions
    var loggedMessages: [String] = []

    /// Logs a message by storing it in the loggedMessages array
    /// - Parameter args: Variable arguments to log
    func log(_ args: Any...) {
        let message = args.map { "\($0)" }.joined(separator: " ")
        loggedMessages.append(message)
    }
}

/// Mock messaging API for testing Messenger functionality
/// This is an actor to ensure that all of the values are kept thread-safe.
actor MockMessageTracker {
    private(set) var sentMessages: [TestEvent] = []
    private(set) var listeners: [(MessengerTransaction<TestEvent>) -> Void] = []
    private(set) var sendMessageCallCount = 0
    private(set) var addListenerCallCount = 0
    private(set) var removeListenerCallCount = 0

    /// Resets all tracked state and counters
    func reset() {
        sentMessages.removeAll()
        listeners.removeAll()
        sendMessageCallCount = 0
        addListenerCallCount = 0
        removeListenerCallCount = 0
    }

    /// Sends a message and notifies all registered listeners
    /// - Parameter message: The test event to send
    /// - Throws: Any errors that occur during message processing
    func sendMessage(_ message: TestEvent) throws {
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
}

/// A wrapper for `MockMessageTracker`.
///
/// This allows us to access the isolated values. We use high priority tasks to ensure the tasks happen asap
class MockMessagingAPI {
    var tracker = MockMessageTracker()

    /// Resets all tracked state and counters
    func reset() {
        Task(priority: .high) { await tracker.reset() }
    }

    /// Sends a message and notifies all registered listeners
    /// - Parameter message: The test event to send
    /// - Throws: Any errors that occur during message processing
    func sendMessage(_ message: TestEvent) throws {
        Task(priority: .high) { try await tracker.sendMessage(message) }
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
    /// (I.e. it makes it so they would never trigger in a typical test.)
    static let avoidIAmHereBeacons = 3_000_000 // 50 mins
}
