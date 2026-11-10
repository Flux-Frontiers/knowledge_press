// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Three shells, one Settings screen. Same chat, same browse, same settings —
// arranged for the screen they are on: a collapsible sidebar on the Mac
// (closest to the Streamlit layout it ports), tabs and a settings popover on
// iPad, tabs and a settings sheet on iPhone.

import SwiftUI

/// macOS window: the conversations sidebar, with the chat alongside.
///
/// The sidebar used to *be* the settings form, which put a full page of
/// sliders permanently beside what you were reading and left no home for
/// past chats. Settings now lives in the standard Settings window
/// (Cmd-comma), where a Mac user looks for it, and the sidebar carries the
/// chats plus the two controls worth seeing per question.
///
/// `columnVisibility` starts `.automatic` — macOS's own default — rather
/// than forcing it open or shut; the point of switching to the explicit
/// binding is only to make `NavigationSplitView`'s built-in sidebar toggle
/// appear in the toolbar, so a Mac window can hide the sidebar the same way
/// Xcode, Mail, and Notes do, without changing the split view's own default.
public struct MacRootView: View {
    @Environment(AppModel.self) private var model
    @State private var columnVisibility = NavigationSplitViewVisibility.automatic
    @State private var selection: SidebarItem? = .chat
    @State private var search = ""
    @State private var confirmingDelete = false

    public init() {}

    public var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            ConversationSidebar(selection: $selection, search: $search)
                .searchable(text: $search, placement: .sidebar, prompt: "Search conversations")
                .navigationSplitViewColumnWidth(min: 260, ideal: 300)
        } detail: {
            detail
                .toolbar {
                    ToolbarItem { ExportConversationButton() }
                    ToolbarItem {
                        Button("Delete", systemImage: "trash") {
                            confirmingDelete = true
                        }
                        .disabled(model.activeConversation == nil && model.turns.isEmpty)
                    }
                }
                .deleteConversationConfirmation($confirmingDelete)
        }
        .onChange(of: selection) { _, item in
            if case .conversation(let id) = item { model.select(id) }
        }
        .onChange(of: model.activeConversation?.id) { _, id in
            if let id, selection == .chat { selection = .conversation(id) }
        }
        .onChange(of: model.sectionRequest) { _, request in
            if let request { selection = SidebarItem(request.section) }
        }
    }

    @ViewBuilder
    private var detail: some View {
        switch selection {
        case .browse:
            BrowseView()
        case .forest:
            ForestView()
        case .chat, .conversation, .none:
            ChatView(showsHeader: false)
                .navigationTitle(model.activeConversation?.title ?? "New chat")
        }
    }
}

/// iPhone: Chat, Browse and the Forest as tabs, settings behind a toolbar
/// button.
///
/// The sidebar does not survive the trip to a phone, so the controls move to
/// a sheet. The corpus/version caption that used to sit under the nav title
/// here now lives only in About (Settings ▸ About) — one home for it,
/// instead of the same line shown twice.
public struct PhoneRootView: View {
    /// The phone's tabs, so a request from elsewhere can switch between them.
    private enum Tab: Hashable {
        case chat, browse, forest
    }

    @Environment(AppModel.self) private var model
    @State private var tab = Tab.chat
    @State private var showingSettings = false
    @State private var showingHistory = false
    @State private var confirmingDelete = false

    public init() {}

    public var body: some View {
        TabView(selection: $tab) {
            NavigationStack {
                ChatView(showsHeader: false)
                    .navigationTitle(model.activeConversation?.title ?? "The Knowledge Press: The Forest")
                    .toolbarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .navigation) {
                            Button("Conversations", systemImage: "sidebar.left") {
                                showingHistory = true
                            }
                        }
                        ToolbarItem(placement: .primaryAction) {
                            Button("Settings", systemImage: "slider.horizontal.3") {
                                showingSettings = true
                            }
                        }
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Delete", systemImage: "trash") {
                                confirmingDelete = true
                            }
                            .disabled(model.activeConversation == nil && model.turns.isEmpty)
                        }
                        ToolbarItem(placement: .secondaryAction) {
                            ExportConversationButton()
                        }
                    }
                    .deleteConversationConfirmation($confirmingDelete)
            }
            .tabItem { Label("Chat", systemImage: "text.bubble") }
            .tag(Tab.chat)

            BrowseView()
                .tabItem { Label("Browse", systemImage: "books.vertical") }
                .tag(Tab.browse)

            ForestView()
                .tabItem { Label("Forest", systemImage: "tree") }
                .tag(Tab.forest)
        }
        .onChange(of: model.sectionRequest) { _, request in
            switch request?.section {
            case .chat: tab = .chat
            case .forest: tab = .forest
            case nil: break
            }
        }
        .sheet(isPresented: $showingHistory) {
            ConversationHistorySheet(isPresented: $showingHistory)
        }
        .sheet(isPresented: $showingSettings) {
            NavigationStack {
                // The phone has no sidebar, so Settings keeps engine and
                // scope -- there is nowhere else for them to live here.
                SettingsView()
                    .navigationTitle("Settings")
                    .toolbarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { showingSettings = false }
                        }
                    }
            }
        }
    }
}

/// The phone's route to past chats: the same list the iPad sidebar shows,
/// in a sheet.
///
/// A sheet rather than the edge-swipe drawer the Claude app uses: a drawer
/// is gesture code that can conflict with the scroll view and the system's
/// own back-swipe, and this can be replaced by one later without touching
/// the list itself.
private struct ConversationHistorySheet: View {
    @Environment(AppModel.self) private var model
    @Binding var isPresented: Bool
    @State private var search = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button("New chat", systemImage: "square.and.pencil") {
                        model.newConversation()
                        isPresented = false
                    }
                    .disabled(model.turns.isEmpty)
                }

                ConversationListView(
                    search: $search, presentation: .sheet,
                    onSelect: { isPresented = false })
            }
            .searchable(text: $search, prompt: "Search conversations")
            .navigationTitle("Conversations")
            .toolbarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { isPresented = false }
                }
            }
        }
    }
}

/// iPad: a persistent sidebar of past chats, with the chat itself alongside.
///
/// The tabs are gone. They were the right shape when a chat was a single
/// disposable buffer, but once chats persist the sidebar is what reaches
/// them, and Browse is one row in it rather than half the tab bar.
///
/// Binding `columnVisibility` is what surfaces `NavigationSplitView`'s own
/// toggle (the same reason `MacRootView` binds it): landscape shows both
/// columns, portrait collapses the sidebar to an overlay reachable from the
/// toolbar, exactly as Files and Notes behave.
public struct PadRootView: View {
    @Environment(AppModel.self) private var model
    @State private var columnVisibility = NavigationSplitViewVisibility.automatic
    @State private var selection: SidebarItem? = .chat
    @State private var search = ""
    @State private var showingSettings = false
    @State private var confirmingDelete = false

    public init() {}

    public var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            ConversationSidebar(
                selection: $selection, search: $search,
                onOpenSettings: { showingSettings = true }
            )
            .searchable(text: $search, placement: .sidebar, prompt: "Search conversations")
            .navigationSplitViewColumnWidth(min: 260, ideal: 300)
            .popover(isPresented: $showingSettings) {
                NavigationStack {
                    // The sidebar carries engine and scope too, for the quick
                    // per-chat switch; Settings keeps them so a reader who
                    // opens it in portrait, sidebar hidden, still finds them.
                    // Both bind to the same model state, so they agree.
                    SettingsView()
                        .navigationTitle("Settings")
                        .toolbarTitleDisplayMode(.inline)
                }
                .frame(minWidth: 380, minHeight: 520)
            }
        } detail: {
            NavigationStack {
                detail
                    .toolbarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .primaryAction) {
                            // Also here, not only in the sidebar: in portrait
                            // the sidebar is hidden, and starting a new chat
                            // is too common to cost two taps.
                            Button("New chat", systemImage: "square.and.pencil") {
                                model.newConversation()
                                selection = .chat
                            }
                            .disabled(
                                model.turns.isEmpty && selection != .browse
                                    && selection != .forest)
                        }
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Delete", systemImage: "trash") {
                                confirmingDelete = true
                            }
                            .disabled(model.activeConversation == nil && model.turns.isEmpty)
                        }
                        ToolbarItem(placement: .secondaryAction) {
                            ExportConversationButton()
                        }
                        // The phone's three tabs, as a bar along the bottom: a
                        // quick way between them, also in portrait with the
                        // sidebar hidden.
                        #if os(iOS)
                            // iOS 26 puts a glass capsule behind each bar item;
                            // the segmented control draws its own, and the two
                            // differ in size, so the toolbar's is hidden.
                            if #available(iOS 26, *) {
                                ToolbarItem(placement: .bottomBar) { sectionPicker }
                                    .sharedBackgroundVisibility(.hidden)
                            } else {
                                ToolbarItem(placement: .bottomBar) { sectionPicker }
                            }
                        #endif
                    }
                    .deleteConversationConfirmation($confirmingDelete)
            }
        }
        .onChange(of: selection) { _, item in
            // Choosing a saved chat loads it into the buffer. The selection
            // stays on that row rather than snapping back to `.chat`, so the
            // list keeps showing which conversation is open.
            if case .conversation(let id) = item {
                model.select(id)
            }
        }
        .onChange(of: model.activeConversation?.id) { _, id in
            // The first completed turn creates a conversation, which is the
            // moment its row appears in the list -- move the highlight onto
            // it so the sidebar agrees with the detail column.
            if let id, selection == .chat { selection = .conversation(id) }
        }
        .onChange(of: model.sectionRequest) { _, request in
            if let request { selection = SidebarItem(request.section) }
        }
    }

    /// The bottom bar's choice: Chat stands for the chat row and any saved
    /// conversation. Choosing Chat returns to the open conversation, so its
    /// row stays highlighted.
    private var section: Binding<SidebarItem> {
        Binding(
            get: {
                switch selection {
                case .browse: .browse
                case .forest: .forest
                case .chat, .conversation, .none: .chat
                }
            },
            set: { item in
                if item == .chat, let id = model.activeConversation?.id {
                    selection = .conversation(id)
                } else {
                    selection = item
                }
            })
    }

    #if os(iOS)
        /// The phone's three tabs, as a segmented control for the bottom bar.
        private var sectionPicker: some View {
            Picker("Section", selection: section) {
                Label("Chat", systemImage: "text.bubble").tag(SidebarItem.chat)
                Label("Browse", systemImage: "books.vertical").tag(SidebarItem.browse)
                Label("Forest", systemImage: "tree").tag(SidebarItem.forest)
            }
            .pickerStyle(.segmented)
            .labelStyle(.titleAndIcon)
            .fixedSize()
        }
    #endif

    @ViewBuilder
    private var detail: some View {
        switch selection {
        case .browse:
            BrowseView()
        case .forest:
            ForestView()
        // `nil` is "no row highlighted", which happens after New chat and on
        // a fresh launch; the chat is still what belongs in the detail column.
        case .chat, .conversation, .none:
            ChatView(showsHeader: false)
                .navigationTitle(model.activeConversation?.title ?? "New chat")
        }
    }
}

extension View {
    /// The one confirmation every "delete this chat" control shows.
    ///
    /// Deleting is now irreversible in a way clearing the screen was not --
    /// it removes a file, not a buffer -- so all three call sites ask first,
    /// in the same words.
    @ViewBuilder
    fileprivate func deleteConversationConfirmation(_ presented: Binding<Bool>) -> some View {
        modifier(DeleteConversationConfirmation(presented: presented))
    }
}

private struct DeleteConversationConfirmation: ViewModifier {
    @Environment(AppModel.self) private var model
    @Binding var presented: Bool

    func body(content: Content) -> some View {
        content.confirmationDialog(
            "Delete this conversation?", isPresented: $presented, titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) { model.deleteActiveConversation() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes the questions, answers, and any illustrations. It cannot be undone.")
        }
    }
}

#if os(iOS)
    /// The iOS entry point's root: `PadRootView` when the window is wide,
    /// `PhoneRootView` when it is narrow. See each type's own doc comment for
    /// why they differ.
    ///
    /// Chosen by width, not by device: an unfolded iPhone Duo has an iPad's
    /// room and gets the sidebar, its cover screen gets the phone layout, and
    /// an iPad in narrow Split View gets the phone layout too. Folding swaps
    /// the root; the conversation lives in `AppModel`, so nothing is lost.
    public struct AdaptiveRootView: View {
        @Environment(\.horizontalSizeClass) private var sizeClass

        public init() {}

        public var body: some View {
            if sizeClass == .regular {
                PadRootView()
            } else {
                PhoneRootView()
            }
        }
    }
#endif
