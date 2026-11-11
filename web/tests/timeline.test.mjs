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
