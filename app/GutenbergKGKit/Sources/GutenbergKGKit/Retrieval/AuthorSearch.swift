// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The Browse tab's author search. The catalog is small (a few hundred books),
// so every book is held in memory and matched here rather than in SQL: the
// same code then serves the installed packs and the worker, and the matching
// rules are testable without a corpus.

import Foundation

/// A book together with the genre it is shelved under.
///
/// ``Book`` does not carry its genre, because `list_books` is always asked for
/// one genre at a time. A search runs across all of them, and opening a result
/// needs the genre back.
public struct ShelvedBook: Sendable, Hashable, Identifiable {
    public let genre: String
    public let book: Book

    public var id: String { "\(genre)/\(book.book)" }

    public init(genre: String, book: Book) {
        self.genre = genre
        self.book = book
    }
}

/// One author and every book of theirs that matched, across genres.
public struct AuthorMatch: Sendable, Hashable, Identifiable {
    public let author: String
    public let books: [ShelvedBook]

    public var id: String { author }
}

/// Word-prefix matching of a typed query against catalog author names.
///
/// Every word of the query must begin some word of the name, in any order.
/// "tolst" finds "Leo, graf Tolstoy", "wells h" finds "H. G. (Herbert George)
/// Wells", and "ells" finds nothing -- a bare substring match would pull in
/// every Wells, Mitchell and Campbell at once. Case and accents are ignored,
/// so "emile zola" finds "Émile Zola", and punctuation separates words, so
/// "jean-jacques" and "jean jacques" are the same query.
public enum AuthorSearch {

    /// Lowercased, accent-folded words of `text`, split on anything that is
    /// not a letter or digit.
    ///
    /// :param text: An author name or a query.
    /// :returns: The words, in order; empty for blank text.
    static func words(_ text: String) -> [String] {
        text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
            .lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
    }

    /// Whether `author` answers `query`.
    ///
    /// :param author: A catalog author name.
    /// :param query: What the reader typed.
    /// :returns: True when every query word begins some word of the name.
    ///     False for a blank query, which matches nothing rather than
    ///     everything.
    public static func matches(author: String, query: String) -> Bool {
        let wanted = words(query)
        guard !wanted.isEmpty else { return false }
        let have = words(author)
        return wanted.allSatisfy { word in have.contains { $0.hasPrefix(word) } }
    }

    /// The authors in `books` that answer `query`, each with their books.
    ///
    /// Books with no author are never returned. Authors are ordered by name
    /// and each author's books by title, so the list does not reshuffle as
    /// the reader types.
    ///
    /// :param query: What the reader typed.
    /// :param books: The whole catalog, as ``CorpusBrowser/shelf(genres:)``
    ///     returns it.
    /// :returns: One entry per matching author; empty for a blank query.
    public static func search(_ query: String, in books: [ShelvedBook]) -> [AuthorMatch] {
        guard !words(query).isEmpty else { return [] }
        let hits = books.filter { shelved in
            guard let author = shelved.book.author else { return false }
            return matches(author: author, query: query)
        }
        let byAuthor = Dictionary(grouping: hits) { $0.book.author ?? "" }
        return byAuthor.map { author, books in
            AuthorMatch(
                author: author,
                books: books.sorted {
                    ($0.book.title ?? $0.book.book).localizedStandardCompare(
                        $1.book.title ?? $1.book.book) == .orderedAscending
                })
        }
        .sorted { $0.author.localizedStandardCompare($1.author) == .orderedAscending }
    }
}

extension CorpusBrowser {

    /// Every book in the given genres, each tagged with its genre.
    ///
    /// Built from ``listBooks(genre:)`` so it works unchanged against the
    /// packs and the worker. Against the packs that is one small SQLite read
    /// per genre.
    ///
    /// :param genres: The genres to read, normally the whole genre list.
    /// :returns: The books, genre by genre.
    /// :throws: Whatever ``listBooks(genre:)`` throws.
    public func shelf(genres: [GenreCount]) async throws -> [ShelvedBook] {
        var out: [ShelvedBook] = []
        for genre in genres {
            let books = try await listBooks(genre: genre.genre)
            out += books.map { ShelvedBook(genre: genre.genre, book: $0) }
        }
        return out
    }
}
