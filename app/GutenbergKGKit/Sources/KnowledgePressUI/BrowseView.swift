// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Browse tab — the pages/1_Browse.py flow: genres → books → chapters →
// chapter text, backed by the worker's list_genres/list_books/get_chapters/
// get_chapter ops.
//
// A NavigationStack rather than the split view it started as: the same drill
// reads correctly on a phone and on a Mac window, and it is one code path.
//
// A book row carries a Tree button when the app has a forest with that
// book's tree in it: the Forest tab, beside the tree, its card open.
//
// The genre list carries a title and author search. Author results are
// grouped by author, title results follow, and both open into the same
// chapter list the drill reaches, so search is a shortcut into the drill
// rather than a second way to read a book.

import GutenbergKGKit
import SwiftUI

struct BrowseView: View {
    @Environment(AppModel.self) private var model
    @State private var path: [BrowseStep] = []
    @State private var loadError: String?
    @State private var query = ""
    /// Every book in the corpus, for search. Reloaded whenever the
    /// genre list changes, which is also when a corpus is installed.
    @State private var shelf: [ShelvedBook] = []

    private var searching: Bool {
        !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// The packs when they are installed, the worker when they are not —
    /// Browse does not need to know which, and neither does the reader.
    private var browser: any CorpusBrowser { model.browser }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if searching {
                    searchResults
                } else {
                    genreList
                }
            }
            .navigationTitle("Corpus")
            .searchable(text: $query, prompt: "Search titles and authors")
            .navigationDestination(for: BrowseStep.self) { step in
                destination(for: step)
            }
        }
        .task(id: model.genres) { await loadShelf() }
        .overlay(alignment: .bottom) {
            if let loadError {
                Label(loadError, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .padding(8)
                    .background(.orange.opacity(0.15), in: Capsule())
                    .padding()
            }
        }
    }

    private var genreList: some View {
        List(model.genres) { genre in
            NavigationLink(value: BrowseStep.books(genre.genre)) {
                HStack {
                    Text(genre.genre)
                    Spacer()
                    Text("\(genre.bookCount)")
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
        }
        .overlay {
            if model.genres.isEmpty {
                ContentUnavailableView(
                    "No genres yet",
                    systemImage: "books.vertical",
                    description: Text(model.connectionError ?? "Connecting to the worker…"))
            }
        }
    }

    /// One section per matching author, each listing their books with the
    /// genre they are shelved under, since an author's books can sit in
    /// several. Then a Titles section with the books whose title matches,
    /// less those an author section already lists.
    private var searchResults: some View {
        let matches = AuthorSearch.search(query, in: shelf)
        let listed = Set(matches.flatMap { $0.books.map(\.id) })
        let titles = AuthorSearch.searchTitles(query, in: shelf).filter { !listed.contains($0.id) }
        return List {
            ForEach(matches) { match in
                Section {
                    ForEach(match.books) { shelved in
                        resultRow(shelved, detail: shelved.genre)
                    }
                } header: {
                    // Names as the catalog spells them, not shouted in caps.
                    Text(match.author).textCase(nil)
                }
            }
            if !titles.isEmpty {
                Section("Titles") {
                    ForEach(titles) { shelved in
                        resultRow(
                            shelved,
                            detail: [shelved.book.author, shelved.genre].compactMap { $0 }
                                .joined(separator: " · "))
                    }
                }
            }
        }
        .overlay {
            if matches.isEmpty && titles.isEmpty {
                ContentUnavailableView.search(text: query)
            }
        }
    }

    private func resultRow(_ shelved: ShelvedBook, detail: String) -> some View {
        NavigationLink(
            value: BrowseStep.chapters(
                genre: shelved.genre, book: shelved.book.book,
                title: shelved.book.title ?? shelved.book.book)
        ) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(shelved.book.title ?? shelved.book.book)
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                ForestTreeButton(genre: shelved.genre, book: shelved.book.book)
            }
        }
    }

    private func loadShelf() async {
        guard !model.genres.isEmpty else {
            shelf = []
            return
        }
        do {
            shelf = try await browser.shelf(genres: model.genres)
        } catch {
            loadError = error.localizedDescription
        }
    }

    @ViewBuilder
    private func destination(for step: BrowseStep) -> some View {
        switch step {
        case .books(let genre):
            BookListView(genre: genre, browser: browser, loadError: $loadError)
        case .chapters(let genre, let book, let title):
            ChapterListView(
                genre: genre, book: book, title: title, browser: browser, loadError: $loadError)
        case .reader(let genre, let book, let sectionId, let block):
            ChapterReaderView(
                genre: genre, book: book, sectionId: sectionId, startBlock: block, browser: browser,
                loadError: $loadError)
        }
    }
}

/// One level of the browse drill.
enum BrowseStep: Hashable {
    case books(String)
    case chapters(genre: String, book: String, title: String)
    /// `block` opens the chapter at that block, as a bookmark or Continue does.
    case reader(genre: String, book: String, sectionId: String, block: Int? = nil)
}

private struct BookListView: View {
    let genre: String
    let browser: any CorpusBrowser
    @Binding var loadError: String?
    @State private var books: [Book] = []

    var body: some View {
        List(books) { book in
            NavigationLink(
                value: BrowseStep.chapters(
                    genre: genre, book: book.book, title: book.title ?? book.book)
            ) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(book.title ?? book.book)
                        if let author = book.author {
                            Text(author).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    ForestTreeButton(genre: genre, book: book.book)
                }
            }
        }
        .navigationTitle(genre)
        .task {
            do {
                books = try await browser.listBooks(genre: genre)
                loadError = nil
            } catch { loadError = error.localizedDescription }
        }
    }
}

private struct ChapterListView: View {
    @Environment(AppModel.self) private var model
    let genre: String
    let book: String
    let title: String
    let browser: any CorpusBrowser
    @Binding var loadError: String?
    @State private var chapters: [Chapter] = []

    /// Diary entries are dated (`Chapter.id` is a `"YYYY-MM-DD…"` timestamp),
    /// and one diary can hold thousands of them — Pepys alone has 2,754. A
    /// flat list at that length has no landmarks to jump by, so a diary's
    /// entries are shown by year; every other book's chapters, too few to need
    /// it, stay a single flat list exactly as before.
    private var byYear: [(year: String, entries: [Chapter])]? {
        guard genre == "diaries" else { return nil }
        let grouped = Dictionary(grouping: chapters) { String($0.id.prefix(4)) }
        return grouped.keys.sorted().map { ($0, grouped[$0] ?? []) }
    }

    private var key: String { ReadingMarks.key(genre: genre, book: book) }

    /// Continue and the bookmarks, above the chapters; nothing until the
    /// chapters load, so a place in a chapter the book lost is never offered.
    @ViewBuilder
    private var places: some View {
        let ids = chapters.map(\.id)
        if let last = model.readingMarks.lastPlace(key, in: ids) {
            Section {
                NavigationLink(
                    value: BrowseStep.reader(
                        genre: genre, book: book, sectionId: last.sectionId, block: last.block)
                ) {
                    Label {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Continue reading")
                            Text(last.chapterTitle).font(.caption).foregroundStyle(.secondary)
                        }
                    } icon: {
                        Image(systemName: "book")
                    }
                }
            }
        }
        let marks = model.readingMarks.bookmarks(key, in: ids)
        if !marks.isEmpty {
            Section("Bookmarks") {
                ForEach(marks) { mark in
                    NavigationLink(
                        value: BrowseStep.reader(
                            genre: genre, book: book, sectionId: mark.sectionId, block: mark.block)
                    ) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(mark.chapterTitle)
                                if !mark.excerpt.isEmpty {
                                    Text(mark.excerpt)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                }
                            }
                        } icon: {
                            Image(systemName: "bookmark.fill")
                        }
                    }
                    .contextMenu {
                        Button("Remove Bookmark", systemImage: "trash", role: .destructive) {
                            model.readingMarks.remove(key, id: mark.id)
                        }
                    }
                }
                .onDelete { offsets in
                    for i in offsets { model.readingMarks.remove(key, id: marks[i].id) }
                }
            }
        }
    }

    var body: some View {
        Group {
            if let byYear {
                List {
                    places
                    ForEach(byYear, id: \.year) { group in
                        Section(group.year) {
                            ForEach(group.entries) { chapter in
                                NavigationLink(
                                    value: BrowseStep.reader(
                                        genre: genre, book: book, sectionId: chapter.id)
                                ) {
                                    Text(chapter.title ?? chapter.id)
                                }
                            }
                        }
                    }
                }
            } else {
                List {
                    places
                    Section {
                        ForEach(chapters) { chapter in
                            NavigationLink(
                                value: BrowseStep.reader(genre: genre, book: book, sectionId: chapter.id)
                            ) {
                                Text(chapter.title ?? chapter.id)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(title)
        .task {
            do {
                chapters = try await browser.chapters(genre: genre, book: book)
                loadError = nil
            } catch { loadError = error.localizedDescription }
        }
    }
}

private struct ChapterReaderView: View {
    @Environment(AppModel.self) private var model
    let genre: String
    let book: String
    @State var sectionId: String
    /// The block to open the first chapter at; when nil, where the book was
    /// left if this is that chapter.
    let startBlock: Int?
    let browser: any CorpusBrowser
    @Binding var loadError: String?
    @State private var content: ChapterContent?
    /// Set when a chapter was read to its end, so the next one is read too.
    @State private var goOn = false
    /// The book's author voice from `core.pack`, for the automatic voice.
    @State private var authorVoice: AuthorVoice?

    /// The chapter cut into blocks once, when it loads, not on every highlight.
    @State private var blocks: [ChapterBlocks.Block] = []

    /// The block at the top of the page; -1 is the chapter heading.
    @State private var topBlock: Int?
    /// The chapter `content` holds, which trails `sectionId` while the next one loads.
    @State private var loadedId: String?
    /// A block to scroll to once the chapter is laid out.
    @State private var restoreTo: Int?
    /// Whether the page's position is the reader's to save: not until a
    /// restore has landed, or the top of the page would overwrite the place.
    @State private var tracking = false
    /// The start block, or the place the book was left, is applied once.
    @State private var started = false

    private var key: String { ReadingMarks.key(genre: genre, book: book) }
    private var here: Int { max(0, topBlock ?? 0) }

    /// The block being read aloud, or -1.
    private var readingBlock: Int {
        model.reading.state == .idle ? -1 : model.reading.block
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    if let content {
                        Text(content.title ?? "")
                            .font(.title2.bold())
                            .id(-1)
                        ForEach(Array(blocks.enumerated()), id: \.offset) { index, block in
                            BlockText(block: block)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    index == readingBlock ? Color.accentColor.opacity(0.12) : .clear,
                                    in: RoundedRectangle(cornerRadius: 6)
                                )
                                .padding(.horizontal, -6)
                                .contentShape(Rectangle())
                                // While a reading is going, tap a paragraph to read from it.
                                .onTapGesture {
                                    if model.reading.state != .idle, !block.spoken.isEmpty { read(from: index) }
                                }
                                .id(index)
                        }
                        pager(content)
                    } else {
                        ProgressView().padding(.top, 40)
                    }
                }
                .scrollTargetLayout()
                .textSelection(.enabled)
                .padding()
                .frame(maxWidth: 700, alignment: .leading)
            }
            .onChange(of: readingBlock) { _, block in
                guard block >= 0, model.reading.state == .playing else { return }
                withAnimation { proxy.scrollTo(block, anchor: .center) }
            }
            .scrollPosition(id: $topBlock, anchor: .top)
            .onChange(of: sectionId) { _, _ in
                tracking = false
                proxy.scrollTo(-1, anchor: .top)
            }
            .task(id: restoreTo) {
                guard let block = restoreTo else { return }
                // Let the loaded chapter lay out before scrolling into it.
                try? await Task.sleep(for: .milliseconds(80))
                proxy.scrollTo(block, anchor: .top)
                restoreTo = nil
                leave(at: block)
                tracking = true
            }
            .onChange(of: topBlock) { _, _ in
                if tracking, loadedId == sectionId { leave(at: here) }
            }
        }
        .navigationTitle(content?.title ?? "Chapter")
        // The chapter heading is already the first thing in the body; a
        // large title above it printed "CHAPTER I." twice on the iPhone.
        #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            if content != nil {
                ToolbarItem(placement: .primaryAction) {
                    let marked = model.readingMarks.isMarked(key, sectionId: sectionId, block: here)
                    Button(action: toggleBookmark) {
                        Label(
                            marked ? "Remove Bookmark" : "Bookmark",
                            systemImage: marked ? "bookmark.fill" : "bookmark")
                    }
                }
            }
            if blocks.contains(where: { !$0.spoken.isEmpty }) {
                ToolbarItem(placement: .primaryAction) {
                    Button(action: toggleReading) {
                        Label(
                            model.reading.state == .playing ? "Pause reading" : "Read aloud",
                            systemImage: model.reading.state == .playing ? "pause.fill" : "play.fill")
                    }
                }
            }
        }
        .task(id: sectionId) { await load() }
        .task { authorVoice = await browser.authorVoice(genre: genre, book: book) }
        // Leaving the chapter for the list, another tab or another book stops the voice.
        .onDisappear { model.reading.stop() }
    }

    /// Remember the place: this chapter, this block.
    private func leave(at block: Int) {
        model.readingMarks.leave(key, at: ReadingMark(
            sectionId: sectionId, block: block, chapterTitle: content?.title ?? sectionId))
    }

    /// Bookmark the block at the top of the page, or take its bookmark away.
    private func toggleBookmark() {
        let block = here
        if let mark = model.readingMarks.saved[key]?.first(where: { $0.sectionId == sectionId && $0.block == block }) {
            model.readingMarks.remove(key, id: mark.id)
            return
        }
        let text = blocks.indices.contains(block) ? blocks[block].runs.map(\.text).joined() : ""
        model.readingMarks.add(key, ReadingMark(
            sectionId: sectionId, block: block, chapterTitle: content?.title ?? sectionId,
            excerpt: ReadingMarks.excerpt(text)))
    }

    private func toggleReading() {
        switch model.reading.state {
        case .playing: model.reading.pause()
        case .paused: model.reading.resume()
        case .idle: read(from: 0)
        }
    }

    private func read(from index: Int) {
        model.reading.read(
            blocks.map(\.spoken), from: index,
            voiceID: readingVoiceID(chosen: model.readVoiceID, want: authorVoice), rate: model.readRate
        ) {
            if let next = content?.nextId {
                goOn = true
                sectionId = next
            }
        }
    }

    /// Turn the chapter by hand: a reading stops.
    private func turn(to id: String?) {
        guard let id else { return }
        model.reading.stop()
        sectionId = id
    }

    private func pager(_ content: ChapterContent) -> some View {
        HStack {
            Button("◀︎ Previous") { turn(to: content.prevId) }
                .disabled(content.prevId == nil)
            Spacer()
            if let index = content.index, let total = content.total {
                Text("\(index + 1) / \(total)")
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Next ▶︎") { turn(to: content.nextId) }
                .disabled(content.nextId == nil)
        }
        .font(.callout)
        .padding(.top, 8)
    }

    private func load() async {
        do {
            let loaded = try await browser.chapter(genre: genre, book: book, sectionId: sectionId)
            blocks = ChapterBlocks.blocks(loaded.text, title: loaded.title ?? "")
            content = loaded
            loadedId = sectionId
            loadError = nil
            var start: Int?
            if !started {
                started = true
                let last = model.readingMarks.last[key]
                start = startBlock ?? (last?.sectionId == sectionId ? last?.block : nil)
            }
            if let start, start > 0, !blocks.isEmpty {
                restoreTo = min(start, blocks.count - 1)
            } else {
                leave(at: 0)
                tracking = true
            }
            if goOn {
                goOn = false
                read(from: 0)
            }
        } catch { loadError = error.localizedDescription }
    }
}

/// One block as the page sets it: prose and verse in a serif face, verse
/// line by line, headings centered, notes and captions small and gray.
private struct BlockText: View {
    let block: ChapterBlocks.Block

    var body: some View {
        switch block.kind {
        case .verse:
            VStack(alignment: .leading, spacing: 2) {
                ForEach(Array(ChapterBlocks.lines(block.runs).enumerated()), id: \.offset) { _, line in
                    Text(Self.styled(line))
                }
            }
            .font(.system(.body, design: .serif))
            .lineSpacing(3)
        case .heading:
            Text(Self.styled(block.runs))
                .font(.system(.callout, design: .serif).weight(.semibold))
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
                .padding(.top, 8)
        case .note:
            Text(Self.styled(block.runs))
                .font(.footnote)
                .foregroundStyle(.secondary)
        case .caption:
            Text(Self.styled(block.runs))
                .font(.system(.callout, design: .serif).italic())
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
        case .prose:
            Text(Self.styled(block.runs))
                .font(.system(.body, design: .serif))
                .lineSpacing(4)
        }
    }

    /// The runs as one attributed string: italics, bold, footnote marks
    /// raised and small, asides small in brackets.
    static func styled(_ runs: [ChapterBlocks.Run]) -> AttributedString {
        var out = AttributedString()
        for run in runs {
            switch run.style {
            case .italic:
                var piece = AttributedString(run.text)
                piece.inlinePresentationIntent = .emphasized
                out += piece
            case .bold:
                var piece = AttributedString(run.text)
                piece.inlinePresentationIntent = .stronglyEmphasized
                out += piece
            case .mark:
                var piece = AttributedString(run.text)
                piece.font = .caption2
                piece.baselineOffset = 6
                piece.foregroundColor = .secondary
                out += piece
            case .aside:
                var piece = AttributedString("[\(run.text)]")
                piece.font = .footnote
                piece.foregroundColor = .secondary
                out += piece
            case nil:
                out += AttributedString(run.text)
            }
        }
        return out
    }
}
