// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The release notes, shown once after the app updates.
//
// Most readers have automatic updates on, so the App Store never tells them
// anything changed. The first launch of a newer version shows this release's
// notes in a sheet. Resources/ReleaseNotes.md is a copy of the repo's
// release-notes.md, written by the release skill; scripts/check_version.py
// fails when its version differs from the others.

import SwiftUI

enum WhatsNew {

    /// The last version whose launch this device has seen.
    static let lastSeenKey = "whatsNewLastSeenVersion"

    /// One block of the notes, in order.
    enum Block: Equatable {
        case heading(String)
        case paragraph(String)
        case bullet(String)
    }

    /// A parsed release-notes file.
    struct Notes: Equatable, Identifiable {
        let version: String
        let released: String?
        let blocks: [Block]

        var id: String { version }
    }

    /// Whether a launch of `current` should show the notes.
    ///
    /// No stored version means a fresh install, or a device updating from a
    /// build that predates this sheet; neither is shown anything. Only a
    /// strictly newer version counts, so a downgrade stays quiet.
    ///
    /// :param current: The running version, e.g. "1.51.0".
    /// :param lastSeen: The version stored at the last launch, if any.
    /// :returns: True when the notes should be shown.
    static func shouldShow(current: String, lastSeen: String?) -> Bool {
        guard let lastSeen else { return false }
        return current.compare(lastSeen, options: .numeric) == .orderedDescending
    }

    /// Parse release-notes.md into blocks.
    ///
    /// Handles exactly what the release skill writes: a `# Release Notes --
    /// vX.Y.Z` title, a `> Released:` line, `###` headings, `-` bullets with
    /// indented continuation lines, plain paragraphs, and a `---` before the
    /// changelog footer, which is dropped (its link is relative to the repo).
    ///
    /// :param markdown: The file's text.
    /// :returns: The notes, or nil when the title line is missing.
    static func parse(_ markdown: String) -> Notes? {
        var lines = markdown.components(separatedBy: "\n")[...]
        guard let title = lines.popFirst(),
            let range = title.range(of: "# Release Notes -- v")
        else { return nil }
        let version = String(title[range.upperBound...]).trimmingCharacters(in: .whitespaces)

        var released: String?
        var blocks: [Block] = []
        var current: Block?

        func flush() {
            if let block = current { blocks.append(block) }
            current = nil
        }

        for raw in lines {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line == "---" { break }
            if line.isEmpty {
                flush()
            } else if line.hasPrefix("> Released:") {
                flush()
                released = line.dropFirst("> Released:".count).trimmingCharacters(in: .whitespaces)
            } else if line.hasPrefix("#") {
                flush()
                blocks.append(.heading(line.drop { $0 == "#" }.trimmingCharacters(in: .whitespaces)))
            } else if line.hasPrefix("- ") {
                flush()
                current = .bullet(String(line.dropFirst(2)))
            } else {
                switch current {
                case .bullet(let text): current = .bullet(text + " " + line)
                case .paragraph(let text): current = .paragraph(text + " " + line)
                case .heading, nil: current = .paragraph(line)
                }
            }
        }
        flush()
        return Notes(version: version, released: released, blocks: blocks)
    }

    /// The notes to show at this launch, if any, recording the launch.
    ///
    /// Nil from `swift run` (no Info.plist, so no real version) and when the
    /// bundled notes are for some other version than the one running.
    ///
    /// :param defaults: Where the last-seen version is kept.
    /// :param info: The app's Info.plist values.
    /// :param notesText: The bundled release notes.
    /// :returns: The notes to show, or nil.
    static func pending(
        defaults: UserDefaults = .standard,
        info: [String: Any]? = Bundle.main.infoDictionary,
        notesText: String? = bundledText()
    ) -> Notes? {
        guard let current = info?["CFBundleShortVersionString"] as? String, !current.isEmpty
        else { return nil }
        let lastSeen = defaults.string(forKey: lastSeenKey)
        defaults.set(current, forKey: lastSeenKey)
        guard shouldShow(current: current, lastSeen: lastSeen),
            let notes = notesText.flatMap(parse), notes.version == current
        else { return nil }
        return notes
    }

    static func bundledText() -> String? {
        // `.copy("Resources")` keeps the folder in a SwiftPM build; the app
        // targets' bundles have the file at the top, as for the splash icon.
        guard
            let url = Bundle.module.url(forResource: "ReleaseNotes", withExtension: "md")
                ?? Bundle.module.url(
                    forResource: "ReleaseNotes", withExtension: "md", subdirectory: "Resources")
        else { return nil }
        return try? String(contentsOf: url, encoding: .utf8)
    }
}

/// The sheet itself: the notes as headings, paragraphs and bullets.
struct WhatsNewView: View {
    let notes: WhatsNew.Notes
    let onDone: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let released = notes.released {
                        Text("Released \(released)")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                    ForEach(Array(notes.blocks.enumerated()), id: \.offset) { _, block in
                        switch block {
                        case .heading(let text):
                            Text(text)
                                .font(.headline)
                                .padding(.top, 12)
                        case .paragraph(let text):
                            inline(text)
                        case .bullet(let text):
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text("•")
                                inline(text)
                            }
                        }
                    }
                }
                .padding()
                .frame(maxWidth: 640, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .navigationTitle("What's New in v\(notes.version)")
            #if !os(macOS)
                .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onDone)
                }
            }
        }
        #if os(macOS)
            .frame(minWidth: 520, idealWidth: 640, minHeight: 480, idealHeight: 640)
        #endif
    }

    /// Markdown so **bold** and `code` render; text that fails to parse is
    /// shown verbatim rather than dropped.
    private func inline(_ text: String) -> some View {
        Text((try? AttributedString(markdown: text)) ?? AttributedString(text))
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// Shows `WhatsNewView` once `ready` turns true, if this launch is the
/// first of a newer version.
struct WhatsNewOnUpdate: ViewModifier {
    let ready: Bool
    @State private var notes: WhatsNew.Notes?
    @State private var checked = false

    func body(content: Content) -> some View {
        content
            .onChange(of: ready, initial: true) { _, ready in
                guard ready, !checked else { return }
                checked = true
                notes = WhatsNew.pending()
            }
            .sheet(item: $notes) { notes in
                WhatsNewView(notes: notes) { self.notes = nil }
            }
    }
}
