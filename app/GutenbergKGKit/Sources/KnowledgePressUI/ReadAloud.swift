// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Reading a chapter aloud in the Browse reader, one block per utterance, on
// AVSpeechSynthesizer. The queue follows the web forest's (speech.ts): a
// token per utterance so the end of a cut-off one is ignored, a pause that
// holds the engine mid-sentence, and a block said again from its start when
// something else cut it off.

import AVFoundation
import GutenbergKGKit
import Observation

/// What `ReadAloud` speaks through: the system synthesizer in the app, a fake in tests.
@MainActor
protocol Speaker: AnyObject {
    /// Called with an utterance's token when it ends: true when it was said
    /// to the end, false when it was cut off.
    var onEnd: (Int, Bool) -> Void { get set }
    func speak(_ text: String, voiceID: String?, rate: Double, token: Int)
    func pause()
    func resume()
    func stop()
}

/// The reader's read-aloud queue. One per app, so two chapters never speak at once.
@MainActor
@Observable
final class ReadAloud {
    enum State: Equatable { case idle, playing, paused }

    /// What is happening now.
    private(set) var state: State = .idle
    /// The block being said, or held at; -1 when idle.
    private(set) var block = -1

    /// Called when a reading starts, so the forest's own reading can stop.
    @ObservationIgnored var onStart: () -> Void = {}

    @ObservationIgnored private let speaker: Speaker
    @ObservationIgnored private var blocks: [String] = []
    @ObservationIgnored private var voiceID: String?
    @ObservationIgnored private var rate = 1.0
    @ObservationIgnored private var onDone: () -> Void = {}
    /// The utterance in flight; ends of any other are stale.
    @ObservationIgnored private var token = 0
    /// Paused with `pause()`, so `resume()` goes on mid-sentence.
    @ObservationIgnored private var held = false

    init(speaker: Speaker? = nil) {
        self.speaker = speaker ?? SystemSpeaker()
        self.speaker.onEnd = { [weak self] token, finished in self?.ended(token, finished: finished) }
    }

    /// Read a chapter's blocks from one, replacing any reading.
    ///
    /// :param blocks: Each block's spoken text; "" for one that is not said.
    /// :param from: The block to start at.
    /// :param voiceID: A voice identifier; nil for the system's English voice.
    /// :param rate: Speed as a multiple of the system's normal rate.
    /// :param onDone: Called once the last block has been said.
    func read(_ blocks: [String], from: Int, voiceID: String?, rate: Double, onDone: @escaping () -> Void) {
        token += 1  // before the stop, so the cut-off utterance's end is stale
        speaker.stop()
        self.blocks = blocks
        self.voiceID = voiceID
        self.rate = rate
        self.onDone = onDone
        onStart()
        say(from)
    }

    /// Pause where the voice is.
    func pause() {
        guard state == .playing else { return }
        speaker.pause()
        held = true
        state = .paused
    }

    /// Go on: mid-sentence after `pause()`, else from the start of the block.
    func resume() {
        guard state == .paused else { return }
        if held {
            held = false
            speaker.resume()
            state = .playing
        } else {
            say(block)
        }
    }

    /// Stop and forget the chapter.
    func stop() {
        guard state != .idle else { return }
        token += 1
        speaker.stop()
        blocks = []
        held = false
        state = .idle
        block = -1
    }

    private func say(_ from: Int) {
        var i = max(0, from)
        while i < blocks.count && blocks[i].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { i += 1 }
        guard i < blocks.count else {
            stop()
            onDone()
            return
        }
        token += 1
        held = false
        block = i
        state = .playing
        speaker.speak(blocks[i], voiceID: voiceID, rate: rate, token: token)
    }

    private func ended(_ ended: Int, finished: Bool) {
        guard ended == token, state != .idle else { return }
        if finished && state == .playing {
            say(block + 1)
        } else if !finished {
            // Cut off by someone else (a call, another app's audio): wait at this block.
            held = false
            state = .paused
        }
    }
}

/// The voices a reader can choose in Settings: English, no novelty voices,
/// by name.
///
/// :returns: (identifier, label) pairs, the label naming the accent and an
///     Enhanced or Premium copy.
func readingVoiceChoices() -> [(id: String, label: String)] {
    AVSpeechSynthesisVoice.speechVoices()
        .filter { $0.language.hasPrefix("en") && !$0.voiceTraits.contains(.isNoveltyVoice) }
        .sorted { ($0.name, $0.language) < ($1.name, $1.language) }
        .map { voice in
            let quality: String =
                switch voice.quality {
                case .premium: ", Premium"
                case .enhanced: ", Enhanced"
                default: ""
                }
            let name = voice.name.replacingOccurrences(of: #"\s*\(.*\)$"#, with: "", options: .regularExpression)
            return (voice.identifier, "\(name) (\(voice.language)\(quality))")
        }
}

/// The voice a book is read in: the one chosen in Settings, else the
/// installed voice that best fits its author, else nil for the system voice.
///
/// :param chosen: The Settings choice by identifier; empty for automatic.
/// :param want: The book's author voice from `core.pack`.
func readingVoiceID(chosen: String, want: AuthorVoice?) -> String? {
    if !chosen.isEmpty { return chosen }
    let installed = AVSpeechSynthesisVoice.speechVoices().map { voice in
        InstalledVoice(
            id: voice.identifier,
            name: voice.name.replacingOccurrences(of: #"\s*\(.*\)$"#, with: "", options: .regularExpression),
            language: voice.language,
            gender: voice.gender == .male ? .male : voice.gender == .female ? .female : nil,
            quality: voice.quality == .premium ? .premium : voice.quality == .enhanced ? .enhanced : .standard,
            novelty: voice.voiceTraits.contains(.isNoveltyVoice))
    }
    let device = AVSpeechSynthesisVoice.currentLanguageCode()
    return VoiceChoice.pick(want, from: installed, deviceAccent: device.hasPrefix("en") ? device : "en-US")
}

/// AVSpeechSynthesizer behind `Speaker`.
@MainActor
final class SystemSpeaker: NSObject, Speaker, AVSpeechSynthesizerDelegate {
    var onEnd: (Int, Bool) -> Void = { _, _ in }
    private let synthesizer = AVSpeechSynthesizer()
    private var tokens: [ObjectIdentifier: Int] = [:]

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func speak(_ text: String, voiceID: String?, rate: Double, token: Int) {
        activateAudio(true)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = voiceID.flatMap(AVSpeechSynthesisVoice.init(identifier:)) ?? Self.systemVoice()
        let scaled = AVSpeechUtteranceDefaultSpeechRate * Float(rate)
        utterance.rate = min(AVSpeechUtteranceMaximumSpeechRate, max(AVSpeechUtteranceMinimumSpeechRate, scaled))
        tokens[ObjectIdentifier(utterance)] = token
        synthesizer.speak(utterance)
    }

    func pause() { synthesizer.pauseSpeaking(at: .word) }
    func resume() { synthesizer.continueSpeaking() }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        activateAudio(false)
    }

    // The delegate may be called off the main thread; only the utterance's
    // identity crosses over, and a late end is stale by its token anyway.
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance)
        Task { @MainActor in self.end(id, finished: true) }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance)
        Task { @MainActor in self.end(id, finished: false) }
    }

    private func end(_ id: ObjectIdentifier, finished: Bool) {
        guard let token = tokens.removeValue(forKey: id) else { return }
        onEnd(token, finished)
    }

    /// The system's English voice: the device's own language when it is English, else US English.
    static func systemVoice() -> AVSpeechSynthesisVoice? {
        let code = AVSpeechSynthesisVoice.currentLanguageCode()
        return AVSpeechSynthesisVoice(language: code.hasPrefix("en") ? code : "en-US")
    }

    /// On iPhone and iPad, a book is spoken audio: heard with the ring
    /// switch on silent, and other audio ducks back in once it stops. No
    /// background mode, so locking the screen still stops it.
    private func activateAudio(_ on: Bool) {
        #if os(iOS)
            let session = AVAudioSession.sharedInstance()
            if on {
                try? session.setCategory(.playback, mode: .spokenAudio)
                try? session.setActive(true)
            } else {
                try? session.setActive(false, options: .notifyOthersOnDeactivation)
            }
        #endif
    }
}
