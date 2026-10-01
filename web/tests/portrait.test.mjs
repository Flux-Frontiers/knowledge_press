import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };
const portrait = () => require(`${process.env.FOREST_TEST_BUILD}/portrait.js`);

test("?shot=<slug> names the tree to photograph", () => {
  const { shotSlug } = portrait();
  assert.equal(shotSlug("?shot=Hamlet"), "hamlet");
  assert.equal(shotSlug("?tree=hamlet"), null);
  assert.equal(shotSlug(""), null);
});

test("a tree's extent is read from its own vertices only", () => {
  const { treeExtent } = portrait();
  // Two trees in one buffer; the second, at x = 50, must not count for the first.
  const pos = [0, 0, 0, 3, 10, 4, 0, 6, 0, 50, 99, 0];
  assert.deepEqual(treeExtent(pos, 0, 3, 0, 0), { minY: 0, maxY: 10, radius: 5 });
});

test("the camera stands far enough back that the whole tree fits the frame", () => {
  const { portraitPose, PORTRAIT_FOV, PORTRAIT_ASPECT } = portrait();
  for (const extent of [{ minY: 0, maxY: 12, radius: 6 }, { minY: 0, maxY: 80, radius: 30 }, { minY: 0, maxY: 20, radius: 40 }]) {
    const pose = portraitPose({ x: 10, z: -20 }, extent);
    const d = Math.hypot(pose.cam[0] - 10, pose.cam[2] + 20);
    const halfV = (PORTRAIT_FOV * Math.PI) / 360;
    const halfH = Math.atan(Math.tan(halfV) * PORTRAIT_ASPECT);
    assert.ok(2 * d * Math.tan(halfV) >= extent.maxY, "tall enough");
    assert.ok(2 * d * Math.tan(halfH) >= extent.radius * 2, "wide enough");
    assert.equal(pose.look[0], 10);
    assert.equal(pose.look[2], -20);
    assert.equal(pose.look[1], pose.cam[1], "level with the middle of the tree");
  }
});

test("a shared frame shows every tree at one scale, sized for the largest", () => {
  const { commonFrame, portraitPose } = portrait();
  const small = { minY: 0, maxY: 4, radius: 2 }, big = { minY: 0, maxY: 60, radius: 25 };
  const frame = commonFrame([small, big]);
  const alone = portraitPose({ x: 0, z: 0 }, big);
  assert.equal(frame.dist, alone.cam[2]);
  for (const e of [small, big]) {
    const pose = portraitPose({ x: 5, z: 5 }, e, Math.PI / 2, frame);
    assert.equal(Math.hypot(pose.cam[0] - 5, pose.cam[2] - 5).toFixed(6), frame.dist.toFixed(6));
    assert.equal(pose.cam[1], frame.mid);
  }
});
