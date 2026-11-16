import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };

test("the Wayfarer's map: a numbered stud per grove in ride order, lit once seen, inside the outer ring", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { wayfarerMap } = require(`${process.env.FOREST_TEST_BUILD}/wheelMap.js`);
  const f = getForest();
  const seen = f.circuit.slice(0, 3).map((wp) => wp.genre);
  const map = wayfarerMap(f, seen, 90);
  assert.equal(map.studs.length, f.circuit.length);
  assert.deepEqual(map.studs.map((s) => s.n), f.circuit.map((_, i) => i + 1));
  assert.deepEqual(map.studs.filter((s) => s.seen).map((s) => s.genre), seen);
  assert.ok(Math.abs(Math.max(...map.rings) - 90) < 1e-9, "the outer ring fills the radius");
  for (const s of map.studs) assert.ok(Math.hypot(s.x, s.y) <= 90 + 1e-6, `${s.label} off the map`);
  // North is up: the forest's -z is the SVG's -y.
  const north = f.circuit.reduce((a, b) => (b.z < a.z ? b : a));
  assert.equal(map.studs.reduce((a, b) => (b.y < a.y ? b : a)).genre, north.genre);
});

test("a grove's stud grows with each visit and each reading of its books, and stops at a pin", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { groveTally, studSize, STUD_H } = require(`${process.env.FOREST_TEST_BUILD}/wheelMap.js`);
  const f = getForest();
  const book = f.trees[0].book;
  const tally = groveTally(f, { [book.genre]: 2 }, { [book.slug]: 3 });
  assert.equal(tally[book.genre], 5);
  assert.deepEqual(studSize(0), { h: STUD_H, r: 1 });
  for (let n = 0; n < 40; n++) {
    const a = studSize(n), b = studSize(n + 1);
    assert.ok(b.h > a.h && b.r > a.r, `no growth from ${n} to ${n + 1}`);
  }
  assert.deepEqual(studSize(5000), studSize(100));
  assert.ok(studSize(100).h <= 0.15 && studSize(100).r <= 1.8, "a stud stays a pin");
});

test("the Wheel's view looks down on the table at a slant, north up, the table filling the screen", () => {
  const { wheelViewPose, WHEEL_TABLE_R, WHEEL_TOP_Y, WHEEL_VIEW_LEAN } = require(`${process.env.FOREST_TEST_BUILD}/wheelMap.js`);
  for (const aspect of [1.6, 0.46]) {
    const { cam, look } = wheelViewPose({ x: 3, z: -4 }, 58, aspect);
    assert.deepEqual(look, [3, WHEEL_TOP_Y, -4]);
    assert.equal(cam[0], 3);
    assert.ok(cam[2] > look[2], "leans from the south, so north is up");
    const d = Math.hypot(cam[1] - look[1], cam[2] - look[2]);
    const t = Math.tan((29 * Math.PI) / 180);
    // Across, the table's full width; top to bottom, its depth foreshortened by the lean.
    const fit = Math.min(d * t * aspect / WHEEL_TABLE_R, d * t / (WHEEL_TABLE_R * Math.cos(WHEEL_VIEW_LEAN)));
    assert.ok(fit > 1 && fit < 1.6, `${aspect}: the table fills ${fit.toFixed(2)} of the screen's tighter side`);
  }
});

test("the save counts every arrival at a grove, every ring stop, and every new opening of a book", () => {
  globalThis.window ??= { localStorage: { getItem: () => null, setItem: () => {} } };
  const { useGame } = require(`${process.env.FOREST_TEST_BUILD}/store.js`);
  const st = () => useGame.getState();
  const before = st().groveVisits.poetry ?? 0;
  st().markGrove("poetry");
  st().markGrove("poetry");
  st().markRingStop("poetry");
  assert.equal(st().groveVisits.poetry, before + 3);
  const reads = st().reads.hamlet ?? 0;
  st().openReader("hamlet");
  st().openReader("hamlet");
  st().openReader(null);
  st().openReader("hamlet");
  assert.equal(st().reads.hamlet, reads + 2, "reopening the book already open is not another reading");
  st().openReader(null);
});

test("setting off on the guided tour from the Wheel's view takes the cart's own view back", () => {
  globalThis.window ??= { localStorage: { getItem: () => null, setItem: () => {} } };
  const { useGame } = require(`${process.env.FOREST_TEST_BUILD}/store.js`);
  const st = () => useGame.getState();
  st().setPreferences({ camera: "high" });
  st().setPreferences({ camera: "wheel" });
  if (st().travelMode === "circuit") st().toggleCircuit();
  st().toggleCircuit();
  assert.equal(st().travelMode, "circuit");
  assert.equal(st().preferences.camera, "high");
  st().toggleCircuit();
});
