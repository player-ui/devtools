//
//  TransactionMetaDataTests.swift
//  TransactionMetaDataTests
//
//  Generated with Cursor by Koriann South - September 23, 2025
//

import XCTest
@testable import PlayerUIDevToolsTypes

final class TransactionMetaDataTests: XCTestCase {

    // MARK: - Initialization Tests

    func testFullInitialization() throws {
        let timestamp: Int = 1695456789000
        let metadata = TransactionMetaData(
            id: 42,
            timestamp: timestamp,
            sender: "sender123",
            context: .player,
            isMessenger: true
        )

        XCTAssertEqual(metadata.id, 42)
        XCTAssertEqual(metadata.timestamp, timestamp)
        XCTAssertEqual(metadata.sender, "sender123")
        XCTAssertEqual(metadata.context, .player)
        XCTAssertTrue(metadata.isMessenger)
    }

    func testDefaultMessengerFlag() throws {
        let metadata = TransactionMetaData(
            id: 1,
            timestamp: 1695456789000,
            sender: "test",
            context: .player
        )

        // Should default to true
        XCTAssertTrue(metadata.isMessenger)
    }

    // MARK: - Context Enum Tests

    func testMessengerContextValues() throws {
        XCTAssertEqual(MessengerContext.player.rawValue, "player")
        XCTAssertEqual(MessengerContext.devtools.rawValue, "devtools")
        XCTAssertEqual(MessengerContext.allCases.count, 2)
    }

    func testMessengerContextFromRawValue() throws {
        XCTAssertEqual(MessengerContext(rawValue: "player"), .player)
        XCTAssertEqual(MessengerContext(rawValue: "devtools"), .devtools)
        XCTAssertNil(MessengerContext(rawValue: "invalid"))
    }

    // MARK: - Codable Tests

    func testTransactionMetaDataEncoding() throws {
        let metadata = TransactionMetaData(
            id: 999,
            timestamp: 1695456789000,
            sender: "encode-test",
            context: .devtools,
            isMessenger: false
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .prettyPrinted]
        let data = try encoder.encode(metadata)
        let jsonString = String(data: data, encoding: .utf8)!

        // Verify JSON structure matches expected keys with _messenger_ mapping
        XCTAssertEqual(
            jsonString,
            """
            {
              "_messenger_" : false,
              "context" : "devtools",
              "id" : 999,
              "sender" : "encode-test",
              "timestamp" : 1695456789000
            }
            """
        )
    }

    func testTransactionMetaDataDecoding() throws {
        // Test that _messenger_ key maps correctly to isMessenger
        let jsonString = """
        {
            "id": 123,
            "timestamp": 1695456789000,
            "sender": "json-test",
            "context": "player",
            "_messenger_": true
        }
        """

        let data = jsonString.data(using: .utf8)!
        let decoder = JSONDecoder()
        let metadata = try decoder.decode(TransactionMetaData.self, from: data)

        XCTAssertEqual(metadata.id, 123)
        XCTAssertEqual(metadata.timestamp, 1695456789000)
        XCTAssertEqual(metadata.sender, "json-test")
        XCTAssertEqual(metadata.context, .player)
        XCTAssertTrue(metadata.isMessenger)
    }

    func testRoundTripEncodingDecoding() throws {
        let originalMetadata = TransactionMetaData(
            id: 456,
            timestamp: 1695456789000,
            sender: "roundtrip-test",
            context: .devtools,
            isMessenger: true
        )

        // Encode
        let encoder = JSONEncoder()
        let data = try encoder.encode(originalMetadata)

        // Decode
        let decoder = JSONDecoder()
        let decodedMetadata = try decoder.decode(TransactionMetaData.self, from: data)

        // Verify they match
        XCTAssertEqual(originalMetadata.id, decodedMetadata.id)
        XCTAssertEqual(originalMetadata.timestamp, decodedMetadata.timestamp)
        XCTAssertEqual(originalMetadata.sender, decodedMetadata.sender)
        XCTAssertEqual(originalMetadata.context, decodedMetadata.context)
        XCTAssertEqual(originalMetadata.isMessenger, decodedMetadata.isMessenger)
    }
}
