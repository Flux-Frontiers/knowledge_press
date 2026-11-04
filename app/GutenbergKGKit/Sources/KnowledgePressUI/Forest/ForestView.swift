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
    init(root: URL?) {
        self.server = root.map(ForestServer.init(root:)).flatMap { $0.isStaged ? $0 : nil }
        super.init()
    }

    /// The forest folder in the app bundle, if the build has one.
    static func bundledRoot() -> URL? {
        Bundle.main.url(forResource: "Forest", withExtension: nil)
    }

    /// The web view, created and loaded on first use.
    var webView: WKWebView? {
        guard let server else { return nil }
        if let webViewStorage { return webViewStorage }
        let view = makeWebView(server: server)
        webViewStorage = view
        view.load(URLRequest(url: ForestSchemeHandler.rootURL))
        return view
    }

    private func makeWebView(server: ForestServer) -> WKWebView {
        let configuration = WKWebViewConfiguration()
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

extension ForestHost: WKNavigationDelegate {
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
