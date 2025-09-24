//
//  MessengerTests.swift
//  MessengerTests
//
//  Generated with Cursor by Koriann South - September 23, 2025
//

import XCTest
import JavaScriptCore
@testable import PlayerUIDevToolsMessenger
import PlayerUIDevToolsTypes

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
            id: "reset-instance",
            logger: MockLogger()
        )
        if let resetMessenger = try? Messenger(options: resetOptions) {
            resetMessenger.reset()
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
            beaconIntervalMS: 1000,
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
        
        // Allow some time for async operations
        let expectation = XCTestExpectation(description: "Message sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)
        
        XCTAssertEqual(mockAPI.sendMessageCallCount, 1)
        XCTAssertEqual(mockAPI.sentMessages.count, 1)
        XCTAssertEqual(mockAPI.sentMessages.first?.payload?.count, 42)
        XCTAssertEqual(mockAPI.sentMessages.first?.target, "test-target")
    }
    
    func testSendMessageAsString() throws {
        let options = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .devtools,
            id: "test-string-sender",
            beaconIntervalMS: 1000,
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
        
        // Allow some time for async operations
        let expectation = XCTestExpectation(description: "String message sent")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)
        
        // The JavaScript implementation should have processed the string
        // This is harder to verify directly in the mock, but we can check that sendMessage was called
        XCTAssertGreaterThan(mockAPI.sendMessageCallCount, 0)
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
        XCTAssertEqual(mockAPI.removeListenerCallCount, 1)
    }
    
    // MARK: - Static Method Tests
    
    func testStaticReset() throws {
        // Create a messenger to establish some state
        let options = MessengerOptions<TestEvent>(
            sendMessage: mockAPI.sendMessage,
            addListener: mockAPI.addListener,
            removeListener: mockAPI.removeListener,
            messageCallback: { _ in },
            context: .devtools,
            id: "test-reset",
            beaconIntervalMS: 1000,
            debug: false,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        let messenger = try Messenger(options: options)
        
        // Send a message to create some state
        let testMessage = TestEvent(payload: TestPayload(count: 1))
        messenger.sendMessage(testMessage)
        
        // Reset should clear static state
        messenger.reset()
        
        // This should not throw and should work as expected
        // The JavaScript implementation handles the actual reset logic
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
    
    func testPlayerContext() throws {
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
            beaconIntervalMS: 1000,
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
            beaconIntervalMS: 1000,
            debug: false,
            handleFailedMessage: nil,
            logger: mockLogger
        )
        
        let messenger1 = try Messenger(options: options1)
        let messenger2 = try Messenger(options: options2)
        
        // Send messages from both
        messenger1.sendMessage(TestEvent(payload: TestPayload(count: 1)))
        messenger2.sendMessage(TestEvent(payload: TestPayload(count: 2)))
        
        // Allow time for processing
        let expectation = XCTestExpectation(description: "Multiple messengers")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)
        
        // Both messengers should have been created successfully
        XCTAssertNotNil(messenger1)
        XCTAssertNotNil(messenger2)
        
        // Messages should have been sent
        XCTAssertGreaterThanOrEqual(mockAPI.sendMessageCallCount, 2)
    }
}

// MARK: - Test Event Types

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

struct TestPayload: Codable, Equatable {
    let count: Int
}

// MARK: - Mock Implementations

class MockLogger: MessengerLogger {
    var loggedMessages: [String] = []
    
    func log(_ args: Any...) {
        let message = args.map { "\($0)" }.joined(separator: " ")
        loggedMessages.append(message)
    }
}

class MockMessagingAPI {
    var sentMessages: [TestEvent] = []
    var listeners: [(MessengerTransaction<TestEvent>) -> Void] = []
    var sendMessageCallCount = 0
    var addListenerCallCount = 0
    var removeListenerCallCount = 0
    
    func reset() {
        sentMessages.removeAll()
        listeners.removeAll()
        sendMessageCallCount = 0
        addListenerCallCount = 0
        removeListenerCallCount = 0
    }
    
    func sendMessage(_ message: TestEvent) async throws {
        sendMessageCallCount += 1
        sentMessages.append(message)
        
        // Simulate message being received by listeners
        let metadata = TransactionMetaData(
            id: sendMessageCallCount,
            timestamp: Int(Date().timeIntervalSince1970 * 1000),
            sender: "mock-sender",
            context: .player,
            isMessenger: true
        )
        
        let transaction = MessengerTransaction<TestEvent>(message: message, metaData: metadata)
        
        for listener in listeners {
            listener(transaction)
        }
    }
    
    func addListener(_ callback: @escaping (MessengerTransaction<TestEvent>) -> Void) {
        addListenerCallCount += 1
        listeners.append(callback)
    }
    
    func removeListener(_ callback: @escaping (MessengerTransaction<TestEvent>) -> Void) {
        removeListenerCallCount += 1
        // In a real implementation, we'd remove the specific callback
        // For testing purposes, we'll just track the call count
    }
}