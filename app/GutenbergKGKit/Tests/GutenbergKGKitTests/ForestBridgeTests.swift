// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The app's half of the forest bridge (web/src/game/host.ts is the page's).
// The event bodies here are what WebKit hands over for the objects host.ts
// posts; the command JSON is what host.ts's parseCommand accepts. A mismatch
// between the two halves fails silently in the app -- a button that does
// nothing -- so the vocabulary is pinned here.

import Foundation
import Testing

@testable import GutenbergKGKit

struct ForestEventTests {

    @Test func eachEventDecodes() {
        #expect(ForestEvent(messageBody: ["kind": "ready"]) == .ready)
        #expect(ForestEvent(messageBody: ["kind": "tree", "slug": "hamlet"]) == .tree(slug: "hamlet"))
        #expect(ForestEvent(messageBody: ["kind": "pressed", "slug": "hamlet"]) == .pressed(slug: "hamlet"))
        #expect(ForestEvent(messageBody: ["kind": "ask", "slug": "hamlet"]) == .ask(slug: "hamlet"))
        #expect(ForestEvent(messageBody: ["kind": "resetSettings"]) == .resetSettings)
    }

    @Test func extraFieldsAreIgnored() {
        let body: [String: Any] = ["kind": "ask", "slug": "hamlet", "title": "Hamlet", "n": 3]
        #expect(ForestEvent(messageBody: body) == .ask(slug: "hamlet"))
    }

    @Test func malformedBodiesAreDropped() {
        let bad: [Any] = [
            "ready",
            42,
            [String: Any](),
            ["kind": 1],
            ["kind": "explode", "slug": "hamlet"],
            ["kind": "ask"],
            ["kind": "ask", "slug": ""],
            ["kind": "tree", "slug": 7],
        ]
        for body in bad {
            #expect(ForestEvent(messageBody: body) == nil)
        }
    }

    @Test func aBridgedNSDictionaryDecodes() {
        // What WKScriptMessage.body actually is for a posted object.
        let body: NSDictionary = ["kind": "tree", "slug": "moby_dick"]
        #expect(ForestEvent(messageBody: body) == .tree(slug: "moby_dick"))
    }
}

struct ForestCommandTests {

    private func decode(_ json: String) throws -> [String: String] {
        try #require(
            JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: String])
    }

    @Test func commandsAreTheJSONHostTsParses() throws {
        #expect(try decode(ForestCommand.goto(slug: "hamlet").json) == ["kind": "goto", "slug": "hamlet"])
        #expect(try decode(ForestCommand.home.json) == ["kind": "home"])
        #expect(try decode(ForestCommand.worker(url: "http://mac.local:8000").json) == ["kind": "worker", "url": "http://mac.local:8000"])
        #expect(try decode(ForestCommand.worker(url: "").json) == ["kind": "worker", "url": ""])
    }

    @Test func theScriptCallsTheBridgeWithAStringLiteral() throws {
        let script = ForestCommand.goto(slug: "hamlet").script
        #expect(script.hasPrefix("window.__forestHost && window.__forestHost.dispatch(\""))
        #expect(script.hasSuffix("); void 0"))
        // The argument is a JS string whose contents are the command's JSON.
        let start = try #require(script.firstIndex(of: "("))
        let end = try #require(script.lastIndex(of: ")"))
        let literal = String(script[script.index(after: start)..<end])
        let inner = try #require(
            JSONSerialization.jsonObject(with: Data("[\(literal)]".utf8)) as? [String])
        #expect(try decode(inner[0]) == ["kind": "goto", "slug": "hamlet"])
    }

    @Test func aHostileSlugStaysInsideTheString() throws {
        let slug = #"x"); alert("pwned"); ("\"#
        let script = ForestCommand.goto(slug: slug).script
        let start = try #require(script.firstIndex(of: "("))
        let end = try #require(script.lastIndex(of: ")"))
        let literal = String(script[script.index(after: start)..<end])
        let inner = try #require(
            JSONSerialization.jsonObject(with: Data("[\(literal)]".utf8)) as? [String])
        #expect(try decode(inner[0])["slug"] == slug)
    }
}
