// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The web forest, served to the app's own web view.
//
// The forest is the production build of web/ (`make web-build`), staged into
// the app as a folder the way the corpus is. WebKit will not run it from
// `file://` -- `fetch()` of a file URL is refused and the module worker that
// grows the forest gets a null origin -- so the web view asks a custom URL
// scheme for every file, and this answers. It knows nothing about WebKit:
// a path in, bytes and a media type out, which is what makes it testable.

import Foundation

/// Answers requests for the forest's files from the staged forest folder.
public final class ForestServer: Sendable {

    /// The staged build: the contents of web/dist.
    public let root: URL

    /// :param root: The staged forest folder, holding `index.html`.
    public init(root: URL) {
        self.root = root.standardizedFileURL
    }

    /// True when a forest has been staged into `root`.
    ///
    /// An ordinary development or CI build carries an empty folder; the view
    /// shows how to stage one instead of a blank page.
    public var isStaged: Bool {
        FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path)
    }

    /// The bytes and media type for one path, or nil for 404.
    ///
    /// Only the empty path and `/` fall back to `index.html`. Anything else
    /// that is missing is a 404, so a broken asset shows up as an error in
    /// the web inspector rather than as the forest quietly loading twice.
    ///
    /// :param path: The request's path, with or without the leading slash.
    ///     A query string or fragment, if present, is ignored.
    /// :returns: The file's contents and its media type, or nil when there
    ///     is no such file under `root`.
    public func respond(to path: String) async throws -> (Data, String)? {
        let relative = Self.relativePath(path)
        let target = relative.isEmpty ? "index.html" : relative
        guard let url = file(at: target) else { return nil }
        return (try Data(contentsOf: url), Self.mediaType(forExtension: url.pathExtension))
    }

    /// The path with its query, fragment and leading slashes removed, and
    /// percent-escapes decoded.
    static func relativePath(_ path: String) -> String {
        var trimmed = Substring(path)
        if let cut = trimmed.firstIndex(where: { $0 == "?" || $0 == "#" }) {
            trimmed = trimmed[..<cut]
        }
        let decoded = String(trimmed).removingPercentEncoding ?? String(trimmed)
        return String(decoded.drop(while: { $0 == "/" }))
    }

    /// A regular file under `root`, or nil.
    ///
    /// Resolved and checked against `root`, so `../` in a request cannot
    /// read outside the staged folder.
    private func file(at relative: String) -> URL? {
        let url = root.appendingPathComponent(relative).standardizedFileURL
        guard url.path.hasPrefix(root.path + "/") else { return nil }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory),
            !isDirectory.boolValue
        else { return nil }
        return url
    }

    /// The media type a browser expects for a file extension.
    ///
    /// Module scripts are refused outright when served as anything but a
    /// JavaScript type, so `js` must be right; the rest mostly matter for
    /// the inspector. Unknown extensions are `application/octet-stream`.
    ///
    /// :param ext: The extension, without the dot, any case.
    /// :returns: The media type, without parameters.
    public static func mediaType(forExtension ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html"
        case "js", "mjs": return "text/javascript"
        case "css": return "text/css"
        case "json", "map": return "application/json"
        case "md": return "text/markdown"
        case "txt": return "text/plain"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        case "glb": return "model/gltf-binary"
        case "gltf": return "model/gltf+json"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "wasm": return "application/wasm"
        case "mp3": return "audio/mpeg"
        case "ogg": return "audio/ogg"
        case "wav": return "audio/wav"
        default: return "application/octet-stream"
        }
    }

    /// Whether a media type is text, so the response can name its encoding.
    ///
    /// :param mediaType: A type from `mediaType(forExtension:)`.
    /// :returns: True for the text types the build writes as UTF-8.
    public static func isText(_ mediaType: String) -> Bool {
        mediaType.hasPrefix("text/") || mediaType == "application/json"
            || mediaType == "image/svg+xml" || mediaType == "model/gltf+json"
    }
}
