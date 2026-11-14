// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// What a book read aloud should sound like, and the installed voice that
// fits it best. The want comes from `core.pack` (`gender`, `accent`, written
// by `gutenkg export-swift` from the corpus's voices.json); the rule follows
// the web forest's `pickVoice` (speech.ts), except that Apple's voices report
// their own gender and quality, so no list of names is needed.

import Foundation

/// The author's voice: gender and accent, either unknown.
public struct AuthorVoice: Sendable, Equatable {
    public enum Gender: String, Sendable { case male, female }

    public let gender: Gender?
    /// A BCP 47 tag such as "en-GB"; nil for a translated author.
    public let accent: String?

    public init(gender: Gender?, accent: String?) {
        self.gender = gender
        self.accent = accent
    }
}

/// An installed voice, as much of it as the choice needs.
public struct InstalledVoice: Sendable, Equatable {
    public enum Quality: Int, Sendable { case standard, enhanced, premium }

    public let id: String
    public let name: String
    public let language: String
    public let gender: AuthorVoice.Gender?
    public let quality: Quality
    public let novelty: Bool

    public init(
        id: String, name: String, language: String, gender: AuthorVoice.Gender?,
        quality: Quality = .standard, novelty: Bool = false
    ) {
        self.id = id
        self.name = name
        self.language = language
        self.gender = gender
        self.quality = quality
        self.novelty = novelty
    }
}

public enum VoiceChoice {

    /// Accents close to each wanted one, nearest first; the forest's list.
    static let accentFamily: [String: [String]] = [
        "en-gb": ["en-gb", "en-ie", "en-au", "en-nz", "en-za"],
        "en-us": ["en-us", "en-ca"],
    ]

    /// Old macOS voices that report a gender but sound like a 1990s robot.
    static let robotic: Set<String> = ["Fred", "Albert", "Kathy", "Junior", "Ralph"]

    /// The best installed voice for a book's author, or nil for the system voice.
    ///
    /// A gendered author takes only a voice of that gender. Among those the
    /// nearest accent wins (exact, then the same family: British with Irish
    /// and Australian, American with Canadian), then a Premium or Enhanced
    /// copy, then the name. With no accent (a translated author) the
    /// device's own accent is wanted. With no gender, or no voice of it,
    /// nil: the system voice reads.
    ///
    /// :param want: The author's voice.
    /// :param voices: The installed voices.
    /// :param deviceAccent: The accent wanted when `want` names none, e.g. "en-US".
    /// :returns: A voice identifier, or nil.
    public static func pick(_ want: AuthorVoice?, from voices: [InstalledVoice], deviceAccent: String)
        -> String?
    {
        guard let gender = want?.gender else { return nil }
        let accent = (want?.accent ?? deviceAccent).lowercased()
        let family = accentFamily[accent] ?? [accent]
        func rank(_ voice: InstalledVoice) -> Int {
            family.firstIndex(of: region(voice.language)) ?? family.count
        }
        return voices
            .filter {
                $0.gender == gender && !$0.novelty && !robotic.contains($0.name)
                    && $0.language.lowercased().hasPrefix("en")
            }
            .min {
                (rank($0), -$0.quality.rawValue, $0.name) < (rank($1), -$1.quality.rawValue, $1.name)
            }?.id
    }

    /// "en-GB-u-sd-gbsct" as "en-gb": language and region only.
    static func region(_ language: String) -> String {
        language.lowercased().split(separator: "-").prefix(2).joined(separator: "-")
    }
}
