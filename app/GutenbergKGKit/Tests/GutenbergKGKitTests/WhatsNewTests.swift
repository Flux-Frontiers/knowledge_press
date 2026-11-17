// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// When the release notes appear after an update, and what they parse into.

import Foundation
import Testing

@testable import KnowledgePressUI

@Suite("What's new")
struct WhatsNewTests {

    private let sample = """
        # Release Notes -- v1.51.0

        > Released: 2026-11-20

        A lead paragraph.

        ### Added

        - **First.** One line
          continued.
        - Second.

        ---

        _Full changelog: [CHANGELOG.md](CHANGELOG.md)_
        """

    private func freshDefaults() -> UserDefaults {
        let name = "WhatsNewTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defaults.removePersistentDomain(forName: name)
        return defaults
    }

    @Test func parsesTheBlocksAndDropsTheFooter() throws {
        let notes = try #require(WhatsNew.parse(sample))
        #expect(notes.version == "1.51.0")
        #expect(notes.released == "2026-11-20")
        #expect(
            notes.blocks == [
                .paragraph("A lead paragraph."),
                .heading("Added"),
                .bullet("**First.** One line continued."),
                .bullet("Second."),
            ])
    }

    @Test func showsOnlyForANewerVersionThanTheLastSeen() {
        #expect(WhatsNew.shouldShow(current: "1.51.0", lastSeen: "1.50.0"))
        #expect(WhatsNew.shouldShow(current: "1.100.0", lastSeen: "1.99.2"))
        #expect(!WhatsNew.shouldShow(current: "1.50.0", lastSeen: "1.50.0"))
        #expect(!WhatsNew.shouldShow(current: "1.49.0", lastSeen: "1.50.0"))
        #expect(!WhatsNew.shouldShow(current: "1.51.0", lastSeen: nil))
    }

    @Test func aFreshInstallRecordsTheVersionAndShowsNothing() {
        let defaults = freshDefaults()
        let info = ["CFBundleShortVersionString": "1.51.0"]
        #expect(WhatsNew.pending(defaults: defaults, info: info, notesText: sample) == nil)
        #expect(defaults.string(forKey: WhatsNew.lastSeenKey) == "1.51.0")
    }

    @Test func anUpdateShowsTheNotesOnce() {
        let defaults = freshDefaults()
        defaults.set("1.50.0", forKey: WhatsNew.lastSeenKey)
        let info = ["CFBundleShortVersionString": "1.51.0"]
        #expect(WhatsNew.pending(defaults: defaults, info: info, notesText: sample)?.version == "1.51.0")
        #expect(WhatsNew.pending(defaults: defaults, info: info, notesText: sample) == nil)
    }

    @Test func notesForAnotherVersionAreNotShown() {
        let defaults = freshDefaults()
        defaults.set("1.50.0", forKey: WhatsNew.lastSeenKey)
        let info = ["CFBundleShortVersionString": "1.52.0"]
        #expect(WhatsNew.pending(defaults: defaults, info: info, notesText: sample) == nil)
    }

    @Test func theBundledNotesParse() throws {
        let text = try #require(WhatsNew.bundledText())
        let notes = try #require(WhatsNew.parse(text))
        #expect(!notes.blocks.isEmpty)
    }
}
