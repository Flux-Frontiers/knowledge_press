// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The Forest tab: the web forest (web/), unchanged, running from the app
// bundle in a WKWebView.
//
// One forest codebase, two hosts. The build is staged into the bundle as a
// `Forest` folder (`make ios-stage-forest` / `mac-stage-forest`) and served
// through `ForestSchemeHandler`, never from `file://`, which WebKit will not
// run a module worker from.
//
// The web view outlives the view that shows it. `ForestHost` owns it and
// `AppModel` owns the host, so leaving the tab -- or the iPad folding from
// the sidebar layout to the tab layout -- does not restart the forest.

import GutenbergKGKit
import SwiftUI
import WebKit

/// Owns the forest's web view, its scheme handler, and the dialogs the page
/// asks the app to show.
@MainActor
@Observable
final class ForestHost: NSObject {

    /// A `window.confirm` waiting for the reader's answer.
    struct Confirmation: Identifiable {
        let id = UUID()
        let message: String
        let answer: (Bool) -> Void
    }

    /// A `window.alert` waiting to be dismissed.
    struct Notice: Identifiable {
        let id = UUID()
        let message: String
        let dismiss: () -> Void
    }

    /// The staged forest, or nil when this build carries none.
    @ObservationIgnored let server: ForestServer?

    /// The page's pending confirm, shown as a SwiftUI alert.
    var confirmation: Confirmation?
    /// The page's pending alert.
    var notice: Notice?

    @ObservationIgnored private var webViewStorage: WKWebView?

    /// :param root: The staged forest folder; nil, or a folder without
    ///     `index.html`, means the tab shows how to stage one.
    /// :param browser: Where the reader's book text comes from.
    init(root: URL?, browser: (any CorpusBrowser)?) {
        self.server = root.map { ForestServer(root: $0, browser: browser) }
            .flatMap { $0.isStaged ? $0 : nil }
        super.init()
    }

    /// The forest folder in the app bundle, if the build has one.
    static func bundledRoot() -> URL? {
        Bundle.main.url(forResource: "Forest", withExtension: nil)
    }

    /// The tree the forest should open beside when it first loads.
    @ObservationIgnored private var requestedTree: String?

    /// Whether the page has said `ready` since it last loaded. Commands sent
    /// before then would reach a page with no listener, so they wait.
    @ObservationIgnored private var pageReady = false
    /// The command waiting for `ready`. Only the latest matters: two Tree
    /// taps before the forest has grown should land at the second tree.
    @ObservationIgnored private var pendingCommand: ForestCommand?

    /// What the app does with the forest's events. Set by `AppModel`, which
    /// owns this host; called on the main actor.
    @ObservationIgnored var onEvent: (ForestEvent) -> Void = { _ in }

    /// The web view, created and loaded on first use.
    ///
    /// A tree asked for before the tab was ever opened rides along as
    /// `?tree=<slug>`, which the forest's start screen already understands.
    var webView: WKWebView? {
        guard let server else { return nil }
        if let webViewStorage { return webViewStorage }
        let view = makeWebView(server: server)
        webViewStorage = view
        view.load(URLRequest(url: Self.url(tree: requestedTree)))
        requestedTree = nil
        return view
    }

    /// The tree for a book, when a forest is staged and it has one.
    ///
    /// :param genre: The book's genre key.
    /// :param book: The corpus folder name (a diary's title).
    /// :returns: The catalog slug, or nil when there is nothing to open.
    func slug(genre: String, book: String) -> String? {
        server?.catalog.slug(genre: genre, book: book)
    }

    /// Open the forest beside one tree, with its card up.
    ///
    /// Before the web view exists the slug waits for the first load as
    /// `?tree=`. After, it goes to the page as a `goto` command, so the drive
    /// carries on rather than restarting -- held until the page is `ready`
    /// when it is still loading.
    ///
    /// :param slug: A catalog slug.
    func show(tree slug: String) {
        guard server != nil else { return }
        guard webViewStorage != nil else {
            requestedTree = slug
            return
        }
        send(.goto(slug: slug))
    }

    /// Deliver a command now if the page is listening, or when it says `ready`.
    ///
    /// :param command: What to ask of the forest.
    func send(_ command: ForestCommand) {
        guard let webViewStorage, pageReady else {
            pendingCommand = command
            return
        }
        webViewStorage.evaluateJavaScript(command.script) { _, error in
            if let error { Self.log("command \(command) failed: \(error.localizedDescription)") }
        }
    }

    /// An event the page posted: `ready` flushes the waiting command, the
    /// rest go to the app.
    fileprivate func receive(_ event: ForestEvent) {
        if case .ready = event {
            pageReady = true
            if let pendingCommand {
                self.pendingCommand = nil
                send(pendingCommand)
            }
        }
        onEvent(event)
    }

    static func log(_ message: String) {
        #if DEBUG
            print("[forest] \(message)")
        #endif
    }

    /// The forest's address, opening beside `tree` when one is given.
    static func url(tree: String?) -> URL {
        guard let tree,
            var components = URLComponents(
                url: ForestSchemeHandler.rootURL, resolvingAgainstBaseURL: false)
        else { return ForestSchemeHandler.rootURL }
        components.queryItems = [URLQueryItem(name: "tree", value: tree)]
        return components.url ?? ForestSchemeHandler.rootURL
    }

    private func makeWebView(server: ForestServer) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // Through a weak proxy: the content controller keeps its handlers
        // alive, and the host keeps the web view that keeps the controller.
        configuration.userContentController.add(
            WeakMessageHandler(host: self), name: ForestEvent.handlerName)
        configuration.setURLSchemeHandler(
            ForestSchemeHandler(server: server), forURLScheme: ForestSchemeHandler.scheme)
        // The default, persistent store: the press and the settings live in
        // the page's localStorage until they move into the app, and a
        // non-persistent store would empty the press on every launch.
        configuration.websiteDataStore = .default()
        // Narration uses speechSynthesis; keep audio from waiting on a tap.
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.preferences.isElementFullscreenEnabled = true
        #if os(iOS)
            configuration.allowsInlineMediaPlayback = true
        #endif

        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        view.uiDelegate = self
        // No white flash before the start screen paints.
        view.underPageBackgroundColor = .black
        #if os(iOS)
            view.isOpaque = false
            view.backgroundColor = .black
            view.scrollView.backgroundColor = .black
            // The one-finger look drag must never scroll or rubber-band the
            // page; the forest takes every touch itself.
            view.scrollView.isScrollEnabled = false
            view.scrollView.bounces = false
            view.scrollView.contentInsetAdjustmentBehavior = .never
        #endif
        #if DEBUG
            // Safari ▸ Develop reaches the forest in a debug build.
            view.isInspectable = true
        #endif
        return view
    }
}

/// The model's corpus browser at the moment of each call.
///
/// The forest server is built once, but `AppModel.browser` changes: the
/// worker until the packs finish opening, the packs after. Asking the model
/// per request means a book opened from a tree reads whatever Browse would.
/// Weak, because the model owns the server through `ForestHost`.
struct ModelBrowser: CorpusBrowser {
    weak var model: AppModel?

    private func current() async throws -> any CorpusBrowser {
        guard let browser = await model?.browser else { throw CancellationError() }
        return browser
    }

    func listGenres() async throws -> [GenreCount] {
        try await current().listGenres()
    }

    func listBooks(genre: String) async throws -> [Book] {
        try await current().listBooks(genre: genre)
    }

    func chapters(genre: String, book: String) async throws -> [Chapter] {
        try await current().chapters(genre: genre, book: book)
    }

    func chapter(genre: String, book: String, sectionId: String) async throws -> ChapterContent {
        try await current().chapter(genre: genre, book: book, sectionId: sectionId)
    }
}

/// Forwards the page's `forest` messages to the host without retaining it.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var host: ForestHost?

    init(host: ForestHost) {
        self.host = host
    }

    func userContentController(
        _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
    ) {
        // Only the forest's own page speaks to the app.
        guard message.frameInfo.securityOrigin.protocol == ForestSchemeHandler.scheme,
            let event = ForestEvent(messageBody: message.body)
        else { return }
        MainActor.assumeIsolated { host?.receive(event) }
    }
}

extension ForestHost: WKNavigationDelegate {
    /// A new page load (a reload after the web process died, included): it
    /// is not listening until it says `ready` again.
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        pageReady = false
    }

    /// The web process was killed -- on a phone, usually for memory. Reload
    /// rather than leave a blank tab.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}

extension ForestHost: WKUIDelegate {
    /// `window.confirm` (Empty the press). Without this the page's button
    /// does nothing: WebKit answers false when no delegate does.
    func webView(
        _ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable (Bool) -> Void
    ) {
        confirmation = Confirmation(message: message, answer: completionHandler)
    }

    /// `window.alert`, for the same reason.
    func webView(
        _ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping @MainActor @Sendable () -> Void
    ) {
        notice = Notice(message: message, dismiss: completionHandler)
    }

    /// The forest never asks for the camera or microphone; refuse if it does.
    func webView(
        _ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
        decisionHandler: @escaping @MainActor @Sendable (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.deny)
    }
}

/// Opens a book's tree in the Forest tab. Shows nothing when this build
/// carries no forest or the forest has no tree for the book, so it can sit
/// on any row that names a book.
struct ForestTreeButton: View {
    @Environment(AppModel.self) private var model
    let genre: String
    let book: String

    var body: some View {
        if let slug = model.forest.slug(genre: genre, book: book) {
            Button {
                model.showForest(tree: slug)
            } label: {
                Label("Tree", systemImage: "tree")
                    .font(.caption)
            }
            .buttonStyle(.borderless)
            .help("Open this book's tree in the forest")
        }
    }
}

/// The Forest tab: the forest when one is staged, how to stage it when not.
struct ForestView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let host = model.forest
        Group {
            if let webView = host.webView {
                ForestWebView(webView: webView)
                    .background(Color.black)
            } else {
                ContentUnavailableView(
                    "The forest is not staged",
                    systemImage: "tree",
                    description: Text(
                        "This build carries no forest. Run `make ios-stage-forest` (or `make mac-stage-forest` for the Mac) and build again."
                    ))
            }
        }
        .alert(
            host.confirmation?.message ?? "",
            isPresented: Binding(
                get: { host.confirmation != nil },
                set: { if !$0 { host.confirmation = nil } }),
            presenting: host.confirmation
        ) { pending in
            Button("Cancel", role: .cancel) { pending.answer(false) }
            Button("OK") { pending.answer(true) }
        }
        .alert(
            host.notice?.message ?? "",
            isPresented: Binding(
                get: { host.notice != nil },
                set: { if !$0 { host.notice = nil } }),
            presenting: host.notice
        ) { pending in
            Button("OK") { pending.dismiss() }
        }
    }
}

#if os(iOS)
    /// Places the host's long-lived web view; never creates or tears one down.
    private struct ForestWebView: UIViewRepresentable {
        let webView: WKWebView

        func makeUIView(context: Context) -> WKWebView { webView }
        func updateUIView(_ uiView: WKWebView, context: Context) {}
    }
#else
    /// Places the host's long-lived web view; never creates or tears one down.
    private struct ForestWebView: NSViewRepresentable {
        let webView: WKWebView

        func makeNSView(context: Context) -> WKWebView { webView }
        func updateNSView(_ nsView: WKWebView, context: Context) {}
    }
#endif
