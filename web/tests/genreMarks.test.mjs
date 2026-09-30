import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };
const build = process.env.FOREST_TEST_BUILD;

test("every genre in the catalog has its own glyph, and no glyph is left over", () => {
  const { GLYPHS } = require(`${build}/genreMarks.js`);
  const { GENRE_ORDER } = require(`${build}/catalog.js`);
  assert.deepEqual(Object.keys(GLYPHS).sort(), [...GENRE_ORDER].sort());
});

test("glyph paths are well-formed SVG path data on the 100 grid", () => {
  const { GLYPHS, glyphFor } = require(`${build}/genreMarks.js`);
  for (const [genre, glyph] of Object.entries(GLYPHS)) {
    assert.ok(glyph.strokes.length > 0, genre);
    assert.ok(glyph.name, genre);
    for (const { d, fill } of glyph.strokes) {
      assert.match(d, /^[MLHVCSQTAZmlhvcsqtaz0-9 .,-]+$/, `${genre}: ${d}`);
      assert.match(d, /^M/, `${genre} starts with a move`);
      if (fill) assert.ok(["paper", "ink"].includes(fill), genre);
      // Every coordinate stays on the grid.
      for (const n of d.match(/-?\d+(\.\d+)?/g)) assert.ok(Math.abs(Number(n)) <= 100, `${genre}: ${n}`);
    }
  }
  assert.equal(glyphFor("no-such-genre"), GLYPHS["world-literature"]);
});
