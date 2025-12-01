import XCTest
import PlayerUI
import PlayerUIDevToolsTypes
@testable import PlayerUIDevToolsBasicPlugin

// MARK: - BasicDevtoolsPluginTests
final class BasicDevtoolsPluginTests: XCTestCase {

    func testPluginNameIsBasicDevtoolsPlugin() {
        let plugin = BasicDevtoolsPlugin(id: "test-id")
        XCTAssertEqual(plugin.pluginName, "BasicDevtoolsPlugin.BasicDevtoolsPlugin")
    }
}
