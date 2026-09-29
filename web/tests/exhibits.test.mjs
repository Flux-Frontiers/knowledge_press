import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };

test("the corpus redwood: height from the corpus, one limb per book, pipe-model trunk", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { REDWOOD_HEIGHT_PER_LOG2 } = require(`${process.env.FOREST_TEST_BUILD}/corpusTree.js`);
  const f = getForest();
  const c = f.corpusTree;
  const total = f.trees.reduce((s, t) => s + t.book.chunks, 0);
  assert.equal(c.totalChunks, total);
  assert.equal(c.limbs, f.trees.length);
  assert.ok(Math.abs(c.height - REDWOOD_HEIGHT_PER_LOG2 * Math.log2(1 + total)) < 1e-9);
  const tallest = Math.max(...f.trees.map((t) => t.height));
  assert.ok(c.height > 2 * tallest, `redwood ${c.height.toFixed(0)} m against ${tallest.toFixed(0)} m`);
  // The flare stays on the hub plaza with room for the spokes to start around it.
  assert.ok(c.baseRadius + 2.75 < 9, `flare ${c.baseRadius.toFixed(2)} m`);
  assert.ok(c.bark.count > 0 && c.foliage.count > c.limbs);
  // Every spray hangs in the crown, not on the bole or out over the groves.
  for (let i = 0; i < c.foliage.count; i++) {
    const [x, y, z] = [c.foliage.pos[i * 3], c.foliage.pos[i * 3 + 1], c.foliage.pos[i * 3 + 2]];
    assert.ok(y > c.height * 0.25 && y < c.height * 1.05, `spray ${i} at ${y.toFixed(1)} m`);
    assert.ok(Math.hypot(x, z) < 20, `spray ${i} reaches ${Math.hypot(x, z).toFixed(1)} m`);
  }
});

test("exhibits stand in roadside glades: clear of trunks, off the road, apart from the hub", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { EXHIBITS, exhibitApproach } = require(`${process.env.FOREST_TEST_BUILD}/exhibits.js`);
  const { forwardOf } = require(`${process.env.FOREST_TEST_BUILD}/sim.js`);
  const f = getForest();
  assert.equal(f.exhibits.length, EXHIBITS.length, "every exhibit found a glade");
  for (const e of f.exhibits) {
    assert.ok(Math.hypot(e.x, e.z) >= 30, `${e.id} sits under the redwood`);
    for (const t of f.trees) {
      assert.ok(Math.hypot(t.x - e.x, t.z - e.z) - t.trunkRadius >= e.treeClearance - 1e-6, `${e.id} crowds ${t.book.slug}`);
    }
    // The plaza reaches the road it faces.
    const toRoad = Math.hypot(e.roadX - e.x, e.roadZ - e.z);
    assert.ok(e.plazaR > toRoad - 1.7, `${e.id} plaza stops short of the road`);
    assert.ok(f.plazas.some((p) => p.x === e.x && p.z === e.z));
    assert.ok(f.obstacles.some((o) => o.x === e.x && o.z === e.z && o.r === e.obstacle));
    const a = exhibitApproach(e);
    const fw = forwardOf(a.yaw);
    const d = Math.hypot(e.x - a.x, e.z - a.z);
    assert.ok(d > e.obstacle + 1.05, `${e.id} approach lands on the plinth`);
    assert.ok((fw.x * (e.x - a.x) + fw.z * (e.z - a.z)) / d > 0.999, `${e.id} approach looks away`);
  }
});

test("wind rotors turn over their own plaza: overhead of the cart, never out over the road", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { rotorEnvelope, PLINTH_TOP } = require(`${process.env.FOREST_TEST_BUILD}/windRotors.js`);
  const f = getForest();
  for (const id of ["helix", "darrieus", "savonius"]) {
    const e = f.exhibits.find((x) => x.id === id);
    assert.ok(e, `${id} placed`);
    const { reach, lowest } = rotorEnvelope(id);
    assert.ok(lowest > PLINTH_TOP + 0.8, `${id} rotor sweeps the plinth top at ${lowest.toFixed(2)} m`);
    // Anything wider than the plinth must pass over the head of someone standing beside it.
    assert.ok(reach <= e.obstacle || lowest > 2.5, `${id} reaches ${reach.toFixed(2)} m at ${lowest.toFixed(2)} m`);
    // The road's near edge (half the widest road, 1.7 m) and the cart's half width (1.05 m).
    const toRoad = Math.hypot(e.roadX - e.x, e.roadZ - e.z);
    assert.ok(reach < toRoad - 1.7 - 1.05, `${id} overhangs the road: ${reach.toFixed(2)} m of ${toRoad.toFixed(2)} m`);
  }
});

test("exhibits stand at the end of side spokes off the rings, spread round the forest", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const f = getForest();
  const rings = f.roadLines.filter((l) => l.kind === "ring").map((l) => Math.hypot(...l.pts[0]));
  const spurs = f.roadLines.filter((l) => l.kind === "spur");
  assert.equal(spurs.length, f.exhibits.length);
  const segDist = (x, z, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - ax - dx * t, z - az - dz * t);
  };
  for (const e of f.exhibits) {
    const [[px, pz], [ex, ez]] = e.spur;
    // Leaves a ring from its centreline and ends inside the exhibit's plaza.
    assert.ok(rings.some((R) => Math.abs(Math.hypot(px, pz) - R) < 1e-6), `${e.id} spur starts off the ring`);
    assert.ok(Math.hypot(ex - e.x, ez - e.z) < e.plazaR, `${e.id} spur stops short of its plaza`);
    // Long enough to read as a road of its own.
    assert.ok(Math.hypot(e.roadX - px, e.roadZ - pz) >= 1.7 + 7 - 1e-6, `${e.id} spur is a stub`);
    // Clear of every trunk.
    for (const t of f.trees) {
      assert.ok(segDist(t.x, t.z, px, pz, e.roadX, e.roadZ) - t.trunkRadius >= 2.75 - 1e-6, `${e.id} spur runs into ${t.book.slug}`);
    }
    // Only the spur reaches the plaza: every other road passes well clear.
    for (const r of f.roads) {
      if (r.kind === "spur") continue;
      assert.ok(segDist(e.x, e.z, r.ax, r.az, r.bx, r.bz) > e.plazaR + 3, `${e.id} plaza touches a ${r.kind}`);
    }
    // The approach lands on the spur, not the ring.
    const { exhibitApproach } = require(`${process.env.FOREST_TEST_BUILD}/exhibits.js`);
    const a = exhibitApproach(e);
    assert.ok(segDist(a.x, a.z, px, pz, ex, ez) < 0.01, `${e.id} approach is off its spur`);
  }
  // Spread round the rings: no two exhibits closer than half an even share of the compass.
  const bearings = f.exhibits.map((e) => Math.atan2(e.z, e.x));
  const share = (2 * Math.PI) / bearings.length;
  for (let i = 0; i < bearings.length; i++) for (let j = i + 1; j < bearings.length; j++) {
    const d = Math.abs(bearings[i] - bearings[j]) % (2 * Math.PI);
    assert.ok(Math.min(d, 2 * Math.PI - d) > share / 2, `${f.exhibits[i].id} and ${f.exhibits[j].id} crowd one side`);
  }
});

test("every grove's signpost names its tree species", () => {
  const { SPECIES } = require(`${process.env.FOREST_TEST_BUILD}/species.js`);
  for (const s of SPECIES) {
    assert.ok(s.common && s.latin, `${s.name} has no names`);
    assert.match(s.latin, /^[A-Z][a-z]+ /, `${s.name}: ${s.latin}`);
  }
});
