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
  const { PAD_R } = require(`${build}/visitorScript.js`);
  assert.equal(e.obstacle, PAD_R, "the pad drawn is the pad the cart stops at");
  // Positions with the field left out (develop at #140); placement is greedy, and the field is last.
  const before = {
    mysterium: [24.889, 36.257], flame: [-73.581, -107.828], helix: [-77.038, 64.138], darrieus: [74.616, -66.639],
    savonius: [98.42, 19.023], dna: [-16.842, 128.644], mast: [-96.292, -29.267], sundial: [23.135, -96.919],
  };
  for (const [id, [x, z]] of Object.entries(before)) {
    const x2 = f.exhibits.find((v) => v.id === id);
    assert.ok(Math.abs(x2.x - x) < 1e-3 && Math.abs(x2.z - z) < 1e-3, `${id} moved`);
  }
});

test("visitor: the craft comes in above every crown and the redwood, and drops only where no leaf reaches", () => {
  const { getForest } = require(`${build}/forest.js`);
  const { visitorPose, VISITOR_END, REST_Y, SAUCER_R } = require(`${build}/visitorScript.js`);
  const f = getForest();
  const e = f.exhibits.find((x) => x.id === "landing");
  const face = Math.atan2(-(e.roadZ - e.z), e.roadX - e.x);
  const tallest = Math.max(...f.trees.map((t) => t.height));
  // No leaf above the pad within the craft's rim, plus 2 m.
  const L = f.leaves;
  let nearest = Infinity;
  for (let i = 0; i < L.count; i++) {
    if (L.pos[i * 3 + 1] < 2) continue;
    nearest = Math.min(nearest, Math.hypot(L.pos[i * 3] - e.x, L.pos[i * 3 + 2] - e.z));
  }
  assert.ok(nearest > SAUCER_R + 2, `a leaf ${nearest.toFixed(1)} m from the column, rim at ${SAUCER_R} m`);
  const redwood = f.corpusTree;
  for (let t = 0; t <= VISITOR_END; t += 0.05) {
    const [lx, y, lz] = visitorPose(t).saucer;
    if (y < tallest + 2) assert.ok(Math.hypot(lx, lz) < 1e-6, `at ${t.toFixed(2)} s the craft is low (${y.toFixed(1)} m) off the column`);
    // The redwood's crown reaches under 20 m from its axis (the redwood test).
    const x = e.x + lx * Math.cos(face) + lz * Math.sin(face), z = e.z - lx * Math.sin(face) + lz * Math.cos(face);
    if (y < redwood.height + 3) assert.ok(Math.hypot(x, z) > 20 + SAUCER_R, `at ${t.toFixed(2)} s the craft is in the redwood`);
  }
  const end = visitorPose(VISITOR_END + 100);
  assert.ok(Math.abs(end.saucer[1] - REST_Y) < 1e-9 && end.saucer[0] === 0 && end.saucer[2] === 0, "the craft stands on the pad");
  assert.equal(end.legs, 1);
  assert.equal(end.iris, 1);
});

test("visitor: the sentinel comes down first, then the cart, which plants the seed facing the tree and comes round to stand beside the sentinel", () => {
  const { getForest } = require(`${build}/forest.js`);
  const { visitorPose, VISITOR_END, PAD_R, REST_Y, TREE_AT, CART_STOP_DIST } = require(`${build}/visitorScript.js`);
  const e = getForest().exhibits.find((x) => x.id === "landing");
  let robotOut = null, cartOut = null, far = null;
  for (let t = 0; t <= VISITOR_END; t += 0.05) {
    const p = visitorPose(t);
    if (robotOut === null && p.robot.shown) robotOut = t;
    if (cartOut === null && p.cart.shown) cartOut = t;
    for (const w of [p.robot, p.cart]) {
      // On the lift below the belly means through the iris, which must be open.
      if (w.shown && w.y < REST_Y - 1e-3 && Math.hypot(w.x, w.z) < 1) assert.ok(p.iris > 0.99, `through a shut iris at ${t.toFixed(2)} s`);
    }
    if (p.grow > 0) assert.equal(p.plant, 1, "the tree grows before the seed is down");
    const r = Math.hypot(p.cart.x, p.cart.z);
    if (!far || r > far.r + 1e-9) far = { r, p };
    // Off the lift and the wedge, the cart keeps off the pad: its half length clear of the edge.
    const { PAD_TOP, PAVE_Y } = require(`${build}/visitorScript.js`);
    if (p.cart.shown && p.cart.y <= PAVE_Y + 1e-9) assert.ok(r > PAD_R + 0.75, `the cart runs over the pad's edge at ${t.toFixed(2)} s`);
    void PAD_TOP;
  }
  assert.ok(robotOut !== null && cartOut !== null && robotOut < cartOut);
  // Out at the tree's spot, facing it (yaw: 0 faces +x, positive turns toward -z).
  assert.ok(Math.abs(far.r - CART_STOP_DIST) < 1e-9);
  const want = Math.atan2(-(TREE_AT[2] - far.p.cart.z), TREE_AT[0] - far.p.cart.x);
  assert.ok(Math.abs(far.p.cart.yaw - want) < 1e-6, "the cart faces the tree");
  const end = visitorPose(VISITOR_END);
  const r = Math.hypot(end.robot.x, end.robot.z);
  assert.ok(r > PAD_R && r < e.plazaR - 0.5, `sentinel stops at ${r.toFixed(2)} m, pad ${PAD_R}, plaza ${e.plazaR.toFixed(2)}`);
  assert.equal(end.robot.yaw, 0);
  assert.equal(end.robot.stride, null);
  // On the paving, not sunk into it.
  const { PAVE_Y } = require(`${build}/visitorScript.js`);
  assert.equal(end.robot.y, PAVE_Y);
  // Beside the sentinel, on the paving, facing the road with it.
  const apart = Math.hypot(end.cart.x - end.robot.x, end.cart.z - end.robot.z);
  assert.ok(apart > 1.2 && apart < 2.5, `the cart stops ${apart.toFixed(2)} m from the sentinel`);
  assert.equal(end.cart.y, PAVE_Y);
  assert.ok(Math.abs(end.cart.yaw) < 1e-9, "the cart faces the road");
  assert.equal(end.cart.stride, null);
  assert.equal(end.grow, 1);
});

test("visitor: nobody passes through the hull; above the belly they ride the lift inside the shaft", () => {
  const { visitorPose, VISITOR_END, REST_Y, PAD_TOP, SHAFT_R, LIFT_R } = require(`${build}/visitorScript.js`);
  // Heights and half widths: the sentinel's fins and arms, the cart's corners.
  const figures = [["robot", 2.75, 0.7], ["cart", 1.15, 0.86]];
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

test("visitor: the camera keeps clear of trunks, leaves and the craft, and sees the grown tree past the rim", () => {
  const { getForest } = require(`${build}/forest.js`);
  const { visitorShot, VISITOR_END, SAUCER_R, TREE_AT } = require(`${build}/visitorScript.js`);
  const f = getForest();
  const e = f.exhibits.find((x) => x.id === "landing");
  const face = Math.atan2(-(e.roadZ - e.z), e.roadX - e.x);
  const L = f.leaves;
  for (let t = 0; t <= VISITOR_END; t += 0.1) {
    const { cam } = visitorShot(t);
    assert.ok(cam[1] > 0.5 && cam[1] < 3, `camera at ${cam[1].toFixed(2)} m`);
    assert.ok(Math.hypot(cam[0], cam[2]) > SAUCER_R + 1, `camera under the rim at ${t.toFixed(1)} s`);
    const x = e.x + cam[0] * Math.cos(face) + cam[2] * Math.sin(face);
    const z = e.z - cam[0] * Math.sin(face) + cam[2] * Math.cos(face);
    for (const t2 of f.trees) assert.ok(Math.hypot(t2.x - x, t2.z - z) - t2.trunkRadius > 2, `camera beside ${t2.book.slug}`);
    for (let i = 0; i < L.count; i++) {
      if (L.pos[i * 3 + 1] > cam[1] + 2) continue;
      assert.ok(Math.hypot(L.pos[i * 3] - x, L.pos[i * 3 + 2] - z) > 1.5, `camera in the leaves at ${t.toFixed(1)} s`);
    }
  }
  // At the end, the line from the camera to the tree's trunk passes outside the craft's rim.
  const { cam } = visitorShot(VISITOR_END);
  const dx = TREE_AT[0] - cam[0], dz = TREE_AT[2] - cam[2];
  const miss = Math.abs(cam[0] * dz - cam[2] * dx) / Math.hypot(dx, dz);
  assert.ok(miss > SAUCER_R + 1, `the craft hides the tree: the sightline passes ${miss.toFixed(1)} m from its axis`);
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

test("the cart's tree: routed at 0 and 45 degrees only, and the same every time", () => {
  const { artTree } = require(`${build}/artTree.js`);
  const a = artTree(), b = artTree();
  assert.deepEqual(a, b);
  assert.ok(a.segs.length > 100 && a.leaves.length > 100, `${a.segs.length} segments, ${a.leaves.length} leaves`);
  for (const s of a.segs) {
    const up = (s.to[1] - s.from[1]) / s.length;
    const tilt = (Math.acos(Math.min(1, up)) * 180) / Math.PI;
    assert.ok(Math.abs(tilt) < 1e-6 || Math.abs(tilt - 45) < 1e-6, `a branch at ${tilt.toFixed(2)} degrees`);
  }
  assert.ok(a.height > 12 && a.reach > 5, `height ${a.height.toFixed(1)}, reach ${a.reach.toFixed(1)}`);
});

test("the cart's tree stands off the paving, clear of roads, trees, the redwood and the craft", () => {
  const { getForest } = require(`${build}/forest.js`);
  const { artTree } = require(`${build}/artTree.js`);
  const { TREE_AT, SAUCER_R, visitorShot, VISITOR_END } = require(`${build}/visitorScript.js`);
  const f = getForest();
  const e = f.exhibits.find((x) => x.id === "landing");
  const tree = artTree();
  const face = Math.atan2(-(e.roadZ - e.z), e.roadX - e.x);
  const world = (lx, lz) => [e.x + lx * Math.cos(face) + lz * Math.sin(face), e.z - lx * Math.sin(face) + lz * Math.cos(face)];
  const [x, z] = world(TREE_AT[0], TREE_AT[2]);
  const dist = Math.hypot(TREE_AT[0], TREE_AT[2]);
  assert.ok(dist - 0.4 > e.plazaR, "the trunk stands on the paving");
  assert.ok(dist - tree.reach > SAUCER_R + 0.5, "the crown reaches under the craft's rim");
  const segDist = (px, pz, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(px - ax - dx * t, pz - az - dz * t);
  };
  for (const line of f.roadLines) {
    const n = line.pts.length;
    for (let i = 0; i < (line.closed ? n : n - 1); i++) {
      const [ax, az] = line.pts[i], [bx, bz] = line.pts[(i + 1) % n];
      assert.ok(segDist(x, z, ax, az, bx, bz) > 3, "the trunk stands on a road");
    }
  }
  for (const t of f.trees) assert.ok(Math.hypot(t.x - x, t.z - z) - t.trunkRadius > tree.reach + 1, `the crown reaches ${t.book.slug}'s trunk`);
  const L = f.leaves;
  for (let i = 0; i < L.count; i++) {
    if (L.pos[i * 3 + 1] < 2) continue;
    assert.ok(Math.hypot(L.pos[i * 3] - x, L.pos[i * 3 + 2] - z) > tree.reach + 1, "the crown tangles with another tree's leaves");
  }
  assert.ok(Math.hypot(x, z) > 20 + tree.reach, "the crown tangles with the redwood's");
  for (let t = 0; t <= VISITOR_END; t += 0.5) {
    const { cam } = visitorShot(t);
    assert.ok(Math.hypot(cam[0] - TREE_AT[0], cam[2] - TREE_AT[2]) > tree.reach + 0.5, "the camera stands in the tree");
  }
});
