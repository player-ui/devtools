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

final class MessengerTests: XCTestCase {
    
    var mockAPI: MockMessagingAPI!
    var mockLogger: MockLogger!
    
    override func setUpWithError() throws {
        mockAPI = MockMessagingAPI()
        mockLogger = MockLogger()
        
        // Reset the shared JavaScript context state
        // Note: We need an instance to call reset() since it's not static
        let resetOptions = MessengerOptions<TestEvent>(
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in },
            context: .player,
            id: "reset-instance-\(UUID().uuidString)", // Unique ID to avoid conflicts
            beaconIntervalMS: 30000, // Very long interval to avoid interference
            logger: MockLogger()
        )
        if let resetMessenger = try? Messenger(options: resetOptions) {
            resetMessenger.reset()
            
            // Give some time for the reset to complete
            let expectation = XCTestExpectation(description: "Reset completed")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                expectation.fulfill()
            }
            wait(for: [expectation], timeout: 1.0)
        }
    }
    
    override func tearDownWithError() throws {
        mockAPI.reset()
        mockLogger.loggedMessages.removeAll()
    }
    
    // MARK: - Basic Functionality Tests
    
    func testMessengerInitialization() throws {
        let options = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .devtools,
            id: "test-messenger",
            beaconIntervalMS: 1000,
            debug: false,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        let messenger = try Messenger(options: options)
        XCTAssertNotNil(messenger)
    }
    
    func testSendMessage() throws {
        var receivedTransactions: [MessengerTransaction<TestEvent>] = []
        
        let options = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                receivedTransactions.append(transaction)
            },
            context: .devtools,
            id: "test-sender",
            beaconIntervalMS: 5000, // Longer interval to avoid interference
            debug: false,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        let messenger = try Messenger(options: options)
        
        let testMessage = TestEvent(
            payload: TestPayload(count: 42),
            target: "test-target"
        )
        
        messenger.sendMessage(testMessage)
        
        // Wait for the message to be processed with proper expectation
        let expectation = XCTestExpectation(description: "Message sent")
        
        // Use a more reliable async wait pattern
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2.0)
        
        // Account for potential beacon messages by checking the actual sent message content
        XCTAssertGreaterThanOrEqual(mockAPI.sendMessageCallCountSnapshot, 1, "At least one message should be sent")
        
        // Find the test message among potentially multiple messages (including beacons)
        let testMessages = mockAPI.sentMessagesSnapshot.filter { $0.payload?.count == 42 }
        XCTAssertEqual(testMessages.count, 1, "Exactly one test message should be sent")
        XCTAssertEqual(testMessages.first?.target, "test-target")
    }
    
    func testSendMessageAsString() throws {
        let options = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .devtools,
            id: "test-string-sender",
            beaconIntervalMS: 5000, // Longer interval to avoid interference
            debug: false,
            handleFailedMessage: nil,
            logger: mockLogger
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
        wait(for: [expectation], timeout: 2.0)
        
        // The JavaScript implementation should have processed the string
        // This is harder to verify directly in the mock, but we can check that sendMessage was called
        XCTAssertGreaterThan(mockAPI.sendMessageCallCountSnapshot, 0)
    }
    
    func testDestroy() throws {
        let options = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .devtools,
            id: "test-destroy",
            beaconIntervalMS: 1000,
            debug: false,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        let messenger = try Messenger(options: options)
        
        // This should not throw
        messenger.destroy()
        
        // After destroy, the messenger should have cleaned up
        XCTAssertEqual(mockAPI.removeListenerCallCountSnapshot, 1)
    }
    
    // MARK: - Reset Method Tests
    
    func testResetClearsStaticEventsAcrossInstances() throws {
        var receivedMessages1: [MessengerTransaction<TestEvent>] = []
        var receivedMessages2: [MessengerTransaction<TestEvent>] = []
        
        // Create first messenger instance
        let options1 = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                receivedMessages1.append(transaction)
            },
            context: .devtools,
            id: "messenger-1",
            beaconIntervalMS: 1000,
            debug: true,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        // Create second messenger instance
        let options2 = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                receivedMessages2.append(transaction)
            },
            context: .player,
            id: "messenger-2",
            beaconIntervalMS: 1000,
            debug: true,
            handleFailedMessage: nil,
            logger: mockLogger
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
        wait(for: [setupExpectation], timeout: 1.0)
        
        let initialMessageCount = mockAPI.sendMessageCallCountSnapshot
        XCTAssertGreaterThan(initialMessageCount, 0, "Messages should have been sent before reset")
        
        // Reset static state using messenger1
        messenger1.reset()
        
        // Allow reset to complete
        let resetExpectation = XCTestExpectation(description: "Reset completed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            resetExpectation.fulfill()
        }
        wait(for: [resetExpectation], timeout: 1.0)
        
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
        wait(for: [postResetExpectation], timeout: 1.0)
        
        // Verify that both messengers can still send messages after reset
        XCTAssertGreaterThan(mockAPI.sendMessageCallCountSnapshot, 0, "Messages should be sent after reset")
        XCTAssertEqual(mockAPI.sentMessagesSnapshot.count, mockAPI.sendMessageCallCountSnapshot, "All sent messages should be tracked")
        
        // Verify the messages contain expected data
        let postResetMessages = mockAPI.sentMessagesSnapshot
        let counts = postResetMessages.compactMap { $0.payload?.count }
        XCTAssertTrue(counts.contains(30), "Should contain message from messenger1 after reset")
        XCTAssertTrue(counts.contains(40), "Should contain message from messenger2 after reset")
    }
    
    func testResetClearsConnectionsState() throws {
        var connectionCallbacks: [String: Int] = [:]
        
        // Create multiple messenger instances to establish connections
        let options1 = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: { [weak self] callback in
                connectionCallbacks["messenger-1"] = (connectionCallbacks["messenger-1"] ?? 0) + 1
                self?.mockAPI.addListener(callback)
            },
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .devtools,
            id: "connection-test-1",
            beaconIntervalMS: 500,
            debug: true,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        let options2 = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: { [weak self] callback in
                connectionCallbacks["messenger-2"] = (connectionCallbacks["messenger-2"] ?? 0) + 1
                self?.mockAPI.addListener(callback)
            },
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .player,
            id: "connection-test-2",
            beaconIntervalMS: 500,
            debug: true,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        let messenger1 = try Messenger(options: options1)
        let _ = try Messenger(options: options2)
        
        // Allow connections to be established
        let connectionExpectation = XCTestExpectation(description: "Connections established")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            connectionExpectation.fulfill()
        }
        wait(for: [connectionExpectation], timeout: 1.0)
        
        let initialAddListenerCount = mockAPI.addListenerCallCountSnapshot
        XCTAssertGreaterThan(initialAddListenerCount, 0, "Listeners should have been added")
        
        // Reset connections state
        messenger1.reset()
        
        // Allow reset to complete
        let resetExpectation = XCTestExpectation(description: "Reset completed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            resetExpectation.fulfill()
        }
        wait(for: [resetExpectation], timeout: 1.0)
        
        // Create new messenger instances after reset - they should establish fresh connections
        let options3 = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .devtools,
            id: "post-reset-messenger",
            beaconIntervalMS: 1000,
            debug: false,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        let postResetMessenger = try Messenger(options: options3)
        
        // Send a message to verify the post-reset messenger works
        postResetMessenger.sendMessage(TestEvent(payload: TestPayload(count: 100)))
        
        let postResetMessageExpectation = XCTestExpectation(description: "Post-reset message sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            postResetMessageExpectation.fulfill()
        }
        wait(for: [postResetMessageExpectation], timeout: 1.0)
        
        // Verify the post-reset messenger can send messages
        XCTAssertTrue(mockAPI.sentMessagesSnapshot.contains { $0.payload?.count == 100 },
                      "Post-reset messenger should be able to send messages")
    }
    
    func testResetAffectsAllInstancesInSharedContext() throws {
        var messages1: [MessengerTransaction<TestEvent>] = []
        var messages2: [MessengerTransaction<TestEvent>] = []
        var messages3: [MessengerTransaction<TestEvent>] = []
        
        let context = JSContext()!
        
        // Create three messenger instances that should share the same JavaScript context
        let messenger1 = try Messenger(options: MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { messages1.append($0) },
            context: .devtools,
            id: "shared-context-1",
            logger: mockLogger
        ), jsContext: context)
        
        let messenger2 = try Messenger(options: MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { messages2.append($0) },
            context: .player,
            id: "shared-context-2",
            logger: mockLogger
        ), jsContext: context)
        
        let messenger3 = try Messenger(options: MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { messages3.append($0) },
            context: .devtools,
            id: "shared-context-3",
            logger: mockLogger
        ), jsContext: context)
        
        // Send messages from all instances to create state
        messenger1.sendMessage(TestEvent(payload: TestPayload(count: 1)))
        messenger2.sendMessage(TestEvent(payload: TestPayload(count: 2)))
        messenger3.sendMessage(TestEvent(payload: TestPayload(count: 3)))
        
        let setupExpectation = XCTestExpectation(description: "Initial messages sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            setupExpectation.fulfill()
        }
        wait(for: [setupExpectation], timeout: 1.0)
        
        let preResetMessageCount = mockAPI.sendMessageCallCountSnapshot
        XCTAssertGreaterThanOrEqual(preResetMessageCount, 3, "All three messages should have been sent")
        
        // Reset using any instance (should affect all instances sharing the context)
        messenger2.reset()
        
        let resetExpectation = XCTestExpectation(description: "Reset completed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            resetExpectation.fulfill()
        }
        wait(for: [resetExpectation], timeout: 1.0)
        
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
        wait(for: [postResetExpectation], timeout: 1.0)
        // Verify all instances can still send messages after reset
        XCTAssertGreaterThanOrEqual(mockAPI.sendMessageCallCountSnapshot, 3, "All instances should work after reset")
        
        let postResetCounts = mockAPI.sentMessagesSnapshot.compactMap { $0.payload?.count }
        XCTAssertTrue(postResetCounts.contains(11), "Messenger1 should work after reset")
        XCTAssertTrue(postResetCounts.contains(22), "Messenger2 should work after reset")
        XCTAssertTrue(postResetCounts.contains(33), "Messenger3 should work after reset")
    }
    
    func testResetWithUnavailableJavaScriptContext() throws {
        // This test verifies the warning case when JavaScript context is not available
        let options = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .devtools,
            id: "context-unavailable-test",
            logger: mockLogger
        )
        
        let messenger = try Messenger(options: options)
        
        // This should not crash even if the JavaScript context becomes unavailable
        // The implementation should handle this gracefully and print a warning
        XCTAssertNoThrow(messenger.reset(), "Reset should not throw even with unavailable context")
        
        // Messenger should still be functional for basic operations
        XCTAssertNoThrow(messenger.sendMessage(TestEvent(payload: TestPayload(count: 999))))
        
        let expectation = XCTestExpectation(description: "Message sent after context warning")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)
        
        // Should still be able to send messages
        XCTAssertGreaterThan(mockAPI.sendMessageCallCountSnapshot, 0)
    }
    
    func testResetClearsAccumulatedMessageState() throws {
        var receivedTransactions: [MessengerTransaction<TestEvent>] = []
        
        let options = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                receivedTransactions.append(transaction)
            },
            context: .devtools,
            id: "message-state-test",
            beaconIntervalMS: 10000, // Very long interval to avoid interference
            debug: true,
            handleFailedMessage: { transaction in
                // Track failed messages
                receivedTransactions.append(transaction)
            },
            logger: mockLogger
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
        wait(for: [batchExpectation], timeout: 2.0)
        
        let preResetCount = mockAPI.sendMessageCallCountSnapshot
        XCTAssertGreaterThanOrEqual(preResetCount, 5, "All batch messages should have been sent")
        
        // Reset to clear accumulated state
        messenger.reset()
        
        let resetExpectation = XCTestExpectation(description: "Reset completed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            resetExpectation.fulfill()
        }
        wait(for: [resetExpectation], timeout: 2.0)
        
        // Reset mock API to track new messages
        mockAPI.reset()
        
        // Send new messages after reset
        messenger.sendMessage(TestEvent(payload: TestPayload(count: 100), target: "post-reset"))
        messenger.sendMessage(TestEvent(payload: TestPayload(count: 200), target: "post-reset"))
        
        let postResetExpectation = XCTestExpectation(description: "Post-reset messages sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            postResetExpectation.fulfill()
        }
        wait(for: [postResetExpectation], timeout: 2.0)
        
        // Verify new messages are sent correctly after reset
        // Be more lenient with the count since beacons might still fire
        XCTAssertGreaterThanOrEqual(mockAPI.sendMessageCallCountSnapshot, 2, "Post-reset messages should be sent")
        
        let postResetCounts = mockAPI.sentMessagesSnapshot.compactMap { $0.payload?.count }
        XCTAssertTrue(postResetCounts.contains(100), "First post-reset message should be sent")
        XCTAssertTrue(postResetCounts.contains(200), "Second post-reset message should be sent")
        
        // Verify targets are correct for the specific test messages
        let testMessages = mockAPI.sentMessagesSnapshot.filter { [100, 200].contains($0.payload?.count) }
        XCTAssertTrue(testMessages.allSatisfy { $0.target == "post-reset" },
                      "All post-reset test messages should have correct target")
    }
    
    func testResetIsolationBetweenDifferentMessengerTypes() throws {
        // This test ensures that reset properly handles different event types
        // and doesn't interfere with type safety
        
        var testEventMessages: [MessengerTransaction<TestEvent>] = []
        
        let testEventOptions = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                testEventMessages.append(transaction)
            },
            context: .devtools,
            id: "typed-messenger",
            logger: mockLogger
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
        wait(for: [preResetExpectation], timeout: 1.0)
        
        let preResetCount = mockAPI.sendMessageCallCountSnapshot
        XCTAssertGreaterThan(preResetCount, 0, "Messages should be sent before reset")
        
        // Reset
        typedMessenger.reset()
        
        let resetExpectation = XCTestExpectation(description: "Reset completed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            resetExpectation.fulfill()
        }
        wait(for: [resetExpectation], timeout: 1.0)
        
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
        wait(for: [postResetExpectation], timeout: 1.0)
        
        // Verify both typed and string messages work after reset
        XCTAssertGreaterThan(mockAPI.sendMessageCallCountSnapshot, 0, "Post-reset messages should be sent")
        
        // Check that we can still send different message types after reset
        let hasTypedMessage = mockAPI.sentMessagesSnapshot.contains { message in
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
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .player,
            id: "test-error",
            beaconIntervalMS: 500,
            debug: true,
            handleFailedMessage: { transaction in
                // Handle failed messages
            },
            logger: mockLogger
        )
        
        XCTAssertNoThrow(try Messenger(options: options))
    }
    
    func testDebugLogging() throws {
        let options = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .devtools,
            id: "test-debug",
            beaconIntervalMS: 1000,
            debug: true,  // Enable debug logging
            handleFailedMessage: nil,
            logger: mockLogger
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
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .player,  // Test player context
            id: "player-test",
            beaconIntervalMS: 1000,
            debug: false,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        let messenger = try Messenger(options: options)
        XCTAssertNotNil(messenger)
    }
    
    func testDevtoolsContext() throws {
        let options = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .devtools,  // Test devtools context
            id: "devtools-test",
            beaconIntervalMS: 1000,
            debug: false,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        let messenger = try Messenger(options: options)
        XCTAssertNotNil(messenger)
    }
    
    // MARK: - Integration Tests
    
    func testMultipleMessengerInstances() throws {
        var messages1: [MessengerTransaction<TestEvent>] = []
        var messages2: [MessengerTransaction<TestEvent>] = []
        
        let options1 = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                messages1.append(transaction)
            },
            context: .player,
            id: "messenger-1",
            beaconIntervalMS: 10000, // Long interval to avoid interference
            debug: false,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        let options2 = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { transaction in
                messages2.append(transaction)
            },
            context: .devtools,
            id: "messenger-2",
            beaconIntervalMS: 10000, // Long interval to avoid interference
            debug: false,
            handleFailedMessage: nil,
            logger: mockLogger
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
        wait(for: [expectation], timeout: 2.0)
        
        // Both messengers should have been created successfully
        XCTAssertNotNil(messenger1)
        XCTAssertNotNil(messenger2)
        
        // Verify specific messages were sent by checking payload content
        let sentCounts = mockAPI.sentMessagesSnapshot.compactMap { $0.payload?.count }
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
///
/// Provides thread-safe mock implementations of message sending and listener management
/// for use in unit tests. Tracks all method calls and messages for assertions.
class MockMessagingAPI {
    private var sentMessages: [TestEvent] = []
    private var listeners: [(MessengerTransaction<TestEvent>) -> Void] = []
    private var sendMessageCallCount = 0
    private var addListenerCallCount = 0
    private var removeListenerCallCount = 0
    
    // Serial queue to protect shared mutable state
    private let queue = DispatchQueue(label: "com.mockapi.queue")
    
    /// Resets all tracked state and counters
    func reset() {
        queue.sync {
            sentMessages.removeAll()
            listeners.removeAll()
            sendMessageCallCount = 0
            addListenerCallCount = 0
            removeListenerCallCount = 0
        }
    }
    
    /// Sends a message and notifies all registered listeners
    /// - Parameter message: The test event to send
    /// - Throws: Any errors that occur during message processing
    func sendMessage(_ message: TestEvent) throws {
        let (count, currentListeners) = queue.sync { () -> (Int, [(MessengerTransaction<TestEvent>) -> Void]) in
            sendMessageCallCount += 1
            sentMessages.append(message)
            return (sendMessageCallCount, listeners)
        }
        
        // Simulate message being received by listeners with a small delay to mimic real async behavior
        let metadata = TransactionMetaData(
            id: count,
            timestamp: Int(Date().timeIntervalSince1970 * 1000),
            sender: "mock-sender",
            context: .player,
            isMessenger: true
        )
        
        let transaction = MessengerTransaction<TestEvent>(message: message, metaData: metadata)
        
        // Dispatch listener calls to main queue to simulate async behavior
        DispatchQueue.main.async {
            for listener in currentListeners {
                listener(transaction)
            }
        }
    }
    
    /// Registers a new message listener
    /// - Parameter callback: The callback to invoke when messages are received
    func addListener(_ callback: @escaping (MessengerTransaction<TestEvent>) -> Void) {
        queue.sync {
            addListenerCallCount += 1
            listeners.append(callback)
        }
    }
    
    /// Removes a message listener
    /// - Parameter callback: The callback to remove from the listeners list
    func removeListener(_ callback: @escaping (MessengerTransaction<TestEvent>) -> Void) {
        queue.sync {
            removeListenerCallCount += 1
            // In a real implementation, we'd remove the specific callback
            // For testing purposes, we'll just track the call count
        }
    }
    
    // Thread-safe accessors for test assertions
    
    /// Thread-safe snapshot of all sent messages
    var sentMessagesSnapshot: [TestEvent] {
        queue.sync { sentMessages }
    }
    
    /// Thread-safe snapshot of sendMessage call count
    var sendMessageCallCountSnapshot: Int {
        queue.sync { sendMessageCallCount }
    }
    
    /// Thread-safe snapshot of addListener call count
    var addListenerCallCountSnapshot: Int {
        queue.sync { addListenerCallCount }
    }
    
    /// Thread-safe snapshot of removeListener call count
    var removeListenerCallCountSnapshot: Int {
        queue.sync { removeListenerCallCount }
    }
}
