import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };

function roadDistance(f, x, z) {
  let best = Infinity;
  for (const r of f.roads) {
    const dx = r.bx - r.ax, dz = r.bz - r.az;
    const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - r.ax - dx * t, z - r.az - dz * t));
  }
  // Plazas are paved too: the tour turns round on a stop's plaza where the ring doubles back.
  for (const p of f.plazas) if (Math.hypot(x - p.x, z - p.z) < p.r) return 0;
  // So are the curb fillets where a spoke meets a ring: the tour's rounded turns cross them.
  const { onFillet } = require(`${process.env.FOREST_TEST_BUILD}/roads.js`);
  if (f.junctions.some((j) => onFillet(x, z, j))) return 0;
  // Through a junction the rounded turn runs off both centrelines but stays on the strips.
  const { RING_W, SPOKE_W } = require(`${process.env.FOREST_TEST_BUILD}/roads.js`);
  if (f.junctions.some((j) => Math.hypot(x - j.x, z - j.z) < 4)) {
    const r = Math.hypot(x, z);
    if (f.junctions.some((j) => Math.abs(r - j.ring) <= RING_W / 2
      || (Math.hypot(x - j.x, z - j.z) < 4 && Math.abs(Math.atan2(Math.sin(Math.atan2(z, x) - j.a), Math.cos(Math.atan2(z, x) - j.a)) * r) <= SPOKE_W / 2))) return 0;
  }
  return best;
}

function driveTour(f, x, z, yaw) {
  const { sim, teleportSim, stepVehicle } = require(`${process.env.FOREST_TEST_BUILD}/sim.js`);
  const { planTour, steerTour } = require(`${process.env.FOREST_TEST_BUILD}/tour.js`);
  teleportSim(x, z, yaw);
  const tour = planTour(f, sim.x, sim.z, sim.yaw);
  // Every route point is on the brick: within a hand's breadth of a centreline (the
  // rounded turns' tangent points sit a few centimetres off it) or on a plaza.
  for (const [px, pz] of tour.pts) assert.ok(roadDistance(f, px, pz) < 0.25, `route point ${px.toFixed(1)}, ${pz.toFixed(1)} is off the road`);
  const stops = new Set();
  // Seconds spent standing still facing each grove's signpost.
  const faced = new Map();
  let onRoad = false, worst = 0;
  const hz = 30;
  for (let i = 0; i < 900 * hz; i++) {
    const c = steerTour(tour, sim.x, sim.z, sim.yaw, sim.speed, 1 / hz);
    stepVehicle(f, c.throttle, c.steer, false, 1 / hz, { brake: c.brake });
    const sign = f.signs.find((sg) => sg.genre === c.genre);
    if (sim.speed === 0 && sign) {
      const want = Math.atan2(-(sign.x - sim.x), -(sign.z - sim.z));
      if (Math.abs(Math.atan2(Math.sin(want - sim.yaw), Math.cos(want - sim.yaw))) < 0.06) faced.set(c.genre, (faced.get(c.genre) ?? 0) + 1 / hz);
    }
    const d = roadDistance(f, sim.x, sim.z);
    // The start may be off the road, or facing away from the route (home faces
    // the redwood, the tour runs out along the spoke behind it): once the cart
    // is under way along the route and on the brick, it must stay on it.
    if (d < 1 && tour.i > 2) onRoad = true;
    if (onRoad) worst = Math.max(worst, d);
    for (const wp of f.circuit) if (Math.hypot(wp.x - sim.x, wp.z - sim.z) < 4) stops.add(wp.genre);
  }
  return { tour, onRoad, worst, stops, faced };
}

test("the guided tour keeps to the road, from home and from the hub end of a spoke, stopping at every grove", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { DWELL } = require(`${process.env.FOREST_TEST_BUILD}/tour.js`);
  const f = getForest();
  const spoke = f.roadLines.filter((l) => l.kind === "spoke").sort((a, b) => b.pts.length - a.pts.length)[0];
  const [sx, sz] = spoke.pts[0], [nx, nz] = spoke.pts[3];
  const starts = [
    { name: "home", ...f.home },
    { name: "spoke", x: sx, z: sz, yaw: Math.atan2(-(nx - sx), -(nz - sz)) },
  ];
  for (const s of starts) {
    const { tour, onRoad, worst, stops, faced } = driveTour(f, s.x, s.z, s.yaw);
    if (s.name === "spoke") assert.ok(tour.loopStart > 0, "a start on a spoke rides the spoke out to the ring");
    // The inner ring comes first: its stops before any on the outer ring.
    const radii = tour.stops.map((st) => f.circuit.find((wp) => wp.genre === st.genre)).map((wp) => Math.round(Math.hypot(wp.x, wp.z)));
    const inner = Math.min(...radii);
    const firstOuter = radii.findIndex((r) => r > inner);
    assert.ok(radii.slice(firstOuter).every((r) => r > inner), `${s.name}: stops by ring radius ${radii.join(", ")}`);
    assert.ok(onRoad, `${s.name}: never reached the road`);
    // Half the narrowest road (the 2.8 m spokes).
    assert.ok(worst < 1.4, `${s.name}: strayed ${worst.toFixed(2)} m from the road`);
    assert.equal(stops.size, f.circuit.length, `${s.name}: passed ${stops.size} of ${f.circuit.length} grove stops`);
    // At every grove the cart pulls up and faces the signpost for the whole dwell.
    for (const wp of f.circuit) {
      assert.ok((faced.get(wp.genre) ?? 0) >= DWELL - 0.1, `${s.name}: faced the ${wp.genre} sign for ${(faced.get(wp.genre) ?? 0).toFixed(1)} s`);
    }
  }
});

test("from a tree off the road, the tour reaches the ring at a drive, not a crawl", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { sim, teleportSim, stepVehicle } = require(`${process.env.FOREST_TEST_BUILD}/sim.js`);
  const { planTour, steerTour } = require(`${process.env.FOREST_TEST_BUILD}/tour.js`);
  const f = getForest();
  // A tree well back from any road, the cart parked beside it facing its trunk.
  const t = f.trees.map((tr) => ({ tr, d: roadDistance(f, tr.x, tr.z) })).filter(({ d }) => d > 26 && d < 40).sort((a, b) => a.d - b.d)[0].tr;
  const x = t.x + 4, z = t.z;
  teleportSim(x, z, Math.atan2(-(t.x - x), -(t.z - z)));
  const start = roadDistance(f, sim.x, sim.z);
  const tour = planTour(f, sim.x, sim.z, sim.yaw);
  const hz = 30;
  let s = 0;
  for (; s < 60 && roadDistance(f, sim.x, sim.z) > 1; s += 1 / hz) {
    const c = steerTour(tour, sim.x, sim.z, sim.yaw, sim.speed, 1 / hz);
    stepVehicle(f, c.throttle, c.steer, false, 1 / hz, { brake: c.brake });
  }
  // Turning round, then about 2 m/s or better: the off-route slowdown is for the last few meters.
  assert.ok(s < start / 2 + 6, `${start.toFixed(1)} m to the road took ${s.toFixed(1)} s`);
  // Then it rides on and pulls up at the next grove's sign within the next stretch of ring.
  let stopped = false;
  for (let k = 0; k < 120 * hz && !stopped; k++) {
    const c = steerTour(tour, sim.x, sim.z, sim.yaw, sim.speed, 1 / hz);
    stepVehicle(f, c.throttle, c.steer, false, 1 / hz, { brake: c.brake });
    stopped = Boolean(tour.dwell);
  }
  assert.ok(stopped, "never pulled up at a grove after joining the ring");
  assert.ok(roadDistance(f, sim.x, sim.z) < 1.4, "pulled up off the road");
});

test("the tour loop turns smoothly: no corner sharper than 40 degrees between samples", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const f = getForest();
  const p = f.ringPath, n = p.length;
  let worst = 0;
  for (let k = 0; k < n; k++) {
    const a = p[(k - 1 + n) % n], b = p[k], c = p[(k + 1) % n];
    const h0 = Math.atan2(b.z - a.z, b.x - a.x), h1 = Math.atan2(c.z - b.z, c.x - b.x);
    worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0))));
  }
  assert.ok(worst < (40 * Math.PI) / 180, `the loop turns ${((worst * 180) / Math.PI).toFixed(0)} degrees at one sample`);
});

test("a grove's stop counts as arrived, though it lies outside the grove's radius", () => {
  const { atGroveStop, groveApproach } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const grove = { genre: "drama", label: "Drama", x: 120, z: 0, radius: 30 };
  const forest = { groves: [grove] };
  const stop = groveApproach(grove);
  assert.ok(Math.hypot(grove.x - stop.x, grove.z - stop.z) > grove.radius, "the stop is outside the grove");
  assert.equal(atGroveStop(forest, "drama", stop.x, stop.z), true);
  assert.equal(atGroveStop(forest, "drama", stop.x - 8, stop.z), true);
  assert.equal(atGroveStop(forest, "drama", stop.x - 40, stop.z), false);
  assert.equal(atGroveStop(forest, "no-such-grove", stop.x, stop.z), false);
});

test("?tree=<slug> names a tree by its catalog slug, and anything else names none", () => {
  const { treeFromSearch } = require(`${process.env.FOREST_TEST_BUILD}/deepLink.js`);
  const trees = [{ book: { slug: "hamlet" } }, { book: { slug: "moby_dick" } }];
  assert.equal(treeFromSearch("?tree=hamlet", trees), trees[0]);
  assert.equal(treeFromSearch("?weather=fog&tree=Moby_Dick", trees), trees[1]);
  assert.equal(treeFromSearch("?tree=no_such_book", trees), undefined);
  assert.equal(treeFromSearch("?tree=", trees), undefined);
  assert.equal(treeFromSearch("", trees), undefined);
});
