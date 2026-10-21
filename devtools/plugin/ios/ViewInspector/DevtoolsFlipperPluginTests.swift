import XCTest
@testable import PlayerUIDevtoolsPlugin

final class DevtoolsFlipperPluginRegistrationTests: XCTestCase {
    private var flipperPlugin: DevtoolsFlipperPlugin!

    override func setUp() {
        flipperPlugin = DevtoolsFlipperPlugin()
    }

    override func tearDown() {
        flipperPlugin = nil
    }

    func testRegisteringAReplacementDisconnectsThePreviousPlugin() {
        let old = FakeDisconnectable()
        let new = FakeDisconnectable()

        flipperPlugin.register(old, playerID: "player", kind: "basic")
        flipperPlugin.register(new, playerID: "player", kind: "basic")

        XCTAssertEqual(old.disconnectCount, 1)
        XCTAssertEqual(new.disconnectCount, 0)
    }

    func testRegisteringTheSamePluginTwiceDoesNotDisconnectIt() {
        let plugin = FakeDisconnectable()

        flipperPlugin.register(plugin, playerID: "player", kind: "basic")
        flipperPlugin.register(plugin, playerID: "player", kind: "basic")

        XCTAssertEqual(plugin.disconnectCount, 0)
    }

    func testDifferentKindsForTheSamePlayerCoexist() {
        let basic = FakeDisconnectable()
        let profiler = FakeDisconnectable()

        flipperPlugin.register(basic, playerID: "player", kind: "basic")
        flipperPlugin.register(profiler, playerID: "player", kind: "profiler")

        XCTAssertEqual(basic.disconnectCount, 0)
        XCTAssertEqual(profiler.disconnectCount, 0)
    }

    /// A different player ID is a different player, so it is left alone.
    func testDifferentPlayerIDsCoexist() {
        let first = FakeDisconnectable()
        let second = FakeDisconnectable()

        flipperPlugin.register(first, playerID: "player-1", kind: "basic")
        flipperPlugin.register(second, playerID: "player-2", kind: "basic")

        XCTAssertEqual(first.disconnectCount, 0)
        XCTAssertEqual(second.disconnectCount, 0)
    }

    func testUnregisteredPluginIsNotDisconnectedByAReplacement() {
        let old = FakeDisconnectable()
        let new = FakeDisconnectable()

        flipperPlugin.register(old, playerID: "player", kind: "basic")
        flipperPlugin.unregister(old)
        flipperPlugin.register(new, playerID: "player", kind: "basic")

        XCTAssertEqual(old.disconnectCount, 0)
    }

    func testPluginsAreHeldWeakly() {
        var old: FakeDisconnectable? = FakeDisconnectable()
        weak var weakOld = old
        flipperPlugin.register(old!, playerID: "player", kind: "basic")

        old = nil

        XCTAssertNil(weakOld)
        // Replacing a plugin that is already gone must not crash
        flipperPlugin.register(FakeDisconnectable(), playerID: "player", kind: "basic")
    }

    /// Disconnecting a plugin calls `unregister`, which must not deadlock.
    func testDisconnectingWhileBeingReplacedCanUnregister() {
        let flipperPlugin = self.flipperPlugin!
        let old = FakeDisconnectable { flipperPlugin.unregister($0) }

        flipperPlugin.register(old, playerID: "player", kind: "basic")
        flipperPlugin.register(FakeDisconnectable(), playerID: "player", kind: "basic")

        XCTAssertEqual(old.disconnectCount, 1)
    }
}

private final class FakeDisconnectable: FlipperDisconnectable {
    private(set) var disconnectCount = 0
    private let onDisconnect: (FakeDisconnectable) -> Void

    init(onDisconnect: @escaping (FakeDisconnectable) -> Void = { _ in }) {
        self.onDisconnect = onDisconnect
    }

    func disconnect() {
        disconnectCount += 1
        onDisconnect(self)
    }
}
