// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Siri and Shortcuts support: "Ask The Knowledge Press <question>" runs the
// same retrieval + synthesis path as typing it into chat.
//
// `openAppWhenRun` runs `perform()` in-process rather than in an extension,
// because answering needs the live `AppModel` the chat UI already has open —
// the on-device embedder, the installed corpus packs, whichever answer
// engine Settings has selected. There is no other way to reach that `@State`
// instance from an intent, so this posts a notification and `AppModel`
// (see its `init()`) is the one live thing guaranteed to be listening by the
// time `openAppWhenRun` has finished bringing the app to the foreground.

import AppIntents
import Foundation

public struct AskKnowledgePressIntent: AppIntent {
    public static let title: LocalizedStringResource = "Ask The Knowledge Press"
    public static let description = IntentDescription(
        "Search the installed corpus and get an answer, the same way the chat does."
    )
    public static let openAppWhenRun: Bool = true

    @Parameter(title: "Question", requestValueDialog: "What do you want to ask?")
    public var question: String

    /// Leaves `question` unset. Set to "" it counted as answered, so Siri
    /// skipped the "What do you want to ask?" prompt and ran with an empty
    /// question, which `send` drops: the shortcut ran and did nothing.
    public init() {}

    public init(question: String) {
        self.question = question
    }

    public func perform() async throws -> some IntentResult {
        NotificationCenter.default.post(
            name: .askKnowledgePress, object: nil, userInfo: ["question": question])
        return .result()
    }
}

// The Siri phrases (`KnowledgePressShortcuts`) are in the app target,
// Sources/KnowledgePress/AppShortcuts.swift: Xcode extracts App Shortcuts
// only from the app's own module.

extension Notification.Name {
    /// Carries `["question": String]` in `userInfo`. Posted by
    /// `AskKnowledgePressIntent.perform()`, observed by `AppModel`.
    public static let askKnowledgePress = Notification.Name("askKnowledgePress")
}
