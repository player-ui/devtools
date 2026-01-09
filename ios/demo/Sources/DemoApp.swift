import SwiftUI
import Combine
import PlayerUI
import PlayerUISwiftUI
import PlayerUIPrintLoggerPlugin
import SwiftFlipper
import PlayerUIDevtoolsPlugins
import PlayerUIReferenceAssets
import PlayerUIDevtoolsBasicPlugin

@main
struct BazelApp: App {
    @StateObject private var model = DemoViewModel()

    var body: some Scene {
        WindowGroup {
            if #available(iOS 16.0, *) {
                NavigationStack {
                    PluginDemos(model: model, demos: demosFromMocks)
                    resetPlugins
                }
            } else { /* Not implementing a fallback for the demo. */ }
        }
    }

    private var resetPlugins: some View {
        VStack {
            Text("BasicDevtoolsPlugin id:")
                .frame(maxWidth: .infinity, alignment: .center)
            Text("\(model.devtoolsPluginID)")
                .font(.callout)
                .frame(maxWidth: .infinity, alignment: .center)
            Button("New Flipper Plugin") {  model.resetPlugins() }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity, alignment: .center)
            Text(String.explanation)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .multilineTextAlignment(.leading)
        .padding()
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
    /// Our connection to flipper
    private let flipperClient = FlipperClient(connectionConfig: .init(), plugins: [])
    /// A plugin that allows us to use the connectiont o flipper
    let flipperPlugin = DevtoolsFlipperPlugin()
    /// The list of all player plugins to load in a demo, if none are specifically provided.
    @Published private(set) var defaultPlugins: [NativePlugin]
    private(set) var devtoolsPluginID: String

    // -- Used to debounce the search query input. -- //
    // The input in the search field
    @Published var searchQuery = ""
    // The search query to use for filtering. This is updated on a debounce schedule
    @Published var debouncedSearchQuery = ""

    init() {
        devtoolsPluginID = "demo"
        defaultPlugins = [
            ReferenceAssetsPlugin(),
            PrintLoggerPlugin(level: .debug),
            BasicDevtoolsPlugin(id: devtoolsPluginID, flipperPlugin: flipperPlugin)
        ]

        flipperClient.addPlugin(flipperPlugin)
        flipperClient.connectToFlipper()

        $searchQuery
            .debounce(for: .seconds(0.5), scheduler: RunLoop.main)
            .assign(to: &$debouncedSearchQuery)
    }

    /// Discard the previous set of plugins and make a new set.
    ///
    /// This allows us to test that the BasicDevtoolsPlugin is cleaned up properly.
    func resetPlugins() {
        devtoolsPluginID = "demo-\(UUID().uuidString)"
        defaultPlugins = [
            ReferenceAssetsPlugin(),
            PrintLoggerPlugin(level: .debug),
            BasicDevtoolsPlugin(id: devtoolsPluginID, flipperPlugin: flipperPlugin)
        ]
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

private extension String {
    static let explanation = "Disconnect the previous BasicDevtoolsPlugin and replace it with a new one. The old plugin should disappear from the Flipper dropdown, and a new one should appear. **NOTE:** You must click into a flow to instantiate the new plugin."
}
