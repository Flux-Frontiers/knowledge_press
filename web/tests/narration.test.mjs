import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };

test("authors and titles are spoken without the catalog's disambiguators", () => {
  const { spokenAuthor, spokenTitle } = require(`${process.env.FOREST_TEST_BUILD}/narration.js`);
  assert.equal(spokenAuthor("H. P. (Howard Phillips) Lovecraft"), "H. P. Lovecraft");
  assert.equal(spokenAuthor("George Gordon Byron, Baron Byron"), "George Gordon Byron");
  assert.equal(spokenAuthor("Leo, graf Tolstoy"), "Leo Tolstoy");
  assert.equal(spokenAuthor("Unknown"), null);
  assert.equal(spokenTitle("Confessions — Saint Augustine", "of Hippo, Saint Augustine"), "Confessions");
  assert.equal(spokenTitle("Bleak House (Dickens)", "Charles Dickens"), "Bleak House");
  assert.equal(spokenTitle("The Diary of Samuel Pepys — Complete", "Samuel Pepys"), "The Diary of Samuel Pepys");
  assert.equal(spokenTitle("The Portrait of a Lady — Volume 1", "Henry James"), "The Portrait of a Lady, Volume 1");
  assert.equal(spokenTitle("The Divine Comedy (Cary's Translation)", "Dante Alighieri"), "The Divine Comedy (Cary's Translation)");
  assert.equal(spokenTitle("Etidorhpa; or, The End of Earth.", "John Uri Lloyd"), "Etidorhpa; or, The End of Earth");
});

test("every grove's narration names it, counts its books and reads cleanly", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const f = getForest();
  for (const g of f.groves) {
    const n = g.narration;
    assert.ok(n.startsWith(`${g.label}:`), `${g.genre}: ${n}`);
    assert.ok(g.bookCount === 1 ? n.includes("one book") : n.includes(`${g.bookCount} books`), `${g.genre}: ${n}`);
    assert.ok(n.endsWith("."), `${g.genre}: ${n}`);
    assert.ok(!/Unknown| — |\s\s/.test(n), `${g.genre}: ${n}`);
  }
  const diaries = f.groves.find((g) => g.genre === "diaries");
  assert.match(diaries.narration, /The entries run from \d{4} to \d{4}\./);
  // A grove with anonymous books names its authors as a sample, not as the authors.
  const sacred = f.groves.find((g) => g.genre === "sacred-texts");
  assert.match(sacred.narration, /including work by/);
});

test("the tour holds at a grove for the dwell and for as long as the narration runs", () => {
  const { getForest } = require(`${process.env.FOREST_TEST_BUILD}/forest.js`);
  const { sim, teleportSim, stepVehicle } = require(`${process.env.FOREST_TEST_BUILD}/sim.js`);
  const { DWELL, planTour, steerTour, tourStop } = require(`${process.env.FOREST_TEST_BUILD}/tour.js`);
  const f = getForest();
  teleportSim(f.home.x, f.home.z, f.home.yaw);
  const tour = planTour(f, sim.x, sim.z, sim.yaw);
  const hz = 30;
  const tick = (busy) => {
    const c = steerTour(tour, sim.x, sim.z, sim.yaw, sim.speed, 1 / hz, busy);
    stepVehicle(f, c.throttle, c.steer, false, 1 / hz, { brake: c.brake });
  };
  // Drive to the first stop's hold.
  for (let i = 0; i < 120 * hz && tour.dwell?.phase !== "hold"; i++) tick(false);
  assert.equal(tour.dwell?.phase, "hold", "reached the first grove's hold");
  const genre = tourStop(tour);
  assert.ok(genre, "the stop names its grove");
  // Still speaking long after the dwell: the cart waits.
  for (let i = 0; i < (DWELL + 10) * hz; i++) tick(true);
  assert.equal(tour.dwell?.phase, "hold", "the hold outlasts the dwell while the narration runs");
  assert.equal(sim.speed, 0);
  // Speech done: the cart turns back and drives on to the next grove.
  for (let i = 0; i < 20 * hz && tourStop(tour) === genre; i++) tick(false);
  assert.notEqual(tourStop(tour), genre, "moved on once the narration ended");
});

test("speech does nothing where the browser has none, and narration is off by default", () => {
  const { speak, speaking, hush } = require(`${process.env.FOREST_TEST_BUILD}/speech.js`);
  speak("Hello.");
  assert.equal(speaking(), false);
  hush();
  const { readPreferences } = require(`${process.env.FOREST_TEST_BUILD}/preferences.js`);
  assert.equal(readPreferences().narrate, false);
  assert.equal(readPreferences({ narrate: true }).narrate, true);
});
