import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const yours = () => require(`${process.env.FOREST_TEST_BUILD}/yourMoots.js`);

function storage() {
  const data = new Map();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
}

const moot = (topic = "justice") => ({
  id: "meditations-the-prince-justice", topic, date: "2026-11-06", model: "m", backend: "omlx",
  trees: [
    { key: "philosophy/Meditations", title: "Meditations", author: "Marcus Aurelius", voice: { gender: "male", accent: null } },
    { key: "philosophy/The Prince", title: "The Prince", author: "Machiavelli", voice: { gender: "male", accent: null } },
  ],
  turns: [
    { turn: 1, speaker: 0, text: "I hold that justice...", cites: [{ tag: "s1", label: "IV", node_id: "chunk:x" }], grounded: true },
    { turn: 2, speaker: 1, text: "A prince must seem...", cites: [], grounded: true },
  ],
});

test("a saved moot comes back whole under its own id, and the same moot twice is two moots", () => {
  globalThis.window = { localStorage: storage() };
  const { saveYourMoot, listYourMoots, yourMoot } = yours();
  assert.equal(saveYourMoot(moot()), true);
  const first = listYourMoots()[0];
  assert.match(first.id, /^yours-/);
  assert.equal(first.turns.length, 2);
  assert.equal(first.turns[0].cites[0].tag, "s1");
  assert.equal(yourMoot(first.id).topic, "justice");
  assert.equal(yourMoot("meditations-the-prince-justice"), undefined);
  // Later in time, since the id comes from the clock.
  const realNow = Date.now;
  Date.now = () => realNow() + 1000;
  try { saveYourMoot(moot("virtue")); } finally { Date.now = realNow; }
  assert.deepEqual(listYourMoots().map((m) => m.topic), ["virtue", "justice"]);
});

test("deleting one leaves the others", () => {
  globalThis.window = { localStorage: storage() };
  const { saveYourMoot, listYourMoots, deleteYourMoot } = yours();
  saveYourMoot(moot());
  const realNow = Date.now;
  Date.now = () => realNow() + 1000;
  try { saveYourMoot(moot("virtue")); } finally { Date.now = realNow; }
  deleteYourMoot(listYourMoots()[0].id);
  assert.deepEqual(listYourMoots().map((m) => m.topic), ["justice"]);
});

test("damaged storage reads as no moots, and a bad entry does not lose the good ones", () => {
  const s = storage();
  globalThis.window = { localStorage: s };
  const { saveYourMoot, listYourMoots } = yours();
  s.setItem("kpf-your-moots-v1", "not json");
  assert.deepEqual(listYourMoots(), []);
  s.setItem("kpf-your-moots-v1", "{}");
  assert.deepEqual(listYourMoots(), []);
  saveYourMoot(moot());
  s.setItem("kpf-your-moots-v1", JSON.stringify([{ version: 99 }, ...JSON.parse(s.getItem("kpf-your-moots-v1"))]));
  assert.equal(listYourMoots().length, 1);
});

test("full storage says it could not save, without throwing", () => {
  const s = storage();
  s.setItem = () => { throw new Error("QuotaExceededError"); };
  globalThis.window = { localStorage: s };
  assert.equal(yours().saveYourMoot(moot()), false);
});

test("a row is titled as the shipped index titles them", () => {
  const { yourMootEntry } = yours();
  const e = yourMootEntry({ ...moot(), id: "yours-1" });
  assert.equal(e.title, "Meditations and The Prince on justice");
  assert.equal(e.turns, 2);
  assert.equal(yourMootEntry({ ...moot(), topic: null }).title, "Meditations and The Prince");
});
