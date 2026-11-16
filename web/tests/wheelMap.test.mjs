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
