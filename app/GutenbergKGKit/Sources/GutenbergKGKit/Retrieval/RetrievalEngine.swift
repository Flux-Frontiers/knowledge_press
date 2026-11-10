// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The retrieval seam. `LocalRetrieval` (Core ML bge-small + a mapped vector
// sidecar + FTS5 + RRF over the installed packs) and `WorkerRetrieval` both
// answer to it, so the chat never learns which one found a passage.

import Foundation

/// What to search and how much of it to return.
///
/// Field-for-field the worker's request contract, so the local engine and the
/// remote one cannot drift apart on semantics.
public struct RetrievalRequest: Sendable, Equatable {
    /// The user's question, verbatim.
    public var query: String
    /// `all`, `gutenberg`, `diary`, a genre slug, or a `<genre>/<book>` key.
    public var corpus: String
    /// Passages to return for the hit cards. Synthesis may use fewer.
    public var k: Int
    /// Drop fused hits below this score.
    public var minScore: Double
    /// Per-KG dense-score floor, applied before fusion.
    public var semanticFloor: Double

    public init(
        query: String,
        corpus: String = "all",
        k: Int = 25,
        minScore: Double = 0.5,
        semanticFloor: Double = 0.20
    ) {
        self.query = query
        self.corpus = corpus
        self.k = k
        self.minScore = minScore
        self.semanticFloor = semanticFloor
    }
}

/// Passages plus how long finding them took.
///
/// `Codable` so a turn can be written to a stored conversation and read back
/// with its evidence intact -- an answer without its passages is exactly the
/// thing this app exists not to show.
public struct RetrievalResult: Sendable, Codable {
    public let hits: [Hit]
    public let kgsQueried: Int
    public let searchMs: Int?
    /// Ids of the hits that hold the whole query as a literal phrase, in hit
    /// order, when the dense channel found none of them. Nil otherwise (and
    /// for a stored turn or a worker result, which do not record it).
    public let phraseMatched: [String]?

    public init(hits: [Hit], kgsQueried: Int, searchMs: Int?, phraseMatched: [String]? = nil) {
        self.hits = hits
        self.kgsQueried = kgsQueried
        self.searchMs = searchMs
        self.phraseMatched = phraseMatched
    }

    /// The hits synthesis should read.
    ///
    /// When the query is a phrase the corpus holds and cosine did not find
    /// it, those passages are the answer and the rest are off the subject.
    /// The on-device model narrates every passage it is handed, so for
    /// "pillar of salt" it quoted Genesis and then reported that the pillars
    /// in Kings and a passage of the Quran "do not mention a pillar of salt".
    /// The cards still show every hit; only synthesis is narrowed.
    public var synthesisHits: [Hit] {
        guard let phraseMatched, !phraseMatched.isEmpty else { return hits }
        let literal = Set(phraseMatched)
        return hits.filter { literal.contains($0.nodeId) }
    }
}

/// A source of passages for a question.
public protocol RetrievalEngine: Sendable {
    /// Short label for the UI, e.g. "On-device corpus".
    var label: String { get }
    /// True when this engine needs the network to answer.
    var requiresNetwork: Bool { get }

    func retrieve(_ request: RetrievalRequest) async throws -> RetrievalResult
}
