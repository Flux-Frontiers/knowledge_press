// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// A one-book scope against the real packs: every hit comes from that book.
// Needs a built corpus:
//
//     GUTENBERG_PACKS=bundles/gutenberg-all/swift swift test --filter ScopedRetrieval

import Foundation
import Testing

@testable import GutenbergKGKit

private var packsDirectory: URL? {
    guard let path = ProcessInfo.processInfo.environment["GUTENBERG_PACKS"], !path.isEmpty
    else { return nil }
    return URL(fileURLWithPath: (path as NSString).expandingTildeInPath, isDirectory: true)
}

@Suite(.enabled(if: packsDirectory != nil, "set GUTENBERG_PACKS to a built corpus"))
struct ScopedRetrievalTests {

    private func hits(_ query: String, corpus: String) async throws -> [Hit] {
        let packs = try CorpusPacks(directory: try #require(packsDirectory))
        return try await LocalRetrieval(packs: packs).retrieve(
            RetrievalRequest(query: query, corpus: corpus)
        ).hits
    }

    @Test func aBookScopeReturnsOnlyThatBook() async throws {
        let found = try await hits("murder and sleep no more", corpus: "shakespeare/Macbeth")
        #expect(!found.isEmpty)
        #expect(found.allSatisfy { $0.sourcePath?.hasPrefix("shakespeare/Macbeth/") == true })
    }

    @Test func aDiaryScopeReturnsOnlyThatDiary() async throws {
        let found = try await hits(
            "the Great Fire of London", corpus: "diaries/The Diary of Samuel Pepys \u{2014} Complete")
        #expect(!found.isEmpty)
        #expect(found.allSatisfy { $0.kgName == "pepys-complete" })
    }
}
