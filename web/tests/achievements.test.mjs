import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const totals = { books: 265, groves: 20, exhibits: 9, species: 9 };
const none = { library: [], grovesVisited: [], plaques: [], nightBooks: [], moots: [], speciesPressed: 0 };
const groves = Array.from({ length: 20 }, (_, i) => `g${i}`);

test("each track climbs bronze, silver, gold at its thresholds", () => {
  const { tracks } = require(`${process.env.FOREST_TEST_BUILD}/achievements.js`);
  const ring = { stops: [], laps: 0, seasons: [] };
  const at = (p) => Object.fromEntries(tracks({ ...none, ring, ...p }, totals).map((t) => [t.id, t.tier]));
  assert.deepEqual(at({}), { ring: 0, explorer: 0, reader: 0, curator: 0, night: 0, botanist: 0, moots: 0 });
  assert.equal(at({ grovesVisited: groves.slice(0, 4) }).explorer, 1);
  assert.equal(at({ grovesVisited: groves.slice(0, 10) }).explorer, 2);
  assert.equal(at({ grovesVisited: groves }).explorer, 3);
  assert.equal(at({ library: ["a", "b", "c"] }).reader, 1);
  assert.equal(at({ plaques: ["mysterium", "flame", "dna", "helix", "mast", "sundial"] }).curator, 2);
  assert.equal(at({ ring: { stops: [], laps: 1, seasons: ["summer"] } }).ring, 1);
  assert.equal(at({ ring: { stops: [], laps: 3, seasons: ["summer"] } }).ring, 2);
  assert.equal(at({ ring: { stops: [], laps: 4, seasons: ["summer", "autumn", "winter", "spring"] } }).ring, 3);
  const books = (n) => Array.from({ length: n }, (_, i) => `b${i}`);
  assert.deepEqual([0, 1, 5, 15].map((n) => at({ nightBooks: books(n) }).night), [0, 1, 2, 3]);
  assert.deepEqual([2, 3, 6, 9].map((n) => at({ speciesPressed: n }).botanist), [0, 1, 2, 3]);
  assert.deepEqual([0, 1, 2, 5].map((n) => at({ moots: books(n) }).moots), [0, 1, 2, 3]);
});

test("Botanist's gold is every kind of tree the forest has, not every kind there is", () => {
  const { tracks } = require(`${process.env.FOREST_TEST_BUILD}/achievements.js`);
  const ring = { stops: [], laps: 0, seasons: [] };
  const botanist = tracks({ ...none, ring, speciesPressed: 4 }, { ...totals, species: 4 }).find((t) => t.id === "botanist");
  assert.equal(botanist.tier, 3);
  assert.equal(botanist.steps[2], "Press books from all 4 kinds of tree");
  assert.equal(botanist.next, "");
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
  const before = tracks({ ...none, ring }, totals);
  r = finishLap(ring, groves, "winter");
  assert.equal(r.counted, true);
  assert.deepEqual({ ...r.ring, stops: r.ring.stops.length }, { stops: 20, laps: 1, seasons: ["winter"], lapDone: true });
  // Home again without riding: not a second lap. The next ride starts dark.
  assert.equal(finishLap(r.ring, groves, "winter").counted, false);
  assert.deepEqual(startRide(r.ring), { stops: [], laps: 1, seasons: ["winter"], lapDone: false });
  assert.equal(startRide(ring), ring, "a ride under way keeps its stops");
  const after = tracks({ ...none, ring: r.ring }, totals);
  assert.deepEqual(gained(before, after), [{ title: "Wayfarer", tier: 1 }]);
});

test("a damaged save reads as no ring progress", () => {
  const { readRing } = require(`${process.env.FOREST_TEST_BUILD}/achievements.js`);
  assert.deepEqual(readRing({ stops: "x", laps: -3, seasons: [1, "winter", "winter"] }), { stops: [], laps: 0, seasons: ["winter"], lapDone: false });
});
