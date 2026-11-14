// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// The Browse reader's read-aloud queue, with a speaker that says nothing: each
// utterance waits until a test ends it, and stop() cuts the one in flight off,
// as AVSpeechSynthesizer's didCancel does. Then the reading choices in Settings.

import Foundation
import Testing

@testable import KnowledgePressUI

@MainActor
private final class SilentSpeaker: Speaker {
    var onEnd: (Int, Bool) -> Void = { _, _ in }
    var said: [(text: String, token: Int)] = []
    var paused = 0
    var resumed = 0
    private var inFlight: Int?

    func speak(_ text: String, voiceID: String?, rate: Double, token: Int) {
        said.append((text, token))
        inFlight = token
    }
    func pause() { paused += 1 }
    func resume() { resumed += 1 }
    func stop() {
        if let token = inFlight {
            inFlight = nil
            onEnd(token, false)
        }
    }
    /// The utterance in flight is said to its end.
    func finish() {
        guard let token = inFlight else { return }
        inFlight = nil
        onEnd(token, true)
    }
    /// Something else (a call) cuts the utterance off.
    func interrupt() { stop() }
}

@MainActor
@Suite("Read aloud")
struct ReadAloudTests {

    @Test("a chapter is read block by block, skipping unsaid blocks, then reports done")
    func readsInOrder() {
        let speaker = SilentSpeaker()
        let reading = ReadAloud(speaker: speaker)
        var done = 0
        reading.read(["One.", "", "Two."], from: 0, voiceID: nil, rate: 1) { done += 1 }
        #expect(speaker.said.last?.text == "One.")
        #expect(reading.state == .playing)
        speaker.finish()
        #expect(speaker.said.last?.text == "Two.")
        #expect(reading.block == 2)
        speaker.finish()
        #expect(reading.state == .idle)
        #expect(done == 1)
    }

    @Test("a new reading's cut-off predecessor does not move it on")
    func staleEndIsIgnored() {
        let speaker = SilentSpeaker()
        let reading = ReadAloud(speaker: speaker)
        reading.read(["First.", "Second."], from: 0, voiceID: nil, rate: 1) {}
        reading.read(["Other."], from: 0, voiceID: nil, rate: 1) {}
        #expect(speaker.said.map(\.text) == ["First.", "Other."])
        #expect(reading.state == .playing)
        reading.stop()
    }

    @Test("pause holds the voice mid-sentence and resume goes on without starting over")
    func pauseAndResume() {
        let speaker = SilentSpeaker()
        let reading = ReadAloud(speaker: speaker)
        reading.read(["A long paragraph."], from: 0, voiceID: nil, rate: 1) {}
        reading.pause()
        #expect(reading.state == .paused)
        #expect(speaker.paused == 1)
        reading.resume()
        #expect(reading.state == .playing)
        #expect(speaker.resumed == 1)
        #expect(speaker.said.count == 1)
        reading.stop()
    }

    @Test("cut off by something else, the reading waits and play says the block again")
    func interruptedBlockIsSaidAgain() {
        let speaker = SilentSpeaker()
        let reading = ReadAloud(speaker: speaker)
        reading.read(["First.", "Second."], from: 0, voiceID: nil, rate: 1) {}
        speaker.finish()
        speaker.interrupt()
        #expect(reading.state == .paused)
        #expect(reading.block == 1)
        reading.resume()
        #expect(speaker.said.last?.text == "Second.")
        #expect(speaker.said.count == 3)
        #expect(speaker.resumed == 0)
        reading.stop()
    }

    @Test("stop ends the reading, and the cut-off block does not lead on")
    func stopEnds() {
        let speaker = SilentSpeaker()
        let reading = ReadAloud(speaker: speaker)
        var done = 0
        reading.read(["First.", "Second."], from: 0, voiceID: nil, rate: 1) { done += 1 }
        reading.stop()
        #expect(reading.state == .idle)
        #expect(reading.block == -1)
        #expect(speaker.said.count == 1)
        #expect(done == 0)
    }

    @Test("starting a reading tells the forest to be quiet")
    func startCallsOnStart() {
        let reading = ReadAloud(speaker: SilentSpeaker())
        var started = 0
        reading.onStart = { started += 1 }
        reading.read(["One."], from: 0, voiceID: nil, rate: 1) {}
        #expect(started == 1)
        reading.stop()
    }

    @Test("voice and speed are kept across launches and reset with everything else")
    func readingSettingsPersistAndReset() {
        let name = "ReadAloudTests.\(UUID().uuidString)"
        let previous = AppModel.defaults
        AppModel.defaults = UserDefaults(suiteName: name)!
        defer {
            AppModel.defaults = previous
            UserDefaults.standard.removePersistentDomain(forName: name)
        }
        let model = AppModel()
        #expect(model.readVoiceID.isEmpty)
        #expect(model.readRate == AppModel.defaultReadRate)
        model.readVoiceID = "com.apple.voice.compact.en-GB.Daniel"
        model.readRate = 1.2
        #expect(!model.settingsAreDefault)

        let relaunched = AppModel()
        #expect(relaunched.readVoiceID == "com.apple.voice.compact.en-GB.Daniel")
        #expect(relaunched.readRate == 1.2)

        relaunched.resetAllSettings()
        #expect(relaunched.readVoiceID.isEmpty)
        #expect(relaunched.readRate == AppModel.defaultReadRate)
    }
}
