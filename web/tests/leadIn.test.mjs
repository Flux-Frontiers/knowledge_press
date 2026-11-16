import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };

test("riding the ring from beside a tree, the cart threads the grove to the road without touching a trunk", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { sim, teleportSim, stepVehicle } = require(`${process.env.FOREST_TEST_BUILD}/sim.js`);
  const { planTour, steerTour } = require(`${process.env.FOREST_TEST_BUILD}/tour.js`);
  const { tourRoadDistance } = require(`${process.env.FOREST_TEST_BUILD}/leadIn.js`);
  const f = getForest();
  const off = f.trees.filter((t) => tourRoadDistance(f, t.x, t.z) > 3);
  const picks = off.filter((_, i) => i % Math.ceil(off.length / 30) === 0);
  for (const t of picks) {
    // Parked to read it, facing the trunk: on the far side from the hub, and on the near side.
    for (const turn of [0.7, -2.4]) {
      const a = Math.atan2(t.z, t.x) + turn;
      const x = t.x + Math.cos(a) * (t.trunkRadius + 1.3), z = t.z + Math.sin(a) * (t.trunkRadius + 1.3);
      teleportSim(x, z, Math.atan2(-(t.x - x), -(t.z - z)));
      const tour = planTour(f, sim.x, sim.z, sim.yaw);
      let s = 0;
      for (; s < 90 && tourRoadDistance(f, sim.x, sim.z) > 1; s += 1 / 30) {
        const c = steerTour(tour, sim.x, sim.z, sim.yaw, sim.speed, 1 / 30);
        stepVehicle(f, c.throttle, c.steer, false, 1 / 30, { brake: c.brake });
        const hit = f.trees.find((tr) => Math.hypot(tr.x - sim.x, tr.z - sim.z) < tr.trunkRadius + 1.06);
        assert.equal(hit, undefined, `from beside ${t.book.slug} the cart ran into ${hit?.book.slug} after ${s.toFixed(1)} s`);
      }
      assert.ok(s < 90, `from beside ${t.book.slug} the cart never reached the road`);
    }
  }
});

test("the way out is found quickly, even from the forest's far edge", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { pathToRoad, tourRoadDistance } = require(`${process.env.FOREST_TEST_BUILD}/leadIn.js`);
  const f = getForest();
  const far = f.trees.reduce((a, b) => (tourRoadDistance(f, a.x, a.z) > tourRoadDistance(f, b.x, b.z) ? a : b));
  const t0 = performance.now();
  const path = pathToRoad(f, far.x + far.trunkRadius + 1.3, far.z);
  const ms = performance.now() - t0;
  assert.ok(path && path.length > 2, "no way out from the farthest tree");
  assert.ok(tourRoadDistance(f, ...path[path.length - 1]) < 0.7, "the way out ends off the road");
  // A tour starts on a tap; on a phone this runs several times slower than here.
  assert.ok(ms < 150, `took ${ms.toFixed(0)} ms`);
});
