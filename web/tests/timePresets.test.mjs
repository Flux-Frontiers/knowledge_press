import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const DEG = Math.PI / 180;
const NYC = { lat: 40.71, lon: -74.01 };

test("a preset starts at its moment and runs on at real speed; a pinned one holds", () => {
  globalThis.window = { localStorage: { getItem: () => null, setItem: () => {} } };
  const { useGame } = require(`${process.env.FOREST_TEST_BUILD}/store.js`);
  const g = () => useGame.getState();
  g().setPlace(NYC);
  g().setTimeMode("dusk");
  const from = g().timeFrom;
  assert.ok(from, "dusk runs");
  assert.ok(Math.abs(g().sky.time - from.at) < 1000);
  // Half an hour on, as if picked thirty minutes ago.
  useGame.setState({ timeFrom: { at: from.at, since: from.since - 30 * 60000 } });
  g().tickSky();
  assert.ok(Math.abs(g().sky.time - (from.at + 30 * 60000)) < 1000, "the clock ran on");
  g().setTimeMode("night", true);
  assert.equal(g().timeFrom, null);
  const pinned = g().sky.time;
  g().tickSky();
  assert.equal(g().sky.time, pinned, "a pinned preset holds");
  g().setTimeMode("live");
  assert.equal(g().timeFrom, null);
  // The menu's cycle runs too.
  g().toggleTimeOfDay();
  assert.equal(g().timeMode, "dawn");
  assert.ok(g().timeFrom);
});

test("the evening sky is the sun going down, not coming up", () => {
  const { effectiveTime, skyState } = require(`${process.env.FOREST_TEST_BUILD}/sky.js`);
  const now = new Date("2026-09-25T15:00:00Z");
  const dusk = skyState(effectiveTime("dusk", now, NYC), NYC);
  const dawn = skyState(effectiveTime("dawn", now, NYC), NYC);
  const noon = skyState(effectiveTime("day", now, NYC), NYC);
  assert.ok(dusk.evening > 0.9, `dusk evening ${dusk.evening}`);
  assert.equal(dusk.morning, 0);
  assert.equal(dawn.evening, 0);
  assert.equal(noon.evening, 0);
});

test("dawn, day and dusk are the place's, whatever the device's time zone", () => {
  const { effectiveTime, skyState } = require(`${process.env.FOREST_TEST_BUILD}/sky.js`);
  const zone = process.env.TZ;
  try {
    // New York's July sunset is after midnight UTC, and its sunrise before midnight in Auckland.
    for (const tz of ["UTC", "America/New_York", "Asia/Tokyo", "Pacific/Auckland", "Pacific/Honolulu"]) {
      process.env.TZ = tz;
      const now = new Date(2026, 6, 15, 12);
      const dawn = skyState(effectiveTime("dawn", now, NYC), NYC);
      const noon = skyState(effectiveTime("day", now, NYC), NYC);
      const dusk = skyState(effectiveTime("dusk", now, NYC), NYC);
      assert.ok(dawn.morning > 0.9 && dawn.evening === 0, `${tz}: dawn morning ${dawn.morning}`);
      assert.ok(dusk.evening > 0.9 && dusk.morning === 0, `${tz}: dusk evening ${dusk.evening}`);
      assert.ok(noon.daylight === 1 && noon.time > dawn.time && noon.time < dusk.time, `${tz}: noon between them`);
      assert.ok(dusk.time - dawn.time < 24 * 3600000, `${tz}: one day`);
    }
  } finally {
    if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone;
  }
});

test("dusk sounds like dusk: insects starting, birds settling", () => {
  const { effectiveTime, skyState } = require(`${process.env.FOREST_TEST_BUILD}/sky.js`);
  delete globalThis.window; // The store test's stand-in has no events for the audio unlock.
  const { ambienceMix } = require(`${process.env.FOREST_TEST_BUILD}/ambience.js`);
  const now = new Date("2026-07-15T15:00:00Z");
  const dusk = skyState(effectiveTime("dusk", now, NYC), NYC);
  const atDusk = ambienceMix(dusk.daylight, dusk.morning, "summer", true, 19, dusk.evening);
  const afternoon = ambienceMix(1, 0, "summer", true, 17, 0);
  assert.ok(atDusk.crickets >= 0.5, `crickets ${atDusk.crickets}`);
  assert.ok(atDusk.frogs >= 0.5, `frogs ${atDusk.frogs}`);
  assert.ok(atDusk.birds < 0.4 * afternoon.birds, `birds ${atDusk.birds} vs ${afternoon.birds}`);
});
