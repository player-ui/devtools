//
//  MessengerTests.swift
//  MessengerTests
//
//  Generated with Cursor by Koriann South - September 23, 2025
//

import XCTest
import JavaScriptCore
@testable import PlayerUIDevToolsFancy

final class FancyTests: XCTestCase {
    func testFancyInitializesWithName() throws {
        let fancy = try Fancy(name: "TestName")
        XCTAssertEqual(try fancy.getName(), "TestName", "Fancy should return the name it was initialized with")
    }

    func testFancyInitialCountIsZero() throws {
        let fancy = try Fancy(name: "CountTest")
        XCTAssertEqual(try fancy.getCount(), 0, "Initial count should be zero")
    }

    func testFancyAddToCountIncrements() throws {
        let fancy = try Fancy(name: "IncrementTest")
        fancy.addToCount(n: 5)
        XCTAssertEqual(try fancy.getCount(), 5, "Count should increment by 5")
        fancy.addToCount(n: 3)
        XCTAssertEqual(try fancy.getCount(), 8, "Count should increment by 3 more")
    }

    func testFancyAddToCountDecrements() throws {
        let fancy = try Fancy(name: "DecrementTest")
        fancy.addToCount(n: 10)
        fancy.addToCount(n: -4)
        XCTAssertEqual(try fancy.getCount(), 6, "Count should decrement by 4")
    }
}
