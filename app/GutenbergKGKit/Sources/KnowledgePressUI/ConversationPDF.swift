// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// A conversation as a PDF: the Markdown export's content, plus each turn's
// illustration, on US Letter or A4 pages by the reader's locale.
//
// Same record as ConversationMarkdown -- question, provenance, answer, the
// quoted passages with work, author and score -- because a PDF without its
// evidence is no more honest than a Markdown file without it. What it adds
// is the picture and the house style: a masthead with the brand lockup and
// version on the first page, a running header after it, and page numbers.
//
// TextKit 1 does the pagination on both platforms: one text container per
// page, filled until the layout manager runs out of glyphs. It draws image
// attachments itself, so there is no web view to load and wait for. The
// masthead, headers and footers are drawn around the text, page by page.

import Foundation
import GutenbergKGKit

#if canImport(UIKit)
    import UIKit
    private typealias PlatformFont = UIFont
    private typealias PlatformColor = UIColor
    private typealias PlatformImage = UIImage
#elseif canImport(AppKit)
    import AppKit
    private typealias PlatformFont = NSFont
    private typealias PlatformColor = NSColor
    private typealias PlatformImage = NSImage
#endif

@MainActor
enum ConversationPDF {

    static let letter = CGSize(width: 612, height: 792)
    static let a4 = CGSize(width: 595, height: 842)

    /// US Letter where the reader measures in inches, A4 everywhere else.
    static func pageSize(for locale: Locale) -> CGSize {
        locale.measurementSystem == .us ? letter : a4
    }

    /// Render a whole conversation.
    ///
    /// :param conversation: The chat to render.
    /// :param image: PNG (or any image) bytes for a turn's illustration, or
    ///     nil when the turn has none.
    /// :param dateStyle: Formatter for the header date.
    /// :param locale: Picks the paper size.
    /// :param version: Printed in the masthead and footer.
    /// :returns: PDF data, one or more pages.
    static func render(
        _ conversation: Conversation,
        image: (ChatTurn) -> Data?,
        dateStyle: Date.FormatStyle = .dateTime.year().month().day(),
        locale: Locale = .current,
        version: String = AppVersion.display
    ) -> Data {
        let page = Page(size: pageSize(for: locale))
        let date = conversation.createdAt.formatted(dateStyle)
        return paginate(
            document(conversation, image: image, date: date, page: page),
            page: page,
            chrome: Chrome(title: conversation.title, date: date, version: version))
    }

    /// A filename for the exported document: the Markdown one, as `.pdf`.
    static func filename(for conversation: Conversation) -> String {
        let markdown = ConversationMarkdown.filename(for: conversation)
        return String(markdown.dropLast(".md".count)) + ".pdf"
    }

    // MARK: - Geometry and style

    private struct Page {
        let size: CGSize
        let side: CGFloat = 60
        let top: CGFloat = 76
        let bottom: CGFloat = 70
        /// The masthead's depth on page one, down to its green rule.
        let masthead: CGFloat = 92

        var width: CGFloat { size.width - 2 * side }
        /// Page one's text starts below the masthead instead of the header.
        func textTop(first: Bool) -> CGFloat { first ? masthead + 30 : top }
        func textHeight(first: Bool) -> CGFloat { size.height - textTop(first: first) - bottom }
    }

    private struct Chrome {
        let title: String
        let date: String
        let version: String
    }

    // The icon's own colors.
    private static let navy = rgb(0x16, 0x1B, 0x29)
    private static let green = rgb(0x2E, 0xCC, 0x7A)
    private static let deepGreen = rgb(0x23, 0x80, 0x5A)
    private static let ink = rgb(0x22, 0x26, 0x33)
    private static let muted = rgb(0x6B, 0x70, 0x7C)
    private static let hairline = rgb(0xD5, 0xD8, 0xDE)

    private static let body = serif(11)

    private static func rgb(_ r: Int, _ g: Int, _ b: Int) -> PlatformColor {
        PlatformColor(
            red: CGFloat(r) / 255, green: CGFloat(g) / 255, blue: CGFloat(b) / 255, alpha: 1)
    }

    // MARK: - The document

    private static func document(
        _ conversation: Conversation,
        image: (ChatTurn) -> Data?,
        date: String,
        page: Page
    ) -> NSAttributedString {
        let out = NSMutableAttributedString()
        out.append(paragraph(conversation.title, font: serif(24, weight: .bold), color: navy, after: 6))

        let count = conversation.turns.count
        var meta = [date, count == 1 ? "1 question" : "\(count) questions"]
        let scopes = Array(Set(conversation.turns.map(\.corpus))).sorted()
        if !scopes.isEmpty { meta.append(scopes.joined(separator: ", ")) }
        out.append(
            paragraph(
                meta.joined(separator: "  \u{00B7}  "), font: sans(9.5), color: muted, after: 10))
        out.append(rule(width: 48, height: 2.5, color: green, after: 18, page: page))

        for (index, turn) in conversation.turns.enumerated() {
            if index > 0 {
                out.append(rule(width: page.width, height: 0.5, color: hairline, after: 14, page: page))
            }
            out.append(render(turn, number: index + 1, image: image(turn), page: page))
        }

        out.append(rule(width: page.width, height: 0.5, color: hairline, after: 8, page: page))
        out.append(
            paragraph(
                "Generated by The Knowledge Press. Passages are from public-domain texts; "
                    + "scores are the retrieval engine's own.",
                font: sans(8), color: muted))
        return out
    }

    private static func render(_ turn: ChatTurn, number: Int, image: Data?, page: Page)
        -> NSAttributedString
    {
        let out = NSMutableAttributedString()
        out.append(label("QUESTION \(number)", color: deepGreen, after: 3))
        out.append(paragraph(turn.question, font: serif(16, weight: .semibold), color: navy, after: 3))

        var provenance = [turn.corpus, turn.engine.label]
        if let model = turn.metrics?.model { provenance.append(model) }
        out.append(
            paragraph(
                provenance.joined(separator: "  \u{00B7}  "), font: sans(8.5), color: muted,
                after: 10))

        if !turn.answer.isEmpty {
            out.append(answer(turn.answer))
        } else if let failure = turn.synthesisFailure {
            out.append(note(failure.displayMessage))
        } else if let error = turn.errorMessage {
            out.append(note(error))
        } else if turn.engine == .off {
            out.append(note("Answer generation was off; the passages follow."))
        }

        if let image, let attachment = attachment(image, page: page) {
            let picture = NSMutableAttributedString(attachment: attachment)
            picture.append(NSAttributedString(string: "\n"))
            picture.addAttribute(
                .paragraphStyle, value: style(before: 4, after: 4, alignment: .center),
                range: NSRange(location: 0, length: picture.length))
            out.append(picture)
            var caption = "Illustration"
            if let model = turn.generatedImage?.imageModel { caption += "  \u{00B7}  \(model)" }
            out.append(
                paragraph(
                    caption, font: italic(sans(8)), color: muted, after: 12, alignment: .center))
        }

        let hits = turn.retrieval?.hits ?? []
        if !hits.isEmpty {
            out.append(sources(hits, metrics: turn.metrics))
        }
        return out
    }

    /// The answer's Markdown, keeping bold, italic and code spans and its
    /// own line breaks; block syntax such as `- ` stays as the text it is.
    private static func answer(_ markdown: String) -> NSAttributedString {
        let parsed =
            (try? AttributedString(
                markdown: markdown,
                options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(markdown)

        let out = NSMutableAttributedString()
        for run in parsed.runs {
            let intent = run.inlinePresentationIntent ?? []
            var font = body
            if intent.contains(.code) {
                font = .monospacedSystemFont(ofSize: 10, weight: .regular)
            } else if intent.contains(.stronglyEmphasized) && intent.contains(.emphasized) {
                font = italic(serif(11, weight: .bold))
            } else if intent.contains(.stronglyEmphasized) {
                font = serif(11, weight: .bold)
            } else if intent.contains(.emphasized) {
                font = italic(body)
            }
            out.append(
                NSAttributedString(
                    string: String(parsed[run.range].characters),
                    attributes: [.font: font, .foregroundColor: ink]))
        }
        out.append(NSAttributedString(string: "\n"))
        out.addAttribute(
            .paragraphStyle, value: style(after: 12, lineSpacing: 3.5),
            range: NSRange(location: 0, length: out.length))
        return out
    }

    private static func sources(_ hits: [Hit], metrics: SynthesisMetrics?) -> NSAttributedString {
        let quoted = hits.prefix(ConversationMarkdown.quotedPassages)
        var detail = "\(hits.count) retrieved"
        if let used = metrics?.passagesUsed, used < hits.count {
            detail += ", \(used) reached the model"
        }
        if hits.count > quoted.count {
            detail += ", \(quoted.count) quoted"
        }

        let out = NSMutableAttributedString()
        let heading = NSMutableAttributedString(attributedString: label("SOURCES", color: deepGreen))
        heading.deleteCharacters(in: NSRange(location: heading.length - 1, length: 1))
        heading.append(
            NSAttributedString(
                string: "   \(detail)\n", attributes: [.font: sans(8), .foregroundColor: muted]))
        heading.addAttribute(
            .paragraphStyle, value: style(before: 2, after: 6),
            range: NSRange(location: 0, length: heading.length))
        out.append(heading)

        for hit in quoted {
            var attribution = hit.title ?? hit.name
            if let author = hit.author, !author.isEmpty { attribution += ", \(author)" }
            let line = NSMutableAttributedString(
                string: attribution,
                attributes: [.font: sans(9, weight: .semibold), .foregroundColor: navy])
            line.append(
                NSAttributedString(
                    string:
                        "   \(hit.genre ?? hit.kgName)  \u{00B7}  score \(ConversationMarkdown.score(hit.score))\n",
                    attributes: [.font: sans(8), .foregroundColor: muted]))
            line.addAttribute(
                .paragraphStyle, value: style(after: 2, indent: 12),
                range: NSRange(location: 0, length: line.length))
            out.append(line)
            if let text = ConversationMarkdown.passage(hit) {
                out.append(
                    paragraph(
                        "\u{201C}\(text)\u{201D}", font: italic(serif(9.5)), color: muted,
                        after: 7, indent: 12, lineSpacing: 1.5))
            }
        }
        out.append(paragraph("", font: sans(4), after: 6))
        return out
    }

    // MARK: - Pieces

    private static func paragraph(
        _ text: String, font: PlatformFont, color: PlatformColor = ink,
        before: CGFloat = 0, after: CGFloat = 0, indent: CGFloat = 0, lineSpacing: CGFloat = 0,
        alignment: NSTextAlignment = .natural
    ) -> NSAttributedString {
        NSAttributedString(
            string: text + "\n",
            attributes: [
                .font: font, .foregroundColor: color,
                .paragraphStyle: style(
                    before: before, after: after, indent: indent, lineSpacing: lineSpacing,
                    alignment: alignment),
            ])
    }

    /// A small tracked capital label: QUESTION 2, SOURCES.
    private static func label(_ text: String, color: PlatformColor, after: CGFloat = 0)
        -> NSAttributedString
    {
        NSAttributedString(
            string: text + "\n",
            attributes: [
                .font: sans(7.5, weight: .bold), .foregroundColor: color, .kern: 1.4,
                .paragraphStyle: style(after: after),
            ])
    }

    private static func note(_ text: String) -> NSAttributedString {
        paragraph(text, font: italic(body), color: muted, after: 12)
    }

    /// A horizontal rule, drawn as a one-colour attachment so TextKit lays
    /// it out with the text.
    private static func rule(
        width: CGFloat, height: CGFloat, color: PlatformColor, after: CGFloat, page: Page
    ) -> NSAttributedString {
        let attachment = NSTextAttachment()
        attachment.image = swatch(color)
        attachment.bounds = CGRect(x: 0, y: 0, width: min(width, page.width), height: height)
        let out = NSMutableAttributedString(attachment: attachment)
        out.append(NSAttributedString(string: "\n", attributes: [.font: sans(1)]))
        out.addAttribute(
            .paragraphStyle, value: style(after: after),
            range: NSRange(location: 0, length: out.length))
        return out
    }

    private static func swatch(_ color: PlatformColor) -> PlatformImage {
        let size = CGSize(width: 4, height: 4)
        #if canImport(UIKit)
            return UIGraphicsImageRenderer(size: size).image { context in
                color.setFill()
                context.fill(CGRect(origin: .zero, size: size))
            }
        #else
            return NSImage(size: size, flipped: false) { rect in
                color.setFill()
                rect.fill()
                return true
            }
        #endif
    }

    private static func style(
        before: CGFloat = 0, after: CGFloat = 0, indent: CGFloat = 0, lineSpacing: CGFloat = 0,
        alignment: NSTextAlignment = .natural
    ) -> NSParagraphStyle {
        let style = NSMutableParagraphStyle()
        style.paragraphSpacingBefore = before
        style.paragraphSpacing = after
        style.firstLineHeadIndent = indent
        style.headIndent = indent
        style.lineSpacing = lineSpacing
        style.alignment = alignment
        return style
    }

    // MARK: - Fonts

    #if canImport(UIKit)
        private typealias Weight = UIFont.Weight
    #else
        private typealias Weight = NSFont.Weight
    #endif

    private static func sans(_ size: CGFloat, weight: Weight = .regular) -> PlatformFont {
        .systemFont(ofSize: size, weight: weight)
    }

    /// The system serif (New York), falling back to the system font.
    private static func serif(_ size: CGFloat, weight: Weight = .regular) -> PlatformFont {
        let base = PlatformFont.systemFont(ofSize: size, weight: weight)
        guard let descriptor = base.fontDescriptor.withDesign(.serif) else { return base }
        #if canImport(UIKit)
            return UIFont(descriptor: descriptor, size: size)
        #else
            return NSFont(descriptor: descriptor, size: size) ?? base
        #endif
    }

    private static func italic(_ font: PlatformFont) -> PlatformFont {
        #if canImport(UIKit)
            let traits = font.fontDescriptor.symbolicTraits.union(.traitItalic)
            guard let descriptor = font.fontDescriptor.withSymbolicTraits(traits) else { return font }
            return UIFont(descriptor: descriptor, size: font.pointSize)
        #else
            let descriptor = font.fontDescriptor.withSymbolicTraits(
                font.fontDescriptor.symbolicTraits.union(.italic))
            return NSFont(descriptor: descriptor, size: font.pointSize) ?? font
        #endif
    }

    // MARK: - Images

    /// The illustration, scaled to the text width and never taller than half
    /// a page -- an attachment taller than a page would never fit a container
    /// and pagination would stall on it.
    private static func attachment(_ data: Data, page: Page) -> NSTextAttachment? {
        guard let image = PlatformImage(data: data), image.size.width > 0 else { return nil }
        let scale = min(
            page.width / image.size.width, page.textHeight(first: false) / 2 / image.size.height)
        let attachment = NSTextAttachment()
        attachment.image = image
        attachment.bounds = CGRect(
            x: 0, y: 0, width: image.size.width * scale, height: image.size.height * scale)
        return attachment
    }

    /// The brand lockup for light grounds (seal and navy name), rendered from
    /// assets/brand-system/lockup-horizontal-ink.svg, for the masthead.
    private static let logo: PlatformImage? = {
        // `.copy("Resources")` keeps the folder, so a SwiftPM build has it one
        // level down; the app targets' bundles have it at the top.
        guard
            let url = Bundle.module.url(forResource: "Lockup-ink", withExtension: "png")
                ?? Bundle.module.url(
                    forResource: "Lockup-ink", withExtension: "png", subdirectory: "Resources")
        else { return nil }
        return PlatformImage(contentsOfFile: url.path)
    }()

    // MARK: - Pages

    private static func paginate(_ text: NSAttributedString, page: Page, chrome: Chrome) -> Data {
        let storage = NSTextStorage(attributedString: text)
        let layout = NSLayoutManager()
        storage.addLayoutManager(layout)

        var pages: [NSRange] = []
        while true {
            let first = pages.isEmpty
            let container = NSTextContainer(
                size: CGSize(width: page.width, height: page.textHeight(first: first)))
            container.lineFragmentPadding = 0
            layout.addTextContainer(container)
            let range = layout.glyphRange(for: container)
            // An empty page means nothing more will fit; stop rather than
            // add containers forever.
            guard range.length > 0 else { break }
            pages.append(range)
            if NSMaxRange(range) >= layout.numberOfGlyphs { break }
        }

        let bounds = CGRect(origin: .zero, size: page.size)
        let drawPage = { (index: Int) in
            let first = index == 0
            drawChrome(page: page, chrome: chrome, index: index, count: pages.count)
            let origin = CGPoint(x: page.side, y: page.textTop(first: first))
            layout.drawBackground(forGlyphRange: pages[index], at: origin)
            layout.drawGlyphs(forGlyphRange: pages[index], at: origin)
        }

        #if canImport(UIKit)
            return UIGraphicsPDFRenderer(bounds: bounds).pdfData { context in
                for index in pages.indices {
                    context.beginPage()
                    drawPage(index)
                }
            }
        #else
            let data = NSMutableData()
            var mediaBox = bounds
            guard let consumer = CGDataConsumer(data: data as CFMutableData),
                let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil)
            else { return Data() }
            let previous = NSGraphicsContext.current
            for index in pages.indices {
                context.beginPDFPage(nil)
                // AppKit text draws top-down; flip the page to match.
                context.translateBy(x: 0, y: page.size.height)
                context.scaleBy(x: 1, y: -1)
                NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: true)
                drawPage(index)
                context.endPDFPage()
            }
            NSGraphicsContext.current = previous
            context.closePDF()
            return data as Data
        #endif
    }

    /// The masthead on page one, the running header after it, and the footer
    /// on every page. Coordinates are top-down on both platforms.
    private static func drawChrome(page: Page, chrome: Chrome, index: Int, count: Int) {
        let left = page.side
        let right = page.size.width - page.side

        if index == 0 {
            // Light masthead: the lockup on the page itself, a green rule
            // under it. A solid navy band outweighed the text it introduced.
            let lockupHeight: CGFloat = 30
            if let logo {
                let width = lockupHeight * logo.size.width / logo.size.height
                draw(logo, in: CGRect(x: left, y: 36, width: width, height: lockupHeight))
            }
            text(
                "A local, source-grounded way to ask better questions of great books.",
                italic(serif(8.5)), muted, at: CGPoint(x: left, y: 72))
            text(chrome.version, sans(8, weight: .semibold), deepGreen, rightAt: CGPoint(x: right, y: 46))
            fill(CGRect(x: left, y: page.masthead, width: page.width, height: 1.5), green)
        } else {
            let font = sans(7.5, weight: .bold)
            text("THE KNOWLEDGE PRESS", font, deepGreen, at: CGPoint(x: left, y: 36), kern: 1.4)
            text(truncated(chrome.title, 70), sans(7.5), muted, rightAt: CGPoint(x: right, y: 36))
            fill(CGRect(x: left, y: 50, width: page.width, height: 0.5), hairline)
        }

        let footerY = page.size.height - 44
        fill(CGRect(x: left, y: footerY - 8, width: page.width, height: 0.5), hairline)
        text(
            "Knowledge Press \(chrome.version)  \u{00B7}  \(chrome.date)", sans(7.5), muted,
            at: CGPoint(x: left, y: footerY))
        text(
            "Page \(index + 1) of \(count)", sans(7.5, weight: .semibold), muted,
            rightAt: CGPoint(x: right, y: footerY))
    }

    private static func truncated(_ text: String, _ limit: Int) -> String {
        text.count > limit ? text.prefix(limit - 3) + "..." : text
    }

    private static func fill(_ rect: CGRect, _ color: PlatformColor) {
        #if canImport(UIKit)
            guard let context = UIGraphicsGetCurrentContext() else { return }
        #else
            guard let context = NSGraphicsContext.current?.cgContext else { return }
        #endif
        context.setFillColor(color.cgColor)
        context.fill(rect)
    }

    private static func draw(_ image: PlatformImage, in rect: CGRect) {
        #if canImport(UIKit)
            image.draw(in: rect)
        #else
            image.draw(
                in: rect, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true,
                hints: nil)
        #endif
    }

    private static func text(
        _ string: String, _ font: PlatformFont, _ color: PlatformColor, at point: CGPoint,
        kern: CGFloat = 0
    ) {
        NSAttributedString(string: string, attributes: [.font: font, .foregroundColor: color, .kern: kern])
            .draw(at: point)
    }

    private static func text(
        _ string: String, _ font: PlatformFont, _ color: PlatformColor, rightAt point: CGPoint
    ) {
        let attributed = NSAttributedString(
            string: string, attributes: [.font: font, .foregroundColor: color])
        attributed.draw(at: CGPoint(x: point.x - attributed.size().width, y: point.y))
    }
}
