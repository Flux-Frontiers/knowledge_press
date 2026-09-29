// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// When the Render button is offered: hidden with no worker address, held at
// "checking" until a probe answers, and disabled with a reason when the
// worker cannot be reached.

import Foundation
import Testing

@testable import GutenbergKGKit
@testable import KnowledgePressUI

@MainActor
@Suite("Render availability")
struct RenderAvailabilityTests {

    private func withScratchDefaults(_ body: () async -> Void) async {
        let name = "RenderAvailabilityTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        let previous = AppModel.defaults
        AppModel.defaults = defaults
        defer {
            AppModel.defaults = previous
            UserDefaults.standard.removePersistentDomain(forName: name)
        }
        await body()
    }

    @Test("no worker address means the button is not offered")
    func unconfigured() async {
        await withScratchDefaults {
            let model = AppModel()
            model.workerURLString = "  "
            #expect(model.renderAvailability == .unconfigured)
            await model.refreshImageBackends()
            #expect(model.renderAvailability == .unconfigured)
        }
    }

    @Test("a new address is unknown until it has been probed")
    func newAddressIsChecking() async {
        await withScratchDefaults {
            let model = AppModel()
            model.workerURLString = "http://127.0.0.1:1"
            #expect(model.renderAvailability == .checking)
        }
    }

    @Test("an unreachable worker disables Render with a reason")
    func unreachable() async {
        await withScratchDefaults {
            let model = AppModel()
            // Port 1 refuses the connection at once, so this does not wait
            // out the availability timeout.
            model.workerURLString = "http://127.0.0.1:1"
            await model.refreshImageBackends()
            #expect(model.renderAvailability == .unavailable("Cannot reach the worker."))
            #expect(model.imageBackends.isEmpty)
        }
    }

    @Test("an unreachable worker does not reset the stored backend choice")
    func unreachableKeepsChoice() async {
        await withScratchDefaults {
            let model = AppModel()
            model.imageBackendChoice = "openai"
            model.workerURLString = "http://127.0.0.1:1"
            await model.refreshImageBackends()
            #expect(model.imageBackendChoice == "openai")
        }
    }

    @Test("clearing the address hides the button again")
    func clearedAddress() async {
        await withScratchDefaults {
            let model = AppModel()
            model.workerURLString = "http://127.0.0.1:1"
            await model.refreshImageBackends()
            model.workerURLString = ""
            #expect(model.renderAvailability == .unconfigured)
        }
    }
}
