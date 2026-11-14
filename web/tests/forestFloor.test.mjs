import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };

test("floor litter: seeded, a quarter stone, and clear of every road and plaza", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { floorLitter } = require(`${process.env.FOREST_TEST_BUILD}/forestFloor.js`);
  const f = getForest();
  const a = floorLitter(f, "summer");
  const b = floorLitter(f, "summer");
  // The same forest gives the same litter, so the game and the Blender export agree.
  assert.deepEqual(a.grass.matrix, b.grass.matrix);
  assert.deepEqual(a.rocks.matrix, b.rocks.matrix);
  const total = a.grass.count + a.rocks.count;
  assert.ok(a.grass.count > 0 && a.rocks.count > 0);
  assert.ok(total <= f.trees.length * 24);
  const stoneShare = a.rocks.count / total;
  assert.ok(stoneShare > 0.2 && stoneShare < 0.3, `stone share ${stoneShare}`);
  for (const set of [a.grass, a.rocks]) {
    for (let i = 0; i < set.count; i++) {
      const x = set.matrix[i * 16 + 12], z = set.matrix[i * 16 + 14];
      for (const p of f.plazas) assert.ok(Math.hypot(x - p.x, z - p.z) >= p.r, "litter on a plaza");
      for (const r of f.roads) {
        const dx = r.bx - r.ax, dz = r.bz - r.az;
        const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz)));
        assert.ok(Math.hypot(x - r.ax - dx * t, z - r.az - dz * t) >= 2, "litter on a road");
      }
    }
  }
  // Only the colours change with the season.
  const w = floorLitter(f, "winter");
  assert.deepEqual(w.grass.matrix, a.grass.matrix);
  assert.notDeepEqual(w.grass.color, a.grass.color);
});
