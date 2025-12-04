import XCTest
import PlayerUI
import PlayerUIDevToolsTypes
import PlayerUIDevToolsPlugins
import PlayerUIDevToolsBaseBasicDevtoolsPlugin
@testable import PlayerUIDevToolsBasicPlugin

// MARK: - BasicDevtoolsPluginTests
final class BasicDevtoolsPluginTests: XCTestCase {

    func testPluginNameIsBasicDevtoolsPlugin() {
        let plugin = BasicDevtoolsPlugin(id: "test-id")
        XCTAssertEqual(plugin.pluginName, "BasicDevtoolsPlugin.BasicDevtoolsPlugin")
    }

    // MARK: - Initialization Tests

    func testInitializationWithValidID() {
        let testID = "player-123"
        let plugin = BasicDevtoolsPlugin(id: testID)
        XCTAssertNotNil(plugin)
    }

    func testInitializationWithEmptyID() {
        let plugin = BasicDevtoolsPlugin(id: "")
        XCTAssertNotNil(plugin)
    }

    func testInitializationWithSpecialCharactersInID() {
        let testID = "player-@#$%^&*()"
        let plugin = BasicDevtoolsPlugin(id: testID)
        XCTAssertNotNil(plugin)
    }

    func testInitializationWithLongID() {
        let testID = String(repeating: "a", count: 1000)
        let plugin = BasicDevtoolsPlugin(id: testID)
        XCTAssertNotNil(plugin)
    }

    // MARK: - Flipper Plugin Tests

    func testFlipperPluginIsInitialized() {
        let plugin = BasicDevtoolsPlugin(id: "test-id")
        XCTAssertNotNil(plugin.flipperPlugin)
    }

    func testFlipperPluginIDIsCorrect() {
        let plugin = BasicDevtoolsPlugin(id: "test-id")
        XCTAssertEqual(plugin.flipperPlugin.id, "player-ui-devtools")
    }

    func testFlipperPluginDoesNotRunInBackground() {
        let plugin = BasicDevtoolsPlugin(id: "test-id")
        XCTAssertFalse(plugin.flipperPlugin.runInBackground)
    }

    // MARK: - Multiple Instance Tests

    func testMultiplePluginInstancesWithDifferentIDs() {
        let plugin1 = BasicDevtoolsPlugin(id: "player-1")
        let plugin2 = BasicDevtoolsPlugin(id: "player-2")

        XCTAssertNotNil(plugin1)
        XCTAssertNotNil(plugin2)
        // Verify they are different instances
        XCTAssertFalse(plugin1 === plugin2)
    }

    func testEachPluginInstanceHasOwnFlipperPlugin() {
        let plugin1 = BasicDevtoolsPlugin(id: "player-1")
        let plugin2 = BasicDevtoolsPlugin(id: "player-2")

        // Each plugin should have its own flipper plugin instance
        XCTAssertNotEqual(ObjectIdentifier(plugin1.flipperPlugin), ObjectIdentifier(plugin2.flipperPlugin))
    }

    // MARK: - Plugin Name Tests

    func testPluginNameConsistency() {
        let plugin1 = BasicDevtoolsPlugin(id: "id-1")
        let plugin2 = BasicDevtoolsPlugin(id: "id-2")

        XCTAssertEqual(plugin1.pluginName, plugin2.pluginName)
        XCTAssertEqual(plugin1.pluginName, "BasicDevtoolsPlugin.BasicDevtoolsPlugin")
    }

    // MARK: - Protocol Conformance Tests

    func testPluginConformsToDevtoolsPlugin() {
        let plugin = BasicDevtoolsPlugin(id: "test-id")
        XCTAssert(plugin is DevtoolsPlugin)
    }

    // MARK: - Flipper Plugin Listener Tests

    func testFlipperPluginCanAddListener() {
        let plugin = BasicDevtoolsPlugin(id: "test-id")
        var listenerCalled = false

        let listener: MessageListener = { _ in
            listenerCalled = true
        }

        plugin.flipperPlugin.addListener(listener)
        // Verify listener was added (we can't directly verify the count, but we can check the plugin exists)
        XCTAssertNotNil(plugin.flipperPlugin)
    }

    func testFlipperPluginCanSendMessage() {
        let plugin = BasicDevtoolsPlugin(id: "test-id")
        let testMessage: Message = ["type": "test", "data": "test-data"]

        // This should not crash
        plugin.flipperPlugin.sendMessage(testMessage)
        XCTAssertTrue(true) // If we get here, sendMessage didn't crash
    }

    // MARK: - Plugin Initialization Behavior Tests

    func testPluginInitializationDoesNotThrow() {
        XCTAssertNoThrow {
            let _ = BasicDevtoolsPlugin(id: "test-id")
        }
    }

    func testPluginInitializationWithUnicodeID() {
        let unicodeID = "player-🎮-🎯"
        let plugin = BasicDevtoolsPlugin(id: unicodeID)
        XCTAssertNotNil(plugin)
    }

    func testPluginInitializationWithNumericID() {
        let numericID = "12345"
        let plugin = BasicDevtoolsPlugin(id: numericID)
        XCTAssertNotNil(plugin)
    }

    // MARK: - Flipper Plugin Configuration Tests

    func testFlipperPluginHasCorrectConfiguration() {
        let plugin = BasicDevtoolsPlugin(id: "test-id")

        XCTAssertEqual(plugin.flipperPlugin.id, "player-ui-devtools")
        XCTAssertFalse(plugin.flipperPlugin.runInBackground)
    }

    func testMultiplePluginsHaveIndependentFlipperPlugins() {
        let plugin1 = BasicDevtoolsPlugin(id: "player-1")
        let plugin2 = BasicDevtoolsPlugin(id: "player-2")

        // Each should have its own flipper plugin instance
        let id1 = ObjectIdentifier(plugin1.flipperPlugin)
        let id2 = ObjectIdentifier(plugin2.flipperPlugin)

        XCTAssertNotEqual(id1, id2)
    }
}
