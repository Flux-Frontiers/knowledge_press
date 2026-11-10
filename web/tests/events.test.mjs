import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };
const build = process.env.FOREST_TEST_BUILD;

test("events: a booked window is on from its first day to its last, inclusive", () => {
  const { activeEvent } = require(`${build}/events.js`);
  const booked = [{ id: "visitor", start: "2027-03-01", end: "2027-03-14" }];
  assert.equal(activeEvent(new Date(2027, 1, 28, 23), "", booked), null);
  assert.equal(activeEvent(new Date(2027, 2, 1, 0, 5), "", booked), "visitor");
  assert.equal(activeEvent(new Date(2027, 2, 14, 23, 55), "", booked), "visitor");
  assert.equal(activeEvent(new Date(2027, 2, 15, 0, 5), "", booked), null);
});

test("events: ?event= stages a known event now and ignores an unknown one", () => {
  const { activeEvent } = require(`${build}/events.js`);
  assert.equal(activeEvent(new Date(2030, 0, 1), "?event=Visitor", []), "visitor");
  assert.equal(activeEvent(new Date(2030, 0, 1), "?event=parade", [{ id: "visitor", start: "2030-01-01", end: "2030-01-01" }]), null);
});

test("the landing field keeps its own glade and leaves the other exhibits where they were", () => {
  const { getForest } = require(`${build}/forest.js`);
  const f = getForest();
  const e = f.exhibits.find((x) => x.id === "landing");
  assert.ok(e, "landing field placed");
  // Positions before the field was added (1.40.0); placement is greedy, and the field is last.
  const before = {
    mysterium: [24.049, 37.235], flame: [-54.382, -83.82], helix: [-78.078, 63.619], darrieus: [121.932, -58.905],
    savonius: [-16.057, 99.427], dna: [96.878, 27.537], mast: [-136.989, -32.606], sundial: [3.962, -130.756],
  };
  for (const [id, [x, z]] of Object.entries(before)) {
    const x2 = f.exhibits.find((v) => v.id === id);
    assert.ok(Math.abs(x2.x - x) < 1e-3 && Math.abs(x2.z - z) < 1e-3, `${id} moved`);
  }
});

test("visitor: the craft comes in above every crown and only drops in the clear column over the pad", () => {
  const { getForest } = require(`${build}/forest.js`);
  const { visitorPose, VISITOR_END, REST_Y, SAUCER_R } = require(`${build}/visitorScript.js`);
  const f = getForest();
  const e = f.exhibits.find((x) => x.id === "landing");
  const tallest = Math.max(...f.trees.map((t) => t.height));
  // Nearest trunk to the pad, less the craft's radius: room for the crowns beside the column.
  const nearest = Math.min(...f.trees.map((t) => Math.hypot(t.x - e.x, t.z - e.z) - t.trunkRadius));
  assert.ok(nearest - SAUCER_R > 8, `only ${(nearest - SAUCER_R).toFixed(1)} m between the craft and a trunk`);
  for (let t = 0; t <= VISITOR_END; t += 0.05) {
    const [x, y, z] = visitorPose(t).saucer;
    if (y < tallest + 2) assert.ok(Math.hypot(x, z) < 1e-6, `at ${t.toFixed(2)} s the craft is low (${y.toFixed(1)} m) off the column`);
  }
  const end = visitorPose(VISITOR_END + 100);
  assert.ok(Math.abs(end.saucer[1] - REST_Y) < 1e-9 && end.saucer[0] === 0 && end.saucer[2] === 0, "the craft stands on the pad");
  assert.equal(end.legs, 1);
  assert.equal(end.iris, 1);
  assert.equal(end.offer, 1);
});

test("visitor: the sentinel comes down first, both stop on the plaza facing the road", () => {
  const { getForest } = require(`${build}/forest.js`);
  const { visitorPose, VISITOR_END, PAD_R } = require(`${build}/visitorScript.js`);
  const e = getForest().exhibits.find((x) => x.id === "landing");
  let robotOut = null, guestOut = null;
  for (let t = 0; t <= VISITOR_END; t += 0.05) {
    const p = visitorPose(t);
    if (robotOut === null && p.robot.shown) robotOut = t;
    if (guestOut === null && p.guest.shown) guestOut = t;
    if (p.robot.shown || p.guest.shown) assert.ok(p.iris > 0.99, `someone is out at ${t.toFixed(2)} s through a shut iris`);
  }
  assert.ok(robotOut !== null && guestOut !== null && robotOut < guestOut);
  const end = visitorPose(VISITOR_END);
  for (const w of [end.robot, end.guest]) {
    const r = Math.hypot(w.x, w.z);
    assert.ok(r > PAD_R && r < e.plazaR - 0.5, `stops at ${r.toFixed(2)} m, pad ${PAD_R}, plaza ${e.plazaR.toFixed(2)}`);
    assert.equal(w.y, 0);
    assert.equal(w.stride, null);
    assert.equal(w.yaw, 0);
  }
});

test("visitor: nobody passes through the hull; above the belly they ride the lift inside the shaft", () => {
  const { visitorPose, VISITOR_END, REST_Y, PAD_TOP, SHAFT_R, LIFT_R } = require(`${build}/visitorScript.js`);
  // Half widths: the sentinel's fins and arms, the visitor's shoulders.
  const figures = [["robot", 2.75, 0.7], ["guest", 1.85, 0.35]];
  for (let t = 0; t <= VISITOR_END; t += 0.02) {
    const p = visitorPose(t);
    for (const [who, height, half] of figures) {
      const w = p[who];
      if (!w.shown) continue;
      const r = Math.hypot(w.x, w.z);
      if (w.y + height > REST_Y) assert.ok(r + half < SHAFT_R, `${who} at ${t.toFixed(2)} s reaches into the hull, ${r.toFixed(2)} m off the axis`);
      // Riding: standing on the platform.
      if (w.y > PAD_TOP + 1e-6) assert.ok(Math.abs(p.lift - w.y) < 1e-6 && r < LIFT_R, `${who} floats at ${t.toFixed(2)} s`);
    }
  }
});

test("visitor: the legs are down before the craft touches, and the beam is out by then", () => {
  const { visitorPose, VISITOR_END, REST_Y } = require(`${build}/visitorScript.js`);
  for (let t = 0; t <= VISITOR_END; t += 0.05) {
    const p = visitorPose(t);
    if (p.saucer[1] < REST_Y + 0.05) assert.ok(p.legs > 0.999, `touching down at ${t.toFixed(2)} s with the legs ${p.legs.toFixed(2)} out`);
    if (p.lift < REST_Y - 1e-6) assert.ok(p.iris > 0.99, `lift down through a shut iris at ${t.toFixed(2)} s`);
  }
});

test("visitor: the camera watches from the spur or the plaza, never among the trees", () => {
  const { getForest } = require(`${build}/forest.js`);
  const { visitorShot, VISITOR_END } = require(`${build}/visitorScript.js`);
  const f = getForest();
  const e = f.exhibits.find((x) => x.id === "landing");
  const face = Math.atan2(-(e.roadZ - e.z), e.roadX - e.x);
  const toRoad = Math.hypot(e.roadX - e.x, e.roadZ - e.z);
  for (let t = 0; t <= VISITOR_END; t += 0.1) {
    const { cam } = visitorShot(t);
    assert.ok(Math.abs(cam[2]) <= 1.5 + 1e-9 && cam[0] > 0 && cam[0] <= toRoad + 6, `camera off the spur at ${t.toFixed(1)} s: ${cam.map((v) => v.toFixed(1))}`);
    assert.ok(cam[1] > 0.5 && cam[1] < 3, `camera at ${cam[1].toFixed(2)} m`);
    const x = e.x + cam[0] * Math.cos(face) + cam[2] * Math.sin(face);
    const z = e.z - cam[0] * Math.sin(face) + cam[2] * Math.cos(face);
    for (const t2 of f.trees) assert.ok(Math.hypot(t2.x - x, t2.z - z) - t2.trunkRadius > 2, `camera beside ${t2.book.slug}`);
  }
});

test("the event swarm: several radiants above the horizon, at storm rates, and nothing at level 0", () => {
  const { swarmSources, SWARM_RADIANTS } = require(`${build}/meteors.js`);
  assert.ok(SWARM_RADIANTS.length >= 4);
  for (const r of SWARM_RADIANTS) {
    assert.ok(Math.abs(Math.hypot(...r) - 1) < 1e-9 && r[1] > 0.2, `radiant ${r.map((v) => v.toFixed(2))}`);
  }
  assert.deepEqual(swarmSources(0), []);
  const full = swarmSources(1).reduce((s, src) => s + src.perHour, 0);
  assert.ok(full / 3600 > 2, `${(full / 3600).toFixed(1)} a second`);
});
