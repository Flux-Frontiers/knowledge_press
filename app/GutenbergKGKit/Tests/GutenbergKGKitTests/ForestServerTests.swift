// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The forest's file server: what the Forest tab's web view gets for each
// path. A wrong media type or a missing-file fallback to index.html both
// break the page silently, so they are pinned here rather than found on a
// phone. The second suite is the books route: the reader's text built from
// the corpus browser, in the shape web/src/game/bookText.ts decodes.

import Foundation
import Testing

@testable import GutenbergKGKit

/// A throwaway staged forest: index.html, one script, one nested texture.
private struct StagedForest {
    let root: URL

    init() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("forest-\(UUID().uuidString)", isDirectory: true)
        let assets = root.appendingPathComponent("assets", isDirectory: true)
        try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)
        try Data("<!doctype html><title>Forest</title>".utf8)
            .write(to: root.appendingPathComponent("index.html"))
        try Data("export const x = 1;".utf8).write(to: assets.appendingPathComponent("x.js"))
        try Data([0x67, 0x6C, 0x54, 0x46]).write(to: assets.appendingPathComponent("tree.glb"))
        // As web/scripts/export-catalog.mjs writes it. `lost_play` is in the
        // forest but not in the stub's packs.
        try Data(
            #"""
            [{"slug":"hamlet","genre":"shakespeare","book":"Hamlet"},
             {"slug":"lost_play","genre":"shakespeare","book":"Cardenio"}]
            """#.utf8
        ).write(to: root.appendingPathComponent("catalog.json"))
    }

    func remove() { try? FileManager.default.removeItem(at: root) }
}

struct ForestServerStaticTests {

    @Test func rootPathIsIndexHTML() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let server = ForestServer(root: forest.root)
        for path in ["", "/", "/?tree=hamlet"] {
            let (data, type) = try #require(try await server.respond(to: path))
            #expect(type == "text/html")
            #expect(String(decoding: data, as: UTF8.self).contains("<title>Forest</title>"))
        }
        #expect(server.isStaged)
    }

    @Test func assetsCarryTheirMediaType() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let server = ForestServer(root: forest.root)
        let (script, scriptType) = try #require(try await server.respond(to: "/assets/x.js"))
        #expect(scriptType == "text/javascript")
        #expect(String(decoding: script, as: UTF8.self) == "export const x = 1;")
        let (_, modelType) = try #require(try await server.respond(to: "assets/tree.glb"))
        #expect(modelType == "model/gltf-binary")
    }

    @Test func missingFilesAre404NotIndex() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let server = ForestServer(root: forest.root)
        #expect(try await server.respond(to: "/assets/missing.js") == nil)
        #expect(try await server.respond(to: "/assets") == nil)
        #expect(try await server.respond(to: "/../../etc/hosts") == nil)
        #expect(try await server.respond(to: "/assets/%2E%2E/%2E%2E/etc/hosts") == nil)
    }

    @Test func anEmptyFolderIsNotStaged() throws {
        let empty = FileManager.default.temporaryDirectory
            .appendingPathComponent("forest-empty-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: empty, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: empty) }
        #expect(!ForestServer(root: empty).isStaged)
    }

    @Test func unknownExtensionsAreOctetStream() {
        #expect(ForestServer.mediaType(forExtension: "CSS") == "text/css")
        #expect(ForestServer.mediaType(forExtension: "webp") == "image/webp")
        #expect(ForestServer.mediaType(forExtension: "wasm") == "application/wasm")
        #expect(ForestServer.mediaType(forExtension: "xyz") == "application/octet-stream")
    }
}

/// Two chapters of one book, counting how often it is asked.
private actor StubBrowser: CorpusBrowser {
    private(set) var chapterListCalls = 0

    func listGenres() async throws -> [GenreCount] { [] }
    func listBooks(genre: String) async throws -> [Book] { [] }

    func chapters(genre: String, book: String) async throws -> [Chapter] {
        chapterListCalls += 1
        guard genre == "shakespeare", book == "Hamlet" else {
            throw LocalBrowser.BrowseError.unknownBook(book)
        }
        // Listed out of id order, so the test sees list order is kept.
        return [
            Chapter(id: "s2", title: "Act I", index: 0),
            Chapter(id: "s1", title: "Act II", index: 1),
        ]
    }

    func chapter(genre: String, book: String, sectionId: String) async throws -> ChapterContent {
        let text = sectionId == "s2" ? "Who's there?" : "Lord Polonius."
        // The second chapter's content has no title; the list's stands in.
        return ChapterContent(
            title: sectionId == "s2" ? "Act I" : nil, text: text, index: nil, total: nil,
            prevId: nil, nextId: nil)
    }
}

/// What `decodeBook` accepts.
private struct DecodedBook: Decodable, Equatable {
    struct Chapter: Decodable, Equatable {
        let title: String
        let text: String
    }
    let chapters: [Chapter]
}

struct ForestServerBookTests {

    @Test func aBookIsItsChaptersInReadingOrder() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let server = ForestServer(root: forest.root, browser: StubBrowser())
        let (data, type) = try #require(try await server.respond(to: "/books/hamlet.json"))
        #expect(type == "application/json")
        let book = try JSONDecoder().decode(DecodedBook.self, from: data)
        #expect(
            book.chapters == [
                .init(title: "Act I", text: "Who's there?"),
                .init(title: "Act II", text: "Lord Polonius."),
            ])
        let top = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(Array(top.keys) == ["chapters"])
    }

    @Test func anUnknownSlugIs404() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let browser = StubBrowser()
        let server = ForestServer(root: forest.root, browser: browser)
        #expect(try await server.respond(to: "/books/macbeth.json") == nil)
        #expect(await browser.chapterListCalls == 0)
    }

    @Test func aBookMissingFromThePacksIs404() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let server = ForestServer(root: forest.root, browser: StubBrowser())
        #expect(try await server.respond(to: "/books/lost_play.json") == nil)
    }

    @Test func aBookIsBuiltOnce() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let browser = StubBrowser()
        let server = ForestServer(root: forest.root, browser: browser)
        let first = try #require(try await server.respond(to: "/books/hamlet.json"))
        let second = try #require(try await server.respond(to: "/books/hamlet.json"))
        #expect(first.0 == second.0)
        #expect(await browser.chapterListCalls == 1)
    }

    @Test func aFailureIsNotCached() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let browser = StubBrowser()
        let server = ForestServer(root: forest.root, browser: browser)
        _ = try await server.respond(to: "/books/lost_play.json")
        _ = try await server.respond(to: "/books/lost_play.json")
        #expect(await browser.chapterListCalls == 2)
    }

    @Test func withoutACatalogThereAreNoBooks() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        try FileManager.default.removeItem(at: forest.root.appendingPathComponent("catalog.json"))
        let browser = StubBrowser()
        let server = ForestServer(root: forest.root, browser: browser)
        #expect(try await server.respond(to: "/books/hamlet.json") == nil)
        // The rest of the forest is unaffected.
        #expect(try await server.respond(to: "/") != nil)
        #expect(await browser.chapterListCalls == 0)
    }

    @Test func anExplicitCatalogWinsOverTheStagedOne() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let catalog = ForestCatalog(entries: [
            .init(slug: "the_prince_of_denmark", genre: "shakespeare", book: "Hamlet")
        ])
        let server = ForestServer(root: forest.root, browser: StubBrowser(), catalog: catalog)
        #expect(try await server.respond(to: "/books/the_prince_of_denmark.json") != nil)
        #expect(try await server.respond(to: "/books/hamlet.json") == nil)
    }

    @Test func onlyBooksSlashSlugDotJSONIsABook() {
        #expect(ForestServer.bookSlug("books/hamlet.json") == "hamlet")
        #expect(ForestServer.bookSlug("books/.json") == nil)
        #expect(ForestServer.bookSlug("books/a/b.json") == nil)
        #expect(ForestServer.bookSlug("moots/index.json") == nil)
        #expect(ForestServer.bookSlug("books/hamlet.txt") == nil)
    }
}
