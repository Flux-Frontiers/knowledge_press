import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// The same silent engine as readAloud.test.mjs: each utterance waits until a
// test ends it, and cancel() fails the one in flight with "canceled".
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
globalThis.window = { speechSynthesis: engine, setTimeout, clearTimeout };
globalThis.document = { visibilityState: "visible", addEventListener() {} };
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };

const build = (name) => require(`${process.env.FOREST_TEST_BUILD}/${name}.js`);
const last = () => engine.spoken.at(-1);
const finish = () => { const u = last(); u.done = true; u.onend?.({}); };

const CHAPTERS = [
  { title: "Chapter I", text: "It began.\n\nIt went on." },
  { title: "Chapter II", text: "It ended." },
];

function readTwoChapters() {
  const updates = [];
  build("bookReading").readBook({
    slug: "tale", title: "A Tale", chapters: CHAPTERS, chapter: 0, from: 0, onUpdate: (r) => updates.push(r),
  });
  return updates;
}

test("a book goes on to its next chapter by itself and reports null at its end", () => {
  const { blocksOf, currentBook } = build("bookReading");
  const updates = readTwoChapters();
  const first = blocksOf(CHAPTERS, 0).filter((b) => b.spoken).length;
  for (let i = 0; i < first; i++) finish();
  assert.equal(currentBook().chapter, 1);
  assert.equal(currentBook().chapterTitle, "Chapter II");
  assert.equal(currentBook().state, "playing");
  while (currentBook()) finish();
  assert.equal(updates.at(-1), null);
  assert.equal(build("speech").readingState(), "idle");
});

test("hush, the tour's stop-narrating, leaves a book being read alone", () => {
  const { hush, readingState } = build("speech");
  const { stopBook } = build("bookReading");
  readTwoChapters();
  const saying = last();
  hush();
  assert.equal(readingState(), "playing");
  assert.equal(saying.done, undefined);
  stopBook();
});

test("a moot cuts the book off and it goes on from the same block afterward", () => {
  const { interruptReading, resumeInterrupted, readingState } = build("speech");
  const { stopBook, currentBook } = build("bookReading");
  readTwoChapters();
  finish();
  const at = currentBook().block;
  const cut = last();
  interruptReading();
  assert.equal(readingState(), "paused");
  assert.equal(cut.done, true);
  resumeInterrupted();
  assert.equal(readingState(), "playing");
  assert.equal(currentBook().block, at);
  assert.notEqual(last(), cut);
  assert.equal(last().text, cut.text);
  stopBook();
});

test("a book the listener paused stays paused through a moot, its engine let go", () => {
  const { pauseReading, resumeReading, interruptReading, resumeInterrupted, readingState } = build("speech");
  const { stopBook } = build("bookReading");
  readTwoChapters();
  const held = last();
  pauseReading();
  const resumed = engine.resumed;
  interruptReading();
  assert.equal(engine.resumed, resumed + 1); // the paused engine is released for the moot
  assert.equal(held.done, true);
  resumeInterrupted();
  assert.equal(readingState(), "paused");
  resumeReading(); // play: the block is said again
  assert.equal(readingState(), "playing");
  assert.equal(last().text, held.text);
  assert.notEqual(last(), held);
  stopBook();
});

test("stopping the book reports null and says nothing more", () => {
  const { stopBook, currentBook } = build("bookReading");
  const updates = readTwoChapters();
  const count = engine.spoken.length;
  stopBook();
  assert.equal(currentBook(), null);
  assert.equal(updates.at(-1), null);
  assert.equal(engine.spoken.length, count);
});
