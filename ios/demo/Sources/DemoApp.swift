import SwiftUI
import Combine
import PlayerUI
import PlayerUISwiftUI
import SwiftFlipper
import PlayerUIDevToolsPlugins
import PlayerUIReferenceAssets

@main
struct BazelApp: App {
    @StateObject private var model = DemoViewModel()

    // This is a very basic demo implementation to help you get started
    var body: some Scene {
        WindowGroup {
            if #available(iOS 16.0, *) {
                NavigationStack {
                    PluginDemos(model: model, demos: demosFromMocks)
                }
            } else {
                // Fallback on earlier versions
            }
        }
    }

    // These demos just load the mocks directly with the basic asset plugin added
    private var demosFromMocks: [Demo] {
        guard let mocksPath = Bundle.mocks?.resourcePath else {
            return []
        }
        let paths = getFlowPaths(from: mocksPath)
        return paths.map { path in
            var relativePath = String(path
                .dropFirst(mocksPath.count) // Remove the absolute path
                .dropLast(5) // Remove the ".json"
            )
            // Remove leading slash if present
            if relativePath.hasPrefix("/") {
                relativePath = String(relativePath.dropFirst())
            }
            return Demo(name: relativePath, flows: [.file(relativePath)])
        }
    }

    /// Return the absolute paths to every flow
    private func getFlowPaths(from path: String) -> [String] {
        let children = try? FileManager.default.contentsOfDirectory(atPath: path)
        let paths: [[String]] = children?.compactMap { child in
            let path = "\(path)/\(child)"
            if child.hasSuffix(".json") {
                return [path]
            }
            return getFlowPaths(from: path)
        } ?? [[]]
        return paths.reduce([]) { $0 + $1 }
    }
}

/// View model for the demo app
class DemoViewModel: ObservableObject {
    private let flipperClient = FlipperClient(connectionConfig: .init(), plugins: [])
    let flipperPlugin = DevtoolsFlipperPlugin()

    // -- Used to debounce the search query input. -- //
    // The input in the search field
    @Published var searchQuery = ""
    // The search query to use for filtering. This is updated on a debounce schedule
    @Published var debouncedSearchQuery = ""

    init() {
        flipperClient.addPlugin(flipperPlugin)
        flipperClient.connectToFlipper()
        flipperPlugin.addListener(onMessageReceived(_:))

        $searchQuery
            .debounce(for: .seconds(0.5), scheduler: RunLoop.main)
            .assign(to: &$debouncedSearchQuery)
    }

    func onMessageReceived(_ message: [String: Any]) {
        print("DEBUG [DemoViewModel]: onMessageReceived() called with message: \(message)")
//        Task {
//            print("DEVTOOLS DEMO: '\(message)'")
//        }
    }
}

extension Bundle {
    /// The bundle containing all the mocks for this app. These are all in the their final JSON format.
    static var mocks: Self? {
        guard let path = Bundle.main.path(forResource: "Mocks", ofType: "bundle") else {
            return nil
        }
        return Self(path: path)
    }
}
