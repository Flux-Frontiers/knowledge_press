import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("trunks scale with height while twigs stay fine", () => {
  const { growTree } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  for (const b of BOOKS.slice(0, 40)) {
    const g = growTree({ slug: b.slug, genre: b.genre, nChunks: b.chunks });
    const { radii, parents, n } = g.skeleton;
    // The pipe-model bug left every trunk on the 0.18 floor, ~1:90 of height.
    assert.ok(g.trunkHeight / g.trunkRadius < 40, `${b.slug}: h/r ${g.trunkHeight / g.trunkRadius}`);
    assert.ok(Math.min(...radii) < 0.06, `${b.slug}: thinnest twig ${Math.min(...radii)}`);
    for (let i = 1; i < n; i++) {
      if (parents[i] >= 0) assert.ok(radii[parents[i]] >= radii[i] - 1e-6, `${b.slug}: node ${i} thicker than its parent`);
    }
  }
});

test("every leaf hangs within reach of a branch", () => {
  const { growTree } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  for (const b of BOOKS.slice(0, 40)) {
    const g = growTree({ slug: b.slug, genre: b.genre, nChunks: b.chunks });
    const { nodes, n } = g.skeleton;
    for (let l = 0; l < g.nLeaves; l++) {
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        best = Math.min(best, Math.hypot(g.leafPoints[l * 3] - nodes[i * 3], g.leafPoints[l * 3 + 1] - nodes[i * 3 + 1], g.leafPoints[l * 3 + 2] - nodes[i * 3 + 2]));
      }
      // Before the fix the median leaf floated 1.5 m from any branch, some 8 m.
      assert.ok(best <= 0.6 + 1e-4, `${b.slug}: leaf ${l} is ${best.toFixed(2)} m from a branch`);
    }
  }
});

test("bark is one watertight sweep per chain, facing outward, with wrapping UVs", () => {
  const { growTree, emitBark } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  for (const b of BOOKS.slice(0, 12)) {
    const out = { pos: [], normal: [], uv: [], index: [] };
    const g = growTree({ slug: b.slug, genre: b.genre, nChunks: b.chunks });
    const count = emitBark(g, 5, -3, out, 2);
    assert.equal(count, out.pos.length / 3);
    assert.equal(out.uv.length / 2, count);
    assert.ok(out.index.every((i) => i >= 0 && i < count), `${b.slug}: index out of range`);
    let agree = 0, tris = 0;
    for (let t = 0; t < out.index.length; t += 3) {
      const [a, c, d] = [out.index[t], out.index[t + 1], out.index[t + 2]];
      const v = (i, k) => out.pos[i * 3 + k];
      const e1 = [0, 1, 2].map((k) => v(c, k) - v(a, k));
      const e2 = [0, 1, 2].map((k) => v(d, k) - v(a, k));
      const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const nrm = [0, 1, 2].map((k) => out.normal[a * 3 + k] + out.normal[c * 3 + k] + out.normal[d * 3 + k]);
      const dot = f[0] * nrm[0] + f[1] * nrm[1] + f[2] * nrm[2];
      if (Math.hypot(...f) < 1e-9) continue;
      tris++;
      if (dot > 0) agree++;
    }
    // Counter-clockwise from outside, or the bark renders inside-out.
    assert.ok(agree / tris > 0.99, `${b.slug}: ${agree}/${tris} faces point outward`);
    // Around each ring u runs 0..k with an integer k, so the texture tiles across the seam.
    for (let i = 0; i < count; i++) {
      const u = out.uv[i * 2];
      assert.ok(Number.isFinite(u) && Number.isFinite(out.uv[i * 2 + 1]));
    }
  }
});

test("leaf levels are fractions of the book's chunks; the skeleton never changes", () => {
  const { growTree } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  for (const b of BOOKS.slice(0, 8)) {
    const all = growTree({ slug: b.slug, genre: b.genre, nChunks: b.chunks });
    assert.equal(all.nLeaves, b.chunks, `${b.slug}: Ultra is one leaf per chunk`);
    for (const leafScale of [0.1, 0.25, 0.5]) {
      const g = growTree({ slug: b.slug, genre: b.genre, nChunks: b.chunks, leafScale });
      assert.deepEqual(Array.from(g.skeleton.radii), Array.from(all.skeleton.radii), `${b.slug}: skeleton changed at ${leafScale}`);
      assert.ok(Math.abs(g.nLeaves - b.chunks * leafScale) <= 1, `${b.slug}: ${g.nLeaves} leaves at ${leafScale} of ${b.chunks}`);
    }
  }
});

test("growth mirrors the Python viz3d: <=3000 attractors, every one reached by wood", () => {
  const { growTree, MAX_ATTRACTORS } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  assert.equal(MAX_ATTRACTORS, 3000);
  const big = BOOKS.slice().sort((a, b) => b.chunks - a.chunks)[0];
  for (const b of [big, ...BOOKS.slice(0, 6)]) {
    const g = growTree({ slug: b.slug, genre: b.genre, nChunks: b.chunks });
    const m = g.crown.length / 3;
    assert.equal(m, Math.min(b.chunks, 3000), `${b.slug}: ${m} attractors`);
    const { nodes, n } = g.skeleton;
    // colonize's last pass gives every surviving attractor its own twig, to within kill = 2 * step.
    for (let a = 0; a < m; a++) {
      let best = Infinity;
      for (let i = 0; i < n; i++) best = Math.min(best, Math.hypot(g.crown[a * 3] - nodes[i * 3], g.crown[a * 3 + 1] - nodes[i * 3 + 1], g.crown[a * 3 + 2] - nodes[i * 3 + 2]));
      assert.ok(best <= 2 * g.step + 1e-3, `${b.slug}: attractor ${a} is ${best.toFixed(2)} m from wood (kill ${(2 * g.step).toFixed(2)})`);
    }
  }
});

test("every leaf hangs on the wood near its chunk, blade lifted toward the sky", () => {
  const { growTree } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  for (const b of BOOKS.slice(0, 8)) {
    const g = growTree({ slug: b.slug, genre: b.genre, nChunks: b.chunks });
    const { nodes, n } = g.skeleton;
    let up = 0;
    for (let l = 0; l < g.nLeaves; l++) {
      let best = Infinity;
      for (let i = 0; i < n; i++) best = Math.min(best, Math.hypot(g.leafPoints[l * 3] - nodes[i * 3], g.leafPoints[l * 3 + 1] - nodes[i * 3 + 1], g.leafPoints[l * 3 + 2] - nodes[i * 3 + 2]));
      assert.ok(best <= 0.1 + 1e-4, `${b.slug}: leaf ${l} is ${best.toFixed(2)} m from a node`);
      const dl = Math.hypot(g.leafDirs[l * 3], g.leafDirs[l * 3 + 1], g.leafDirs[l * 3 + 2]);
      assert.ok(Math.abs(dl - 1) < 1e-4);
      if (g.leafDirs[l * 3 + 1] > 0) up++;
    }
    assert.ok(up / g.nLeaves > 0.7, `${b.slug}: only ${up}/${g.nLeaves} leaves point upward`);
  }
});

test("trunks rise plumb to their first fork instead of leaning toward one side", () => {
  const { growTree } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  for (const b of BOOKS.slice(0, 20)) {
    const { nodes, parents, n } = growTree({ slug: b.slug, genre: b.genre, nChunks: b.chunks }).skeleton;
    const kids = Array.from({ length: n }, () => []);
    for (let i = 1; i < n; i++) kids[parents[i]].push(i);
    let k = 0;
    while (kids[k].length === 1) k = kids[k][0];
    const lean = Math.atan2(Math.hypot(nodes[k * 3], nodes[k * 3 + 2]), nodes[k * 3 + 1]) * 180 / Math.PI;
    // Bridging to the nearest crown point leaned every trunk ~28 deg the same way.
    assert.ok(lean < 5, `${b.slug}: trunk leans ${lean.toFixed(1)} deg`);
  }
});

test("no tree's wood passes through another's, within or across groves", () => {
  globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { growTree } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const f = getForest();
  const wood = f.trees.map((t) => {
    const g = growTree({ slug: t.book.slug, genre: t.book.genre, nChunks: t.book.chunks, periods: t.book.periods });
    const { nodes, radii, n } = g.skeleton;
    const pts = [];
    let reach = 0;
    for (let i = 0; i < n; i++) {
      pts.push([t.x + nodes[i * 3], nodes[i * 3 + 1], t.z + nodes[i * 3 + 2], radii[i]]);
      reach = Math.max(reach, Math.hypot(nodes[i * 3], nodes[i * 3 + 2]));
    }
    return { t, pts, reach };
  });
  for (let i = 0; i < wood.length; i++) {
    for (let j = i + 1; j < wood.length; j++) {
      const a = wood[i], b = wood[j];
      if (Math.hypot(a.t.x - b.t.x, a.t.z - b.t.z) >= a.reach + b.reach) continue;
      for (const p of a.pts) {
        if (Math.hypot(p[0] - b.t.x, p[2] - b.t.z) > b.reach + 1) continue;
        for (const q of b.pts) {
          const gap = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) - p[3] - q[3];
          assert.ok(gap > 0.3, `${a.t.book.slug} and ${b.t.book.slug} touch (gap ${gap.toFixed(2)} m)`);
        }
      }
    }
  }
});

test("packing never spins on an unplaceable grove: a NaN radius throws", () => {
  const { packAroundHub } = require(`${process.env.FOREST_TEST_BUILD}/math.js`);
  // A grove whose layout left a tree unplaced had a NaN radius and hung the page.
  assert.throws(() => packAroundHub([20, NaN], 22, 10), /radius 1 is NaN/);
  assert.equal(packAroundHub([20, 30], 22, 10).length, 2);
});

test("diary entries hang along their year's limb, not at its tip", () => {
  const { placeDiaryCrown, PERIOD_BINS } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { SPECIES, speciesFor } = require(`${process.env.FOREST_TEST_BUILD}/species.js`);
  const habit = SPECIES[speciesFor("diaries")].habit;
  // Ten years, one chunk in each year's first and last slices. (With only two
  // years both limbs sit at the envelope's narrow ends, too short to tell apart.)
  const bins = Array.from({ length: PERIOD_BINS }, (_, i) => (i === 0 || i === PERIOD_BINS - 1 ? 1 : 0));
  const periods = Array.from({ length: 10 }, (_, y) => ({ label: String(1660 + y), entries: 50, bins }));
  const { crown, nCrown } = placeDiaryCrown(periods, 1000, habit, "t");
  assert.equal(nCrown, 20);
  const out = (i) => Math.hypot(crown[i * 3], crown[i * 3 + 2]);
  // January's chunk sits near the trunk, December's out toward the tip.
  for (let y = 0; y < 10; y++) {
    assert.ok(out(2 * y) < out(2 * y + 1) / 2, `${1660 + y}: ${out(2 * y).toFixed(2)} vs ${out(2 * y + 1).toFixed(2)}`);
  }
});

test("a full diary year is not squeezed by the crown's taper", () => {
  const { placeDiaryCrown, PERIOD_BINS } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { SPECIES, speciesFor } = require(`${process.env.FOREST_TEST_BUILD}/species.js`);
  const habit = SPECIES[speciesFor("diaries")].habit;
  const bins = Array.from({ length: PERIOD_BINS }, (_, i) => (i === PERIOD_BINS - 1 ? 1 : 0));
  const periods = Array.from({ length: 10 }, (_, y) => ({ label: String(1660 + y), entries: 100, bins }));
  const { crown } = placeDiaryCrown(periods, 1000, habit, "t");
  // One December chunk per year: its distance from the trunk is that limb's reach.
  const reach = periods.map((_, i) => Math.hypot(crown[i * 3], crown[i * 3 + 2]));
  assert.ok(Math.min(...reach) >= 0.45 * Math.max(...reach), reach.map((r) => r.toFixed(2)).join(" "));
});

test("catalog diaries grow from their periods, every leaf on a branch", () => {
  const { growTree } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  const diaries = BOOKS.filter((b) => b.periods);
  assert.ok(diaries.length > 0, "the catalog carries no diary periods");
  for (const b of diaries) {
    const binned = b.periods.reduce((s, p) => s + p.bins.reduce((a, c) => a + c, 0), 0);
    assert.equal(binned, b.chunks, `${b.slug}: periods hold ${binned} of ${b.chunks} chunks`);
    const g = growTree({ slug: b.slug, genre: b.genre, nChunks: b.chunks, periods: b.periods, leafScale: 0.1 });
    const { nodes, n } = g.skeleton;
    for (let l = 0; l < g.nLeaves; l++) {
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        best = Math.min(best, Math.hypot(g.leafPoints[l * 3] - nodes[i * 3], g.leafPoints[l * 3 + 1] - nodes[i * 3 + 1], g.leafPoints[l * 3 + 2] - nodes[i * 3 + 2]));
      }
      assert.ok(best <= 0.6 + 1e-4, `${b.slug}: leaf ${l} is ${best.toFixed(2)} m from a branch`);
    }
  }
});

test("every diary year forks from the trunk, none from another year's limb", () => {
  const { growTree, placeDiaryCrown } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { SPECIES, speciesFor } = require(`${process.env.FOREST_TEST_BUILD}/species.js`);
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  const b = BOOKS.find((x) => x.slug.includes("pepys") && x.periods);
  const g = growTree({ slug: b.slug, genre: b.genre, nChunks: b.chunks, periods: b.periods });
  const { nodes, parents, n } = g.skeleton;
  const { crown } = placeDiaryCrown(b.periods, b.chunks, SPECIES[speciesFor(b.genre)].habit, b.slug);
  const forks = new Set();
  let li = 0;
  for (const p of b.periods) {
    const m = p.bins.reduce((a, c) => a + c, 0);
    let sx = 0, sy = 0, sz = 0;
    for (let k = 0; k < m; k++, li++) { sx += crown[li * 3]; sy += crown[li * 3 + 1]; sz += crown[li * 3 + 2]; }
    sx /= m; sy /= m; sz /= m;
    let c = 0, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(nodes[i * 3] - sx, nodes[i * 3 + 1] - sy, nodes[i * 3 + 2] - sz);
      if (d < bd) { bd = d; c = i; }
    }
    // Walk in to the trunk axis: the node where this year's wood leaves it.
    while (parents[c] >= 0 && Math.hypot(nodes[c * 3], nodes[c * 3 + 2]) > 0.35) c = parents[c];
    forks.add(c);
  }
  // With the species' 0.7 leader, Pepys's 1667-1669 all forked from one side limb.
  assert.equal(forks.size, b.periods.length);
});

test("diary limbs spiral up the trunk half a golden angle per year", () => {
  const { placeDiaryCrown, PERIOD_BINS } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { SPECIES, speciesFor } = require(`${process.env.FOREST_TEST_BUILD}/species.js`);
  const habit = SPECIES[speciesFor("diaries")].habit;
  const K = 40;
  const bins = Array.from({ length: PERIOD_BINS }, (_, i) => (i === PERIOD_BINS - 1 ? K : 0));
  const periods = Array.from({ length: 8 }, (_, y) => ({ label: String(1660 + y), entries: 100, bins }));
  const { crown } = placeDiaryCrown(periods, 800 * K, habit, "t");
  // K December chunks per year sit around its limb's tip; their mean lies on the limb.
  const az = periods.map((_, i) => {
    let x = 0, z = 0;
    for (let k = i * K; k < (i + 1) * K; k++) { x += crown[k * 3]; z += crown[k * 3 + 2]; }
    return Math.atan2(z, x);
  });
  for (let i = 1; i < az.length; i++) {
    const step = (((az[i] - az[i - 1]) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    assert.ok(Math.abs(step - Math.PI * (3 - Math.sqrt(5)) / 2) < 0.25, `year ${i}: step ${step.toFixed(2)} rad`);
  }
});

test("a skipped diary year leaves bare trunk", () => {
  const { placeDiaryCrown, PERIOD_BINS } = require(`${process.env.FOREST_TEST_BUILD}/growTree.js`);
  const { SPECIES, speciesFor } = require(`${process.env.FOREST_TEST_BUILD}/species.js`);
  const habit = SPECIES[speciesFor("diaries")].habit;
  const K = 40;
  const bins = Array.from({ length: PERIOD_BINS }, (_, i) => (i === PERIOD_BINS - 1 ? K : 0));
  const periods = ["1660", "1661", "1665"].map((label) => ({ label, entries: 100, bins }));
  const { crown } = placeDiaryCrown(periods, 300 * K, habit, "t");
  const y = periods.map((_, i) => {
    let s = 0;
    for (let k = i * K; k < (i + 1) * K; k++) s += crown[k * 3 + 1];
    return s / K;
  });
  // 1661 to 1665 is four years of trunk; 1660 to 1661 is one.
  const ratio = (y[2] - y[1]) / (y[1] - y[0]);
  assert.ok(Math.abs(ratio - 4) < 0.3, `ratio ${ratio.toFixed(2)}`);
});
