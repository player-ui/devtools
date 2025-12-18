//
//  FlowManagerView.swift
//  Pods
//
//  Created by Zhao Xia Wu on 2023-11-01.
//

import SwiftUI
import PlayerUI
import PlayerUISwiftUI

/** SwiftUI View to wrap the `ManagedPlayer` and handle the result for use in UI testing */
struct FlowManagerView: View {
    /// The json / flows belonging to this demo experience, in order of navigation.
    /// I.e. the first flow will appear first.
    let flowSequence: [Flow]
    /// This will be shown in the navigation bar during the demo
    let navTitle: String
    /// Any plugins to be used in the demo
    let plugins: [NativePlugin]

    @State private var isComplete = false

    public var body: some View {
        VStack {
            if isComplete {
                completed
            } else {
                VStack {
                    ManagedPlayer(
                        plugins: plugins,
                        flowManager: ConstantFlowManager(flows),
                        onComplete: { _ in
                            isComplete = true
                        },
                        fallback: fallback(context:),
                        loading: {
                            Text("Loading Flow")
                        }
                    )

                    Button("Terminate Flow") { isComplete = true }
                }.padding()
            }
        }.navigationBarTitle(Text(navTitle))
    }

    private var flows: [String] { flowSequence.map { $0.value } }

    private var completed: some View {
        VStack {
            Text("Flow Completed").font(.title)
            Button("Start Over") { isComplete = false }
        }
    }

    private func fallback(context: ManagedPlayerErrorContext) -> some View {
        VStack {
            Text(context.error.localizedDescription)

            switch context.error as? PlayerError {
            case .promiseRejected(error: let errorState) :
                Text(errorState.error)
            default:
                EmptyView()
            }

            Button("Retry", action: context.retry)
            Button("Reset", action: context.reset)
        }.accessibility(identifier: "FallbackView")
    }
}
