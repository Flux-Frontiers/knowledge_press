// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Where a book was left and its bookmarks: adding, removing, listing in
// reading order, dropping places in chapters a book no longer has, and
// surviving a relaunch.

import Foundation
import Testing

@testable import KnowledgePressUI

@MainActor
@Suite("Reading marks")
struct ReadingMarksTests {
    private let key = ReadingMarks.key(genre: "fiction", book: "moby")
    private let chapters = ["c1", "c2", "c3"]

    private func mark(_ section: String, _ block: Int) -> ReadingMark {
        ReadingMark(sectionId: section, block: block, chapterTitle: section)
    }

    @Test("a place is bookmarked once")
    func addOnce() {
        var marks = ReadingMarks()
        let first = marks.add(key, mark("c1", 4))
        let again = marks.add(key, mark("c1", 4))
        #expect(first)
        #expect(!again)
        #expect(marks.isMarked(key, sectionId: "c1", block: 4))
        #expect(marks.saved[key]?.count == 1)
    }

    @Test("removing the last bookmark drops the book's entry")
    func remove() {
        var marks = ReadingMarks()
        let m = mark("c2", 0)
        marks.add(key, m)
        marks.remove(key, id: m.id)
        #expect(marks.saved[key] == nil)
        #expect(!marks.isMarked(key, sectionId: "c2", block: 0))
    }

    @Test("bookmarks list in reading order, without chapters the book lost")
    func readingOrder() {
        var marks = ReadingMarks()
        marks.add(key, mark("c3", 1))
        marks.add(key, mark("gone", 0))
        marks.add(key, mark("c1", 9))
        marks.add(key, mark("c1", 2))
        let listed = marks.bookmarks(key, in: chapters).map { "\($0.sectionId):\($0.block)" }
        #expect(listed == ["c1:2", "c1:9", "c3:1"])
    }

    @Test("the last place is offered only while its chapter exists")
    func lastPlace() {
        var marks = ReadingMarks()
        marks.leave(key, at: mark("c2", 7))
        #expect(marks.lastPlace(key, in: chapters)?.block == 7)
        #expect(marks.lastPlace(key, in: ["c1"]) == nil)
        #expect(marks.lastPlace("other/book", in: chapters) == nil)
    }

    @Test("an excerpt is cut at a word and keeps short text whole")
    func excerpt() {
        #expect(ReadingMarks.excerpt("Call me\n  Ishmael.") == "Call me Ishmael.")
        let long = String(repeating: "whale ", count: 40)
        let cut = ReadingMarks.excerpt(long)
        #expect(cut.hasSuffix("whale..."))
        #expect(cut.count <= ReadingMarks.excerptLength + 3)
    }

    @Test("marks survive a relaunch and a settings reset")
    func persists() {
        let name = "ReadingMarksTests.\(UUID().uuidString)"
        let previous = AppModel.defaults
        AppModel.defaults = UserDefaults(suiteName: name)!
        defer {
            AppModel.defaults = previous
            UserDefaults.standard.removePersistentDomain(forName: name)
        }
        let first = AppModel()
        first.readingMarks.add(key, mark("c1", 3))
        first.readingMarks.leave(key, at: mark("c2", 5))
        first.resetAllSettings()
        let second = AppModel()
        #expect(second.readingMarks.isMarked(key, sectionId: "c1", block: 3))
        #expect(second.readingMarks.last[key]?.block == 5)
    }
}
