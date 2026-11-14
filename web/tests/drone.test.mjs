import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };

test("the drone's fly-in stays clear of every leaf, the redwood and the ground, and lands at home", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { droneFlight, droneSite } = require(`${process.env.FOREST_TEST_BUILD}/droneScript.js`);
  const f = getForest();
  const flight = droneFlight(droneSite(f));
  assert.ok(flight.duration > 40 && flight.duration < 120, `duration ${flight.duration}`);
  // A coarse grid of every leaf and redwood spray, 4 m cells.
  const cell = 4, grid = new Map();
  const add = (x, y, z) => { const k = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(x, y, z); };
  const L = f.leaves; for (let i = 0; i < L.count; i++) add(L.pos[i * 3], L.pos[i * 3 + 1], L.pos[i * 3 + 2]);
  const S = f.corpusTree.foliage; for (let i = 0; i < S.count; i++) add(S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]);
  const nearest = (x, y, z) => {
    let best = Infinity;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const pts = grid.get(`${cx + a},${cy + b},${cz + c}`); if (!pts) continue;
      for (let i = 0; i < pts.length; i += 3) best = Math.min(best, Math.hypot(pts[i] - x, pts[i + 1] - y, pts[i + 2] - z));
    }
    return best;
  };
  let minLeaf = Infinity, minY = Infinity, minTrunk = Infinity, worst = null;
  let prev = null, maxStep = 0;
  for (let t = 0; t <= flight.duration; t += 0.1) {
    const { cam } = flight.pose(t);
    const d = nearest(...cam);
    if (d < minLeaf) { minLeaf = d; worst = { t: +t.toFixed(1), cam: cam.map((v) => +v.toFixed(1)) }; }
    minY = Math.min(minY, cam[1]);
    // Trunks: every book tree's, and the redwood's base.
    for (const tr of f.trees) if (cam[1] < tr.height) minTrunk = Math.min(minTrunk, Math.hypot(cam[0] - tr.x, cam[2] - tr.z) - tr.trunkRadius);
    minTrunk = Math.min(minTrunk, Math.hypot(cam[0], cam[2]) - f.corpusTree.baseRadius);
    if (prev) maxStep = Math.max(maxStep, Math.hypot(cam[0] - prev[0], cam[1] - prev[1], cam[2] - prev[2]) / 0.1);
    prev = cam;
  }
  assert.ok(minLeaf > 2.5, `within ${minLeaf.toFixed(2)} m of a leaf at ${JSON.stringify(worst)}`);
  assert.ok(minTrunk > 3, `within ${minTrunk.toFixed(2)} m of a trunk`);
  assert.ok(minY >= 1.6, `down to ${minY.toFixed(2)} m`);
  assert.ok(maxStep < 25, `a jump of ${maxStep.toFixed(1)} m/s`);
  const end = flight.pose(flight.duration).cam;
  assert.ok(Math.hypot(end[0] - f.home.x, end[2] - f.home.z) < 0.01 && Math.abs(end[1] - 1.7) < 0.01, `ends at ${end}`);
  console.log(`duration ${flight.duration.toFixed(1)} s, nearest leaf ${minLeaf.toFixed(2)} m, nearest trunk ${minTrunk.toFixed(2)} m, top speed ${maxStep.toFixed(1)} m/s`);
});
