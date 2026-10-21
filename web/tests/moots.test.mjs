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

test("two speakers get British male voices, never a female or old UK voice", () => {
  const { voicePair } = require(`${process.env.FOREST_TEST_BUILD}/speech.js`);
  const v = (name, lang, isDefault = false) => ({ name, lang, default: isDefault, localService: true });
  const daniel = v("Daniel", "en-GB");
  const samantha = v("Samantha (English (US))", "en-US", true);
  const reedUs = v("Reed (English (US))", "en-US");
  const reedUk = v("Reed (English (UK))", "en-GB");
  // This Mac's list: Samantha twice, novelty voices, Reed in both locales.
  const mac = [v("Albert", "en-US"), v("Bubbles", "en-US"), v("Amelie", "fr-CA"),
    samantha, v("Samantha (English (US))", "en-US"), reedUs, reedUk, daniel];
  assert.deepEqual(voicePair(mac), [daniel, daniel]); // never Samantha, never Reed
  const arthur = v("Arthur", "en-GB");
  assert.deepEqual(voicePair([...mac, arthur]), [daniel, arthur]); // a second good voice
  // This Mac after downloads: Enhanced copies win over the plain ones.
  const danielUk = v("Daniel (English (UK))", "en-GB");
  const danielPlus = v("Daniel (Enhanced)", "en-GB");
  const arthurPlus = v("Arthur (Enhanced)", "en-GB");
  const jamiePlus = v("Jamie (Enhanced)", "en-GB");
  const downloaded = [arthur, arthurPlus, danielUk, v("Daniel (English (UK))", "en-GB"), danielPlus, jamiePlus, samantha];
  assert.deepEqual(voicePair(downloaded), [danielPlus, arthurPlus]);
  assert.deepEqual(voicePair([danielUk, jamiePlus, samantha]), [danielUk, jamiePlus]);
  // Edge's British voices.
  const ryan = v("Microsoft Ryan Online (Natural) - English (United Kingdom)", "en-GB");
  const thomas = v("Microsoft Thomas Online (Natural) - English (United Kingdom)", "en-GB");
  assert.deepEqual(voicePair([v("Microsoft Aria Online (Natural) - English (United States)", "en-US"), thomas, ryan]), [ryan, thomas]);
});

test("with one male voice both speakers share it; with none, the usual voice", () => {
  const { voicePair } = require(`${process.env.FOREST_TEST_BUILD}/speech.js`);
  const v = (name, lang, isDefault = false) => ({ name, lang, default: isDefault, localService: true });
  const ukMale = v("Google UK English Male", "en-GB");
  const us = v("Google US English", "en-US", true);
  assert.deepEqual(voicePair([us, ukMale]), [ukMale, ukMale]); // never the female voice
  const kim = v("Kim (English (US))", "en-US", true);
  assert.deepEqual(voicePair([kim, v("Zarvox", "en-US")]), [kim, kim]);
  assert.deepEqual(voicePair([v("Amelie", "fr-CA")]), [undefined, undefined]);
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

test("a voice chosen in Settings wins for its speaker when the browser has it", () => {
  const { voicePair } = require(`${process.env.FOREST_TEST_BUILD}/speech.js`);
  const v = (name, lang, isDefault = false) => ({ name, lang, default: isDefault, localService: true });
  const daniel = v("Daniel", "en-GB");
  const arthur = v("Arthur", "en-GB");
  const samantha = v("Samantha", "en-US", true);
  const all = [samantha, daniel, arthur];
  assert.deepEqual(voicePair(all), [daniel, arthur]); // automatic
  assert.deepEqual(voicePair(all, ["Samantha", ""]), [samantha, arthur]);
  assert.deepEqual(voicePair(all, ["Arthur", ""]), [arthur, daniel]); // the automatic second avoids the first's
  assert.deepEqual(voicePair(all, ["", "Daniel"]), [daniel, daniel]);
  assert.deepEqual(voicePair(all, ["Gone Voice", "Also Gone"]), [daniel, arthur]); // not here: automatic
});

test("the moot voice setting keeps two names and resets anything else", () => {
  const { readPreferences } = require(`${process.env.FOREST_TEST_BUILD}/preferences.js`);
  assert.deepEqual(readPreferences().mootVoices, ["", ""]);
  assert.deepEqual(readPreferences({ mootVoices: ["Daniel", ""] }).mootVoices, ["Daniel", ""]);
  assert.deepEqual(readPreferences({ mootVoices: ["Daniel"] }).mootVoices, ["", ""]);
  assert.deepEqual(readPreferences({ mootVoices: "Daniel" }).mootVoices, ["", ""]);
  assert.deepEqual(readPreferences({ mootVoices: [1, 2] }).mootVoices, ["", ""]);
});
