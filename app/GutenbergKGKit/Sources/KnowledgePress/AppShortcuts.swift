// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The Siri and Shortcuts phrases for `AskKnowledgePressIntent`.
//
// This lives in the app target, not in KnowledgePressUI with the intent:
// Xcode extracts App Shortcuts only from the app's own module. Declared in
// the package, the intent still reached the Shortcuts action list, but the
// shortcut and its Siri phrases never did (the built app's
// Metadata.appintents had one action and no autoShortcuts). The Mac target
// compiles this directory; app/ios/project.yml lists this file for iOS.

import AppIntents
import KnowledgePressUI

/// Surfaces `AskKnowledgePressIntent` to Siri and the Shortcuts app.
///
/// One shortcut, not per-genre ones: corpus scope is already a Settings
/// choice, and multiplying shortcuts by 21 genres would clutter Shortcuts
/// for a distinction Siri phrasing cannot express cleanly anyway.
///
/// The phrase cannot embed `$question`: App Intents only allows an
/// `AppEntity`/`AppEnum` parameter inside an invocation phrase, since Siri
/// needs a bounded vocabulary to match against, and free text has none.
/// Saying "Ask The Knowledge Press" triggers the intent with `question`
/// still unset, and its `requestValueDialog` prompts for it by voice.
struct KnowledgePressShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskKnowledgePressIntent(),
            phrases: [
                "Ask \(.applicationName)",
                "Ask \(.applicationName) a question",
            ],
            shortTitle: "Ask a Question",
            systemImageName: "text.bubble"
        )
    }
}
