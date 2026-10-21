import XCTest
import PlayerUI
import PlayerUITestUtilitiesCore
import JavaScriptCore
import SwiftFlipper
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

// MARK: - Disconnect Tests

final class BasicDevtoolsPluginDisconnectTests: XCTestCase {
    private static let initType = "PLAYER_DEVTOOLS_PLAYER_INIT"
    private static let stoppedType = "PLAYER_DEVTOOLS_PLAYER_STOPPED"

    private var flipperPlugin: DevtoolsFlipperPlugin!
    private var bus: RecordingMessageBus!

    override func setUp() {
        flipperPlugin = DevtoolsFlipperPlugin()
        bus = RecordingMessageBus()
        flipperPlugin.didConnect(connection: FlipperConnection(pluginId: flipperPlugin.id, client: bus))
    }

    override func tearDown() {
        flipperPlugin = nil
        bus = nil
    }

    /// Messages reach flipper asynchronously, so wait for them.
    private func waitUntil(_ condition: () -> Bool) {
        let deadline = Date().addingTimeInterval(5)
        while !condition() && Date() < deadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.01))
        }
    }

    /// Wait a moment, to check that something does *not* happen.
    private func settle() {
        RunLoop.current.run(until: Date().addingTimeInterval(0.3))
    }

    private func count(_ type: String) -> Int {
        bus.eventTypes.filter { $0 == type }.count
    }

    func testDisconnectIsIdempotentAndReleasesResources() {
        let plugin = BasicDevtoolsPlugin(id: "test-id", flipperPlugin: flipperPlugin)
        plugin.listeners.append(flipperPlugin.addListener { _ in })

        plugin.disconnect()
        plugin.disconnect()

        XCTAssertNil(plugin.messenger)
        XCTAssertTrue(plugin.listeners.isEmpty)
        XCTAssertTrue(flipperPlugin.listeners.isEmpty)
    }

    func testDisconnectTellsDevtoolsThePlayerStopped() {
        let plugin = BasicDevtoolsPlugin(id: "test-id", flipperPlugin: flipperPlugin)
        let player = HeadlessPlayerImpl(plugins: [plugin])
        XCTAssertNotNil(player)
        waitUntil { count(Self.initType) == 1 }
        XCTAssertEqual(count(Self.stoppedType), 0)

        plugin.disconnect()
        plugin.disconnect()
        waitUntil { count(Self.stoppedType) >= 1 }
        settle()

        XCTAssertEqual(count(Self.stoppedType), 1)
        XCTAssertLessThan(
            bus.eventTypes.firstIndex(of: Self.initType)!,
            bus.eventTypes.firstIndex(of: Self.stoppedType)!
        )
        let stopped = bus.events.first { $0["type"] as? String == Self.stoppedType }
        XCTAssertEqual(stopped?["sender"] as? String, "test-id")
        // Says which plugin stopped, so the player stays until all its plugins are gone
        XCTAssertNotNil((stopped?["payload"] as? [String: Any])?["pluginID"] as? String)
    }

    func testDeinitTellsDevtoolsThePlayerStopped() {
        // The player doesn't keep its plugins alive, so hold on to it like an app would
        var plugin: BasicDevtoolsPlugin? = BasicDevtoolsPlugin(id: "test-id", flipperPlugin: flipperPlugin)
        var player: HeadlessPlayerImpl? = HeadlessPlayerImpl(plugins: [plugin!])
        XCTAssertNotNil(player)
        waitUntil { count(Self.initType) == 1 }
        XCTAssertEqual(count(Self.stoppedType), 0)

        player = nil
        plugin = nil

        waitUntil { count(Self.stoppedType) >= 1 }
        XCTAssertEqual(count(Self.stoppedType), 1)
    }

    func testDisconnectBeforeApplySendsNothing() {
        let plugin = BasicDevtoolsPlugin(id: "test-id", flipperPlugin: flipperPlugin)

        plugin.disconnect()
        settle()

        XCTAssertEqual(count(Self.stoppedType), 0)
    }

    /// A new plugin with the same ID must retire the old one first, or the old one's "stopped" would remove the new player.
    func testReplacingAPluginWithTheSameIDStopsTheOldOneBeforeTheNewOneInits() {
        var old: BasicDevtoolsPlugin? = BasicDevtoolsPlugin(id: "same-id", flipperPlugin: flipperPlugin)
        var oldPlayer: HeadlessPlayerImpl? = HeadlessPlayerImpl(plugins: [old!])
        XCTAssertNotNil(oldPlayer)
        waitUntil { count(Self.initType) == 1 }

        let new = BasicDevtoolsPlugin(id: "same-id", flipperPlugin: flipperPlugin)
        let newPlayer = HeadlessPlayerImpl(plugins: [new])
        XCTAssertNotNil(newPlayer)
        waitUntil { count(Self.initType) == 2 }
        settle()

        XCTAssertEqual(
            bus.eventTypes.filter { $0 == Self.initType || $0 == Self.stoppedType },
            [Self.initType, Self.stoppedType, Self.initType]
        )
        XCTAssertNil(old?.messenger)
        XCTAssertNotNil(new.messenger)

        // Releasing the old one later must not stop the new one
        bus.clear()
        oldPlayer = nil
        old = nil
        settle()
        XCTAssertEqual(count(Self.stoppedType), 0)
        XCTAssertNotNil(new.messenger)
    }

    func testPluginsForDifferentIDsDoNotStopEachOther() {
        let first = BasicDevtoolsPlugin(id: "id-1", flipperPlugin: flipperPlugin)
        let second = BasicDevtoolsPlugin(id: "id-2", flipperPlugin: flipperPlugin)
        let players = [HeadlessPlayerImpl(plugins: [first]), HeadlessPlayerImpl(plugins: [second])]
        XCTAssertEqual(players.count, 2)
        waitUntil { count(Self.initType) == 2 }
        settle()

        XCTAssertEqual(count(Self.stoppedType), 0)
        XCTAssertNotNil(first.messenger)
        XCTAssertNotNil(second.messenger)
    }
}

/// Records what is sent over a fake flipper connection. Thread safe.
private final class RecordingMessageBus: FlipperMessageBus {
    private let lock = NSLock()
    private var recorded: [[String: Any]] = []

    var events: [[String: Any]] {
        lock.lock()
        defer { lock.unlock() }
        return recorded
    }

    var eventTypes: [String] { events.compactMap { $0["type"] as? String } }

    func clear() {
        lock.lock()
        defer { lock.unlock() }
        recorded.removeAll()
    }

    func sendMessage(message: [String: Any]) {
        guard let params = message["params"] as? [String: Any],
              params["method"] as? String == "message::plugin",
              let event = params["params"] as? [String: Any]
        else { return }
        lock.lock()
        defer { lock.unlock() }
        recorded.append(event)
    }
}

extension BasicDevtoolsPlugin {
    convenience init(id: String) {
        self.init(id: id, flipperPlugin: .init())
    }
}
