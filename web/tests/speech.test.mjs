import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const spoken = [];
const listeners = new Map();
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
globalThis.window = {
  speechSynthesis: { speak: (u) => spoken.push(u), cancel() {}, getVoices: () => [], speaking: false, pending: false },
  addEventListener: (type, fn) => listeners.set(type, fn),
  removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); },
};
const speech = () => require(`${process.env.FOREST_TEST_BUILD}/speech.js`);

test("the first tap speaks one silent utterance, then removes its listeners", () => {
  const { unlockSpeechOnGesture } = speech();
  unlockSpeechOnGesture();
  assert.deepEqual([...listeners.keys()].sort(), ["click", "keydown", "touchend"]);
  listeners.get("touchend")();
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].volume, 0);
  assert.equal(listeners.size, 0);
});

test("unlocking again does not speak again", () => {
  const { unlockSpeech } = speech();
  unlockSpeech();
  assert.equal(spoken.length, 1);
});
