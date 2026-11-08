// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The web forest, served to the app's own web view.
//
// The forest is the production build of web/ (`make web-build`), staged into
// the app as a folder the way the corpus is. WebKit will not run it from
// `file://` -- `fetch()` of a file URL is refused and the module worker that
// grows the forest gets a null origin -- so the web view asks a custom URL
// scheme for every file, and this answers. It knows nothing about WebKit:
// a path in, bytes and a media type out, which is what makes it testable.
//
// It is also the forest's backend for book text. The reader fetches
// `books/<slug>.json`; on the web that is a file `make web-books` wrote, here
// it is built from the installed corpus packs, so every book the app carries
// can be read from its tree.

import Foundation

/// Answers requests for the forest's files and for book text, from the
/// staged forest folder and the installed corpus packs.
public final class ForestServer: Sendable {

    /// The staged build: the contents of web/dist.
    public let root: URL

    /// The slug table the staged build carries; the app asks it which books
    /// have a tree.
    public let catalog: ForestCatalog

    private let browser: (any CorpusBrowser)?
    private let books = BookCache()

    /// :param root: The staged forest folder, holding `index.html`.
    /// :param browser: Where book text comes from; nil serves no books.
    /// :param catalog: The slug table; nil reads `catalog.json` from `root`,
    ///     and an older stage without one serves no books.
    public init(root: URL, browser: (any CorpusBrowser)? = nil, catalog: ForestCatalog? = nil) {
        self.root = root.standardizedFileURL
        self.browser = browser
        self.catalog =
            catalog
            ?? (try? ForestCatalog(contentsOf: self.root.appendingPathComponent("catalog.json")))
            ?? ForestCatalog(entries: [])
    }

    /// True when a forest has been staged into `root`.
    ///
    /// An ordinary development or CI build carries an empty folder; the view
    /// shows how to stage one instead of a blank page.
    public var isStaged: Bool {
        FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path)
    }

    /// The bytes and media type for one path, or nil for 404.
    ///
    /// Only the empty path and `/` fall back to `index.html`. Anything else
    /// that is missing is a 404, so a broken asset shows up as an error in
    /// the web inspector rather than as the forest quietly loading twice.
    ///
    /// :param path: The request's path, with or without the leading slash.
    ///     A query string or fragment, if present, is ignored.
    /// :returns: The file's contents and its media type, or nil when there
    ///     is no such file under `root`.
    public func respond(to path: String) async throws -> (Data, String)? {
        let relative = Self.relativePath(path)
        if let slug = Self.bookSlug(relative) {
            guard let data = await book(slug: slug) else { return nil }
            return (data, "application/json")
        }
        let target = relative.isEmpty ? "index.html" : relative
        guard let url = file(at: target) else { return nil }
        return (try Data(contentsOf: url), Self.mediaType(forExtension: url.pathExtension))
    }

    /// The slug in `books/<slug>.json`, or nil for any other path.
    static func bookSlug(_ relative: String) -> String? {
        let prefix = "books/", suffix = ".json"
        guard relative.hasPrefix(prefix), relative.hasSuffix(suffix),
            relative.count > prefix.count + suffix.count
        else { return nil }
        let slug = relative.dropFirst(prefix.count).dropLast(suffix.count)
        return slug.contains("/") ? nil : String(slug)
    }

    /// One book's text as the forest's reader expects it, or nil for 404.
    ///
    /// `{"chapters": [{"title", "text"}]}` in reading order -- the shape
    /// `decodeBook` in web/src/game/bookText.ts checks. Built once per slug
    /// and kept for the life of the process: a book is a few hundred KB, and
    /// the reader fetches it once per session anyway. A failure is not kept,
    /// so a book that was not there (or a worker that was unreachable) is
    /// tried again on the next request.
    ///
    /// :param slug: The catalog slug.
    /// :returns: The encoded JSON, or nil when the slug is not in the catalog,
    ///     the book is not in the packs, or it has no chapters.
    func book(slug: String) async -> Data? {
        guard let browser, let location = catalog.location(of: slug) else { return nil }
        return await books.value(for: slug) {
            try await Self.encodeBook(genre: location.genre, book: location.book, from: browser)
        }
    }

    private struct BookText: Encodable {
        struct Chapter: Encodable {
            let title: String
            let text: String
        }
        let chapters: [Chapter]
    }

    private static func encodeBook(genre: String, book: String, from browser: any CorpusBrowser)
        async throws -> Data?
    {
        let whole = try await browser.wholeBook(genre: genre, book: book)
        guard !whole.isEmpty else { return nil }
        return try JSONEncoder().encode(
            BookText(chapters: whole.map { .init(title: $0.title, text: $0.text) }))
    }

    /// The path with its query, fragment and leading slashes removed, and
    /// percent-escapes decoded.
    static func relativePath(_ path: String) -> String {
        var trimmed = Substring(path)
        if let cut = trimmed.firstIndex(where: { $0 == "?" || $0 == "#" }) {
            trimmed = trimmed[..<cut]
        }
        let decoded = String(trimmed).removingPercentEncoding ?? String(trimmed)
        return String(decoded.drop(while: { $0 == "/" }))
    }

    /// A regular file under `root`, or nil.
    ///
    /// Resolved and checked against `root`, so `../` in a request cannot
    /// read outside the staged folder.
    private func file(at relative: String) -> URL? {
        let url = root.appendingPathComponent(relative).standardizedFileURL
        guard url.path.hasPrefix(root.path + "/") else { return nil }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory),
            !isDirectory.boolValue
        else { return nil }
        return url
    }

    /// The media type a browser expects for a file extension.
    ///
    /// Module scripts are refused outright when served as anything but a
    /// JavaScript type, so `js` must be right; the rest mostly matter for
    /// the inspector. Unknown extensions are `application/octet-stream`.
    ///
    /// :param ext: The extension, without the dot, any case.
    /// :returns: The media type, without parameters.
    public static func mediaType(forExtension ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html"
        case "js", "mjs": return "text/javascript"
        case "css": return "text/css"
        case "json", "map": return "application/json"
        case "md": return "text/markdown"
        case "txt": return "text/plain"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        case "glb": return "model/gltf-binary"
        case "gltf": return "model/gltf+json"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "wasm": return "application/wasm"
        case "mp3": return "audio/mpeg"
        case "ogg": return "audio/ogg"
        case "wav": return "audio/wav"
        default: return "application/octet-stream"
        }
    }

    /// Whether a media type is text, so the response can name its encoding.
    ///
    /// :param mediaType: A type from `mediaType(forExtension:)`.
    /// :returns: True for the text types the build writes as UTF-8.
    public static func isText(_ mediaType: String) -> Bool {
        mediaType.hasPrefix("text/") || mediaType == "application/json"
            || mediaType == "image/svg+xml" || mediaType == "model/gltf+json"
    }
}

/// The forest catalog's slug -> (genre, book) table.
///
/// Read from the `catalog.json` that `web/scripts/export-catalog.mjs` writes
/// into the build at stage time, so the app and the forest it carries can
/// never disagree about which slug is which book.
public struct ForestCatalog: Sendable {

    /// One tree: its slug, and the genre and corpus folder name the corpus
    /// browser takes.
    public struct Entry: Codable, Sendable, Hashable {
        public let slug: String
        public let genre: String
        public let book: String

        public init(slug: String, genre: String, book: String) {
            self.slug = slug
            self.genre = genre
            self.book = book
        }
    }

    private let bySlug: [String: Entry]
    private let byBook: [BookKey: String]

    /// A (genre, book) pair as the corpus browser names a book.
    private struct BookKey: Hashable {
        let genre: String
        let book: String
    }

    /// :param entries: The table; a repeated slug, or a repeated
    ///     (genre, book), keeps its first entry.
    public init(entries: [Entry]) {
        bySlug = Dictionary(entries.map { ($0.slug, $0) }, uniquingKeysWith: { first, _ in first })
        byBook = Dictionary(
            entries.map { (BookKey(genre: $0.genre, book: $0.book), $0.slug) },
            uniquingKeysWith: { first, _ in first })
    }

    /// :param url: A `catalog.json`: `[{slug, genre, book}]`.
    public init(contentsOf url: URL) throws {
        self.init(entries: try JSONDecoder().decode([Entry].self, from: Data(contentsOf: url)))
    }

    /// The number of trees in the table.
    public var count: Int { bySlug.count }

    /// :param slug: A catalog slug.
    /// :returns: Its genre and book, or nil when the forest has no such tree.
    public func location(of slug: String) -> (genre: String, book: String)? {
        bySlug[slug].map { ($0.genre, $0.book) }
    }

    /// The tree for a book, the way Browse and a chat citation name it.
    ///
    /// :param genre: The book's genre key, as `CorpusBrowser` takes it.
    /// :param book: The corpus folder name (a book's `book`, a diary's title).
    /// :returns: The catalog slug, or nil when the forest has no tree for it.
    public func slug(genre: String, book: String) -> String? {
        byBook[BookKey(genre: genre, book: book)]
    }
}

/// Encoded books by slug. A request already in flight is shared rather than
/// built twice, and a failed or empty one is forgotten.
private actor BookCache {
    private var entries: [String: Task<Data?, Never>] = [:]

    func value(for slug: String, build: @escaping @Sendable () async throws -> Data?) async
        -> Data?
    {
        if let task = entries[slug] { return await task.value }
        let task = Task { try? await build() }
        entries[slug] = task
        let data = await task.value
        if data == nil { entries[slug] = nil }
        return data
    }
}
