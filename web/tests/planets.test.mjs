import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };
const build = process.env.FOREST_TEST_BUILD;
const { planetPositions } = require(`${build}/planets.js`);

// JPL Horizons, astrometric J2000 RA and Dec and apparent magnitude, geocentric, 2026-01-10 00:00 UT.
const HORIZONS = {
  Jupiter: { ra: 111.4503, dec: 22.2353, mag: -2.676 },
  Mars: { ra: 290.985, dec: -22.9887, mag: 1.005 },
  Venus: { ra: 291.9509, dec: -22.7349, mag: -3.908 },
};

/** Angle between two sky positions, degrees. */
function separation(ra1, dec1, ra2, dec2) {
  const r = Math.PI / 180;
  const c = Math.sin(dec1 * r) * Math.sin(dec2 * r) + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.cos((ra1 - ra2) * r);
  return Math.acos(Math.min(1, c)) / r;
}

test("planets stand where JPL Horizons puts them, and shine as bright", () => {
  const ps = planetPositions(new Date("2026-01-10T00:00:00Z"));
  assert.deepEqual(ps.map((p) => p.name), ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"]);
  for (const [name, want] of Object.entries(HORIZONS)) {
    const p = ps.find((q) => q.name === name);
    const off = separation(p.raDeg, p.decDeg, want.ra, want.dec);
    assert.ok(off < 0.5, `${name} is ${off.toFixed(3)} degrees off`);
    assert.ok(Math.abs(p.mag - want.mag) < 0.3, `${name} magnitude ${p.mag.toFixed(2)}, want ${want.mag}`);
    assert.ok(Math.abs(Math.hypot(...p.dir) - 1) < 1e-9, `${name} direction is a unit vector`);
  }
});
