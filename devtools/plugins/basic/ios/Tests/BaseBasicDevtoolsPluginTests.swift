import XCTest
import JavaScriptCore
import PlayerUI
import PlayerUIDevtoolsPlugins
import PlayerUIDevtoolsTypes
@testable import PlayerUIDevtoolsBaseBasicDevtoolsPlugin

final class BaseBasicDevtoolsPluginTests: XCTestCase {

    var context: JSContext!
    var testHandler: TestHandler!
    var plugin: BaseBasicDevtoolsPlugin!
    let testPlayerID = "test-player-123"

    override func setUp() {
        super.setUp()
        context = JSContext()
        testHandler = TestHandler()
        plugin = BaseBasicDevtoolsPlugin(playerID: testPlayerID)
        plugin.handler = testHandler

        // Actually load the JS plugin
        plugin.context = context
        plugin.setup(context: context)
    }

    override func tearDown() {
        plugin = nil
        super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitializationWithVariousPlayerIDs() {
        let testCases = [
            "player-1",
            "",
            "player-@#$%^&*()",
            "player-🎮-🎯",
            String(repeating: "a", count: 1000)
        ]

        for playerID in testCases {
            let testPlugin = BaseBasicDevtoolsPlugin(playerID: playerID)
            XCTAssertNotNil(testPlugin)
        }
    }

    // MARK: - Arguments Tests

    func testGetArgumentsStructure() {
        let arguments = plugin.getArguments()
        XCTAssertEqual(arguments.count, 1)

        guard let jsCompatibleDict = arguments.first as? [String: Any] else {
            XCTFail("First argument should be a dictionary")
            return
        }

        // Verify playerID
        XCTAssertEqual(jsCompatibleDict["playerID"] as? String, testPlayerID)

        // Verify handler structure
        guard let handler = jsCompatibleDict["handler"] as? [String: Any] else {
            XCTFail("Handler should be a dictionary")
            return
        }

        XCTAssertTrue(handler.keys.contains("checkIfDevtoolsIsActive"))
        XCTAssertTrue(handler.keys.contains("processInteraction"))
    }

    // MARK: - Handler Functionality Tests

    func testJSCompatibleHandlerHasCorrectProperties() {
        let arguments = plugin.getArguments()
        guard let jsCompatibleDict = arguments.first as? [String: Any],
              let handler = jsCompatibleDict["handler"] as? [String: Any] else {
            XCTFail("Handler should be a dictionary")
            return
        }

        // Verify handler has exactly the required methods
        XCTAssertEqual(handler.keys.count, 2)
        XCTAssertTrue(handler.keys.contains("checkIfDevtoolsIsActive"))
        XCTAssertTrue(handler.keys.contains("processInteraction"))
    }

    func testJSCompatibleIsActive() {
        let arguments = plugin.getArguments()
        guard let jsCompatibleDict = arguments.first as? [String: Any],
              let handler = jsCompatibleDict["handler"] as? [String: Any],
              let checkIfActiveFn = handler["checkIfDevtoolsIsActive"] as? JSValue
        else {
            XCTFail("Handler should be a dictionary")
            return
        }
        XCTAssert(checkIfActiveFn.call(withArguments: []).toBool())
    }

    func testJSCompatibleProcessInteraction() {
        let arguments = plugin.getArguments()
        guard let jsCompatibleDict = arguments.first as? [String: Any],
              let handler = jsCompatibleDict["handler"] as? [String: Any],
              let processInteractionFn = handler["processInteraction"] as? JSValue
        else {
            XCTFail("Handler should be a dictionary")
            return
        }

        let interaction: Message = ["type": "PLAYER_DEVTOOLS_PLUGIN_INTERACTION", "data": "test-data"]
        processInteractionFn.call(withArguments: [interaction])
        XCTAssertEqual(testHandler.interactionsProcessed, 1)
    }

    func testIsActiveReturnsTrue() {
        XCTAssert(plugin.isActive)
    }

    func testProcessInteractionWithVariousMessages() {
        let testMessages: [Message] = [
            ["type": "PLAYER_DEVTOOLS_PLUGIN_INTERACTION", "data": "test-data"],
            ["type": "PLAYER_DEVTOOLS_PLUGIN_INTERACTION", "data": ["nested": "value", "array": [1, 2, 3]]],
            ["type": "PLAYER_DEVTOOLS_PLUGIN_INTERACTION", "data": NSNull()]
        ]

        for message in testMessages {
            testHandler.processInteraction(interaction: message)
        }

        XCTAssertEqual(testHandler.interactionsProcessed, testMessages.count)
    }

    // MARK: - Plugin Configuration Tests

    func testPluginConfiguration() {
        XCTAssertEqual(plugin.pluginName, "BasicDevtoolsPlugin.BasicDevtoolsPlugin")
        XCTAssertEqual(plugin.fileName, "BasicDevtoolsPlugin.native")
    }
}

class TestHandler: DevtoolsHandler {
    var interactionsProcessed = 0
    var isActive = true

    func processInteraction(interaction: PlayerUIDevtoolsTypes.Message) {
        interactionsProcessed += 1
    }
}
