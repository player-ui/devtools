//
//  DevtoolsPlayerPluginTests.swift
//  DevtoolsPlayerPluginTests
//
//  Generated with Cursor by Koriann South - November 26, 2025
//

import XCTest
import JavaScriptCore
import PlayerUI
import PlayerUITestUtilitiesCore
@testable import PlayerUIDevToolsPlugins
@testable import PlayerUIDevToolsTypes
@testable import PlayerUIDevToolsMessenger

final class DevtoolsPlayerPluginTests: XCTestCase {

    var mockHandler: MockDevtoolsHandler!
    var plugin: DevtoolsPlayerPlugin!
    var player: HeadlessPlayerImpl!

    override func setUpWithError() throws {
        mockHandler = MockDevtoolsHandler()

        // Create minimal plugin data with a valid flow structure
        let pluginData = PluginData(
            id: "test-plugin",
            version: "1.0.0",
            name: "Test Plugin",
            description: "Test DevTools Plugin",
            flow: [
                "id": "test-flow",
                "navigation": ["START": "END"]
            ]
        )

        plugin = DevtoolsPlayerPlugin(options: DevtoolsPluginOptions(
            playerID: "test-player",
            handler: mockHandler,
            pluginData: pluginData
        ))
        player = HeadlessPlayerImpl(plugins: [plugin])
    }

    override func tearDown() async throws {
        mockHandler = nil
        plugin = nil
        player = nil
    }

    // MARK: - Initialization Tests

    func testPluginNameIsGettable() throws {
        XCTAssertEqual(plugin.pluginName, "DevtoolsPlugin.DevtoolsPlugin")
    }

    func testPlayerIDIGettable() throws {
        XCTAssertEqual(plugin.playerID, "test-player")
    }

    // MARK: - Options Tests

    func testDevtoolsPluginOptionsJSCompatible() throws {
        let options = DevtoolsPluginOptions(
            playerID: "test-player-123",
            handler: mockHandler
        )

        let jsCompatible = options.jsCompatible

        XCTAssertEqual(jsCompatible["playerID"] as? String, "test-player-123")
        XCTAssertNotNil(jsCompatible["handler"])
    }

    // MARK: - Handler Integration Tests

    func testHandlerIsActiveCheck() throws {
        mockHandler.isActive = true
        XCTAssertTrue(mockHandler.isActive)

        mockHandler.isActive = false
        XCTAssertFalse(mockHandler.isActive)
    }

    func testHandlerProcessesInteraction() throws {
        let interaction: Message = [
            "type": InternalEventType.devtoolsPluginInteraction.rawValue,
            "payload": ["action": "test"]
        ]

        mockHandler.processInteraction(interaction: interaction)

        XCTAssertEqual(mockHandler.receivedInteractions.count, 1)
        XCTAssertEqual(mockHandler.receivedInteractions.first?["type"] as? String,
                      InternalEventType.devtoolsPluginInteraction.rawValue)
    }

    func testHandlerLogsMessages() throws {
        mockHandler.log(message: "Test log message")

        XCTAssertEqual(mockHandler.loggedMessages.count, 1)
        XCTAssertEqual(mockHandler.loggedMessages.first, "Test log message")
    }
}

// MARK: - Mock Implementations

/// Mock DevtoolsHandler for testing
class MockDevtoolsHandler: DevtoolsHandler {
    var isActive: Bool = true
    var receivedInteractions: [Message] = []
    var loggedMessages: [String] = []

    func processInteraction(interaction: Message) {
        receivedInteractions.append(interaction)
    }

    func log(message: String) {
        loggedMessages.append(message)
    }
}


