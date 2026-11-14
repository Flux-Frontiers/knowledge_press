// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Matching a book's reading voice to its author: the rule over installed
// voices, and `core.pack`'s gender and accent columns, old packs included.

import Foundation
import SQLite3
import Testing

@testable import GutenbergKGKit

struct VoiceChoiceTests {

    /// A Mac's English voices as AVSpeechSynthesisVoice reports them (2026-11-14), trimmed.
    let mac: [InstalledVoice] = [
        .init(id: "daniel", name: "Daniel", language: "en-GB", gender: .male),
        .init(id: "daniel+", name: "Daniel", language: "en-GB", gender: .male, quality: .enhanced),
        .init(id: "arthur", name: "Arthur", language: "en-GB", gender: .male),
        .init(id: "samantha", name: "Samantha", language: "en-US", gender: .female),
        .init(id: "moira", name: "Moira", language: "en-IE", gender: .female),
        .init(id: "fiona+", name: "Fiona", language: "en-GB-u-sd-gbsct", gender: .female, quality: .enhanced),
        .init(id: "fred", name: "Fred", language: "en-US", gender: .male),
        .init(id: "aaron+", name: "Aaron", language: "en-US", gender: .male, quality: .enhanced),
        .init(id: "bells", name: "Bells", language: "en-US", gender: nil, novelty: true),
        .init(id: "eddy", name: "Eddy", language: "en-US", gender: nil),
    ]

    @Test func aBritishManGetsTheBestBritishMaleVoice() {
        let id = VoiceChoice.pick(.init(gender: .male, accent: "en-GB"), from: mac, deviceAccent: "en-US")
        #expect(id == "daniel+")  // Enhanced before standard, same accent
    }

    @Test func aBritishWomanGetsTheExactAccentBeforeTheFamily() {
        let id = VoiceChoice.pick(.init(gender: .female, accent: "en-GB"), from: mac, deviceAccent: "en-US")
        #expect(id == "fiona+")  // en-GB (Scottish variant) before Irish Moira
    }

    @Test func anAmericanManNeverGetsTheRoboticVoice() {
        let id = VoiceChoice.pick(.init(gender: .male, accent: "en-US"), from: mac, deviceAccent: "en-US")
        #expect(id == "aaron+")
        let withoutAaron = mac.filter { $0.id != "aaron+" }
        // No American man left but Fred: a British man reads instead.
        #expect(VoiceChoice.pick(.init(gender: .male, accent: "en-US"), from: withoutAaron, deviceAccent: "en-US") == "daniel+")
    }

    @Test func aTranslatedAuthorTakesTheDevicesAccent() {
        let id = VoiceChoice.pick(.init(gender: .female, accent: nil), from: mac, deviceAccent: "en-US")
        #expect(id == "samantha")
    }

    @Test func noGenderMeansTheSystemVoice() {
        #expect(VoiceChoice.pick(nil, from: mac, deviceAccent: "en-US") == nil)
        #expect(VoiceChoice.pick(.init(gender: nil, accent: "en-GB"), from: mac, deviceAccent: "en-US") == nil)
    }

    @Test func noVoiceOfTheGenderMeansTheSystemVoice() {
        let men = mac.filter { $0.gender == .male }
        #expect(VoiceChoice.pick(.init(gender: .female, accent: "en-GB"), from: men, deviceAccent: "en-US") == nil)
    }
}

struct CatalogPackVoiceTests {

    private func pack(_ schema: String, _ rows: [String]) throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("core-\(UUID().uuidString).pack")
        var db: OpaquePointer?
        #expect(sqlite3_open(url.path, &db) == SQLITE_OK)
        defer { sqlite3_close(db) }
        for sql in [schema] + rows { #expect(sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK, "\(sql)") }
        return url
    }

    @Test func readsTheVoiceColumns() throws {
        let url = try pack(
            "CREATE TABLE books (key TEXT, genre TEXT, book TEXT, title TEXT, author TEXT, ebook_id INTEGER, file_path TEXT, gender TEXT, accent TEXT)",
            [
                "INSERT INTO books VALUES ('fiction/Emma','fiction','Emma','Emma','Jane Austen',158,'x','female','en-GB')",
                "INSERT INTO books VALUES ('fiction/Anon','fiction','Anon','Anon',NULL,1,'y',NULL,NULL)",
                "INSERT INTO books VALUES ('fiction/Iliad','fiction','Iliad','Iliad','Homer',2,'z','male',NULL)",
            ])
        defer { try? FileManager.default.removeItem(at: url) }
        let catalog = try CatalogPack(contentsOf: url)
        #expect(catalog.voice(genre: "fiction", book: "Emma") == AuthorVoice(gender: .female, accent: "en-GB"))
        #expect(catalog.voice(genre: "fiction", book: "Iliad") == AuthorVoice(gender: .male, accent: nil))
        #expect(catalog.voice(genre: "fiction", book: "Anon") == nil)
        #expect(catalog.voice(genre: "fiction", book: "Missing") == nil)
    }

    @Test func anOlderPackWithoutTheColumnsReadsNil() throws {
        let url = try pack(
            "CREATE TABLE books (key TEXT, genre TEXT, book TEXT, title TEXT, author TEXT, ebook_id INTEGER, file_path TEXT)",
            ["INSERT INTO books VALUES ('fiction/Emma','fiction','Emma','Emma','Jane Austen',158,'x')"])
        defer { try? FileManager.default.removeItem(at: url) }
        let catalog = try CatalogPack(contentsOf: url)
        #expect(catalog.voice(genre: "fiction", book: "Emma") == nil)
        #expect(catalog.books(genre: "fiction").map(\.book) == ["Emma"])
    }
}
