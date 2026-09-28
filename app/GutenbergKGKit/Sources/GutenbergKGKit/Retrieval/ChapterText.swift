// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Turning a chapter's chunks back into readable text. Two things go wrong if
// the chunks are simply concatenated: the chunker overlaps neighbours, so a
// sentence at each seam appears twice, and the source keeps the printed
// edition's hard line wrap, so prose breaks mid-sentence on a phone.

import Foundation

public enum ChapterText {

    /// One chunk of a chapter: its stored offset and its text.
    public struct Chunk: Sendable {
        public let start: Int?
        public let text: String

        public init(start: Int?, text: String) {
            self.start = start
            self.text = text
        }
    }

    /// Join chunks in reading order, dropping the text each one repeats.
    ///
    /// The chunker overlaps neighbours by up to a sentence or two. The
    /// overlap is found by matching text: the stored offsets are off by a
    /// character here and there, and a wrong cut is worse than a repeat.
    /// Offsets still decide how short a match may be. A repeat of 20
    /// characters or more is always the chunker's; a shorter one ("Come
    /// along now.") counts only when the offsets say the chunks overlap and
    /// the match sits on word boundaries, so a phrase that merely recurs is
    /// kept.
    ///
    /// :param chunks: The chapter's chunks, ordered by `char_start`.
    /// :returns: The chapter's text; chunks with no overlap are separated by a
    ///     blank line, overlapping ones continue the same paragraph.
    public static func join(_ chunks: [Chunk]) -> String {
        var text = ""
        var previous: Chunk?
        for chunk in chunks {
            defer { previous = chunk }
            guard let previous, !text.isEmpty else {
                text = chunk.text
                continue
            }
            var offsetsOverlap = false
            if let before = previous.start, let start = chunk.start {
                offsetsOverlap = before + previous.text.unicodeScalars.count > start
            }
            let overlap = overlapLength(
                tail: text, head: chunk.text, offsetsOverlap: offsetsOverlap)
            if overlap > 0 {
                text += chunk.text.dropFirst(overlap)
            } else {
                text += "\n\n" + chunk.text
            }
        }
        return text
    }

    /// Unwrap hard-wrapped prose; leave verse and lists as they are.
    ///
    /// A paragraph is wrapped prose when at least three in ten of its lines
    /// continue in lower case, at least eight in ten of its line breaks are
    /// continuations (the next line starts in lower case, or the line before
    /// stops mid-phrase), and its lines average 30 characters or more; those
    /// lines are joined with spaces. Verse capitalises every line, which
    /// keeps blank verse and Dante's terza rima; Whitman's long lines wrap in
    /// lower case but break after punctuation, which the second test keeps.
    /// In anything that is not prose, a line is joined to the one before only
    /// when it starts in lower case, which is a wrapped verse line. A line is
    /// judged by its first letter, so a stage direction such as
    /// `_[hiding the packet]_` counts as lower case.
    ///
    /// :param text: A chapter's text.
    /// :returns: The same text with paragraphs separated by one blank line.
    public static func reflow(_ text: String) -> String {
        text.replacingOccurrences(of: "\r\n", with: "\n")
            .components(separatedBy: "\n\n")
            .map { reflowParagraph($0) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    // MARK: - Internals

    /// The shortest overlap worth treating as one; shorter matches are chance.
    static let minimumOverlap = 20
    /// The longest overlap the chunker produces, with room to spare.
    static let maximumOverlap = 400

    static func overlapLength(tail: String, head: String, offsetsOverlap: Bool) -> Int {
        let limit = min(maximumOverlap, tail.count, head.count)
        let floor = offsetsOverlap ? 2 : minimumOverlap
        guard limit >= floor else { return 0 }
        for length in stride(from: limit, through: floor, by: -1)
        where tail.hasSuffix(head.prefix(length)) {
            if length >= minimumOverlap { return length }
            let before = tail.dropLast(length).last ?? " "
            let after = head.dropFirst(length).first ?? " "
            if before.isWhitespace && after.isWhitespace { return length }
        }
        return 0
    }

    static func reflowParagraph(_ paragraph: String) -> String {
        let lines = paragraph.components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        guard lines.count > 1 else { return lines.first ?? "" }

        if isWrappedProse(lines) {
            return lines.joined(separator: " ")
        }
        var out: [String] = []
        for line in lines {
            if let last = out.last, startsLowercase(line) {
                out[out.count - 1] = last + " " + line
            } else {
                out.append(line)
            }
        }
        return out.joined(separator: "\n")
    }

    static func isWrappedProse(_ lines: [String]) -> Bool {
        let rest = lines.dropFirst()
        let lower = rest.filter(startsLowercase).count
        let continuations = zip(lines, rest).filter { line, next in
            guard let last = line.last else { return false }
            return startsLowercase(next) || last.isLetter || last.isNumber
        }.count
        let averageLength = lines.reduce(0) { $0 + $1.count } / lines.count
        return lower * 10 >= rest.count * 3
            && continuations * 10 >= rest.count * 8
            && averageLength >= 30
    }

    static func startsLowercase(_ line: String) -> Bool {
        line.first(where: \.isLetter)?.isLowercase ?? false
    }
}
