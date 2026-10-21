import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// A browser whose voice list is empty until it says otherwise, as Chrome's is
// right after it starts. node --test runs each file in its own process, so
// these globals stay here.
const daniel = { name: "Daniel (Enhanced)", lang: "en-GB", default: false, localService: true };
const arthur = { name: "Arthur (Enhanced)", lang: "en-GB", default: false, localService: true };
const engine = {
  listed: [],
  spoken: [],
  listeners: new Set(),
  speaking: false,
  pending: false,
  getVoices() { return this.listed; },
  speak(u) { this.spoken.push(u); },
  cancel() {},
  resume() {},
  addEventListener(type, fn) { if (type === "voiceschanged") this.listeners.add(fn); },
  removeEventListener(type, fn) { if (type === "voiceschanged") this.listeners.delete(fn); },
  listVoices(list) { this.listed = list; for (const fn of [...this.listeners]) fn(); },
};
globalThis.window = { speechSynthesis: engine, setTimeout, clearTimeout };
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };

const speech = () => require(`${process.env.FOREST_TEST_BUILD}/speech.js`);
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

// Order matters: the module keeps the voice list once it has one, so the
// waiting cases run before any test lists voices.
test("hush cancels a line still waiting for voices", async () => {
  const { speak, hush, speaking } = speech();
  speak("never said", false, { speaker: 0 });
  hush();
  assert.equal(speaking(), false);
  await tick(1100); // past VOICE_WAIT_MS: the overtaken line must stay unsaid
  assert.equal(engine.spoken.length, 0);
});

test("a moot line waits for the voice list instead of speaking with the default voice", async () => {
  const { speak, speaking } = speech();
  speak("Thus Spake Zarathustra, I confess", false, {
    speaker: 1, wants: [{ gender: "male", accent: "en-GB" }, { gender: "male", accent: null }],
  });
  assert.equal(engine.spoken.length, 0); // nothing yet: no voices
  assert.equal(speaking(), true); // so the player does not skip the turn
  engine.listVoices([daniel, arthur]);
  assert.equal(engine.spoken.length, 1);
  assert.equal(engine.spoken[0].voice, arthur); // the second speaker's voice
  assert.equal(engine.spoken[0].text, "Thus Spake Zarathustra, I confess");
});
