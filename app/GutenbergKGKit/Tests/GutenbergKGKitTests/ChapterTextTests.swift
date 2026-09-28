// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The reader's text: chunk seams without repeated sentences, and prose
// unwrapped without flattening verse. The last suite reads a real chapter, so
// it needs a built corpus:
//
//     GUTENBERG_PACKS=bundles/gutenberg-all/swift swift test

import Foundation
import Testing

@testable import GutenbergKGKit

struct ChapterTextJoinTests {

    private func chunk(_ start: Int?, _ text: String) -> ChapterText.Chunk {
        ChapterText.Chunk(start: start, text: text)
    }

    @Test func dropsTheSentenceTwoChunksShare() {
        let first = "We got six thousand dollars apiece. It was an awful sight of money when\nit was piled up."
        let second = "It was an awful sight of money when\nit was piled up. Well, Judge Thatcher took it."
        let text = ChapterText.join([chunk(0, first), chunk(35, second)])
        #expect(text.components(separatedBy: "an awful sight of money").count == 2)
        #expect(text.hasSuffix("piled up. Well, Judge Thatcher took it."))
    }

    @Test func separatesChunksThatDoNotOverlap() {
        let text = ChapterText.join([
            chunk(0, "Polly, or the widow, or maybe Mary."), chunk(40, "Aunt Polly, she is and Mary."),
        ])
        #expect(text == "Polly, or the widow, or maybe Mary.\n\nAunt Polly, she is and Mary.")
    }

    @Test func dropsAShortRepeatWhenTheOffsetsOverlap() {
        // The chunker repeated one short sentence; the offsets agree.
        let first = "Let him keep back or he'll be shot. Come along now."
        let second = "Come along now. Come slow; push the door open yourself."
        let text = ChapterText.join([chunk(100, first), chunk(135, second)])
        #expect(text == "Let him keep back or he'll be shot. Come along now. Come slow; push the door open yourself.")
    }

    @Test func keepsAShortRepeatWhenTheOffsetsDoNot() {
        // "the end." recurs by chance in chunks that do not overlap.
        let text = ChapterText.join([chunk(0, "He came to the end."), chunk(30, "the end. Then more.")])
        #expect(text == "He came to the end.\n\nthe end. Then more.")
    }

    @Test func ignoresAPartialWordMatch() {
        // Offsets overlap, but "ow." is the tail of "now." and the head of
        // "ow." is not a word boundary match.
        let text = ChapterText.join([chunk(0, "Come along now."), chunk(10, "ow. And then.")])
        #expect(text == "Come along now.\n\now. And then.")
    }
}

struct ChapterTextReflowTests {

    @Test func unwrapsHardWrappedProse() {
        let prose = """
            You don't know about me without you have read a book by the name of The
            Adventures of Tom Sawyer; but that ain't no matter. That book was made
            by Mr. Mark Twain, and he told the truth, mainly. There was things
            which he stretched, but mainly he told the truth.
            """
        let text = ChapterText.reflow(prose)
        #expect(!text.contains("\n"))
        #expect(text.contains("the name of The Adventures of Tom Sawyer"))
    }

    @Test func keepsVerseLines() {
        let verse = """
            Once upon a midnight dreary, while I pondered, weak and weary,
            Over many a quaint and curious volume of forgotten lore—
            While I nodded, nearly napping, suddenly there came a tapping,
            As of some one gently rapping, rapping at my chamber door.
            """
        #expect(ChapterText.reflow(verse) == verse)
    }

    @Test func joinsAVerseLineTheEditionWrapped() {
        let verse = """
            Here lands female and male,
            Here the heir-ship and heiress-ship of the world, here the flame of
            materials,
            Here spirituality the translatress, the openly-avow'd,
            """
        let lines = ChapterText.reflow(verse).components(separatedBy: "\n")
        #expect(lines.count == 3)
        #expect(lines[1].hasSuffix("the flame of materials,"))
    }

    @Test func keepsBlankVerseThatRunsOnAcrossLines() {
        // Cary's Dante: lines stop mid-phrase like wrapped prose, but every
        // line starts with a capital.
        let verse = """
            In the midway of this our mortal life,
            I found me in a gloomy wood, astray
            Gone from the path direct: and e'en to tell
            It were no easy task, how savage wild
            That forest, how robust and rough its growth,
            """
        #expect(ChapterText.reflow(verse) == verse)
    }

    @Test func keepsWhitmansLinesAndJoinsOnlyTheirWraps() {
        let verse = """
            Swiftly arose and spread around me the peace and knowledge that pass
            all the argument of the earth,
            And I know that the hand of God is the promise of my own,
            And I know that the spirit of God is the brother of my own,
            """
        let lines = ChapterText.reflow(verse).components(separatedBy: "\n")
        #expect(lines.count == 3)
        #expect(lines[0].hasSuffix("that pass all the argument of the earth,"))
    }

    @Test func unwrapsProseWithStageDirections() {
        let prose = """
            RANK.
            _[after a short silence]_. When I am sitting here, talking to you as
            intimately as this, I cannot imagine for a moment what would have
            become of me if I had never come into this house.
            """
        #expect(!ChapterText.reflow(prose).contains("\n"))
    }

    @Test func keepsAListOfShortTitles() {
        let list = "The Widows\nMoses and the Bulrushers\nMiss Watson\nHuck Stealing Away"
        #expect(ChapterText.reflow(list) == list)
    }

    @Test func keepsParagraphBreaks() {
        let text = ChapterText.reflow("First paragraph.\n\nSecond paragraph.")
        #expect(text == "First paragraph.\n\nSecond paragraph.")
    }
}

private var packsDirectory: URL? {
    guard let path = ProcessInfo.processInfo.environment["GUTENBERG_PACKS"], !path.isEmpty
    else { return nil }
    return URL(fileURLWithPath: (path as NSString).expandingTildeInPath, isDirectory: true)
}

@Suite(.enabled(if: packsDirectory != nil, "set GUTENBERG_PACKS to a built corpus"))
struct ChapterTextCorpusTests {

    @Test func huckleberryFinnChapterOneReadsCleanly() async throws {
        let directory = try #require(packsDirectory)
        let browser = LocalBrowser(packs: try CorpusPacks(directory: directory))
        let books = try await browser.listBooks(genre: "american-literature")
        let huck = try #require(books.first { ($0.title ?? "").contains("Huckleberry Finn") })
        let chapters = try await browser.chapters(genre: "american-literature", book: huck.book)
        let first = try #require(chapters.first { ($0.title ?? "").uppercased().hasPrefix("CHAPTER I.") })
        let content = try await browser.chapter(
            genre: "american-literature", book: huck.book, sectionId: first.id)

        #expect(content.text.components(separatedBy: "an awful sight of money when").count == 2)
        let shown = ChapterText.reflow(content.text)
        #expect(shown.contains("by the name of The Adventures of Tom Sawyer"))
    }
}
