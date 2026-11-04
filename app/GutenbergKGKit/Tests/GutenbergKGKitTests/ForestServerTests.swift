// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The forest's file server: what the Forest tab's web view gets for each
// path. A wrong media type or a missing-file fallback to index.html both
// break the page silently, so they are pinned here rather than found on a
// phone.

import Foundation
import Testing

@testable import GutenbergKGKit

/// A throwaway staged forest: index.html, one script, one nested texture.
private struct StagedForest {
    let root: URL

    init() throws {
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("forest-\(UUID().uuidString)", isDirectory: true)
        let assets = root.appendingPathComponent("assets", isDirectory: true)
        try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)
        try Data("<!doctype html><title>Forest</title>".utf8)
            .write(to: root.appendingPathComponent("index.html"))
        try Data("export const x = 1;".utf8).write(to: assets.appendingPathComponent("x.js"))
        try Data([0x67, 0x6C, 0x54, 0x46]).write(to: assets.appendingPathComponent("tree.glb"))
    }

    func remove() { try? FileManager.default.removeItem(at: root) }
}

struct ForestServerStaticTests {

    @Test func rootPathIsIndexHTML() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let server = ForestServer(root: forest.root)
        for path in ["", "/", "/?tree=hamlet"] {
            let (data, type) = try #require(try await server.respond(to: path))
            #expect(type == "text/html")
            #expect(String(decoding: data, as: UTF8.self).contains("<title>Forest</title>"))
        }
        #expect(server.isStaged)
    }

    @Test func assetsCarryTheirMediaType() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let server = ForestServer(root: forest.root)
        let (script, scriptType) = try #require(try await server.respond(to: "/assets/x.js"))
        #expect(scriptType == "text/javascript")
        #expect(String(decoding: script, as: UTF8.self) == "export const x = 1;")
        let (_, modelType) = try #require(try await server.respond(to: "assets/tree.glb"))
        #expect(modelType == "model/gltf-binary")
    }

    @Test func missingFilesAre404NotIndex() async throws {
        let forest = try StagedForest()
        defer { forest.remove() }
        let server = ForestServer(root: forest.root)
        #expect(try await server.respond(to: "/assets/missing.js") == nil)
        #expect(try await server.respond(to: "/assets") == nil)
        #expect(try await server.respond(to: "/../../etc/hosts") == nil)
        #expect(try await server.respond(to: "/assets/%2E%2E/%2E%2E/etc/hosts") == nil)
    }

    @Test func anEmptyFolderIsNotStaged() throws {
        let empty = FileManager.default.temporaryDirectory
            .appendingPathComponent("forest-empty-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: empty, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: empty) }
        #expect(!ForestServer(root: empty).isStaged)
    }

    @Test func unknownExtensionsAreOctetStream() {
        #expect(ForestServer.mediaType(forExtension: "CSS") == "text/css")
        #expect(ForestServer.mediaType(forExtension: "webp") == "image/webp")
        #expect(ForestServer.mediaType(forExtension: "wasm") == "application/wasm")
        #expect(ForestServer.mediaType(forExtension: "xyz") == "application/octet-stream")
    }
}
