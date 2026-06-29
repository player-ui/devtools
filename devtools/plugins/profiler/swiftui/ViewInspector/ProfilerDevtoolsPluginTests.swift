import XCTest
import PlayerUI
import JavaScriptCore
import PlayerUIDevtoolsTypes
import PlayerUIDevtoolsPlugin
import PlayerUIDevtoolsBaseProfilerDevtoolsPlugin
@testable import PlayerUIDevtoolsProfilerPlugin

// MARK: - ProfilerDevtoolsPluginTests
final class ProfilerDevtoolsPluginTests: XCTestCase {

    func testPluginNameIsProfilerDevtoolsPlugin() {
        let plugin = ProfilerDevtoolsPlugin(id: "test-id")
        XCTAssertEqual(plugin.pluginName, "ProfilerDevtoolsPlugin.ProfilerDevtoolsPlugin")
    }

    // MARK: - Initialization Tests

    func testInitializationWithValidID() {
        let testID = "player-123"
        let plugin = ProfilerDevtoolsPlugin(id: testID)
        XCTAssertNotNil(plugin)
    }

    func testInitializationWithEmptyID() {
        let plugin = ProfilerDevtoolsPlugin(id: "")
        XCTAssertNotNil(plugin)
    }

    func testInitializationWithSpecialCharactersInID() {
        let testID = "player-@#$%^&*()"
        let plugin = ProfilerDevtoolsPlugin(id: testID)
        XCTAssertNotNil(plugin)
    }

    func testInitializationWithLongID() {
        let testID = String(repeating: "a", count: 1000)
        let plugin = ProfilerDevtoolsPlugin(id: testID)
        XCTAssertNotNil(plugin)
    }

    // MARK: - Flipper Plugin Tests

    func testFlipperPluginIsInitialized() {
        let plugin = ProfilerDevtoolsPlugin(id: "test-id")
        XCTAssertNotNil(plugin.flipperPlugin)
    }

    func testFlipperPluginIDIsCorrect() {
        let plugin = ProfilerDevtoolsPlugin(id: "test-id")
        XCTAssertEqual(plugin.flipperPlugin.id, "player-ui-devtools")
    }

    func testFlipperPluginDoesNotRunInBackground() {
        let plugin = ProfilerDevtoolsPlugin(id: "test-id")
        XCTAssertFalse(plugin.flipperPlugin.runInBackground)
    }

    // MARK: - Multiple Instance Tests

    func testMultiplePluginInstancesWithDifferentIDs() {
        let plugin1 = ProfilerDevtoolsPlugin(id: "player-1")
        let plugin2 = ProfilerDevtoolsPlugin(id: "player-2")

        XCTAssertNotNil(plugin1)
        XCTAssertNotNil(plugin2)
        XCTAssertFalse(plugin1 === plugin2)
    }

    func testEachPluginInstanceHasOwnFlipperPlugin() {
        let plugin1 = ProfilerDevtoolsPlugin(id: "player-1")
        let plugin2 = ProfilerDevtoolsPlugin(id: "player-2")

        XCTAssertNotEqual(ObjectIdentifier(plugin1.flipperPlugin), ObjectIdentifier(plugin2.flipperPlugin))
    }

    // MARK: - Plugin Name Tests

    func testPluginNameConsistency() {
        let plugin1 = ProfilerDevtoolsPlugin(id: "id-1")
        let plugin2 = ProfilerDevtoolsPlugin(id: "id-2")

        XCTAssertEqual(plugin1.pluginName, plugin2.pluginName)
        XCTAssertEqual(plugin1.pluginName, "ProfilerDevtoolsPlugin.ProfilerDevtoolsPlugin")
    }

    // MARK: - Flipper Plugin Configuration Tests

    func testFlipperPluginHasCorrectConfiguration() {
        let plugin = ProfilerDevtoolsPlugin(id: "test-id")

        XCTAssertEqual(plugin.flipperPlugin.id, "player-ui-devtools")
        XCTAssertFalse(plugin.flipperPlugin.runInBackground)
    }

    func testMultiplePluginsHaveIndependentFlipperPlugins() {
        let plugin1 = ProfilerDevtoolsPlugin(id: "player-1")
        let plugin2 = ProfilerDevtoolsPlugin(id: "player-2")

        let id1 = ObjectIdentifier(plugin1.flipperPlugin)
        let id2 = ObjectIdentifier(plugin2.flipperPlugin)

        XCTAssertNotEqual(id1, id2)
    }

    // MARK: - Deinit Tests

    func testDeinitRemovesListeners() {
        let flipperPlugin = DevtoolsFlipperPlugin()
        var plugin: ProfilerDevtoolsPlugin? = ProfilerDevtoolsPlugin(id: "test-id", flipperPlugin: flipperPlugin)

        let listenerID = flipperPlugin.addListener { _ in }
        plugin?.listeners.append(listenerID)

        XCTAssertEqual(flipperPlugin.listeners.count, 1)

        plugin = nil

        XCTAssertEqual(flipperPlugin.listeners.count, 0)
    }

    func testDeinitDestroysMessenger() {
        let flipperPlugin = DevtoolsFlipperPlugin()
        var plugin: ProfilerDevtoolsPlugin? = ProfilerDevtoolsPlugin(id: "test-id", flipperPlugin: flipperPlugin)

        plugin = nil

        if let jsException = plugin?.context?.exception {
            XCTFail("Destroy failed")
        }
    }
}

extension ProfilerDevtoolsPlugin {
    convenience init(id: String) {
        self.init(id: id, flipperPlugin: .init())
    }
}
