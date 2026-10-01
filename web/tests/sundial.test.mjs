import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };

const build = () => process.env.FOREST_TEST_BUILD;
const RAD = Math.PI / 180;
const place = { lat: 39, lon: -77 };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** The sun's world direction at 39 N, every `step` minutes of the given days of a year. */
function suns(days, step = 20) {
  const { sunPosition, bodyDirection } = require(`${build()}/sky.js`);
  const out = [];
  for (const day of days) {
    for (let m = 0; m < 1440; m += step) {
      const at = new Date(Date.UTC(2026, 0, 1) + (day * 1440 + m) * 60000);
      const p = sunPosition(at, place);
      out.push({ at, p, dir: bodyDirection(p) });
    }
  }
  return out;
}

test("the style points at the celestial pole: true north, 39 degrees up, as the star field has it", () => {
  const { POLE, NOON, EAST, SUNDIAL_LAT, RING_TILT } = require(`${build()}/sundialGeometry.js`);
  const { equatorialToWorld } = require(`${build()}/sky.js`);
  assert.equal(SUNDIAL_LAT, 39);
  assert.ok(Math.abs(POLE[0]) < 1e-12 && POLE[2] < 0, "north is -z");
  assert.ok(Math.abs(Math.asin(POLE[1]) / RAD - 39) < 1e-9);
  assert.ok(Math.abs(dot(POLE, NOON)) < 1e-12 && Math.abs(dot(POLE, EAST)) < 1e-12 && NOON[2] > 0, "noon is toward the south");
  // The sky's own north celestial pole (its third matrix column), for this place and date.
  const M = equatorialToWorld(new Date("2026-09-30T17:00:00Z"), place);
  const pole = [M[2], M[5], M[8]];
  const gap = Math.acos(Math.min(1, dot(pole, POLE))) / RAD;
  assert.ok(gap < 0.5, `style is ${gap.toFixed(2)} degrees off the sky's pole`);
  // The dial group's tilt turns local y to the pole and local z to noon.
  const [c, s] = [Math.cos(RING_TILT), Math.sin(RING_TILT)];
  const y = [0, c, s], z = [0, -s, c];
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(y[i] - POLE[i]) < 1e-12 && Math.abs(z[i] - NOON[i]) < 1e-12);
  }
});

test("the hour angle is zero when the sun is due south and highest, and runs 15 degrees an hour", () => {
  const { hourAngle } = require(`${build()}/sundialGeometry.js`);
  const { sunPosition, bodyDirection } = require(`${build()}/sky.js`);
  for (const day of [10, 80, 172, 265, 355]) {
    const day0 = Date.UTC(2026, 0, 1) + day * 86400000;
    let best = day0, bestAlt = -Infinity;
    for (let m = 0; m < 1440; m++) {
      const alt = sunPosition(new Date(day0 + m * 60000), place).altitude;
      if (alt > bestAlt) { bestAlt = alt; best = day0 + m * 60000; }
    }
    const noon = bodyDirection(sunPosition(new Date(best), place));
    assert.ok(Math.abs(hourAngle(noon)) < 0.1 * RAD, `day ${day}: noon at ${(hourAngle(noon) / RAD).toFixed(3)} degrees`);
    assert.ok(noon[2] > 0 && Math.abs(noon[0]) < 0.002, `day ${day}: the noon sun is not due south`);
    const at = (h) => hourAngle(bodyDirection(sunPosition(new Date(best + h * 3600000), place))) / RAD;
    for (const h of [-4, -2, 1, 3]) assert.ok(Math.abs(at(h) - 15.04 * h) < 0.3, `day ${day}: ${at(h).toFixed(2)} at ${h} h`);
    // Morning sun is in the east: negative hour angle, east of the meridian.
    assert.ok(bodyDirection(sunPosition(new Date(best - 3 * 3600000), place))[0] > 0);
  }
});

test("the style's shadow lies on the ring at the hour the sun's hour angle gives, in the right place in the world", () => {
  const { hourAngle, ringShadow, ringAngle, POLE, NOON, EAST, RING_R, RING_W } = require(`${build()}/sundialGeometry.js`);
  let checked = 0, dead = 0;
  for (const { dir } of suns([5, 40, 80, 120, 172, 220, 265, 300, 355])) {
    if (dir[1] < 0.1) continue;
    const s = ringShadow(dir);
    if (!s) { dead++; continue; }
    checked++;
    assert.ok(Math.abs(wrap(s.angle - ringAngle(hourAngle(dir)))) < 1e-9, "the shadow does not read the hour");
    // Cast the style's points along the rays by hand, in world coordinates, onto the ring's cylinder.
    const perp = Math.hypot(dot(dir, EAST), dot(dir, NOON));
    const hit = (t) => {
      const lam = RING_R / perp;
      return [0, 1, 2].map((i) => t * POLE[i] - lam * dir[i]);
    };
    const q = hit(0);
    const psi = Math.atan2(dot(q, NOON), dot(q, EAST));
    assert.ok(Math.abs(wrap(psi - s.angle)) < 1e-9, "the shadow is not where the ray lands");
    // Of the ring's width, the near edge hides what its rays cross; compare with ray marching.
    const lit = [];
    for (let a = -RING_W / 2; a <= RING_W / 2; a += RING_W / 200) {
      const p = [0, 1, 2].map((i) => q[i] + a * POLE[i]);
      // Second crossing of the ring's cylinder along the ray toward the sun.
      const pe = dot(p, EAST), pn = dot(p, NOON);
      const se = dot(dir, EAST), sn = dot(dir, NOON);
      const mu = -2 * (pe * se + pn * sn) / (se * se + sn * sn);
      const near = a + mu * dot(dir, POLE);
      if (Math.abs(near) >= RING_W / 2) lit.push(a);
    }
    if (lit.length) {
      assert.ok(Math.abs(Math.min(...lit) - s.from) < RING_W / 100 + 1e-9 && Math.abs(Math.max(...lit) - s.to) < RING_W / 100 + 1e-9,
        `lit span [${s.from.toFixed(3)}, ${s.to.toFixed(3)}] against marched [${Math.min(...lit).toFixed(3)}, ${Math.max(...lit).toFixed(3)}]`);
    }
  }
  assert.ok(checked > 200, `only ${checked} suns checked`);
  assert.ok(dead < checked / 10, "the shadow vanishes too often");
});

test("noon is at the bottom of the ring on the north side, the morning hours on the west", () => {
  const { ringAngleOfHour, hourLabel, FIRST_HOUR, LAST_HOUR } = require(`${build()}/sundialGeometry.js`);
  // Local frame: x east, y the style, z toward noon; a ring angle psi is the point (cos psi, 0, sin psi).
  const noon = ringAngleOfHour(12);
  assert.ok(Math.abs(Math.cos(noon)) < 1e-12 && Math.sin(noon) === -1, "noon is on the side away from the sun's noon direction");
  assert.ok(Math.cos(ringAngleOfHour(9)) < 0, "morning is west");
  assert.ok(Math.cos(ringAngleOfHour(15)) > 0, "afternoon is east");
  assert.ok(Math.abs(Math.cos(ringAngleOfHour(6)) + 1) < 1e-12, "six in the morning is due west");
  assert.deepEqual([4, 6, 12, 13, 18, 20].map(hourLabel), ["IV", "VI", "XII", "I", "VI", "VIII"]);
  assert.equal(FIRST_HOUR, 4);
  assert.equal(LAST_HOUR, 20);
});

test("the dial is on the roster of exhibits, and shades its own face at the equinox", () => {
  const { EXHIBITS } = require(`${build()}/exhibits.js`);
  const { ringShadow, NOON, EAST, POLE } = require(`${build()}/sundialGeometry.js`);
  assert.ok(EXHIBITS.some((e) => e.id === "sundial"));
  // A sun exactly in the equator's plane (declination 0), in the south-east and up.
  const flat = [0, 1, 2].map((i) => -0.5 * EAST[i] + 0.8 * NOON[i]);
  assert.equal(ringShadow(flat), null);
  // A few degrees either side of it, the shadow is a sliver; well clear of it, the ring's whole width.
  const near = [0, 1, 2].map((i) => flat[i] + 0.02 * POLE[i]);
  const sliver = ringShadow(near);
  assert.ok(sliver && sliver.to - sliver.from < 0.1);
  const summer = ringShadow([0.2, 0.6, 0.5].map((v, _, a) => v / Math.hypot(...a)));
  assert.ok(summer && summer.to - summer.from > 0);
});

test("the compass rose: sixteen winds, north up the canvas and so toward -z on the ground", () => {
  const { WINDS, rosePoint, ROSE_TILT, ROSE_R } = require(`${build()}/compassRoseArt.js`);
  assert.equal(WINDS.length, 16);
  assert.deepEqual(WINDS.filter((w) => w.bearing % 90 === 0).map((w) => w.name), ["N", "E", "S", "W"]);
  const [nx, ny] = rosePoint(0, 100), [ex, ey] = rosePoint(90, 100);
  assert.ok(Math.abs(nx - 512) < 1e-9 && ny < 512, "north is up the canvas");
  assert.ok(ex > 512 && Math.abs(ey - 512) < 1e-9, "east is to the right");
  // The mesh is a plane laid flat by a turn about x: its up (0, 1, 0) goes to (0, cos, sin).
  const up = [0, Math.cos(ROSE_TILT), Math.sin(ROSE_TILT)];
  assert.ok(Math.abs(up[1]) < 1e-12 && Math.abs(up[2] + 1) < 1e-12, "canvas up lies along -z, north");
  // Right stays +x, east.
  assert.ok(ROSE_R <= 10, "the rose fits the hub plaza");
  const tip = Math.max(...WINDS.map((w) => w.tip));
  assert.ok(tip < 440, "the points stay inside the letters' ring");
  assert.equal(WINDS.find((w) => w.name === "N").tip, tip, "north is the longest point");
});

test("the compass rose rings the redwood on the hub plaza, clear of the root flare and inside the paving", () => {
  const { getForest, HUB_PLAZA_R } = require(`${build()}/forest.js`);
  const { ROSE_R, WINDS } = require(`${build()}/compassRoseArt.js`);
  const f = getForest();
  assert.ok(ROSE_R < HUB_PLAZA_R, "the rose overhangs the hub plaza");
  assert.ok(f.corpusTree.baseRadius + 0.4 < ROSE_R * 0.5, "the flare leaves no room for the winds");
  // Every wind reaches well past the flare.
  const hole = (f.corpusTree.baseRadius + 0.4) / ROSE_R * 512;
  for (const w of WINDS) assert.ok(w.tip > hole + 150, `${w.name} is too short to show past the trunk`);
});

test("junction plazas are small, and still cover the tour's rounded turns", () => {
  const { getForest } = require(`${build()}/forest.js`);
  const f = getForest();
  const junctions = f.plazas.filter((p) => p.r !== 10 && !f.circuit.some((wp) => wp.x === p.x && wp.z === p.z) && !f.exhibits.some((e) => e.x === p.x && e.z === p.z));
  assert.ok(junctions.length >= 2);
  for (const j of junctions) assert.equal(j.r, 3);
  // Where the loop bends at a junction, every route point near it stays on the paving with the cart's half-width to spare.
  for (const j of junctions) {
    for (const p of f.ringPath) {
      const d = Math.hypot(p.x - j.x, p.z - j.z);
      if (d > j.r) continue;
      const onRing = f.roads.some((r) => r.kind === "ring" && segDist(p.x, p.z, r.ax, r.az, r.bx, r.bz) < 1.7 - 1.05);
      const onSpoke = f.roads.some((r) => r.kind === "spoke" && segDist(p.x, p.z, r.ax, r.az, r.bx, r.bz) < 1.4 - 1.05);
      assert.ok(onRing || onSpoke || d + 1.05 <= j.r, `the cart leaves the paving ${d.toFixed(1)} m from a junction`);
    }
  }
});

function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
