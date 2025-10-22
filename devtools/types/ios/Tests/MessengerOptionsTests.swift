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
    
    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.
    }
    
    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }
    
    // MARK: - asJSValue() Tests
    
    func testAsJSValueWithPlayerContext() throws {
        let options = MessengerOptions<TestEvent>(
            id: "test-player-id",
            context: .player,
            logger: MockLogger(),
            beaconIntervalMS: 2000,
            debug: false,
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in },
            handleFailedMessage: nil
        )
        
        let jsValue = options.asJSValue
        
        XCTAssertNotNil(jsValue, "asJSValue should return a JSValue")
        XCTAssertFalse(jsValue?.isUndefined ?? true, "JSValue should not be undefined")
        
        // Verify the properties are accessible in the JavaScript object
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("context")?.toString(), "player")
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("id")?.toString(), "test-player-id")
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("beaconIntervalMS")?.toInt32(), 2000)
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("debug")?.toBool(), false)
    }
    
    func testAsJSValueWithDevtoolsContext() throws {
        let options = MessengerOptions<TestEvent>(
            id: "test-devtools-id",
            context: .devtools,
            logger: MockLogger(),
            beaconIntervalMS: 500,
            debug: true,
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in },
            handleFailedMessage: nil
        )
        
        let jsValue = options.asJSValue
        
        XCTAssertNotNil(jsValue, "asJSValue should return a JSValue")
        XCTAssertFalse(jsValue?.isUndefined ?? true, "JSValue should not be undefined")
        
        // Verify the properties match the devtools context
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("context")?.toString(), "devtools")
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("id")?.toString(), "test-devtools-id")
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("beaconIntervalMS")?.toInt32(), 500)
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("debug")?.toBool(), true)
    }
    
    func testAsJSValueWithDefaultBeaconInterval() throws {
        let options = MessengerOptions<TestEvent>(
            id: "default-beacon-test",
            context: .player,
            logger: MockLogger(),
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in }
        )
        
        let jsValue = options.asJSValue
        
        XCTAssertNotNil(jsValue, "asJSValue should return a JSValue")
        
        // Verify default beacon interval (1000ms as per MessengerOptions init)
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("beaconIntervalMS")?.toInt32(), 1000)
        XCTAssertEqual(jsValue?.objectForKeyedSubscript("debug")?.toBool(), false)
    }
    
    func testAsJSValueWithDifferentIds() throws {
        let testIds = ["short", "very-long-identifier-with-dashes", "123456", "special_chars!@#"]
        
        for testId in testIds {
            let options = MessengerOptions<TestEvent>(
                id: testId,
                context: .player,
                logger: MockLogger(),
                sendMessage: { _ in },
                addListener: { _ in },
                removeListener: { _ in },
                messageCallback: { _ in }
            )
            
            let jsValue = options.asJSValue
            
            XCTAssertNotNil(jsValue, "asJSValue should return a JSValue for id: \(testId)")
            XCTAssertEqual(jsValue?.objectForKeyedSubscript("id")?.toString(), testId, "ID should match for: \(testId)")
        }
    }
    
    func testAsJSValueWithDifferentBeaconIntervals() throws {
        let testIntervals: [Int] = [100, 1000, 5000, 10000]
        
        for interval in testIntervals {
            let options = MessengerOptions<TestEvent>(
                id: "beacon-test-\(interval)",
                context: .devtools,
                logger: MockLogger(),
                beaconIntervalMS: interval,
                sendMessage: { _ in },
                addListener: { _ in },
                removeListener: { _ in },
                messageCallback: { _ in }
            )
            
            let jsValue = options.asJSValue
            
            XCTAssertNotNil(jsValue, "asJSValue should return a JSValue for interval: \(interval)")
            XCTAssertEqual(jsValue?.objectForKeyedSubscript("beaconIntervalMS")?.toInt32(), Int32(interval), "Beacon interval should match: \(interval)")
        }
    }
    
    func testAsJSValueDebugModes() throws {
        // Test debug = true
        let debugOptions = MessengerOptions<TestEvent>(
            id: "debug-true-test",
            context: .player,
            logger: MockLogger(),
            debug: true,
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in }
        )
        
        let debugJSValue = debugOptions.asJSValue
        XCTAssertEqual(debugJSValue?.objectForKeyedSubscript("debug")?.toBool(), true)
        
        // Test debug = false
        let nonDebugOptions = MessengerOptions<TestEvent>(
            id: "debug-false-test",
            context: .devtools,
            logger: MockLogger(),
            debug: false,
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in }
        )
        
        let nonDebugJSValue = nonDebugOptions.asJSValue
        XCTAssertEqual(nonDebugJSValue?.objectForKeyedSubscript("debug")?.toBool(), false)
    }
    
    func testAsJSValueContextEnumValues() throws {
        // Test all context enum values
        for messengerContext in MessengerContext.allCases {
            let options = MessengerOptions<TestEvent>(
                id: "context-test-\(messengerContext.rawValue)",
                context: messengerContext,
                logger: MockLogger(),
                sendMessage: { _ in },
                addListener: { _ in },
                removeListener: { _ in },
                messageCallback: { _ in }
            )
            
            let jsValue = options.asJSValue
            
            XCTAssertNotNil(jsValue, "asJSValue should work for context: \(messengerContext)")
            XCTAssertEqual(jsValue?.objectForKeyedSubscript("context")?.toString(), messengerContext.rawValue, "Context should match: \(messengerContext.rawValue)")
        }
    }
    
    func testAsJSValueMultipleInstances() throws {
        // Test that multiple calls to asJSValue work independently
        let options1 = MessengerOptions<TestEvent>(
            id: "instance-1",
            context: .player,
            logger: MockLogger(),
            beaconIntervalMS: 1000,
            debug: true,
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in }
        )
        
        let options2 = MessengerOptions<TestEvent>(
            id: "instance-2",
            context: .devtools,
            logger: MockLogger(),
            beaconIntervalMS: 2000,
            debug: false,
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in }
        )
        
        let jsValue1 = options1.asJSValue
        let jsValue2 = options2.asJSValue
        
        // Verify both instances have their own properties
        XCTAssertEqual(jsValue1?.objectForKeyedSubscript("id")?.toString(), "instance-1")
        XCTAssertEqual(jsValue1?.objectForKeyedSubscript("context")?.toString(), "player")
        XCTAssertEqual(jsValue1?.objectForKeyedSubscript("beaconIntervalMS")?.toInt32(), 1000)
        XCTAssertEqual(jsValue1?.objectForKeyedSubscript("debug")?.toBool(), true)
        
        XCTAssertEqual(jsValue2?.objectForKeyedSubscript("id")?.toString(), "instance-2")
        XCTAssertEqual(jsValue2?.objectForKeyedSubscript("context")?.toString(), "devtools")
        XCTAssertEqual(jsValue2?.objectForKeyedSubscript("beaconIntervalMS")?.toInt32(), 2000)
        XCTAssertEqual(jsValue2?.objectForKeyedSubscript("debug")?.toBool(), false)
    }
    
    func testAsJSValueErrorHandling() throws {
        // Test that asJSValue handles potential errors gracefully
        let options = MessengerOptions<TestEvent>(
            id: "error-handling-test",
            context: .player,
            logger: MockLogger(),
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in }
        )
        
        // Verify the result is valid
        let jsValue = options.asJSValue
        XCTAssertNotNil(jsValue, "asJSValue should return a valid JSValue")
        XCTAssertFalse(jsValue?.isUndefined ?? true, "JSValue should not be undefined")
    }
    
    func testAsJSValuePropertiesAreReadable() throws {
        let options = MessengerOptions<TestEvent>(
            id: "property-test",
            context: .devtools,
            logger: MockLogger(),
            beaconIntervalMS: 3000,
            debug: true,
            sendMessage: { _ in },
            addListener: { _ in },
            removeListener: { _ in },
            messageCallback: { _ in }
        )
        
        let jsValue = options.asJSValue
        
        // Test that all expected properties exist and are readable
        XCTAssertFalse(jsValue?.objectForKeyedSubscript("context")?.isUndefined ?? true, "context property should exist")
        XCTAssertFalse(jsValue?.objectForKeyedSubscript("id")?.isUndefined ?? true, "id property should exist")
        XCTAssertFalse(jsValue?.objectForKeyedSubscript("beaconIntervalMS")?.isUndefined ?? true, "beaconIntervalMS property should exist")
        XCTAssertFalse(jsValue?.objectForKeyedSubscript("debug")?.isUndefined ?? true, "debug property should exist")
        
        // Test that properties have the correct types
        XCTAssertTrue(jsValue?.objectForKeyedSubscript("context")?.isString ?? false, "context should be a string")
        XCTAssertTrue(jsValue?.objectForKeyedSubscript("id")?.isString ?? false, "id should be a string")
        XCTAssertTrue(jsValue?.objectForKeyedSubscript("beaconIntervalMS")?.isNumber ?? false, "beaconIntervalMS should be a number")
        XCTAssertTrue(jsValue?.objectForKeyedSubscript("debug")?.isBoolean ?? false, "debug should be a boolean")
    }
}

// MARK: - Test Event Types

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

struct TestPayload: Codable, Equatable {
    let count: Int
    
    init(count: Int = 0) {
        self.count = count
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
