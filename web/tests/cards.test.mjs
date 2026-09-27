import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("a book card pops up only when the cart slows within reading range", () => {
  globalThis.window ??= { localStorage: { getItem: () => null, setItem: () => {} } };
  const { useGame } = require(`${process.env.FOREST_TEST_BUILD}/store.js`);
  const st = () => useGame.getState();
  // Driving past a roadside tree at speed: no card.
  st().setNearby("hamlet", 3, 4.5);
  assert.equal(st().cardSlug, null);
  // Slowing beside it: card.
  st().setNearby("hamlet", 3, 0.5);
  assert.equal(st().cardSlug, "hamlet");
  // Pulling away keeps it while in range, drops it once out of range.
  st().setNearby("hamlet", 5, 4);
  assert.equal(st().cardSlug, "hamlet");
  st().setNearby("hamlet", 7, 4);
  assert.equal(st().cardSlug, null);
  // A new nearest tree reached at speed replaces nothing.
  st().setNearby("hamlet", 3, 0);
  st().setNearby("macbeth", 3, 4);
  assert.equal(st().cardSlug, null);
});

test("a picked tree stays pinned until dismissed", () => {
  const { useGame } = require(`${process.env.FOREST_TEST_BUILD}/store.js`);
  const st = () => useGame.getState();
  st().setNearby("hamlet", 3, 0);
  st().pinTree("lear");
  st().dismissNearby();
  assert.equal(st().pinnedSlug, null);
  assert.equal(st().nearbyDismissed, null, "the first dismiss only clears the pin");
  st().dismissNearby();
  assert.equal(st().nearbyDismissed, "hamlet");
});

test("pickTree returns the first tree along the ray", () => {
  const { pickTree } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const tree = (slug, x, z) => ({ book: { slug }, x, z, height: 10, trunkRadius: 0.3 });
  const forest = { trees: [tree("far", 0, -30), tree("near", 0, -15), tree("aside", 12, -15)] };
  const eye = { x: 0, y: 1.6, z: 0 };
  assert.equal(pickTree(forest, eye, { x: 0, y: 0, z: -1 }, 200).book.slug, "near");
  assert.equal(pickTree(forest, eye, { x: 0, y: 0, z: -1 }, 10), null, "past maxDist");
  assert.equal(pickTree(forest, eye, { x: 0, y: 1, z: 0 }, 200), null, "straight up");
  assert.equal(pickTree(forest, eye, { x: 12, y: 0, z: -15 }, 200).book.slug, "aside");
  // Standing under a crown doesn't make every click hit it.
  const under = { x: 1.5, y: 1.6, z: -15 };
  assert.equal(pickTree(forest, under, { x: -1.5, y: 0, z: -15 }, 200).book.slug, "far");
});

test("fog level reads back from saved preferences", () => {
  const { readPreferences, FOG_SCALE } = require(`${process.env.FOREST_TEST_BUILD}/preferences.js`);
  assert.equal(readPreferences({}).fog, "normal");
  assert.equal(readPreferences({ fog: "heavy" }).fog, "heavy");
  assert.equal(readPreferences({ fog: "soup" }).fog, "normal");
  assert.ok(FOG_SCALE.clear < FOG_SCALE.normal && FOG_SCALE.normal < FOG_SCALE.heavy);
});

test("reading a book twice says it is already in the press", () => {
  const { useGame } = require(`${process.env.FOREST_TEST_BUILD}/store.js`);
  const st = () => useGame.getState();
  st().collect("othello", "Othello");
  assert.equal(st().toast, "Pressed · Othello");
  assert.ok(st().library.includes("othello"));
  st().collect("othello", "Othello");
  assert.equal(st().toast, "Already in your press · Othello");
  assert.equal(st().library.filter((s) => s === "othello").length, 1);
});
