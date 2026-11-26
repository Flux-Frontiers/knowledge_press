import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { excerpt, isMarked, toggleMark } = require(`${process.env.FOREST_TEST_BUILD}/bookmarks.js`);
const { readPreferences } = require(`${process.env.FOREST_TEST_BUILD}/preferences.js`);

test("a bookmark toggles on and off and the list stays in reading order", () => {
  let marks = toggleMark([], 3, 9);
  marks = toggleMark(marks, 1, 4);
  marks = toggleMark(marks, 3, 2);
  assert.deepEqual(marks, [[1, 4], [3, 2], [3, 9]]);
  assert.ok(isMarked(marks, 3, 2));
  marks = toggleMark(marks, 3, 2);
  assert.deepEqual(marks, [[1, 4], [3, 9]]);
  assert.ok(!isMarked(marks, 3, 2));
});

test("an excerpt is cut at a word", () => {
  const block = { kind: "prose", spoken: "", runs: [{ text: "Call me\n Ishmael. " }, { text: "Some years ago, never mind how long precisely" }] };
  assert.equal(excerpt(block, 200), "Call me Ishmael. Some years ago, never mind how long precisely");
  assert.equal(excerpt(block, 20), "Call me Ishmael....");
  assert.equal(excerpt(undefined), "");
});

test("stored bookmarks keep whole-number pairs and drop the rest", () => {
  const p = readPreferences({ bookmarks: { moby: [[1, 2], [1.5, 2], "x", [3, -1], [4, 0]], bad: "x", empty: [] } });
  assert.deepEqual(p.bookmarks, { moby: [[1, 2], [4, 0]] });
  assert.deepEqual(readPreferences(undefined).bookmarks, {});
});
