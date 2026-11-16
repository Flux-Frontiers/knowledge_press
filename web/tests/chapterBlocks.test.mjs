import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Shared with the Swift ChapterText tests, so the two reflows stay in step.
const fixtures = "../app/GutenbergKGKit/Tests/GutenbergKGKitTests/Fixtures";
const reflowCases = JSON.parse(readFileSync(`${fixtures}/chapter_reflow.json`, "utf8"));
const blockCases = JSON.parse(readFileSync(`${fixtures}/chapter_blocks.json`, "utf8"));

test("reflow matches ChapterText.reflow on the shared fixtures", () => {
  const { reflow } = require(`${process.env.FOREST_TEST_BUILD}/chapterBlocks.js`);
  for (const c of reflowCases) assert.equal(reflow(c.input), c.expected, c.name);
});

test("chapterBlocks cuts the shared fixtures into the expected blocks", () => {
  const { chapterBlocks } = require(`${process.env.FOREST_TEST_BUILD}/chapterBlocks.js`);
  for (const c of blockCases) assert.deepEqual(chapterBlocks(c.input, c.title), c.expected, c.name);
});

test("blockLines cuts a verse block at its line breaks, splitting a run that crosses one", () => {
  const { blockLines } = require(`${process.env.FOREST_TEST_BUILD}/chapterBlocks.js`);
  const lines = blockLines([{ text: "NORA.\nNo! " }, { text: "[She bolts\nthe door.]", style: "italic" }]);
  assert.deepEqual(lines, [
    [{ text: "NORA." }],
    [{ text: "No! " }, { text: "[She bolts", style: "italic" }],
    [{ text: "the door.]", style: "italic" }],
  ]);
});
