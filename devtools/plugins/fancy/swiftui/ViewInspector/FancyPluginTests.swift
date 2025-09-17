import XCTest
import SwiftUI
import ViewInspector
@testable import PlayerUI
@testable import PlayerUISwiftUI
@testable import ExampleFancyPlugin

@MainActor
class SwiftUIFancyPluginTests: XCTestCase {
    func testHasIsFancyTrueAsDefault() throws {
        let player = SwiftUIPlayer(flow: String.COUNTER, plugins: [FancyPlugin()])
        var baseView = TestView()

        let appear = baseView.on(\.didAppear) { view in
            let isFancy = try view.actualView().isFancy
            XCTAssert(isFancy)
        }

        guard let view: AnyView = player.hooks?.view.call(AnyView(baseView)) else {
            return XCTFail("no view returned from hook")
        }
        ViewHosting.host(view: view)
        wait(for: [appear], timeout: 2)
    }

    /// Test setting isFancy to false
    func testHasIsFancyFalse() {
        let player = SwiftUIPlayer(flow: String.COUNTER, plugins: [FancyPlugin(isFancy: false)])
        var baseView = TestView()

        let appear = baseView.on(\.didAppear) { view in
            let isFancy = try view.actualView().isFancy
            XCTAssertFalse(isFancy)
        }

        guard let view: AnyView = player.hooks?.view.call(AnyView(baseView)) else {
            return XCTFail("no view returned from hook")
        }
        ViewHosting.host(view: view)
        wait(for: [appear], timeout: 2)
    }
}

private struct TestView: View {
    @Environment(\.isFancy) var isFancy

    // For Testing Purposes
    internal var didAppear: ((Self) -> Void)?

    var body: some View {
        Text(isFancy ? "Fancy" : "Not Fancy").onAppear { didAppear?(self) }
    }
}

private extension String {
    static let COUNTER: String = """
    {
      "id": "counter-flow",
      "views": [
        {
          "id": "action",
          "type": "action",
          "exp": "{{count}} = {{count}} + 1",
          "label": {
            "asset": {
              "id": "action-label",
              "type": "text",
              "value": "Clicked {{count}} times"
            }
          }
        }
      ],
      "data": {
        "count": 0
      },
      "navigation": {
        "BEGIN": "FLOW_1",
        "FLOW_1": {
          "startState": "VIEW_1",
          "VIEW_1": {
            "state_type": "VIEW",
            "ref": "action",
            "transitions": {
              "*": "END_Done"
            },
            "attributes": { "test": "value" }
          },
          "END_Done": {
            "state_type": "END",
            "outcome": "done",
            "param": {
              "someKey": "someValue"
            },
            "extraKey": "extraValue",
            "extraObject": {
              "someInt": 1
            }
          }
        }
      }
    }
    """
}
