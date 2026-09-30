import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const build = process.env.FOREST_TEST_BUILD;
const sky = () => require(`${build}/sky.js`);
const stars = () => require(`${build}/stars.js`);
const cat = () => require(`${build}/starCatalog.js`);
const DEG = Math.PI / 180;
const NYC = { lat: 40.71, lon: -74.01 };

const star = (name) => {
  const { STAR_DATA, NAMED_STARS } = cat();
  const i = NAMED_STARS[name] * 4;
  return { ra: STAR_DATA[i], dec: STAR_DATA[i + 1], mag: STAR_DATA[i + 2] };
};
const where = (name, at, place) => {
  const { equatorialToWorld } = sky();
  const { equatorialVector, applyMatrix } = stars();
  const s = star(name);
  return applyMatrix(equatorialToWorld(at, place), equatorialVector(s.ra, s.dec));
};
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / DEG;

test("the catalog holds the naked-eye sky and its brightest stars are where they should be", () => {
  const { STAR_DATA, NAMED_STARS } = cat();
  assert.ok(STAR_DATA.length % 4 === 0 && STAR_DATA.length / 4 > 4500);
  assert.ok(STAR_DATA.every(Number.isFinite));
  for (let i = 0; i < STAR_DATA.length; i += 4) {
    assert.ok(STAR_DATA[i] >= 0 && STAR_DATA[i] < 360 && Math.abs(STAR_DATA[i + 1]) <= 90 && STAR_DATA[i + 2] <= 6.0);
  }
  // Sirius: RA 6h45m, Dec -16.7, the brightest star in the sky.
  const sirius = star("Sirius");
  assert.ok(Math.abs(sirius.ra - 101.29) < 0.05 && Math.abs(sirius.dec + 16.72) < 0.05 && sirius.mag < -1.4);
  const brighter = Array.from({ length: STAR_DATA.length / 4 }, (_, i) => STAR_DATA[i * 4 + 2]).filter((m) => m < sirius.mag);
  assert.equal(brighter.length, 0);
  assert.equal(Object.keys(NAMED_STARS).length, 17);
});

test("the matrix is a rotation", () => {
  const { equatorialToWorld } = sky();
  const m = equatorialToWorld(new Date("2026-09-29T02:00:00Z"), NYC);
  for (let r = 0; r < 3; r++) {
    assert.ok(Math.abs(Math.hypot(m[r * 3], m[r * 3 + 1], m[r * 3 + 2]) - 1) < 1e-9);
    for (let q = r + 1; q < 3; q++) {
      assert.ok(Math.abs(m[r * 3] * m[q * 3] + m[r * 3 + 1] * m[q * 3 + 1] + m[r * 3 + 2] * m[q * 3 + 2]) < 1e-9);
    }
  }
  const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  assert.ok(Math.abs(det - 1) < 1e-9, `determinant ${det}, a reflection would be -1`);
});

test("Polaris stands as high as the latitude, due north, at any hour", () => {
  for (const hour of [0, 5, 11, 17, 22]) {
    const d = where("Polaris", new Date(`2026-09-29T${String(hour).padStart(2, "0")}:00:00Z`), NYC);
    const alt = Math.asin(d[1]) / DEG;
    // Polaris is about 0.7 degrees from the pole in 2026.
    assert.ok(Math.abs(alt - NYC.lat) < 1.0, `hour ${hour}: ${alt.toFixed(2)} deg`);
    // North is -z in the forest, and Polaris barely leaves it.
    assert.ok(d[2] < 0 && Math.abs(d[0]) < 0.08, `hour ${hour}: x ${d[0].toFixed(3)} z ${d[2].toFixed(3)}`);
  }
});

test("the stars turn the way the sun does: the sun stands on Regulus in late August", () => {
  const { sunPosition, bodyDirection } = sky();
  // The sun crosses Leo's Regulus, on the ecliptic, around 23 August. If the
  // matrix were mirrored, off by an hour angle or by the latitude, they would be far apart.
  const at = new Date("2026-08-23T16:00:00Z");
  const sun = bodyDirection(sunPosition(at, NYC));
  const regulus = where("Regulus", at, NYC);
  assert.ok(angle(sun, regulus) < 1.5, `${angle(sun, regulus).toFixed(2)} deg apart`);
  // And on the opposite side of the year it is nowhere near.
  const feb = new Date("2026-02-23T16:00:00Z");
  assert.ok(angle(bodyDirection(sunPosition(feb, NYC)), where("Regulus", feb, NYC)) > 90);
});

test("Vega crosses the meridian at 90 - |latitude - declination|, and Orion rises in the east", () => {
  const vega = star("Vega");
  let best = 0;
  for (let m = 0; m < 24 * 60; m += 2) {
    best = Math.max(best, where("Vega", new Date(Date.UTC(2026, 6, 15) + m * 60000), NYC)[1]);
  }
  const expected = 90 - Math.abs(NYC.lat - vega.dec);
  assert.ok(Math.abs(Math.asin(best) / DEG - expected) < 0.3, `${(Math.asin(best) / DEG).toFixed(2)} vs ${expected.toFixed(2)}`);
  // Betelgeuse, just risen on a December evening, stands in the east (+x).
  let rising = null;
  for (let m = 0; m < 24 * 60 && !rising; m += 5) {
    const d = where("Betelgeuse", new Date(Date.UTC(2026, 11, 15) + m * 60000), NYC);
    if (d[1] > 0.02) rising = d;
  }
  assert.ok(rising[0] > 0.5, `x ${rising[0].toFixed(2)}`);
});

test("precession moves the J2000 pole about 0.15 degrees off the pole of 2026", () => {
  const { equatorialToWorld } = sky();
  const { applyMatrix } = stars();
  // The pole moves 20 arcseconds a year, so 26.7 years since J2000 is 0.149 degrees.
  // The pole of date stands due north at the latitude: (0, sin lat, -cos lat).
  const j2000Pole = applyMatrix(equatorialToWorld(new Date("2026-09-29T12:00:00Z"), NYC), [0, 0, 1]);
  const ofDate = [0, Math.sin(NYC.lat * DEG), -Math.cos(NYC.lat * DEG)];
  const off = angle(j2000Pole, ofDate);
  assert.ok(off > 0.13 && off < 0.17, `${off.toFixed(3)} deg`);
});

test("star colors run from blue-white to orange", () => {
  const { starColor } = stars();
  const hot = starColor(-0.3), sun = starColor(0.65), cool = starColor(1.8);
  assert.ok(hot[2] > hot[0] && cool[0] > cool[2]);
  assert.ok(sun[0] >= sun[2]);
  assert.deepEqual(starColor(-5), starColor(-0.3));
  assert.deepEqual(starColor(9), starColor(2));
});
