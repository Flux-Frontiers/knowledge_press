// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Author search in the Browse tab. The matching rules run on a hand-built
// shelf; the last suite runs them on the installed catalog and opens what they
// find, and is opt-in like the other corpus suites:
//
//     GUTENBERG_PACKS=bundles/gutenberg-all/swift swift test

import Foundation
import Testing

@testable import GutenbergKGKit

private func shelved(_ genre: String, _ title: String, _ author: String?) -> ShelvedBook {
    ShelvedBook(genre: genre, book: Book(book: title, title: title, author: author, ebookId: nil))
}

/// Names copied from the catalog as it is, awkward inversions included.
private let shelf: [ShelvedBook] = [
    shelved("russian-literature", "War and Peace", "Leo, graf Tolstoy"),
    shelved("russian-literature", "Anna Karenina", "Leo, graf Tolstoy"),
    shelved("philosophy", "What Is Art?", "Leo, graf Tolstoy"),
    shelved("science-fiction", "The Time Machine", "H. G. (Herbert George) Wells"),
    shelved("french-literature", "Germinal", "Émile Zola"),
    shelved("philosophy", "Emile", "Jean-Jacques Rousseau"),
    shelved("english-literature", "Jane Eyre", "Charlotte Brontë"),
    shelved("english-literature", "Wuthering Heights", "Emily Brontë"),
    shelved("sacred-texts", "The Bible", nil),
]

struct AuthorMatchingTests {

    @Test func aWordPrefixMatchesAndAMidWordFragmentDoesNot() {
        #expect(AuthorSearch.matches(author: "H. G. (Herbert George) Wells", query: "wel"))
        #expect(!AuthorSearch.matches(author: "H. G. (Herbert George) Wells", query: "ells"))
    }

    @Test func caseAndAccentsAreIgnoredOnBothSides() {
        #expect(AuthorSearch.matches(author: "Émile Zola", query: "EMILE"))
        #expect(AuthorSearch.matches(author: "Charlotte Bronte", query: "brontë"))
    }

    @Test func everyQueryWordMustMatchInAnyOrder() {
        let wells = "H. G. (Herbert George) Wells"
        #expect(AuthorSearch.matches(author: wells, query: "h g wells"))
        #expect(AuthorSearch.matches(author: wells, query: "wells herbert"))
        #expect(!AuthorSearch.matches(author: wells, query: "wells orson"))
    }

    @Test func punctuationSeparatesWords() {
        #expect(AuthorSearch.matches(author: "Jean-Jacques Rousseau", query: "jacques"))
        #expect(AuthorSearch.matches(author: "Jean-Jacques Rousseau", query: "jean-jacques"))
        #expect(AuthorSearch.matches(author: "Leo, graf Tolstoy", query: "tolstoy,"))
    }

    @Test func aBlankQueryMatchesNothing() {
        #expect(!AuthorSearch.matches(author: "Jane Austen", query: ""))
        #expect(!AuthorSearch.matches(author: "Jane Austen", query: "  - "))
    }
}

struct AuthorSearchResultTests {

    @Test func anAuthorsBooksAreGatheredAcrossGenres() throws {
        let results = AuthorSearch.search("tolstoy", in: shelf)
        let tolstoy = try #require(results.first)
        #expect(results.count == 1)
        #expect(tolstoy.author == "Leo, graf Tolstoy")
        #expect(tolstoy.books.map(\.book.title) == ["Anna Karenina", "War and Peace", "What Is Art?"])
        #expect(Set(tolstoy.books.map(\.genre)) == ["russian-literature", "philosophy"])
    }

    @Test func severalAuthorsComeBackInNameOrder() {
        let results = AuthorSearch.search("bronte", in: shelf)
        #expect(results.map(\.author) == ["Charlotte Brontë", "Emily Brontë"])
    }

    @Test func booksWithoutAnAuthorAreNeverResults() {
        #expect(AuthorSearch.search("bible", in: shelf).isEmpty)
    }

    @Test func aBlankQueryReturnsNothing() {
        #expect(AuthorSearch.search("   ", in: shelf).isEmpty)
    }

    @Test func aResultKeepsTheGenreItWasShelvedUnder() throws {
        let zola = try #require(AuthorSearch.search("zola", in: shelf).first)
        #expect(zola.books.map(\.id) == ["french-literature/Germinal"])
    }
}

// MARK: - Against the installed catalog

private var packsDirectory: URL? {
    guard let path = ProcessInfo.processInfo.environment["GUTENBERG_PACKS"], !path.isEmpty
    else { return nil }
    return URL(fileURLWithPath: (path as NSString).expandingTildeInPath, isDirectory: true)
}

@Suite(.enabled(if: packsDirectory != nil, "set GUTENBERG_PACKS to a built corpus"))
struct AuthorSearchCorpusTests {

    private func openShelf() async throws -> (LocalBrowser, [ShelvedBook]) {
        let packs = try CorpusPacks(directory: try #require(packsDirectory))
        let browser = LocalBrowser(packs: packs)
        let genres = try await browser.listGenres()
        return (browser, try await browser.shelf(genres: genres))
    }

    @Test func theShelfHoldsEveryBookInTheCatalog() async throws {
        let (browser, books) = try await openShelf()
        let expected = try await browser.listGenres().reduce(0) { $0 + $1.bookCount }
        #expect(books.count == expected)
        #expect(Set(books.map(\.id)).count == books.count)
    }

    /// Every result has to open in the existing drill, or search finds books
    /// the reader cannot read. Diaries are routed differently from books, so
    /// one of each is opened.
    @Test(arguments: ["lovecraft", "pepys"])
    func aResultOpensToItsChapters(query: String) async throws {
        let (browser, books) = try await openShelf()
        let match = try #require(AuthorSearch.search(query, in: books).first)
        let first = try #require(match.books.first)
        let chapters = try await browser.chapters(genre: first.genre, book: first.book.book)
        #expect(!chapters.isEmpty)
    }

    /// Names such as "Leo, graf Tolstoy" come out of gutenberg_kg's name
    /// inversion. Only the surname is pinned here, so the test survives that
    /// being fixed.
    @Test(arguments: ["tolstoy", "augustine", "aurelius"])
    func oddlyInvertedNamesAreStillFoundBySurname(query: String) async throws {
        let (_, books) = try await openShelf()
        let results = AuthorSearch.search(query, in: books)
        #expect(results.count == 1)
        #expect(results.first?.author.localizedCaseInsensitiveContains(query) == true)
    }
}
