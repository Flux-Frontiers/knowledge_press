import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// A speech engine that says nothing: each utterance waits until a test ends
// it. cancel() fails the one in flight with "canceled", as Safari does.
// node --test runs each file in its own process, so these globals stay here.
const engine = {
  spoken: [],
  paused: 0,
  resumed: 0,
  speaking: false,
  pending: false,
  getVoices: () => [{ name: "Samantha", lang: "en-US", default: true, localService: true }],
  speak(u) { this.spoken.push(u); },
  cancel() { const u = this.spoken.at(-1); if (u && !u.done) { u.done = true; u.onerror?.({ error: "canceled" }); } },
  pause() { this.paused++; },
  resume() { this.resumed++; },
  addEventListener() {},
  removeEventListener() {},
};
const visibility = new Set();
globalThis.window = { speechSynthesis: engine, setTimeout, clearTimeout };
globalThis.document = {
  visibilityState: "visible",
  addEventListener: (type, fn) => { if (type === "visibilitychange") visibility.add(fn); },
};
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };

const speech = () => require(`${process.env.FOREST_TEST_BUILD}/speech.js`);
const last = () => engine.spoken.at(-1);
const finish = () => { const u = last(); u.done = true; u.onend?.({}); };
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

function start(blocks, from = 0) {
  const seen = [];
  let done = 0;
  speech().readAloud({ blocks, from, onChange: (state, block) => seen.push(`${state}@${block}`), onDone: () => done++ });
  return { seen, done: () => done };
}

test("a chapter is read block by block, skipping blocks that are not said, then reports done", () => {
  const { readingState, speaking } = speech();
  const run = start(["One.", "", "Two.", "Three."]);
  assert.equal(last().text, "One.");
  assert.equal(readingState(), "playing");
  assert.equal(speaking(), false); // the tour's hold must not wait on a book
  finish();
  assert.equal(last().text, "Two."); // the empty block (a note) is passed over
  finish();
  finish();
  assert.equal(readingState(), "idle");
  assert.equal(run.done(), 1);
  assert.deepEqual(run.seen, ["playing@0", "playing@2", "playing@3", "idle@0"]);
});

test("pause holds the engine mid-sentence and resume goes on without starting over", () => {
  const { pauseReading, resumeReading, readingState, stopReading } = speech();
  start(["A long paragraph.", "Next."]);
  const count = engine.spoken.length;
  pauseReading();
  assert.equal(readingState(), "paused");
  assert.equal(engine.paused, 1);
  resumeReading();
  assert.equal(readingState(), "playing");
  assert.equal(engine.resumed, 1);
  assert.equal(engine.spoken.length, count); // the same utterance, not a new one
  stopReading();
});

test("narration cutting in pauses the reading at its block; resume says that block again", () => {
  const { speak, resumeReading, readingState, stopReading } = speech();
  start(["First.", "Second."]);
  finish();
  assert.equal(last().text, "Second.");
  speak("Welcome to the grove.");
  assert.equal(readingState(), "paused");
  finish(); // the narration ends; the reading stays put
  assert.equal(readingState(), "paused");
  resumeReading();
  assert.equal(last().text, "Second.");
  assert.equal(readingState(), "playing");
  stopReading();
});

test("stop ends the reading, and the cancelled block does not lead on to the next", () => {
  const { stopReading, readingState } = speech();
  const run = start(["First.", "Second."]);
  const count = engine.spoken.length;
  stopReading();
  assert.equal(readingState(), "idle");
  assert.equal(engine.spoken.length, count);
  assert.equal(run.done(), 0);
});

test("back from a lock with the engine stuck, the block is said again; with progress, it is left alone", async () => {
  const { stopReading } = speech();
  start(["Stuck here.", "After."]);
  const stuck = last();
  await tick(10);
  for (const fn of visibility) fn();
  await tick(1600);
  assert.equal(last().text, "Stuck here.");
  assert.notEqual(last(), stuck); // a fresh utterance for the same block

  const speakingOn = last();
  for (const fn of visibility) fn();
  await tick(200);
  speakingOn.onboundary?.({}); // the engine is still talking (macOS reads on through a lock)
  await tick(1500);
  assert.equal(last(), speakingOn);
  stopReading();
});

test("paused across a lock, play says the block again rather than resume a stuck engine", () => {
  const { pauseReading, resumeReading, readingState, stopReading } = speech();
  start(["Held here.", "After."]);
  const held = last();
  pauseReading();
  for (const fn of visibility) fn();
  assert.equal(readingState(), "paused");
  resumeReading();
  assert.equal(last().text, "Held here.");
  assert.notEqual(last(), held);
  stopReading();
});
