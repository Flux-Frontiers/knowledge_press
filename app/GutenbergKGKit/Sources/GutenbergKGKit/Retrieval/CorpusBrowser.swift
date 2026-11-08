// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The Browse tab's four operations, behind one protocol so the reader does not
// know whether the book came off the network or off the disk.

import Foundation

/// Genres → books → chapters → chapter text.
///
/// The signatures are the worker's, so ``WorkerClient`` conforms with nothing
/// added and ``LocalBrowser`` has a shape to match rather than invent.
public protocol CorpusBrowser: Sendable {
    func listGenres() async throws -> [GenreCount]
    func listBooks(genre: String) async throws -> [Book]
    func chapters(genre: String, book: String) async throws -> [Chapter]
    func chapter(genre: String, book: String, sectionId: String) async throws -> ChapterContent
    /// Every chapter of one book, in reading order: the forest's reader takes a
    /// book whole.
    func wholeBook(genre: String, book: String) async throws -> [BookChapterText]
}

/// One chapter of a whole book, as the forest's reader shows it.
public struct BookChapterText: Sendable, Equatable {
    public let title: String
    public let text: String

    public init(title: String, text: String) {
        self.title = title
        self.text = text
    }
}

extension CorpusBrowser {
    /// The list, then each chapter in turn. Fine for a book's few dozen
    /// chapters; a diary's thousands of entries need ``LocalBrowser``'s single
    /// query instead.
    public func wholeBook(genre: String, book: String) async throws -> [BookChapterText] {
        try await chapterByChapter(genre: genre, book: book)
    }

    /// ``wholeBook(genre:book:)`` one chapter at a time.
    func chapterByChapter(genre: String, book: String) async throws -> [BookChapterText] {
        let list = try await chapters(genre: genre, book: book)
        var out: [BookChapterText] = []
        out.reserveCapacity(list.count)
        for (position, entry) in list.enumerated() {
            let content = try await chapter(genre: genre, book: book, sectionId: entry.id)
            out.append(
                BookChapterText(
                    title: content.title ?? entry.title ?? "Chapter \(position + 1)", text: content.text))
        }
        return out
    }
}

extension WorkerClient: CorpusBrowser {}

/// Browse served from the installed packs — works in airplane mode.
public struct LocalBrowser: CorpusBrowser {

    public enum BrowseError: Error, LocalizedError {
        case noCatalog
        case unknownBook(String)
        case unknownChapter(String)

        public var errorDescription: String? {
            switch self {
            case .noCatalog:
                return "This corpus has no core.pack, so its books cannot be listed."
            case .unknownBook(let book):
                return "\(book) is not in the installed corpus."
            case .unknownChapter(let id):
                return "That chapter is not in the installed corpus (\(id))."
            }
        }
    }

    private let packs: CorpusPacks

    public init(packs: CorpusPacks) {
        self.packs = packs
    }

    public func listGenres() async throws -> [GenreCount] {
        guard let catalog = packs.catalog else { throw BrowseError.noCatalog }
        return catalog.genres()
    }

    public func listBooks(genre: String) async throws -> [Book] {
        guard let catalog = packs.catalog else { throw BrowseError.noCatalog }
        return catalog.books(genre: genre)
    }

    public func chapters(genre: String, book: String) async throws -> [Chapter] {
        if genre == "diaries" { return try diaryChapters(book: book) }
        let (pack, path) = try locate(genre: genre, book: book)
        return try pack.chapters(filePath: path)
    }

    public func chapter(genre: String, book: String, sectionId: String) async throws
        -> ChapterContent
    {
        if genre == "diaries" {
            guard let content = try diaryChapter(book: book, sectionId: sectionId) else {
                throw BrowseError.unknownChapter(sectionId)
            }
            return content
        }
        let (pack, path) = try locate(genre: genre, book: book)
        guard let content = try pack.chapter(filePath: path, sectionID: sectionId) else {
            throw BrowseError.unknownChapter(sectionId)
        }
        return content
    }

    /// Resolve a book to the pack holding its passages and its document path.
    ///
    /// The catalog knows the path; which pack carries it is a lookup, because a
    /// diary's chapters live in `diaries.pack` and a book's in `gutenberg.pack`.
    private func locate(genre: String, book: String) throws -> (PassagePack, String) {
        guard let catalog = packs.catalog else { throw BrowseError.noCatalog }
        guard let path = catalog.documentPath(genre: genre, book: book) else {
            throw BrowseError.unknownBook("\(genre)/\(book)")
        }
        for pack in packs.packs where !((try? pack.chapters(filePath: path))?.isEmpty ?? true) {
            return (pack, path)
        }
        guard let first = packs.packs.first else { throw BrowseError.unknownBook(book) }
        return (first, path)
    }

    // MARK: - Diaries
    //
    // A diary has no `file_path` in `core.pack` (every chunk has its own) and
    // no `section` rows, so `locate(genre:book:)` cannot resolve one — this is
    // the gap `app/RUNBOOK.md` used to log as "diaries cannot be browsed".
    // `title` in `diaries.pack` matches the catalog's book name exactly, so it
    // stands in for the path lookup `locate` uses for everything else.

    private func diaryPack() -> PassagePack? {
        packs.packs.first { $0.isDiaries }
    }

    private func diaryChapters(book: String) throws -> [Chapter] {
        guard let pack = diaryPack(), let kgName = try pack.diaryIdentity(title: book) else {
            throw BrowseError.unknownBook("diaries/\(book)")
        }
        return try pack.diaryEntries(kgName: kgName)
    }

    /// A diary whole, in one query. Entry by entry, Pepys's 3,358 days took
    /// three queries each, two of them scans of the pack, and the forest's
    /// reader never finished opening it.
    public func wholeBook(genre: String, book: String) async throws -> [BookChapterText] {
        guard genre == "diaries" else { return try await chapterByChapter(genre: genre, book: book) }
        guard let pack = diaryPack(), let kgName = try pack.diaryIdentity(title: book) else {
            throw BrowseError.unknownBook("diaries/\(book)")
        }
        return try pack.diaryText(kgName: kgName)
    }

    private func diaryChapter(book: String, sectionId: String) throws -> ChapterContent? {
        guard let pack = diaryPack(), let kgName = try pack.diaryIdentity(title: book) else {
            throw BrowseError.unknownBook("diaries/\(book)")
        }
        return try pack.diaryEntry(kgName: kgName, timestamp: sectionId)
    }
}
