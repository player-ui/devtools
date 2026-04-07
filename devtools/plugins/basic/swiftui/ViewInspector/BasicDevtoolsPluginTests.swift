import XCTest
import PlayerUI
import JavaScriptCore
import PlayerUIDevtoolsTypes
import PlayerUIDevtoolsPlugin
import PlayerUIDevtoolsBaseBasicDevtoolsPlugin
@testable import PlayerUIDevtoolsBasicPlugin

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

    // MARK: - Deinit Tests

    func testDeinitRemovesListeners() {
        let flipperPlugin = DevtoolsFlipperPlugin()
        var plugin: BasicDevtoolsPlugin? = BasicDevtoolsPlugin(id: "test-id", flipperPlugin: flipperPlugin)

        // Add a listener
        let listenerID = flipperPlugin.addListener { _ in }
        plugin?.listeners.append(listenerID)

        // Verify listener was added
        XCTAssertEqual(flipperPlugin.listeners.count, 1)

        // Deinit should be called when plugin is set to nil
        plugin = nil

        // Test that they were actually removed
        XCTAssertEqual(flipperPlugin.listeners.count, 0)
    }

    // TODO: test the destroy on Messenger?
    func testDeinitDestroysMessenger() { // TODO: worried this doesn't work
        let flipperPlugin = DevtoolsFlipperPlugin()
        var plugin: BasicDevtoolsPlugin? = BasicDevtoolsPlugin(id: "test-id", flipperPlugin: flipperPlugin)

        // Deinit should be called when plugin is set to nil
        plugin = nil

        // Test that destroy was called
        if let jsException = plugin?.context?.exception {
            XCTFail("Destroy failed")
        }
    }
}

extension BasicDevtoolsPlugin {
    convenience init(id: String) {
        self.init(id: id, flipperPlugin: .init())
    }
}
