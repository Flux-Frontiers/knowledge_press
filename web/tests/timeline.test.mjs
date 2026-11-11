import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { bookShown, timelineStops, yearLabel } = require(`${process.env.FOREST_TEST_BUILD}/timeline.js`);

test("one stop per distinct year, earliest first, with running totals", () => {
  const stops = timelineStops([
    { year: 1859, genre: "science", chunks: 10 },
    { year: -750, genre: "classics", chunks: 5 },
    { year: 1859, genre: "fiction", chunks: 2 },
    { genre: "misc", chunks: 1 },
  ]);
  assert.deepEqual(stops, [
    { year: -750, added: 2, books: 2, groves: 2, chunks: 6 },
    { year: 1859, added: 2, books: 4, groves: 4, chunks: 18 },
  ]);
});

test("a tree stands once its year has come, and always with the timeline off or no year", () => {
  assert.equal(bookShown({ year: 1900 }, 1899), false);
  assert.equal(bookShown({ year: 1900 }, 1900), true);
  assert.equal(bookShown({ year: 1900 }, null), true);
  assert.equal(bookShown({}, -5000), true);
});

test("years read as BC, AD or plain", () => {
  assert.equal(yearLabel(-1000), "1000 BC");
  assert.equal(yearLabel(632), "AD 632");
  assert.equal(yearLabel(1859), "1859");
});

test("the real catalog dates every book and ends with the whole forest", () => {
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  const stops = timelineStops(BOOKS);
  assert.ok(BOOKS.every((b) => Number.isInteger(b.year)), "a book without a year");
  assert.equal(stops.at(-1).books, BOOKS.length);
  assert.ok(stops[0].year < 0, "the earliest work is BC");
});

test("an exhibit's year is a stop of its own, carrying the totals so far", () => {
  const stops = timelineStops(
    [{ year: 1850, genre: "a", chunks: 3 }, { year: 1900, genre: "b", chunks: 4 }],
    [{ year: 1900, label: "Rotor" }, { year: 1964, label: "Flame" }, { label: "Mast" }],
  );
  assert.deepEqual(stops, [
    { year: 1850, added: 1, books: 1, groves: 1, chunks: 3 },
    { year: 1900, added: 1, books: 2, groves: 2, chunks: 7, exhibits: ["Rotor"] },
    { year: 1964, added: 0, books: 2, groves: 2, chunks: 7, exhibits: ["Flame"] },
  ]);
});

test("the redwood grows from the books the timeline shows, and exhibits wait for their year", () => {
  globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };
  const { getForest, corpusTreeAt } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { sim, teleportSim, stepVehicle } = require(`${process.env.FOREST_TEST_BUILD}/sim.js`);
  const f = getForest();
  assert.equal(corpusTreeAt(f, null), f.corpusTree);
  const year = timelineStops(f.trees.map((t) => t.book))[5].year;
  const shown = f.trees.filter((t) => bookShown(t.book, year));
  const c = corpusTreeAt(f, year);
  assert.equal(c.limbs, shown.length);
  assert.ok(c.height < f.corpusTree.height);
  const flame = f.exhibits.find((e) => e.id === "flame");
  assert.equal(flame.year, 1964);
  // Drive at the flame's plinth: in 1963 nothing is there; in 1964 it stops the cart.
  const reach = (y) => {
    teleportSim(flame.x + 6, flame.z, Math.PI / 2);
    let closest = Infinity;
    for (let i = 0; i < 90; i++) {
      stepVehicle(f, 1, 0, false, 1 / 30, { year: y });
      closest = Math.min(closest, Math.hypot(sim.x - flame.x, sim.z - flame.z));
    }
    return closest;
  };
  assert.ok(reach(1963) < flame.obstacle, "drives through before 1964");
  assert.ok(reach(1964) >= flame.obstacle + 1, "stopped by the plinth in 1964");
});
