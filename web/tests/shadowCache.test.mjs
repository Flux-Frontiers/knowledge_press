import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { shadowStale, snapToTexels, SHADOW_MOVING_FRAMES, SHADOW_IDLE_FRAMES, SHADOW_MAX_FRAMES } =
  require(`${process.env.FOREST_TEST_BUILD}/shadowCache.js`);

const SUN = [0.3, 0.8, 0.52].map((v, _, a) => v / Math.hypot(...a));

test("the shadow map is redrawn first, then only when stale", () => {
  assert.equal(shadowStale(null, 0, 0, SUN, false), true);
  const at = (frames) => ({ x: 0, z: 0, dir: SUN, frames });
  // At rest in still air: only at the ceiling.
  assert.equal(shadowStale(at(SHADOW_MAX_FRAMES - 2), 0, 0, SUN, false), false);
  assert.equal(shadowStale(at(SHADOW_MAX_FRAMES - 1), 0, 0, SUN, false), true);
  // At rest in the wind: every few frames.
  assert.equal(shadowStale(at(SHADOW_IDLE_FRAMES - 2), 0, 0, SUN, true), false);
  assert.equal(shadowStale(at(SHADOW_IDLE_FRAMES - 1), 0, 0, SUN, true), true);
  // Moving: every other frame.
  assert.equal(shadowStale(at(SHADOW_MOVING_FRAMES - 2), 0.5, 0, SUN, false), false);
  assert.equal(shadowStale(at(SHADOW_MOVING_FRAMES - 1), 0.5, 0, SUN, false), true);
  // The sun moving: at once.
  const later = [0.31, 0.79, 0.52].map((v, _, a) => v / Math.hypot(...a));
  assert.equal(shadowStale(at(0), 0, 0, later, false), true);
});

test("snapping moves less than a texel and holds still between texels", () => {
  const texel = 80 / 2048;
  for (const dir of [SUN, [0, 1, 0], [0.7, 0.1, -0.7].map((v, _, a) => v / Math.hypot(...a))]) {
    for (const [x, z] of [[0, 0], [12.345, -6.789], [-150.2, 98.7]]) {
      const [sx, sy, sz] = snapToTexels(x, z, dir, texel);
      // No further than half a texel along each of the light's two axes.
      assert.ok(Math.hypot(sx - x, sy, sz - z) <= texel * Math.SQRT1_2 + 1e-9);
      // Across the light the snapped point sits on whole texels, so creeping 0.2 m in 100 steps
      // moves the map in a few texel jumps, not every step. (Along the light it may slide: that moves no texel.)
      const right = Math.hypot(dir[2], dir[0]) < 1e-6 ? [1, 0, 0] : [dir[2], 0, -dir[0]].map((v) => v / Math.hypot(dir[2], dir[0]));
      const up = [dir[1] * right[2], dir[2] * right[0] - dir[0] * right[2], -dir[1] * right[0]];
      const across = (p) => [p[0] * right[0] + p[1] * right[1] + p[2] * right[2], p[0] * up[0] + p[1] * up[1] + p[2] * up[2]].map((v) => v / texel);
      for (const v of across([sx, sy, sz])) assert.ok(Math.abs(v - Math.round(v)) < 1e-6, "on the texel grid");
      const seen = new Set();
      for (let k = 0; k < 100; k++) seen.add(across(snapToTexels(x + k * 0.002, z, dir, texel)).map((v) => Math.round(v)).join());
      assert.ok(seen.size <= 2 * Math.ceil(0.2 / texel) + 2, `${seen.size} positions`);
    }
  }
});
