// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// "Export as Markdown" and "Export as PDF" -- the open conversation, through
// the system share sheet. Only the PDF carries the illustrations.
//
// It shares the *open* conversation rather than offering the action on every
// row in the list, and that is a deliberate narrowing of the plan. A row
// carries only a ConversationSummary; exporting one would mean reading its
// file to build the share item, and `ShareLink` needs that item up front, so
// every context menu that merely *opened* would hit the disk on the main
// actor. The chat on screen is already in memory, which is where the share
// sheet can be offered for free.

import CoreTransferable
import SwiftUI
import UniformTypeIdentifiers

/// A conversation rendered for sharing, with a filename the receiving app
/// can use.
struct ExportedConversation: Transferable {
    let markdown: String
    let filename: String

    static var transferRepresentation: some TransferRepresentation {
        // Plain text rather than a Markdown UTType: every destination that
        // matters (Mail, Notes, Files, Messages) accepts it, and the `.md`
        // extension is what tells an editor how to read it.
        DataRepresentation(exportedContentType: .plainText) { exported in
            Data(exported.markdown.utf8)
        }
        .suggestedFileName { $0.filename }
    }
}

/// A conversation to share as a PDF, rendered only when the share sheet asks
/// for the bytes rather than every time the toolbar draws.
struct ExportedConversationPDF: Transferable {
    let conversation: Conversation
    /// This session's illustrations, as base64, for turns whose PNG may not
    /// be on disk yet.
    let inlineImages: [ChatTurn.ID: String]
    /// Where each saved turn's PNG lives.
    let imageURLs: [ChatTurn.ID: URL]
    let filename: String

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .pdf) { exported in
            await exported.render()
        }
        .suggestedFileName { $0.filename }
    }

    @MainActor
    private func render() -> Data {
        ConversationPDF.render(conversation) { turn in
            if let b64 = inlineImages[turn.id], let data = Data(base64Encoded: b64) {
                return data
            }
            return imageURLs[turn.id].flatMap { try? Data(contentsOf: $0) }
        }
    }
}

struct ExportConversationButton: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let conversation = exportable {
            Menu {
                ShareLink(
                    item: ExportedConversation(
                        markdown: ConversationMarkdown.render(conversation),
                        filename: ConversationMarkdown.filename(for: conversation)),
                    preview: SharePreview(conversation.title)
                ) {
                    Label("Export as Markdown", systemImage: "doc.plaintext")
                }
                ShareLink(
                    item: ExportedConversationPDF(
                        conversation: conversation,
                        inlineImages: inlineImages,
                        imageURLs: imageURLs(conversation),
                        filename: ConversationPDF.filename(for: conversation)),
                    preview: SharePreview(conversation.title)
                ) {
                    Label("Export as PDF (with images)", systemImage: "doc.richtext")
                }
            } label: {
                Label("Export", systemImage: "square.and.arrow.up")
            }
        }
    }

    private var inlineImages: [ChatTurn.ID: String] {
        Dictionary(
            model.turns.compactMap { turn in turn.generatedImage.map { (turn.id, $0.imageB64) } },
            uniquingKeysWith: { first, _ in first })
    }

    /// Paths only; nothing is read until the PDF is rendered.
    private func imageURLs(_ conversation: Conversation) -> [ChatTurn.ID: URL] {
        guard let store = model.store, model.activeConversation?.id == conversation.id
        else { return [:] }
        var urls: [ChatTurn.ID: URL] = [:]
        for turn in conversation.turns {
            if let file = turn.imageFile {
                urls[turn.id] = store.imageURL(conversation: conversation.id, file: file)
            }
        }
        return urls
    }

    /// The conversation to share: the saved one when there is one, otherwise
    /// whatever is on screen, so a chat can be exported before its first turn
    /// has finished being written to disk.
    private var exportable: Conversation? {
        if let active = model.activeConversation { return active }
        guard !model.turns.isEmpty else { return nil }
        return Conversation(
            title: ConversationTitle.title(for: model.turns[0].question),
            turns: model.turns)
    }
}
