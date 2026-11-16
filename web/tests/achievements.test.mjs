import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const totals = { books: 265, groves: 20, exhibits: 9 };
const groves = Array.from({ length: 20 }, (_, i) => `g${i}`);

test("each track climbs bronze, silver, gold at its thresholds", () => {
  const { tracks } = require(`${process.env.FOREST_TEST_BUILD}/achievements.js`);
  const ring = { stops: [], laps: 0, seasons: [] };
  const at = (p) => Object.fromEntries(tracks({ library: [], grovesVisited: [], plaques: [], ring, ...p }, totals).map((t) => [t.id, t.tier]));
  assert.deepEqual(at({}), { ring: 0, explorer: 0, reader: 0, curator: 0 });
  assert.equal(at({ grovesVisited: groves.slice(0, 4) }).explorer, 1);
  assert.equal(at({ grovesVisited: groves.slice(0, 10) }).explorer, 2);
  assert.equal(at({ grovesVisited: groves }).explorer, 3);
  assert.equal(at({ library: ["a", "b", "c"] }).reader, 1);
  assert.equal(at({ plaques: ["mysterium", "flame", "dna", "helix", "mast", "sundial"] }).curator, 2);
  assert.equal(at({ ring: { stops: [], laps: 1, seasons: ["summer"] } }).ring, 1);
  assert.equal(at({ ring: { stops: [], laps: 3, seasons: ["summer"] } }).ring, 2);
  assert.equal(at({ ring: { stops: [], laps: 4, seasons: ["summer", "autumn", "winter", "spring"] } }).ring, 3);
});

test("a lap counts only once every grove is stopped at, across rides broken off", () => {
  const { finishLap, ringStop, readRing, startRide, tracks, gained } = require(`${process.env.FOREST_TEST_BUILD}/achievements.js`);
  let ring = readRing(undefined);
  for (const g of groves.slice(0, 12)) ring = ringStop(ring, g);
  // Home early: not a lap, and the stops are kept for the next ride.
  let r = finishLap(ring, groves, "winter");
  assert.equal(r.counted, false);
  assert.equal(r.ring.stops.length, 12);
  // A reload, a new ride: it picks up where it left off.
  ring = readRing(JSON.parse(JSON.stringify(ring)));
  for (const g of groves) ring = ringStop(ring, g);
  assert.equal(ring.stops.length, 20, "a grove stopped at twice counts once");
  const before = tracks({ library: [], grovesVisited: [], plaques: [], ring }, totals);
  r = finishLap(ring, groves, "winter");
  assert.equal(r.counted, true);
  assert.deepEqual({ ...r.ring, stops: r.ring.stops.length }, { stops: 20, laps: 1, seasons: ["winter"], lapDone: true });
  // Home again without riding: not a second lap. The next ride starts dark.
  assert.equal(finishLap(r.ring, groves, "winter").counted, false);
  assert.deepEqual(startRide(r.ring), { stops: [], laps: 1, seasons: ["winter"], lapDone: false });
  assert.equal(startRide(ring), ring, "a ride under way keeps its stops");
  const after = tracks({ library: [], grovesVisited: [], plaques: [], ring: r.ring }, totals);
  assert.deepEqual(gained(before, after), [{ title: "Wayfarer", tier: 1 }]);
});

test("a damaged save reads as no ring progress", () => {
  const { readRing } = require(`${process.env.FOREST_TEST_BUILD}/achievements.js`);
  assert.deepEqual(readRing({ stops: "x", laps: -3, seasons: [1, "winter", "winter"] }), { stops: [], laps: 0, seasons: ["winter"], lapDone: false });
});
