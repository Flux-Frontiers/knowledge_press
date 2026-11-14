// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The block model the reader shows and read-aloud speaks, held to the same
// fixtures as the web forest's chapterBlocks.ts (web/tests/chapterBlocks.test.mjs).

import Foundation
import Testing

@testable import GutenbergKGKit

struct ChapterBlocksTests {

    struct Case: Decodable {
        struct Run: Decodable {
            let text: String
            let style: String?
        }
        struct Block: Decodable {
            let kind: String
            let runs: [Run]
            let spoken: String
        }
        let name: String
        let title: String
        let input: String
        let expected: [Block]
    }

    @Test func blocksMatchTheSharedFixtures() throws {
        let url = try #require(
            Bundle.module.url(forResource: "chapter_blocks", withExtension: "json", subdirectory: "Fixtures"))
        let cases = try JSONDecoder().decode([Case].self, from: Data(contentsOf: url))
        #expect(!cases.isEmpty)
        for item in cases {
            let expected = item.expected.map { block in
                ChapterBlocks.Block(
                    kind: ChapterBlocks.Block.Kind(rawValue: block.kind)!,
                    runs: block.runs.map { ChapterBlocks.Run(text: $0.text, style: $0.style.flatMap(ChapterBlocks.Run.Style.init)) },
                    spoken: block.spoken)
            }
            #expect(ChapterBlocks.blocks(item.input, title: item.title) == expected, "\(item.name)")
        }
    }

    @Test func verseLinesSplitARunThatCrossesABreak() {
        let lines = ChapterBlocks.lines([
            .init(text: "Tyger Tyger, "), .init(text: "burning\nbright", style: .italic),
        ])
        #expect(lines == [
            [.init(text: "Tyger Tyger, "), .init(text: "burning", style: .italic)],
            [.init(text: "bright", style: .italic)],
        ])
    }
}
