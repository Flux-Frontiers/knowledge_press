import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };
const build = process.env.FOREST_TEST_BUILD;
const script = () => require(`${build}/tourScript.js`);
const FACTS = { books: 253, groves: 19, exhibits: 7 };

test("the welcome fills in the forest's numbers and leaves no placeholder", () => {
  const { tourIntro } = script();
  const text = tourIntro(FACTS, false).join(" ");
  assert.match(text, /\b253 books\b/);
  assert.match(text, /\b19 groves\b/);
  assert.match(text, /\b7 exhibits\b/);
  assert.doesNotMatch(text, /[{}]/);
});

test("the first tour gets the background, later ones a line", () => {
  const { tourIntro, TOUR_WELCOME, TOUR_ABOUT, TOUR_REDWOOD, TOUR_TIPS, TOUR_WELCOME_BACK } = script();
  const first = tourIntro(FACTS, false), again = tourIntro(FACTS, true);
  assert.equal(first.length, 4);
  assert.ok(first[0] === TOUR_WELCOME && first[1].length > 100 && TOUR_REDWOOD && TOUR_TIPS && TOUR_ABOUT);
  assert.deepEqual(again, [TOUR_WELCOME_BACK]);
});

test("every line reads cleanly aloud: plain ASCII, whole sentences, no stray spaces", () => {
  const s = script();
  const lines = ["TOUR_WELCOME", "TOUR_ABOUT", "TOUR_REDWOOD", "TOUR_TIPS", "TOUR_WELCOME_BACK", "TOUR_LAP_DONE", "TOUR_FAREWELL"].map((k) => [k, s[k]]);
  for (const [name, line] of lines) {
    assert.equal(typeof line, "string", name);
    assert.match(line, /^[\x20-\x7e]+$/, `${name} has a non-ASCII character`);
    assert.match(line, /^[A-Z].*[.!?]$/, name);
    assert.doesNotMatch(line, /\s{2}|^\s|\s$/, name);
  }
});

test("the full welcome takes well under a minute to say", () => {
  const { tourIntro } = script();
  const words = tourIntro(FACTS, false).join(" ").split(/\s+/).length;
  // About 150 words a minute at the speech rate in use.
  assert.ok(words > 60 && words < 130, `${words} words`);
});

test("the welcome is only remembered once given, and a blocked store is harmless", () => {
  const { tourHeard, markTourHeard } = script();
  const store = new Map();
  globalThis.window = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
  assert.equal(tourHeard(), false);
  markTourHeard();
  assert.equal(tourHeard(), true);
  globalThis.window = { localStorage: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } } };
  assert.equal(tourHeard(), false);
  assert.doesNotThrow(() => markTourHeard());
});

test("the numbers in the welcome are the real forest's", () => {
  const { getForest } = require(`${build}/forest.js`);
  const { tourIntro } = script();
  const f = getForest();
  const text = tourIntro({ books: f.trees.length, groves: f.groves.length, exhibits: f.exhibits.length }, false).join(" ");
  assert.ok(f.trees.length === 253 && text.includes("253 books"), `${f.trees.length} trees`);
  assert.ok(text.includes(`${f.groves.length} groves`) && text.includes(`${f.exhibits.length} exhibits`));
});

test("the tour counts a lap once every grove has been visited and the ring starts over", () => {
  const { getForest } = require(`${build}/forest.js`);
  const { sim, teleportSim, stepVehicle } = require(`${build}/sim.js`);
  const { planTour, steerTour } = require(`${build}/tour.js`);
  const f = getForest();
  teleportSim(0, 0, 0);
  const tour = planTour(f, sim.x, sim.z, sim.yaw);
  assert.equal(tour.laps, 0);
  const hz = 30;
  let firstLap = -1;
  for (let i = 0; i < 2400 * hz && firstLap < 0; i++) {
    const c = steerTour(tour, sim.x, sim.z, sim.yaw, sim.speed, 1 / hz);
    stepVehicle(f, c.throttle, c.steer, false, 1 / hz, { brake: c.brake });
    if (tour.laps > 0) firstLap = i / hz;
  }
  assert.ok(firstLap > 0, "no lap in 40 minutes");
  assert.equal(tour.next, 0);
});
