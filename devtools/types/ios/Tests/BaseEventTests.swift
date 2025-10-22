//
//  BaseEventTests.swift
//  BaseEventTests
//
//  Generated with Cursor by Koriann South - September 23, 2025
//

import XCTest

@testable import PlayerUIDevToolsTypes

final class BaseEventTests: XCTestCase {
    // MARK: - Initialization Tests.
    // Test that normal initialization works and all fields are set correctly.
    
    func testConcreteBaseEventWithPayload() throws {
        let payload = LoginPayload(userId: "user123", timestamp: 1_695_456_789)
        let event = SimpleTestEvent(
            type: "USER_LOGIN",
            payload: payload,
            target: "target123"
        )
        
        XCTAssertEqual(event.type, "USER_LOGIN")
        XCTAssertEqual(event.payload?.userId, "user123")
        XCTAssertEqual(event.payload?.timestamp, 1_695_456_789)
        XCTAssertEqual(event.target, "target123")
    }
    
    func testConcreteBaseEventWithoutTarget() throws {
        let payload = DataPayload(data: ["key": "value"], version: 1)
        let event = TestDataEvent(
            data: ["key": "value"],
            version: 1
        )
        
        XCTAssertEqual(event.type, "DATA_UPDATE")
        XCTAssertEqual(event.payload?.data["key"], "value")
        XCTAssertEqual(event.payload?.version, 1)
        XCTAssertNil(event.target)
    }
    
    func testConcreteBaseEventWithNilPayload() throws {
        let event = NilPayloadEvent(
            type: "SYSTEM_NOTIFICATION",
            target: "broadcast"
        )
        
        XCTAssertEqual(event.type, "SYSTEM_NOTIFICATION")
        XCTAssertNil(event.payload)
        XCTAssertEqual(event.target, "broadcast")
    }
    
    // MARK: - Codable Tests with BaseEventCodingKeys
    
    func testBaseEventEncoding() throws {
        let event = SimpleTestEvent(
            type: "TEST_EVENT",
            payload: LoginPayload(userId: "encode-test", timestamp: 12345),
            target: "test-target"
        )
        
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .prettyPrinted]
        let data = try encoder.encode(event)
        let jsonString = String(data: data, encoding: .utf8)!
        
        // Verify JSON structure matches expected keys
        XCTAssertEqual(
            jsonString,
            """
            {
              "payload" : {
                "timestamp" : 12345,
                "userId" : "encode-test"
              },
              "target" : "test-target",
              "type" : "TEST_EVENT"
            }
            """
        )
    }
    
    func testBaseEventDecoding() throws {
        let jsonString = """
        {
            "type": "USER_LOGIN",
            "payload": {
                "userId": "decode-test",
                "timestamp": 67890
            },
            "target": "decode-target"
        }
        """
        
        let data = jsonString.data(using: .utf8)!
        let decoder = JSONDecoder()
        let event = try decoder.decode(SimpleTestEvent.self, from: data)
        
        XCTAssertEqual(event.type, "USER_LOGIN")
        XCTAssertEqual(event.payload?.userId, "decode-test")
        XCTAssertEqual(event.payload?.timestamp, 67890)
        XCTAssertEqual(event.target, "decode-target")
    }
    
    func testBaseEventEncodingWithNilPayload() throws {
        let event = NilPayloadEvent(
            type: "NO_PAYLOAD_EVENT",
            target: "nil-target"
        )
        
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .prettyPrinted]
        let data = try encoder.encode(event)
        let jsonString = String(data: data, encoding: .utf8)!
        
        XCTAssertEqual(
            jsonString,
            """
            {
              "target" : "nil-target",
              "type" : "NO_PAYLOAD_EVENT"
            }
            """
        )
    }
    
    func testBaseEventDecodingWithNilPayload() throws {
        let jsonString = """
        {
            "type": "NO_PAYLOAD_EVENT",
            "payload": null,
            "target": "nil-decode-target"
        }
        """
        
        let data = jsonString.data(using: .utf8)!
        let decoder = JSONDecoder()
        let event = try decoder.decode(NilPayloadEvent.self, from: data)
        
        XCTAssertEqual(event.type, "NO_PAYLOAD_EVENT")
        XCTAssertNil(event.payload)
        XCTAssertEqual(event.target, "nil-decode-target")
    }
    
    func testBaseEventDecodingWithMissingTarget() throws {
        let jsonString = """
        {
            "type": "BROADCAST_EVENT",
            "payload": {
                "userId": "broadcast-test",
                "timestamp": 11111
            }
        }
        """
        
        let data = jsonString.data(using: .utf8)!
        let decoder = JSONDecoder()
        let event = try decoder.decode(SimpleTestEvent.self, from: data)
        
        XCTAssertEqual(event.type, "BROADCAST_EVENT")
        XCTAssertEqual(event.payload?.userId, "broadcast-test")
        XCTAssertEqual(event.payload?.timestamp, 11111)
        XCTAssertNil(event.target)
    }
    
    func testRoundTripEncodingDecoding() throws {
        let originalEvent = SimpleTestEvent(
            type: "ROUND_TRIP_TEST",
            payload: LoginPayload(userId: "roundtrip", timestamp: 99999),
            target: "roundtrip-target"
        )
        
        // Encode
        let encoder = JSONEncoder()
        let data = try encoder.encode(originalEvent)
        
        // Decode
        let decoder = JSONDecoder()
        let decodedEvent = try decoder.decode(SimpleTestEvent.self, from: data)
        
        // Verify they match
        XCTAssertEqual(originalEvent.type, decodedEvent.type)
        XCTAssertEqual(
            originalEvent.payload?.userId,
            decodedEvent.payload?.userId
        )
        XCTAssertEqual(
            originalEvent.payload?.timestamp,
            decodedEvent.payload?.timestamp
        )
        XCTAssertEqual(originalEvent.target, decodedEvent.target)
    }
    
    // MARK: - Edge Cases
    
    func testEventWithComplexPayload() throws {
        let complexPayload = ComplexPayload(
            nested: ["numbers": [1, 2, 3], "more": [4, 5]],
            optional: nil,
            array: [
                LoginPayload(userId: "user1", timestamp: 100),
                LoginPayload(userId: "user2", timestamp: 200),
            ]
        )
        
        let event = ComplexPayloadEvent(
            type: "COMPLEX_EVENT",
            payload: complexPayload,
            target: "complex-target"
        )
        
        XCTAssertEqual(event.payload?.nested["numbers"], [1, 2, 3])
        XCTAssertEqual(event.payload?.nested["more"], [4, 5])
        XCTAssertNil(event.payload?.optional)
        XCTAssertEqual(event.payload?.array.count, 2)
        XCTAssertEqual(event.payload?.array[0].userId, "user1")
        XCTAssertEqual(event.payload?.array[1].timestamp, 200)
        
        // Test encoding/decoding of complex payload
        let encoder = JSONEncoder()
        let data = try encoder.encode(event)
        
        let decoder = JSONDecoder()
        let decodedEvent = try decoder.decode(
            ComplexPayloadEvent.self,
            from: data
        )
        
        XCTAssertEqual(decodedEvent.type, "COMPLEX_EVENT")
        XCTAssertEqual(decodedEvent.payload?.nested["numbers"], [1, 2, 3])
        XCTAssertEqual(decodedEvent.payload?.nested["more"], [4, 5])
        XCTAssertNil(decodedEvent.payload?.optional)
        XCTAssertEqual(decodedEvent.payload?.array.count, 2)
        XCTAssertEqual(decodedEvent.payload?.array[0].userId, "user1")
        XCTAssertEqual(decodedEvent.payload?.array[1].timestamp, 200)
        XCTAssertEqual(decodedEvent.target, "complex-target")
    }
}

// Test payload structures
struct LoginPayload: Codable, Equatable {
    let userId: String
    let timestamp: Int
}

struct DataPayload: Codable, Equatable {
    let data: [String: String]
    let version: Int
}

// Concrete test event implementations matching the new BaseEvent protocol
struct SimpleTestEvent: BaseEvent {
    typealias Payload = LoginPayload
    
    let type: String
    let payload: LoginPayload?
    let target: String?
    
    init(type: String, payload: LoginPayload?, target: String? = nil) {
        self.type = type
        self.payload = payload
        self.target = target
    }
}

struct NilPayloadEvent: BaseEvent {
    typealias Payload = String
    
    let type: String
    let payload: String?
    let target: String?
    
    init(type: String, target: String? = nil) {
        self.type = type
        self.payload = nil
        self.target = target
    }
}

struct ComplexPayloadEvent: BaseEvent {
    typealias Payload = ComplexPayload
    
    let type: String
    let payload: ComplexPayload?
    let target: String?
    
    init(type: String, payload: ComplexPayload?, target: String? = nil) {
        self.type = type
        self.payload = payload
        self.target = target
    }
}

struct ComplexPayload: Codable, Equatable {
    let nested: [String: [Int]]
    let optional: String?
    let array: [LoginPayload]
}

struct TestDataEvent: BaseEvent {
    typealias Payload = DataPayload
    
    let type: String
    let payload: DataPayload?
    let target: String?
    
    init(data: [String: String], version: Int, target: String? = nil) {
        self.type = "DATA_UPDATE"
        self.payload = DataPayload(data: data, version: version)
        self.target = target
    }
}
