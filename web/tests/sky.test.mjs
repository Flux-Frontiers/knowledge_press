import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sky = () => require(`${process.env.FOREST_TEST_BUILD}/sky.js`);
const DEG = Math.PI / 180;
const NYC = { lat: 40.71, lon: -74.01 };

test("the noon sun stands 90 - latitude +/- the tilt at the solstices", () => {
  const { sunPosition } = sky();
  // Solar noon in New York is about 16:57 UTC in June and 16:54 UTC in December.
  const june = sunPosition(new Date("2026-06-21T16:57:00Z"), NYC).altitude / DEG;
  const dec = sunPosition(new Date("2026-12-21T16:54:00Z"), NYC).altitude / DEG;
  assert.ok(Math.abs(june - (90 - 40.71 + 23.44)) < 0.5, `June noon ${june.toFixed(2)} deg`);
  assert.ok(Math.abs(dec - (90 - 40.71 - 23.44)) < 0.5, `December noon ${dec.toFixed(2)} deg`);
});

test("sunrise and sunset land on the almanac's minute", () => {
  const { nextSunEvent } = sky();
  // New York, 21 June 2026: sunrise 05:25 EDT (09:25 UTC), sunset 20:31 EDT (00:31 UTC).
  const rise = nextSunEvent(new Date("2026-06-21T04:00:00Z"), NYC);
  const set = nextSunEvent(new Date("2026-06-21T12:00:00Z"), NYC);
  assert.equal(rise.kind, "sunrise");
  assert.equal(set.kind, "sunset");
  const min = (d, iso) => Math.abs(d.valueOf() - new Date(iso).valueOf()) / 60000;
  assert.ok(min(rise.at, "2026-06-21T09:25:00Z") < 4, `sunrise ${rise.at.toISOString()}`);
  assert.ok(min(set.at, "2026-06-22T00:31:00Z") < 4, `sunset ${set.at.toISOString()}`);
});

test("moon phase: full and new on the dates they happened", () => {
  const { moonIllumination, moonPhaseName } = sky();
  const full = moonIllumination(new Date("2024-01-25T17:54:00Z"));
  const nu = moonIllumination(new Date("2024-01-11T11:57:00Z"));
  assert.ok(full.fraction > 0.99, `full ${full.fraction}`);
  assert.ok(nu.fraction < 0.01, `new ${nu.fraction}`);
  assert.equal(moonPhaseName(full.phase), "Full moon");
  assert.equal(moonPhaseName(nu.phase), "New moon");
  assert.equal(moonPhaseName(moonIllumination(new Date("2024-01-18T12:00:00Z")).phase), "First quarter");
});

test("the drawn moon's phase comes out of where the sun and moon stand", () => {
  // The sky shader lights the moon's disc from sunDir, so the angle between the
  // two directions must give the almanac's lit fraction: (1 - cos elongation) / 2.
  const { skyState } = sky();
  for (const iso of ["2024-01-14T22:00:00Z", "2024-01-18T23:00:00Z", "2024-01-22T03:00:00Z", "2024-01-25T23:00:00Z"]) {
    const s = skyState(new Date(iso), NYC);
    const cos = s.sunDir[0] * s.moonDir[0] + s.sunDir[1] * s.moonDir[1] + s.sunDir[2] * s.moonDir[2];
    assert.ok(Math.abs((1 - cos) / 2 - s.moonFraction) < 0.03, `${iso}: ${((1 - cos) / 2).toFixed(3)} vs ${s.moonFraction.toFixed(3)}`);
  }
});

test("day and night pin the sky: noon sun up high, night sun well down", () => {
  const { effectiveTime, skyState, sunPosition } = sky();
  const now = new Date("2026-09-25T15:00:00Z");
  const day = effectiveTime("day", now, NYC);
  const night = effectiveTime("night", now, NYC);
  assert.ok(sunPosition(day, NYC).altitude / DEG > 45, "noon sun");
  assert.ok(sunPosition(night, NYC).altitude / DEG < -12, "night sun");
  assert.equal(skyState(day, NYC).daylight, 1);
  assert.equal(skyState(night, NYC).daylight, 0);
  assert.equal(effectiveTime("live", now, NYC), now);
});

test("dawn and dusk pin the sky low in the east and west, glowing", () => {
  const { effectiveTime, skyState, sunPosition } = sky();
  const now = new Date("2026-09-25T15:00:00Z");
  const noon = effectiveTime("day", now, NYC);
  for (const [mode, before] of [["dawn", true], ["dusk", false]]) {
    const at = effectiveTime(mode, now, NYC);
    const sun = sunPosition(at, NYC);
    assert.ok(Math.abs(sun.altitude / DEG - 4) < 0.5, `${mode} altitude ${sun.altitude / DEG}`);
    assert.equal(at < noon, before, `${mode} is on the right side of noon`);
    // SunCalc azimuth is from south, positive west: dawn in the east, dusk in the west.
    assert.equal(sun.azimuth > 0, !before, `${mode} azimuth ${sun.azimuth / DEG}`);
    const s = skyState(at, NYC);
    assert.ok(s.warmth > 0.8, `${mode} warmth ${s.warmth}`);
    assert.ok(s.daylight > 0.7 && s.daylight < 1, `${mode} daylight ${s.daylight}`);
  }
});

test("light hands over from sun to moon through twilight without a jump", () => {
  const { skyState } = sky();
  let prev = null;
  // Sunset in New York on 25 January 2024, the night of a full moon, minute by minute.
  for (let t = Date.parse("2024-01-25T21:30:00Z"); t < Date.parse("2024-01-26T00:30:00Z"); t += 60000) {
    const i = skyState(new Date(t), NYC).light.intensity;
    if (prev !== null) assert.ok(Math.abs(i - prev) < 0.12, `light jumps ${prev.toFixed(3)} -> ${i.toFixed(3)} at ${new Date(t).toISOString()}`);
    prev = i;
  }
  assert.ok(prev > 0.3, "the full moon lights the night");
});

test("only a sun well above the horizon casts shadows", () => {
  const { skyState } = sky();
  const at = (iso) => skyState(new Date(iso), NYC).light;
  assert.equal(at("2026-06-21T16:57:00Z").shadow, 1, "noon");
  // New York, 21 June 2026: sunset 00:31 UTC, so the sun is about 1 deg up at 00:20.
  assert.equal(at("2026-06-22T00:20:00Z").shadow, 0, "sun on the horizon");
  assert.equal(at("2024-01-26T04:00:00Z").shadow, 0, "under a full moon");
  assert.ok(at("2026-06-21T23:45:00Z").shadow > 0, "evening sun still casts");
});
