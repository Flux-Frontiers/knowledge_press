import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

globalThis.window = { localStorage: { getItem: () => null, setItem: () => {} } };
const { freshlyDone, questProgress } = require(`${process.env.FOREST_TEST_BUILD}/quests.js`);

test("switching to winter with a book pressed is a quest freshly done, and stays done back in autumn", () => {
  const before = { library: ["hamlet"], grovesVisited: [], season: "autumn" };
  const seen = new Set(freshlyDone(new Set(), before).map((q) => q.id));
  assert.deepEqual([...seen], ["hamlet"]);
  const after = { ...before, season: "winter" };
  assert.deepEqual(freshlyDone(seen, after).map((q) => q.title), ["Bare wood"]);
  seen.add("winter");
  assert.deepEqual(freshlyDone(seen, after), []);
  // Back to autumn, a quest once done stays counted.
  assert.equal(questProgress(before).done, 1);
  assert.equal(questProgress(before, ["hamlet", "winter"]).done, 2);
  assert.equal(questProgress(after).done, 2);
});

test("done quests are saved and survive a reload", () => {
  let save = null;
  globalThis.window = { localStorage: { getItem: () => save, setItem: (_, v) => { save = v; } } };
  const path = `${process.env.FOREST_TEST_BUILD}/store.js`;
  delete require.cache[require.resolve(path)];
  const { useGame } = require(path);
  useGame.getState().markQuests(["winter"]);
  useGame.getState().markQuests(["winter", "hamlet"]);
  assert.deepEqual(JSON.parse(save).quests, ["winter", "hamlet"]);
  delete require.cache[require.resolve(path)];
  assert.deepEqual(require(path).useGame.getState().quests, ["winter", "hamlet"]);
});

test("reset all settings starts the quests over from what the press still meets", () => {
  let save = null;
  globalThis.window = { localStorage: { getItem: () => save, setItem: (_, v) => { save = v; } } };
  const path = `${process.env.FOREST_TEST_BUILD}/store.js`;
  delete require.cache[require.resolve(path)];
  const { useGame } = require(path);
  useGame.setState({ library: ["hamlet"] });
  useGame.getState().markQuests(["hamlet", "winter"]);
  useGame.getState().resetSettings();
  const kept = useGame.getState().quests;
  assert.ok(kept.includes("hamlet"), "met by the press");
  assert.equal(kept.includes("winter"), useGame.getState().season === "winter");
  assert.deepEqual(JSON.parse(save).quests, kept);
});

test("reset all settings puts every setting back and keeps progress", () => {
  let save = null;
  globalThis.window = { localStorage: { getItem: () => save, setItem: (_, v) => { save = v; }, removeItem: () => {} } };
  const path = `${process.env.FOREST_TEST_BUILD}/store.js`;
  delete require.cache[require.resolve(path)];
  const { useGame } = require(path);
  const st = () => useGame.getState();
  const fresh = st().preferences;
  useGame.setState({ library: ["hamlet"], grovesVisited: ["drama"] });
  st().setPreferences({ pace: "brisk", fog: "heavy", silent: true, camera: "god", readingAt: { hamlet: [3, 12] }, mootWorker: "https://w.example" });
  st().setSeason("winter");
  st().setTimeMode("night");
  st().dismissQuestHint("stoic");
  st().toggleCleanView();
  st().setTimeline(1850, true);
  st().resetSettings();
  assert.deepEqual({ ...st().preferences, readingAt: {} }, { ...fresh, readingAt: {} });
  assert.deepEqual(st().preferences.readingAt, { hamlet: [3, 12] });
  assert.equal(st().groundCamera, "follow");
  assert.equal(st().timeMode, "live");
  assert.equal(st().questHintHidden, null);
  assert.equal(st().cleanView, false);
  assert.equal(st().timelineYear, null);
  assert.deepEqual(st().library, ["hamlet"]);
  assert.deepEqual(st().grovesVisited, ["drama"]);
  const saved = JSON.parse(save);
  assert.equal(saved.preferences.pace, "gentle");
  assert.deepEqual(saved.library, ["hamlet"]);
});
