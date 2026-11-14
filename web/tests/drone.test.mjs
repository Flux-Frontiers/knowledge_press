import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };

test("the drone's fly-in stays clear of every leaf, the redwood and the ground, and ends on the start screen's circle", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { droneFlight, droneSite } = require(`${process.env.FOREST_TEST_BUILD}/droneScript.js`);
  const { ORBIT_R, ORBIT_UP, ORBIT_RATE, orbitAngle, orbitPose } = require(`${process.env.FOREST_TEST_BUILD}/startOrbit.js`);
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
  let prev = null, maxStep = 0, maxJerk = 0, prevV = null;
  const dt = 0.1;
  // The flight and ten seconds of circling after it.
  for (let t = 0; t <= flight.duration + 10; t += dt) {
    const { cam } = flight.pose(t);
    const d = nearest(...cam);
    if (d < minLeaf) { minLeaf = d; worst = { t: +t.toFixed(1), cam: cam.map((v) => +v.toFixed(1)) }; }
    minY = Math.min(minY, cam[1]);
    for (const tr of f.trees) if (cam[1] < tr.height) minTrunk = Math.min(minTrunk, Math.hypot(cam[0] - tr.x, cam[2] - tr.z) - tr.trunkRadius);
    minTrunk = Math.min(minTrunk, Math.hypot(cam[0], cam[2]) - f.corpusTree.baseRadius);
    if (prev) {
      const v = Math.hypot(cam[0] - prev[0], cam[1] - prev[1], cam[2] - prev[2]) / dt;
      maxStep = Math.max(maxStep, v);
      if (prevV !== null) maxJerk = Math.max(maxJerk, Math.abs(v - prevV) / dt);
      prevV = v;
    }
    prev = cam;
  }
  assert.ok(minLeaf > 2.5, `within ${minLeaf.toFixed(2)} m of a leaf at ${JSON.stringify(worst)}`);
  assert.ok(minTrunk > 3, `within ${minTrunk.toFixed(2)} m of a trunk`);
  assert.ok(minY >= 1.6, `down to ${minY.toFixed(2)} m`);
  assert.ok(maxStep < 25, `a jump of ${maxStep.toFixed(1)} m/s`);
  // No lurch anywhere, the handover onto the circle included: speed changes by under 6 m/s each second.
  assert.ok(maxJerk < 6, `speed changes by ${maxJerk.toFixed(1)} m/s per second`);
  // No corners: the heading turns under 45 degrees a second (over half a second), and the view
  // under 25 (circling the redwood at 26 m and 7 m/s turns it about 15).
  const dir = (q) => { const d = q.look.map((v, i) => v - q.cam[i]); const n = Math.hypot(...d); return d.map((v) => v / n); };
  const heads = [];
  let maxLook = 0, last = null;
  for (let t = 0; t <= flight.duration; t += 0.05) {
    const q = flight.pose(t);
    if (last) {
      heads.push(Math.atan2(q.cam[2] - last.cam[2], q.cam[0] - last.cam[0]));
      const a = dir(last), b = dir(q);
      maxLook = Math.max(maxLook, (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI / 0.05);
    }
    last = q;
  }
  let maxTurn = 0;
  for (let i = 10; i < heads.length; i++) {
    const d = heads[i] - heads[i - 10];
    maxTurn = Math.max(maxTurn, (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * 180) / Math.PI / 0.5);
  }
  assert.ok(maxTurn < 45, `the path turns ${maxTurn.toFixed(1)} degrees a second`);
  assert.ok(maxLook < 25, `the view turns ${maxLook.toFixed(1)} degrees a second`);
  // It ends on the start screen's circle, looking where the start screen looks, and goes on circling at its rate.
  const end = flight.pose(flight.duration);
  assert.ok(Math.abs(Math.hypot(end.cam[0], end.cam[2]) - ORBIT_R) < 0.01 && Math.abs(end.cam[1] - ORBIT_UP) < 0.01, `ends at ${end.cam}`);
  const a = orbitAngle(end.cam[0], end.cam[2]);
  const later = flight.pose(flight.duration + 5);
  const want = orbitPose(a + ORBIT_RATE * 5, f.corpusTree.height);
  assert.ok(Math.hypot(...later.cam.map((v, i) => v - want.cam[i])) < 0.01, "circles on as the start screen does");
  assert.deepEqual(later.look.map((v) => +v.toFixed(3)), want.look.map((v) => +v.toFixed(3)));
  console.log(`duration ${flight.duration.toFixed(1)} s, nearest leaf ${minLeaf.toFixed(2)} m, nearest trunk ${minTrunk.toFixed(2)} m, top speed ${maxStep.toFixed(1)} m/s, worst speed change ${maxJerk.toFixed(1)} m/s/s, sharpest turn ${maxTurn.toFixed(1)} deg/s, fastest view turn ${maxLook.toFixed(1)} deg/s`);
});
