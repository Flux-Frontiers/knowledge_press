// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// A chapter's text as blocks the reader shows and read-aloud speaks: the
// Swift twin of web/src/game/chapterBlocks.ts. Both are held to
// Tests/GutenbergKGKitTests/Fixtures/chapter_blocks.json, so a change to
// either has to change both.
//
// Matching uses NSRegularExpression on purpose: its ranges are UTF-16, as
// JavaScript's are, so the two ports cut text at the same places. Digits are
// written [0-9], since ICU's \d also matches non-ASCII digits and JS's does not.

import Foundation

public enum ChapterBlocks {

    /// A piece of a block's text and how the page sets it.
    public struct Run: Equatable, Sendable {
        /// italic and bold: `_x_` and `**x**`. mark: a footnote mark such as
        /// `[1]`. aside: an inline `[Footnote: ...]` or `[Sidenote: ...]`.
        public enum Style: String, Sendable { case italic, bold, mark, aside }

        public let text: String
        public let style: Style?

        public init(text: String, style: Style? = nil) {
            self.text = text
            self.style = style
        }
    }

    /// One paragraph. prose has no line breaks; verse keeps them. heading is
    /// a short line in capitals. note is a footnote or sidenote, caption an
    /// illustration's; neither is spoken.
    public struct Block: Equatable, Sendable {
        public enum Kind: String, Sendable { case prose, verse, heading, note, caption }

        public let kind: Kind
        public let runs: [Run]
        /// What a voice says: the text without markup, footnote marks or
        /// asides. Empty for note and caption.
        public let spoken: String

        public init(kind: Kind, runs: [Run], spoken: String) {
            self.kind = kind
            self.runs = runs
            self.spoken = spoken
        }
    }

    /// Cut a chapter into blocks.
    ///
    /// :param text: The chapter's text as stored: hard-wrapped, with markup.
    /// :param title: The chapter's title; a first line that only repeats it
    ///     is dropped.
    /// :returns: The blocks in reading order.
    public static func blocks(_ text: String, title: String = "") -> [Block] {
        let paragraphs = ChapterText.reflow(text).components(separatedBy: "\n\n")
        var blocks: [Block] = []
        var i = 0
        while i < paragraphs.count {
            defer { i += 1 }
            var p = paragraphs[i]
            if matches(rule, p) { continue }  // the export's rule under the author line

            if matches(bracketStart, p) {
                // A caption or footnote that runs on: gather paragraphs until its bracket closes.
                var depth = bracketBalance(p)
                var j = i
                while depth > 0 && j + 1 < paragraphs.count && j - i < maxBracketParagraphs {
                    j += 1
                    p += "\n\n" + paragraphs[j]
                    depth += bracketBalance(paragraphs[j])
                }
                // Never closed (the source dropped the "]"): the first paragraph alone is the note or caption.
                if depth == 0 { i = j } else { p = paragraphs[i] }
                if let block = bracketBlock(p) { blocks.append(block) }
                continue
            }

            if matches(noteBody, p) {
                blocks.append(Block(kind: .note, runs: inlineRuns(p), spoken: ""))
                continue
            }

            let runs = inlineRuns(p)
            let plain = runs.map(\.text).joined()
            let kind: Block.Kind =
                p.contains("\n")
                ? .verse
                : plain.unicodeScalars.count <= 80 && matches(twoCapitals, plain) && !matches(lower, plain)
                    ? .heading : .prose
            if blocks.isEmpty && !title.isEmpty && titleKey(plain) == titleKey(title) { continue }
            blocks.append(Block(kind: kind, runs: runs, spoken: spokenText(runs)))
        }
        return blocks
    }

    /// A verse block's runs cut at its line breaks, so each line can be set
    /// with a hanging indent. A run that crosses a break is split in two.
    ///
    /// :param runs: A block's runs.
    /// :returns: One list of runs per line.
    public static func lines(_ runs: [Run]) -> [[Run]] {
        var lines: [[Run]] = [[]]
        for run in runs {
            for (i, text) in run.text.components(separatedBy: "\n").enumerated() {
                if i > 0 { lines.append([]) }
                if !text.isEmpty { lines[lines.count - 1].append(Run(text: text, style: run.style)) }
            }
        }
        return lines
    }

    // MARK: - Internals

    /// The furthest a bracketed block is followed looking for its `]`.
    static let maxBracketParagraphs = 30

    private static func regex(_ pattern: String, _ options: NSRegularExpression.Options = []) -> NSRegularExpression {
        // The patterns are fixed; a bad one is a programming error caught by the tests.
        try! NSRegularExpression(pattern: pattern, options: options)
    }

    static let rule = regex(#"^-{3,}\z"#)
    /// Bracketed blocks that may run over several paragraphs.
    static let bracketStart = regex(#"^\[(Footnote|Illustration|Sidenote)\b"#)
    /// A footnote's body: `[1] A quotation from the Aeneid.`
    static let noteBody = regex(#"^\[[0-9]{1,3}\]\s"#)
    /// A heading has two capitals at least, so a paragraph of "I." or "O!" stays prose.
    static let twoCapitals = regex(#"\p{Lu}[\s\S]*\p{Lu}"#)
    static let lower = regex(#"\p{Lowercase}"#)
    /// Inline markup. `_x_` opens only where a word does not, so `C_{2}H` is
    /// left alone, and may close inside one, as in `_my_self`.
    static let inline = regex(
        #"(^|[^\p{L}\p{N}])_(?=\S)([^_]*?[^_\s])_|\*\*([^*\n]+)\*\*|\[([0-9]{1,3})\]|\[((?:Footnote|Sidenote)\b[^\]]*)\]"#)
    static let bracketParts = regex(#"^\[(Footnote|Illustration|Sidenote)\b[\s0-9]*:?\s*([\s\S]*?)\]?\z"#)
    static let digitsOnly = regex(#"^[0-9]*\z"#)
    static let partOf = regex(#"\(Part [0-9]+ of [0-9]+\)"#, [.caseInsensitive])
    static let nonWord = regex(#"[^\p{L}\p{N}]+"#)

    private static func matches(_ re: NSRegularExpression, _ s: String) -> Bool {
        re.firstMatch(in: s, range: NSRange(location: 0, length: (s as NSString).length)) != nil
    }

    private static func replace(_ s: String, _ pattern: String, with template: String) -> String {
        replace(s, regex(pattern), with: template)
    }

    private static func replace(_ s: String, _ re: NSRegularExpression, with template: String) -> String {
        re.stringByReplacingMatches(
            in: s, range: NSRange(location: 0, length: (s as NSString).length), withTemplate: template)
    }

    static func inlineRuns(_ text: String) -> [Run] {
        let ns = text as NSString
        var runs: [Run] = []
        var at = 0
        func group(_ m: NSTextCheckingResult, _ n: Int) -> String? {
            let r = m.range(at: n)
            return r.location == NSNotFound ? nil : ns.substring(with: r)
        }
        for m in inline.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            let start = m.range.location + (group(m, 1)?.utf16.count ?? 0)
            if start > at { runs.append(Run(text: ns.substring(with: NSRange(location: at, length: start - at)))) }
            if let s = group(m, 2) {
                runs.append(Run(text: s, style: .italic))
            } else if let s = group(m, 3) {
                runs.append(Run(text: s, style: .bold))
            } else if let s = group(m, 4) {
                runs.append(Run(text: s, style: .mark))
            } else {
                runs.append(Run(text: group(m, 5) ?? "", style: .aside))
            }
            at = m.range.location + m.range.length
        }
        if at < ns.length { runs.append(Run(text: ns.substring(from: at))) }
        return runs
    }

    static func spokenText(_ runs: [Run]) -> String {
        var s = runs.filter { $0.style != .mark && $0.style != .aside }.map(\.text).joined()
        // A stage direction is read, its brackets are not; an underscore left
        // unpaired (italics the source carries across paragraphs) is not said either.
        s = replace(s, #"[\[\]_]"#, with: "")
        s = replace(s, #"[ \t]+"#, with: " ")
        s = replace(s, #" *\n *"#, with: "\n")
        s = replace(s, #" ([,.;:!?])"#, with: "$1")
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Bracket depth change across a string.
    static func bracketBalance(_ s: String) -> Int {
        s.reduce(0) { $0 + ($1 == "[" ? 1 : $1 == "]" ? -1 : 0) }
    }

    /// The block for a bracketed paragraph: `[Illustration: x]` is a caption, the rest are notes.
    static func bracketBlock(_ text: String) -> Block? {
        let ns = text as NSString
        let m = bracketParts.firstMatch(in: text, range: NSRange(location: 0, length: ns.length))
        let label = m.map { ns.substring(with: $0.range(at: 1)) } ?? "Footnote"
        let body = (m.map { ns.substring(with: $0.range(at: 2)) } ?? text)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if label == "Illustration" {
            // "[Illustration]" and "[Illustration: 0202]" (a plate number) have nothing to show.
            return matches(digitsOnly, body) ? nil : Block(kind: .caption, runs: inlineRuns(body), spoken: "")
        }
        return Block(kind: .note, runs: inlineRuns(replace(text, #"^\[|\]\z"#, with: "")), spoken: "")
    }

    /// Lower case, punctuation and "(Part n of m)" gone, for comparing a title with a line.
    static func titleKey(_ s: String) -> String {
        var out = s
        let ns = out as NSString
        if let m = partOf.firstMatch(in: out, range: NSRange(location: 0, length: ns.length)) {
            out = ns.replacingCharacters(in: m.range, with: "")
        }
        return replace(out, nonWord, with: " ").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }
}
