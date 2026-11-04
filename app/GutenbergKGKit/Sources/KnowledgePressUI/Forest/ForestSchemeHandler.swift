// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The bridge between WebKit's custom-scheme loading and `ForestServer`.
//
// Every request the forest makes -- the page, its scripts, the module worker
// that grows the trees, textures, models, `fetch()` of JSON -- arrives here as
// `kp-forest://forest/<path>` and is answered from the staged build.

import Foundation
import GutenbergKGKit
import WebKit

/// Serves `kp-forest://forest/<path>` from a `ForestServer`.
@MainActor
final class ForestSchemeHandler: NSObject, WKURLSchemeHandler {

    /// The scheme the forest is loaded under.
    static let scheme = "kp-forest"
    /// The page itself. The host is fixed; only the path varies.
    static let rootURL = URL(string: "\(scheme)://forest/")!

    private let server: ForestServer

    /// Tasks WebKit has started and not stopped. A task that is stopped while
    /// its file is still being read must not be answered: calling back into a
    /// stopped `WKURLSchemeTask` raises an Objective-C exception.
    private var live: Set<ObjectIdentifier> = []

    /// :param server: Answers each request's path.
    init(server: ForestServer) {
        self.server = server
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        let id = ObjectIdentifier(urlSchemeTask)
        live.insert(id)
        guard let url = urlSchemeTask.request.url else {
            finish(urlSchemeTask, id: id, url: Self.rootURL, result: nil)
            return
        }
        let server = server
        Task {
            let result = try? await server.respond(to: url.path(percentEncoded: true))
            finish(urlSchemeTask, id: id, url: url, result: result)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
        live.remove(ObjectIdentifier(urlSchemeTask))
    }

    /// Answer a task with 200 and the bytes, or 404 when `result` is nil.
    private func finish(
        _ task: any WKURLSchemeTask, id: ObjectIdentifier, url: URL, result: (Data, String)?
    ) {
        guard live.remove(id) != nil else { return }
        // Access-Control-Allow-Origin because the module worker and `fetch`
        // are subject to CORS checks a custom scheme does not obviously pass;
        // everything here is the app's own content, so there is nothing to
        // protect by refusing.
        var headers = ["Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache"]
        let status: Int
        let body: Data
        if let (data, mediaType) = result {
            status = 200
            body = data
            headers["Content-Type"] =
                ForestServer.isText(mediaType) ? "\(mediaType); charset=utf-8" : mediaType
        } else {
            status = 404
            body = Data("Not found".utf8)
            headers["Content-Type"] = "text/plain; charset=utf-8"
        }
        headers["Content-Length"] = String(body.count)
        let response = HTTPURLResponse(
            url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }
}
