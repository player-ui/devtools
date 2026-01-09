//
//  PolyfillPluginTests.swift
//  PolyfillPluginTests
//
//  Generated with Cursor by Koriann South - December 16, 2025
//

import XCTest
import JavaScriptCore
import PlayerUI
import PlayerUILogger
import PlayerUITestUtilitiesCore
@testable import PlayerUIDevtoolsUtilsSwiftUI

final class PolyfillPluginTests: XCTestCase {

    var plugin: PolyfillPlugin!

    override func setUpWithError() throws {
        plugin = PolyfillPlugin()
    }

    override func tearDownWithError() throws {
        plugin = nil
    }

    // MARK: - Initialization Tests

    func testPluginNameIsCorrect() throws {
        XCTAssertEqual(plugin.pluginName, "PolyfillPlugin")
    }

    // MARK: - Plugin Apply Tests

    func testApplyStoresContext() throws {
        let player = HeadlessPlayerImpl(plugins: [plugin])
        XCTAssertNotNil(plugin.context)
    }

    func testApplyAddsSetInterval() throws {
        let player = HeadlessPlayerImpl(plugins: [plugin])

        guard let context = plugin.context else {
            XCTFail("Plugin context should be set after apply")
            return
        }

        let setIntervalExists = context.objectForKeyedSubscript("setInterval")
        XCTAssertNotNil(setIntervalExists)
        XCTAssertTrue(setIntervalExists!.isObject)
    }

    func testApplyAddsClearInterval() throws {
        let player = HeadlessPlayerImpl(plugins: [plugin])

        guard let context = plugin.context else {
            XCTFail("Plugin context should be set after apply")
            return
        }

        let clearIntervalExists = context.objectForKeyedSubscript("clearInterval")
        XCTAssertNotNil(clearIntervalExists)
        XCTAssertTrue(clearIntervalExists!.isObject)
    }

    func testApplyAddsConsole() throws {
        let player = HeadlessPlayerImpl(plugins: [plugin])

        guard let context = plugin.context else {
            XCTFail("Plugin context should be set after apply")
            return
        }

        let consoleExists = context.objectForKeyedSubscript("console")
        XCTAssertNotNil(consoleExists)
        XCTAssertTrue(consoleExists!.isObject)
    }

    // MARK: - SetInterval Tests

    func testSetIntervalReturnsTimerId() throws {
        let player = HeadlessPlayerImpl(plugins: [plugin])

        guard let context = plugin.context else {
            XCTFail("Plugin context should be set after apply")
            return
        }

        let script = """
        var timerId = setInterval(function() {}, 100);
        timerId;
        """
        let result = context.evaluateScript(script)

        XCTAssertNotNil(result)
        XCTAssertTrue(result!.isNumber)
        XCTAssertGreaterThan(result!.toInt32(), 0)
    }

    func testSetIntervalWithDifferentDelays() throws {
        let player = HeadlessPlayerImpl(plugins: [plugin])

        guard let context = plugin.context else {
            XCTFail("Plugin context should be set after apply")
            return
        }

        let script = """
        var id1 = setInterval(function() {}, 100);
        var id2 = setInterval(function() {}, 200);
        [id1, id2];
        """
        let result = context.evaluateScript(script)

        XCTAssertNotNil(result)
        XCTAssertTrue(result!.isObject)
    }

    // MARK: - ClearInterval Tests

    func testClearIntervalCancelsTimer() throws {
        let player = HeadlessPlayerImpl(plugins: [plugin])

        guard let context = plugin.context else {
            XCTFail("Plugin context should be set after apply")
            return
        }

        let script = """
        var timerId = setInterval(function() {}, 100);
        clearInterval(timerId);
        true;
        """
        let result = context.evaluateScript(script)

        XCTAssertNotNil(result)
        XCTAssertTrue(result!.toBool())
    }

}

