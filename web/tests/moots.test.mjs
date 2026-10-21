import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const moots = () => require(`${process.env.FOREST_TEST_BUILD}/moots.js`);

const pack = () => ({
  version: 1,
  id: "pepys-zarathustra-jealousy",
  topic: "jealousy",
  date: "2026-10-21",
  model: "m",
  backend: "omlx",
  trees: [
    { key: "diaries/The Diary of Samuel Pepys", title: "The Diary of Samuel Pepys", author: "Samuel Pepys" },
    { key: "philosophy/Thus Spake Zarathustra", title: "Thus Spake Zarathustra", author: "Nietzsche" },
  ],
  // Out of order on purpose: the decoder puts them in speaking order.
  turns: [
    { turn: 2, speaker: 1, text: "Pepys, no.", cites: [], grounded: true, snaps: [] },
    { turn: 1, speaker: 0, text: "I open this moot.", cites: [{ tag: "s1", label: "1664-01-18", node_id: "chunk:x" }], grounded: true, snaps: [] },
    { turn: 3, speaker: 0, text: "Again.", cites: [], grounded: false, snaps: [] },
  ],
  stats: {},
});

test("a moot pack decodes, its turns in order with the first tree on the left", () => {
  const { decodeMoot } = moots();
  const m = decodeMoot(pack());
  assert.equal(m.id, "pepys-zarathustra-jealousy");
  assert.deepEqual(m.turns.map((t) => t.turn), [1, 2, 3]);
  assert.deepEqual(m.turns.map((t) => t.speaker), [0, 1, 0]);
  assert.equal(m.turns[0].cites[0].label, "1664-01-18");
});

test("a moot pack of another version or shape is refused", () => {
  const { decodeMoot, MootError } = moots();
  assert.throws(() => decodeMoot({ ...pack(), version: 2 }), /version 2 is not 1/);
  assert.throws(() => decodeMoot(null), MootError);
  assert.throws(() => decodeMoot({ ...pack(), trees: [pack().trees[0]] }), /two trees/);
  assert.throws(() => decodeMoot({ ...pack(), turns: "none" }), /two trees and a list of turns/);
  assert.throws(() => decodeMoot({ ...pack(), turns: [{ turn: 1, speaker: 2, text: "x", cites: [] }] }), /malformed turn/);
  assert.throws(() => decodeMoot({ ...pack(), turns: [{ turn: 1, speaker: 0, cites: [] }] }), /malformed turn/);
  assert.throws(() => decodeMoot({ ...pack(), trees: [{ key: 1, title: "x" }, pack().trees[1]] }), /malformed tree/);
});

test("the moot index decodes and refuses a bad entry", () => {
  const { decodeIndex, MootError } = moots();
  const entry = { id: "a", title: "A and B on c", topic: "c", trees: ["g/a", "g/b"], turns: 4, date: "2026-10-21" };
  assert.deepEqual(decodeIndex([entry]), [entry]);
  assert.deepEqual(decodeIndex([]), []);
  assert.throws(() => decodeIndex({ moots: [entry] }), MootError);
  assert.throws(() => decodeIndex([{ ...entry, turns: "4" }]), /malformed entry/);
});

test("trees match catalog books by genre and book folder; an unknown key matches nothing", () => {
  const { decodeMoot, mootBooks } = moots();
  const books = [
    { slug: "pepys", genre: "diaries", book: "The Diary of Samuel Pepys", title: "Pepys's Diary" },
    { slug: "zara", genre: "fiction", book: "Thus Spake Zarathustra", title: "Thus Spake Zarathustra" },
  ];
  const [a, b] = mootBooks(decodeMoot(pack()), books);
  assert.equal(a.slug, "pepys");
  // Same folder, other genre: not the same tree.
  assert.equal(b, undefined);
  assert.deepEqual(mootBooks(decodeMoot(pack()), []), [undefined, undefined]);
});

test("names, quotes and citation tags are marked; the rest is plain", () => {
  const { markText } = moots();
  const open = String.fromCharCode(0x201c), close = String.fromCharCode(0x201d);
  const text = `Thus Spake Zarathustra, I say ${open}God forgive me${close} [s1]. Pepys says "so deadly full" (s2, o3) and The Diary of Samuel Pepys agrees.`;
  const spans = markText(text, ["The Diary of Samuel Pepys", "Thus Spake Zarathustra"]);
  assert.equal(spans.map((s) => s.text).join(""), text);
  assert.deepEqual(spans.filter((s) => s.kind !== "plain"), [
    { text: "Thus Spake Zarathustra", kind: "name", side: 1 },
    { text: `${open}God forgive me${close}`, kind: "quote" },
    { text: "[s1]", kind: "tag" },
    { text: '"so deadly full"', kind: "quote" },
    { text: "(s2, o3)", kind: "tag" },
    { text: "The Diary of Samuel Pepys", kind: "name", side: 0 },
  ]);
  // A title with regex characters is matched literally.
  assert.deepEqual(markText("Is (1+1)? yes", ["(1+1)?", "B"]).map((s) => s.kind), ["plain", "name", "plain"]);
});

test("spoken text drops the citation tags", () => {
  const { spokenText } = moots();
  assert.equal(spokenText("I confess [s1]. Yet [o3, s2] I find none (s5)."), "I confess. Yet I find none.");
});

test("a silent turn stays for its reading time, never under four seconds", () => {
  const { readingMs } = moots();
  assert.equal(readingMs("Short [s1]."), 4000);
  const long = Array.from({ length: 60 }, () => "word").join(" ") + " [s2] [o1]";
  assert.equal(readingMs(long), 20000); // 60 words at 3 a second; tags are not read
});

test("moots are read aloud unless turned off", () => {
  const { readPreferences } = require(`${process.env.FOREST_TEST_BUILD}/preferences.js`);
  assert.equal(readPreferences().speakMoots, true);
  assert.equal(readPreferences({ speakMoots: false }).speakMoots, false);
});

test("the exported moots decode and their trees stand in the catalog", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const { decodeIndex, decodeMoot, mootBooks } = moots();
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  if (!existsSync("public/moots/index.json")) return;
  for (const entry of decodeIndex(JSON.parse(readFileSync("public/moots/index.json", "utf8")))) {
    const m = decodeMoot(JSON.parse(readFileSync(`public/moots/${entry.id}.json`, "utf8")));
    assert.equal(m.turns.length, entry.turns);
    assert.ok(mootBooks(m, BOOKS).every(Boolean), `${entry.id}: a tree is not in the catalog`);
  }
});

test("the moot voice setting keeps two names and resets anything else", () => {
  const { readPreferences } = require(`${process.env.FOREST_TEST_BUILD}/preferences.js`);
  assert.deepEqual(readPreferences().mootVoices, ["", ""]);
  assert.deepEqual(readPreferences({ mootVoices: ["Daniel", ""] }).mootVoices, ["Daniel", ""]);
  assert.deepEqual(readPreferences({ mootVoices: ["Daniel"] }).mootVoices, ["", ""]);
  assert.deepEqual(readPreferences({ mootVoices: "Daniel" }).mootVoices, ["", ""]);
  assert.deepEqual(readPreferences({ mootVoices: [1, 2] }).mootVoices, ["", ""]);
});

// ---------------------------------------------------------------------------
// Voices that match each book's author: gender first, then accent
// ---------------------------------------------------------------------------

const voice = (name, lang, isDefault = false, local = true) => ({ name, lang, default: isDefault, localService: local });
const want = (gender, accent) => ({ gender, accent });
const pair = (...args) => require(`${process.env.FOREST_TEST_BUILD}/speech.js`).voicePair(...args);
// Safari's whole English list: what macOS and iOS ship.
const safari = () => {
  const [daniel, karen, moira, rishi, samantha, tessa] = [voice("Daniel", "en-GB"), voice("Karen", "en-AU"),
    voice("Moira", "en-IE"), voice("Rishi", "en-IN"), voice("Samantha", "en-US", true), voice("Tessa", "en-ZA")];
  return { all: [daniel, karen, moira, rishi, samantha, tessa], daniel, karen, moira, rishi, samantha, tessa };
};
const auto = ["", ""];

test("Safari: men get Daniel, women a woman's voice, never Rishi", () => {
  const { all, daniel, moira, samantha } = safari();
  // Pepys and Nietzsche: both men, so Daniel twice (the second deeper).
  assert.deepEqual(pair(all, auto, [want("male", "en-GB"), want("male", null)]), [daniel, daniel]);
  // Twain has no American man in Safari: Daniel, not Rishi.
  assert.deepEqual(pair(all, auto, [want("male", "en-US"), want("male", null)]), [daniel, daniel]);
  // Austen: Moira, the nearest British accent among the women; Twain: Daniel.
  assert.deepEqual(pair(all, auto, [want("female", "en-GB"), want("male", "en-US")]), [moira, daniel]);
  // Two American women: Samantha, then another woman rather than Samantha again.
  const [first, second] = pair(all, auto, [want("female", "en-US"), want("female", "en-US")]);
  assert.equal(first, samantha);
  assert.ok(["Moira", "Karen", "Tessa"].includes(second.name));
});

test("Chrome: its own voices before downloads it lists but may not have", () => {
  const daniel = voice("Daniel (English (UK))", "en-GB");
  const arthur = voice("Arthur", "en-GB"); // listed, maybe never downloaded
  const ukMale = voice("Google UK English Male", "en-GB", false, false);
  const us = voice("Google US English", "en-US", false, false);
  const ukFemale = voice("Google UK English Female", "en-GB", false, false);
  const samantha = voice("Samantha (English (US))", "en-US", true);
  const chrome = [arthur, daniel, ukMale, us, ukFemale, samantha];
  assert.deepEqual(pair(chrome, auto, [want("male", "en-GB"), want("male", null)]), [daniel, ukMale]);
  assert.deepEqual(pair(chrome, auto, [want("female", "en-GB"), want("male", "en-US")]), [ukFemale, daniel]);
});

test("Edge: an American man for Twain", () => {
  const guy = voice("Microsoft Guy Online (Natural) - English (United States)", "en-US", false, false);
  const ryan = voice("Microsoft Ryan Online (Natural) - English (United Kingdom)", "en-GB", false, false);
  const aria = voice("Microsoft Aria Online (Natural) - English (United States)", "en-US", true, false);
  assert.deepEqual(pair([aria, ryan, guy], auto, [want("male", "en-US"), want("male", "en-GB")]), [guy, ryan]);
});

test("downloads count once installed: an Enhanced copy wins among them", () => {
  const { all } = safari();
  const arthur = voice("Arthur", "en-GB");
  const arthurPlus = voice("Arthur (Enhanced)", "en-GB");
  const jamiePlus = voice("Jamie (Enhanced)", "en-GB");
  const [first, second] = pair([...all, arthur, arthurPlus, jamiePlus], auto, [want("male", "en-GB"), want("male", null)]);
  assert.equal(first.name, "Daniel");
  assert.equal(second, arthurPlus);
});

test("an author of unknown gender gets the system's default voice", () => {
  const { all, samantha } = safari();
  assert.equal(pair(all, auto, [want(null, null), want("male", "en-GB")])[0], samantha);
});

test("a voice chosen in Settings wins for its speaker when the browser has it", () => {
  const { all, daniel, moira, samantha } = safari();
  const men = [want("male", "en-GB"), want("male", null)];
  assert.deepEqual(pair(all, ["Samantha", ""], men), [samantha, daniel]);
  assert.deepEqual(pair(all, ["", "Moira"], men), [daniel, moira]);
  assert.deepEqual(pair(all, ["Gone Voice", "Also Gone"], men), [daniel, daniel]); // not here: automatic
});

test("a tree's voice decodes from the pack, anything unknown as null", () => {
  const { decodeMoot } = moots();
  const p = pack();
  p.trees[0].voice = { gender: "male", accent: "en-GB" };
  p.trees[1].voice = { gender: "robot", accent: 7 };
  const m = decodeMoot(p);
  assert.deepEqual(m.trees[0].voice, { gender: "male", accent: "en-GB" });
  assert.deepEqual(m.trees[1].voice, { gender: null, accent: null });
  delete p.trees[0].voice; // a pack written before voices
  assert.deepEqual(decodeMoot(p).trees[0].voice, { gender: null, accent: null });
});
