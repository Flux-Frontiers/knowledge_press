import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { catalogEntries } from "../scripts/export-catalog.mjs";
const require = createRequire(import.meta.url);

test("the exported catalog carries slug, genre and book for every tree, slugs unique", () => {
  const { BOOKS } = require(`${process.env.FOREST_TEST_BUILD}/catalog.js`);
  const entries = catalogEntries(BOOKS);
  assert.equal(entries.length, BOOKS.length);
  assert.deepEqual(Object.keys(entries[0]).sort(), ["book", "genre", "slug"]);
  for (const e of entries) {
    assert.ok(e.slug && e.genre && e.book, `incomplete entry ${JSON.stringify(e)}`);
  }
  assert.equal(new Set(entries.map((e) => e.slug)).size, entries.length);
});
