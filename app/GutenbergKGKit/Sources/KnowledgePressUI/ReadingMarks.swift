// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Where each book was left, and the places a reader marked in it.
//
// A place is a chapter and a block (a paragraph, a stanza, a heading) in it,
// not a scroll offset: a block is the same block at any text size or window
// width. Kept on this device only, as JSON in the app's defaults.

import Foundation

/// One place in a book.
struct ReadingMark: Codable, Hashable, Identifiable {
    var id = UUID()
    /// The chapter's id, as `CorpusBrowser.chapter` takes it.
    var sectionId: String
    /// The block at the top of the page.
    var block: Int
    /// The chapter's title, for the list.
    var chapterTitle: String
    /// The block's first words, for the list.
    var excerpt: String = ""
    var date = Date()
}

/// Every book's last place and its bookmarks, keyed by ``ReadingMarks/key(genre:book:)``.
struct ReadingMarks: Codable, Equatable {
    var last: [String: ReadingMark] = [:]
    var saved: [String: [ReadingMark]] = [:]

    /// The longest excerpt kept with a bookmark.
    static let excerptLength = 90

    static func key(genre: String, book: String) -> String { "\(genre)/\(book)" }

    /// A block's text cut to a short excerpt at a word.
    static func excerpt(_ text: String) -> String {
        let flat = text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        guard flat.count > excerptLength else { return flat }
        let cut = flat.prefix(excerptLength)
        let atWord = cut.lastIndex(of: " ").map { cut[..<$0] } ?? cut
        return atWord + "..."
    }

    /// Remember where a book was left.
    mutating func leave(_ key: String, at mark: ReadingMark) {
        last[key] = mark
    }

    /// Bookmark a place. A place already marked is not marked twice.
    ///
    /// :param key: The book's key.
    /// :param mark: The place.
    /// :returns: Whether a bookmark was added.
    @discardableResult
    mutating func add(_ key: String, _ mark: ReadingMark) -> Bool {
        guard !isMarked(key, sectionId: mark.sectionId, block: mark.block) else { return false }
        saved[key, default: []].append(mark)
        return true
    }

    mutating func remove(_ key: String, id: UUID) {
        saved[key]?.removeAll { $0.id == id }
        if saved[key]?.isEmpty == true { saved[key] = nil }
    }

    func isMarked(_ key: String, sectionId: String, block: Int) -> Bool {
        saved[key]?.contains { $0.sectionId == sectionId && $0.block == block } ?? false
    }

    /// A book's bookmarks in reading order, keeping only those in a chapter
    /// the book still has (a re-exported text can drop or rename one).
    ///
    /// :param key: The book's key.
    /// :param chapters: The book's chapter ids, in order.
    func bookmarks(_ key: String, in chapters: [String]) -> [ReadingMark] {
        let order = Dictionary(chapters.enumerated().map { ($1, $0) }, uniquingKeysWith: { a, _ in a })
        return (saved[key] ?? [])
            .filter { order[$0.sectionId] != nil }
            .sorted { (order[$0.sectionId]!, $0.block) < (order[$1.sectionId]!, $1.block) }
    }

    /// Where a book was left, if that chapter is still in it.
    func lastPlace(_ key: String, in chapters: [String]) -> ReadingMark? {
        guard let mark = last[key], chapters.contains(mark.sectionId) else { return nil }
        return mark
    }
}
