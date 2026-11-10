import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { godLeafLod, godLeafBlend, leafFraction, GOD_LEAF_FULL, GOD_LEAF_MAX_SCALE, GOD_BLEND_LOW, GOD_BLEND_HIGH } = require(`${process.env.FOREST_TEST_BUILD}/leafLod.js`);

test("in god's eye, near groves draw every leaf at full size", () => {
  for (const d of [-5, 0, 10, GOD_LEAF_FULL]) assert.deepEqual(godLeafLod(d), { fraction: 1, scale: 1 });
});

test("in god's eye, far groves draw fewer, larger leaves and keep their leaf area", () => {
  let last = 1;
  for (const d of [60, 90, 120]) {
    const { fraction } = godLeafLod(d);
    assert.ok(fraction < last, `fewer leaves at ${d} m`);
    last = fraction;
  }
  for (const d of [60, 90, 120, 200, 600]) {
    const { fraction, scale } = godLeafLod(d);
    assert.ok(Math.abs(fraction * scale * scale - 1) < 1e-9, "fraction x scale^2 = 1");
  }
  // Past three times the full distance it stops at the floor, as in the god's-eye view hundreds of metres up.
  assert.deepEqual(godLeafLod(3 * GOD_LEAF_FULL + 1), godLeafLod(600));
  assert.equal(godLeafLod(600).scale, GOD_LEAF_MAX_SCALE);
  assert.ok(Math.abs(godLeafLod(600).fraction - 1 / GOD_LEAF_MAX_SCALE ** 2) < 1e-12);
});

test("near the ground god's eye is the ground's thinning, so a dive lands without a change", () => {
  for (const d of [10, 80, 150, 400]) {
    const ground = leafFraction(d, 60, 0.15);
    assert.deepEqual(godLeafBlend(Math.hypot(d, 4), 4, ground), { fraction: ground, scale: 1 });
    assert.deepEqual(godLeafBlend(Math.hypot(d, GOD_BLEND_LOW), GOD_BLEND_LOW, ground), { fraction: ground, scale: 1 });
  }
});

test("high up god's eye is the full far-leaf rule, and eases between", () => {
  const d = 150, ground = leafFraction(d, 60, 0.15);
  const top = godLeafBlend(Math.hypot(d, 300), 300, ground);
  assert.deepEqual(top, godLeafLod(Math.hypot(d, 300)));
  assert.deepEqual(godLeafBlend(Math.hypot(d, GOD_BLEND_HIGH), GOD_BLEND_HIGH, ground), godLeafLod(Math.hypot(d, GOD_BLEND_HIGH)));
  // Climbing, the leaves only grow and the share moves steadily from the ground's to the far rule's.
  let lastScale = 1;
  for (let h = GOD_BLEND_LOW; h <= GOD_BLEND_HIGH; h += 5) {
    const { fraction, scale } = godLeafBlend(Math.hypot(d, h), h, ground);
    assert.ok(scale >= lastScale - 1e-12 && scale <= GOD_LEAF_MAX_SCALE + 1e-12);
    assert.ok(fraction > 0 && fraction <= 1);
    lastScale = scale;
  }
});
