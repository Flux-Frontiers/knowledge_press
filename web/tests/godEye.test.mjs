import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };

const { godView, godLimits, resetGodView, zoomGodView, godPose, groundPose, flightPose, FLIGHT_S, GOD_TILT } =
  require(`${process.env.FOREST_TEST_BUILD}/godEye.js`);

const WORLD = 300;
const limits = godLimits(WORLD, 20, 58);

test("the god's-eye limits run from about one grove to the whole world", () => {
  assert.ok(limits.min < limits.max);
  const t = Math.tan((58 * Math.PI) / 360);
  // At the top the world radius fills the half-height of the view, with margin.
  assert.ok(limits.max * t > WORLD);
  // At the bottom the view is a few grove radii tall, not a single tree.
  assert.ok(limits.min * t > 20 && limits.min * t < 100);
});

test("zoom clamps hold at both ends", () => {
  resetGodView(limits.max);
  for (let i = 0; i < 200; i++) zoomGodView(40, -60, 0.8, limits, WORLD);
  assert.equal(godView.height, limits.min);
  for (let i = 0; i < 200; i++) zoomGodView(40, -60, 1.25, limits, WORLD);
  assert.equal(godView.height, limits.max);
  // All the way out, the view is back over the hub.
  assert.equal(Math.hypot(godView.cx, godView.cz), 0);
});

test("zooming in keeps the ground point under the cursor", () => {
  resetGodView(limits.max);
  zoomGodView(0, 0, 0.5, limits, WORLD);
  const before = godPose();
  const ax = 30, az = 20;
  // The point's offset from the camera, as a fraction of the height, is what fixes its pixel.
  const rel = (p) => [(ax - p.cam.x) / p.cam.y, (az - p.cam.z) / p.cam.y];
  const [bx, bz] = rel(before);
  zoomGodView(ax, az, 0.7, limits, WORLD);
  const [cx, cz] = rel(godPose());
  assert.ok(Math.abs(bx - cx) < 1e-9 && Math.abs(bz - cz) < 1e-9);
});

test("a zoomed view never leaves the world", () => {
  resetGodView(limits.max);
  for (let i = 0; i < 50; i++) zoomGodView(5000, 5000, 0.9, limits, WORLD);
  assert.ok(Math.hypot(godView.cx, godView.cz) <= WORLD + 1e-9);
});

test("the god's-eye pose looks at its centre from the south", () => {
  resetGodView(limits.max);
  const { cam, look } = godPose();
  assert.deepEqual(look, { x: 0, y: 0, z: 0 });
  assert.equal(cam.z, cam.y * GOD_TILT);
});

test("a flight leaves from god's eye and lands on the chase pose", () => {
  resetGodView(limits.max);
  const from = godPose();
  for (const mode of ["follow", "high", "cart"]) {
    const to = groundPose(mode, 12, 0.4, -80, 0.7);
    assert.deepEqual(flightPose(from, to, 0).cam, from.cam);
    const mid = flightPose(from, to, FLIGHT_S / 2);
    assert.equal(mid.done, false);
    assert.ok(mid.cam.y < from.cam.y && mid.cam.y > to.cam.y);
    const end = flightPose(from, to, FLIGHT_S);
    assert.equal(end.done, true);
    assert.deepEqual(end.cam, to.cam);
    assert.deepEqual(end.look, to.look);
    // Overshooting the duration stays on the chase pose.
    assert.deepEqual(flightPose(from, to, FLIGHT_S * 3).cam, to.cam);
  }
});

test("the follow pose sits behind the cart and looks down the road", () => {
  // Yaw 0 heads toward -z (sim.ts forwardOf).
  const { cam, look } = groundPose("follow", 0, 0, 0, 0);
  assert.ok(cam.z > 0 && look.z < 0);
  assert.equal(cam.y, look.y);
});
