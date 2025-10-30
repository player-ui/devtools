//
//  SwiftUIView.swift
//  DemoApp
//
//  Created by Koriann South on 2025-07-11.
//

import SwiftUI
import PlayerUI

struct PluginDemos: View {
    @ObservedObject var model: DemoViewModel
    let demos: [Demo]

    @State private var filteredDemos: [Demo] = []

    var body: some View {
        List {
            Section("Mocks") {
                let demosToShow = filteredDemos.isEmpty ? demos : filteredDemos
                ForEach(demosToShow, id: \.name) { demo in
                    NavigationLink {
                        FlowManagerView(
                            flowSequence: demo.flows,
                            navTitle: demo.navTitle,
                            plugins: demo.plugins
                        )
                    } label: {
                        Text(demo.name)
                    }
                }
            }
        }
        .searchable(text: $model.searchQuery)
        .autocorrectionDisabled()
        .textInputAutocapitalization(.never)
        .onChange(of: model.debouncedSearchQuery) { searchQuery in
            filteredDemos = demos.filter { demo in
                demo.name.localizedCaseInsensitiveContains(searchQuery)
            }
        }
    }
}

/// A representation of each demo
struct Demo {
    /// The name of this demo. This is what will appear in the list of demos.
    /// This should be unique. This is what will be used to identify the demo for testing.
    /// E.g. if this is "action counter", a UI test can open it with `openFlow("action counter")`
    let name: String
    /// The json / flows belonging to this demo experience, in order of navigation.
    /// I.e. the first flow will appear first.
    let flows: [Flow]
    /// This will be shown in the navigation bar during the demo
    let navTitle: String
    /// Any plugins to be used in the demo. If none are provided, we'll default to loading all of the assets
    let plugins: [NativePlugin]

    init(name: String, flows: [Flow], navTitle: String? = nil, plugins: [NativePlugin] = .defaults) {
        self.name = name
        self.flows = flows
        self.navTitle = navTitle ?? name
        self.plugins = plugins
    }
}

/// A representation of a single-page or multi-page experience
enum Flow {
    /// A flow that is defined by a string literal
    case literal(String)
    /// A flow that is defined by a path to the file in the mocks bundle.
    /// This path should be relative and NOT include the ".json" extension.
    /// E.g. fancy-dog/basic
    case file(String)

    var value: String {
        switch self {
        case .literal(let value):
            return value
        case .file(let filename):
            guard let path = Bundle.mocks?.path(forResource: filename, ofType: "json"),
                  let flow = try? String(contentsOfFile: path)
            else {
                print("Could not find file \(filename).json in mocks bundle")
                return ""
            }
            return flow
        }
    }
}

extension [NativePlugin] {
    /// The list of all plugins to load in a demo, if none are specifically provided.
    static let defaults: [NativePlugin] = [
        // TODO: Add all plugins here
        // No plugins defined yet for devtools
    ]
}
