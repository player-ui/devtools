import XCTest
import PlayerUI
import PlayerUIDevToolsPlugins
import PlayerUIDevToolsTypes
@testable import PlayerUIDevToolsBasicCoreWrapper

// MARK: - BasicDevtoolsCoreWrapperTests
final class BasicDevtoolsCoreWrapperTests: XCTestCase {

    var wrapper: BasicDevtoolsCoreWrapper!
    var mockHandler: MockDevtoolsHandler!
    let testPlayerID = "test-player-123"

    override func setUp() {
        super.setUp()
        mockHandler = MockDevtoolsHandler(isActive: true)
        wrapper = BasicDevtoolsCoreWrapper(playerID: testPlayerID, handler: mockHandler)
    }

    override func tearDown() {
        wrapper = nil
        mockHandler = nil
        super.tearDown()
    }

    // MARK: - Initialization Tests

    func testInitializationWithPlayerIDAndHandler() {
        XCTAssertNotNil(wrapper)
        XCTAssertNotNil(wrapper.options)
    }

    func testOptionsAreStoredCorrectly() {
        XCTAssertNotNil(wrapper.options)
    }

    func testInitializationWithInactiveHandler() {
        let inactiveHandler = MockDevtoolsHandler(isActive: false)
        let wrapperWithInactiveHandler = BasicDevtoolsCoreWrapper(
            playerID: "inactive-player",
            handler: inactiveHandler
        )

        XCTAssertNotNil(wrapperWithInactiveHandler)
        XCTAssertNotNil(wrapperWithInactiveHandler.options)
    }

    // MARK: - File URL Tests

    func testGetUrlForFileReturnsValidURL() {
        let url = wrapper.getUrlForFile(fileName: "BasicDevtoolsPlugin.native")
        XCTAssertNotNil(url)
    }

    func testGetUrlForFileWithCorrectExtension() {
        let url = wrapper.getUrlForFile(fileName: "BasicDevtoolsPlugin.native")
        XCTAssertNotNil(url)
        XCTAssertTrue(url?.pathExtension == "js")
    }

    func testGetUrlForFileWithNonexistentFile() {
        let url = wrapper.getUrlForFile(fileName: "NonexistentFile.native")
        // Should return nil for non-existent files
        XCTAssertNil(url)
    }

    // MARK: - Arguments Tests

    func testGetArgumentsReturnsArray() {
        let arguments = wrapper.getArguments()
        XCTAssertEqual(arguments.count, 1)
    }

    func testGetArgumentsContainsJSCompatibleOptions() {
        let arguments = wrapper.getArguments()
        XCTAssertEqual(arguments.count, 1)

        guard let jsCompatibleDict = arguments.first as? [String: Any] else {
            XCTFail("First argument should be a dictionary")
            return
        }

        XCTAssertTrue(jsCompatibleDict.keys.contains("playerID"))
        XCTAssertTrue(jsCompatibleDict.keys.contains("handler"))
    }

    func testGetArgumentsPlayerIDMatches() {
        let arguments = wrapper.getArguments()
        guard let jsCompatibleDict = arguments.first as? [String: Any] else {
            XCTFail("First argument should be a dictionary")
            return
        }

        XCTAssertEqual(jsCompatibleDict["playerID"] as? String, testPlayerID)
    }

    // MARK: - JSCompatible Options Tests

    func testJSCompatibleOptionsContainsPlayerID() {
        let jsCompatible = wrapper.options.jsCompatible
        XCTAssertEqual(jsCompatible["playerID"] as? String, testPlayerID)
    }

    func testJSCompatibleOptionsContainsHandler() {
        let jsCompatible = wrapper.options.jsCompatible
        XCTAssertTrue(jsCompatible.keys.contains("handler"))
    }

    func testJSCompatibleHandlerContainsRequiredFunctions() {
        let jsCompatible = wrapper.options.jsCompatible
        guard let handler = jsCompatible["handler"] as? [String: Any] else {
            XCTFail("Handler should be a dictionary")
            return
        }

        XCTAssertTrue(handler.keys.contains("checkIfDevtoolsIsActive"))
        XCTAssertTrue(handler.keys.contains("processInteraction"))
        XCTAssertTrue(handler.keys.contains("log"))
    }

    // MARK: - Multiple Instances Tests

    func testMultipleInstancesWithDifferentPlayerIDs() {
        let wrapper1 = BasicDevtoolsCoreWrapper(playerID: "player-1", handler: mockHandler)
        let wrapper2 = BasicDevtoolsCoreWrapper(playerID: "player-2", handler: mockHandler)

        XCTAssertNotNil(wrapper1)
        XCTAssertNotNil(wrapper2)
    }

    func testMultipleInstancesWithDifferentHandlers() {
        let handler1 = MockDevtoolsHandler(isActive: true)
        let handler2 = MockDevtoolsHandler(isActive: false)

        let wrapper1 = BasicDevtoolsCoreWrapper(playerID: "player", handler: handler1)
        let wrapper2 = BasicDevtoolsCoreWrapper(playerID: "player", handler: handler2)

        XCTAssertNotNil(wrapper1)
        XCTAssertNotNil(wrapper2)
    }
}

// MARK: - Mock DevtoolsHandler for Testing
class MockDevtoolsHandler: DevtoolsHandler {
    var isActive: Bool
    var processedInteractions: [Message] = []
    var loggedMessages: [String] = []

    init(isActive: Bool = true) {
        self.isActive = isActive
    }

    func processInteraction(interaction: Message) {
        processedInteractions.append(interaction)
    }

    func log(message: String) {
        loggedMessages.append(message)
    }
}