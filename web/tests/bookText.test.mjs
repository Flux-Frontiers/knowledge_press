import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("book files decode to their chapters and reject a bad shape", () => {
  const { decodeBook, BookTextError } = require(`${process.env.FOREST_TEST_BUILD}/bookText.js`);
  const chapters = [{ title: "Act I", text: "Who's there?" }];
  assert.deepEqual(decodeBook({ chapters }), chapters);
  assert.deepEqual(decodeBook({ chapters: [] }), []);
  assert.throws(() => decodeBook(null), BookTextError);
  assert.throws(() => decodeBook({ output: { chapters } }), /no chapter list/);
  assert.throws(() => decodeBook({ chapters: [{ title: "Act I" }] }), /malformed chapter/);
});
