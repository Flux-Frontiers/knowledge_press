import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { ambienceMix, callsNow, solarHour } = require(`${process.env.FOREST_TEST_BUILD}/ambience.js`);

test("summer nights are crickets and frogs, summer days are birds", () => {
  const night = ambienceMix(0, 0, "summer");
  assert.equal(night.crickets, 1);
  assert.equal(night.frogs, 1);
  assert.equal(night.birds, 0);
  const noon = ambienceMix(1, 0, "summer");
  assert.equal(noon.crickets, 0);
  assert.ok(noon.birds > 0.8);
});

test("winter nights have no insects or frogs, and the wind is up", () => {
  const m = ambienceMix(0, 0, "winter");
  assert.equal(m.crickets, 0);
  assert.equal(m.frogs, 0);
  assert.ok(m.wind > ambienceMix(0, 0, "summer").wind);
});

test("the dawn chorus comes with a morning sky and gives way to day birds", () => {
  const sunrise = ambienceMix(0.4, 1, "spring");
  const afternoon = ambienceMix(1, 0, "spring");
  assert.ok(sunrise.dawn > 0.9);
  assert.equal(afternoon.dawn, 0);
  assert.ok(sunrise.birds < afternoon.birds);
});

test("every weight stays between 0 and 1", () => {
  for (const season of ["spring", "summer", "autumn", "winter"]) {
    for (let d = 0; d <= 1; d += 0.1) {
      for (const v of Object.values(ambienceMix(d, 1 - d, season))) assert.ok(v >= 0 && v <= 1);
    }
  }
});

test("owls call at night, woodpeckers on days outside winter", () => {
  assert.deepEqual(callsNow(0, "summer"), { owl: true, woodpecker: false });
  assert.deepEqual(callsNow(1, "summer"), { owl: false, woodpecker: true });
  assert.deepEqual(callsNow(1, "winter"), { owl: false, woodpecker: false });
});

test("with wind and cart motion off, the wind is silent and nothing else changes", () => {
  const on = ambienceMix(0, 0, "winter");
  const off = ambienceMix(0, 0, "winter", false);
  assert.equal(off.wind, 0);
  assert.deepEqual({ ...off, wind: on.wind }, on);
});

test("birds go quiet around midday and come back for the afternoon", () => {
  const at = (h) => ambienceMix(1, 0, "spring", true, h).birds;
  assert.ok(at(13) < 0.5 * at(9));
  assert.ok(at(17) > 0.95 * at(9));
  assert.equal(ambienceMix(1, 0, "spring", true, 13).dawn, ambienceMix(1, 0, "spring", true, 9).dawn);
});

test("solar time follows the longitude, a day around", () => {
  const noonUtc = Date.UTC(2026, 5, 21, 12, 0);
  assert.equal(solarHour(noonUtc, 0), 12);
  assert.equal(solarHour(noonUtc, -120), 4);
  assert.equal(solarHour(noonUtc, 180), 0);
});
