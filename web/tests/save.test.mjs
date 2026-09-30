import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("existing collections survive preference changes and library jumps close the panel", () => {
  let save = JSON.stringify({ version: 1, library: ["hamlet"], grovesVisited: ["shakespeare"], season: "winter", timeOfDay: "night" });
  globalThis.window = { localStorage: { getItem: () => save, setItem: (_, value) => { save = value; } } };
  const { useGame } = require(`${process.env.FOREST_TEST_BUILD}/store.js`);
  assert.deepEqual(useGame.getState().library, ["hamlet"]);
  assert.equal(useGame.getState().preferences.pace, "gentle");
  useGame.getState().setPreferences({ camera: "high", sensitivity: 1.2 });
  const saved = JSON.parse(save);
  assert.deepEqual(saved.library, ["hamlet"]);
  assert.deepEqual(saved.grovesVisited, ["shakespeare"]);
  assert.equal(saved.preferences.camera, "high");
  assert.equal(saved.season, "winter");
  useGame.getState().toggleLibrary();
  useGame.getState().requestJump({ x: 1, z: 2, yaw: 0 });
  assert.equal(useGame.getState().libraryOpen, false);
});

test("leaving the ring puts the lantern trail away; a grove jump keeps it", () => {
  const { useGame } = require(`${process.env.FOREST_TEST_BUILD}/store.js`);
  const st = () => useGame.getState();
  st().toggleCircuit();
  st().selectGrove("horror");
  st().toggleCircuit(); // End tour
  assert.equal(st().selectedGrove, null);
  st().toggleCircuit();
  st().selectGrove("drama");
  st().setTravelMode("free"); // steered off the ring
  assert.equal(st().selectedGrove, null);
  st().selectGrove("letters");
  st().requestJump({ x: 0, z: 0, yaw: 0 }); // atlas jump: trail should lead there
  assert.equal(st().selectedGrove, "letters");
});

test("reset puts every setting back, forgets the tour welcome, and forgets the pressed books", () => {
  const store = new Map([["kpf-tour-heard", "1"]]);
  globalThis.window = {
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => { store.set(k, v); },
      removeItem: (k) => { store.delete(k); },
    },
  };
  const { useGame } = require(`${process.env.FOREST_TEST_BUILD}/store.js`);
  const { tourHeard } = require(`${process.env.FOREST_TEST_BUILD}/tourScript.js`);
  const st = () => useGame.getState();
  st().setPreferences({ camera: "god", narrate: true, weather: true, fog: "heavy" });
  st().setSeason("winter");
  st().toggleTimeOfDay();
  st().collect("hamlet", "Hamlet");
  assert.deepEqual(st().library, ["hamlet"]);
  assert.equal(tourHeard(), true);
  st().resetSettings();
  assert.equal(st().preferences.camera, "follow");
  assert.equal(st().preferences.narrate, false);
  assert.equal(st().preferences.weather, false);
  assert.equal(st().preferences.fog, "normal");
  assert.equal(st().season, "summer");
  assert.equal(st().timeMode, "live");
  assert.equal(tourHeard(), false);
  assert.deepEqual(st().library, []);
  assert.equal(st().lastReadSlug, null);
  const saved = JSON.parse(store.get("kpf-library-v1"));
  assert.equal(saved.season, "summer");
  assert.equal(saved.preferences.camera, "follow");
  assert.deepEqual(saved.library, []);
});
