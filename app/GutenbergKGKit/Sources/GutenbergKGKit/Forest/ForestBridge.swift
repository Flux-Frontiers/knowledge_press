// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The two message shapes the forest and the app trade, both ways.
//
// web/src/game/host.ts is the page's half: it posts events to a WebKit
// message handler named `forest` and takes commands through
// `window.__forestHost.dispatch(json)`. This is the app's half, kept free of
// WebKit so the decoding and the script it writes can be tested. A change to
// either side's vocabulary has to change both files.

import Foundation

/// Something the forest tells the app.
public enum ForestEvent: Equatable, Sendable {
    /// The forest has grown and listens for commands.
    case ready
    /// A tree's card came up.
    case tree(slug: String)
    /// A book was read into the press (E at a tree).
    case pressed(slug: String)
    /// The card's Ask about this book.
    case ask(slug: String)
    /// Reset all settings: clear what the app keeps for the forest.
    case resetSettings

    /// The WebKit message handler's name, on both sides.
    public static let handlerName = "forest"

    /// Decode a posted message.
    ///
    /// WebKit hands a posted object over as a dictionary of Foundation values.
    /// Anything else, an unknown `kind`, or a tree event without a slug is
    /// dropped rather than guessed at: a newer forest in an older app should
    /// be ignored, not misread.
    ///
    /// :param body: `WKScriptMessage.body`.
    /// :returns: The event, or nil when the body is not one.
    public init?(messageBody body: Any) {
        guard let fields = body as? [String: Any], let kind = fields["kind"] as? String else {
            return nil
        }
        if kind == "ready" {
            self = .ready
            return
        }
        if kind == "resetSettings" {
            self = .resetSettings
            return
        }
        guard let slug = fields["slug"] as? String, !slug.isEmpty else { return nil }
        switch kind {
        case "tree": self = .tree(slug: slug)
        case "pressed": self = .pressed(slug: slug)
        case "ask": self = .ask(slug: slug)
        default: return nil
        }
    }
}

/// Something the app asks of the forest.
public enum ForestCommand: Equatable, Sendable {
    /// Go beside this tree and open its card, without reloading the page.
    case goto(slug: String)
    /// Back to the corpus redwood.
    case home
    /// The app's worker address, empty for none. Live moots use it.
    case worker(url: String)

    /// The command as the JSON `host.ts` parses.
    public var json: String {
        let fields: [String: String]
        switch self {
        case .goto(let slug): fields = ["kind": "goto", "slug": slug]
        case .home: fields = ["kind": "home"]
        case .worker(let url): fields = ["kind": "worker", "url": url]
        }
        let data = (try? JSONSerialization.data(withJSONObject: fields, options: [.sortedKeys])) ?? Data()
        return String(decoding: data, as: UTF8.self)
    }

    /// The script that delivers this command to the page.
    ///
    /// The JSON goes in as a JavaScript string literal -- itself JSON-encoded,
    /// so a slug cannot close the string or the call -- and the call is
    /// skipped when the page has no bridge (an older staged forest).
    public var script: String {
        let literal =
            (try? JSONSerialization.data(withJSONObject: [json], options: []))
            .map { String(decoding: $0, as: UTF8.self).dropFirst().dropLast() }
            .map(String.init) ?? "\"\""
        return "window.__forestHost && window.__forestHost.dispatch(\(literal)); void 0"
    }
}
