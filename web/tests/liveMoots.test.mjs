import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const live = () => require(`${process.env.FOREST_TEST_BUILD}/liveMoots.js`);
const prefs = () => require(`${process.env.FOREST_TEST_BUILD}/preferences.js`);

const WORKER = { url: "http://localhost:8000/", token: "" };
const TREES = [
  { key: "philosophy/Meditations", title: "Meditations", author: "Marcus Aurelius", voice: { gender: "male", accent: null } },
  { key: "philosophy/The Prince", title: "The Prince", author: "Niccolo Machiavelli", voice: { gender: "male", accent: null } },
];
const TURN = { turn: 1, speaker: 0, text: "Virtue first [s1].", cites: [{ tag: "s1", label: "chunk:1", node_id: "n1" }], grounded: true, snaps: [] };

/** A fetch that records each request and answers from a list, in order. */
function fakeFetch(...answers) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const a = answers.shift();
    if (a instanceof Error) throw a;
    return { ok: (a.status ?? 200) < 400, status: a.status ?? 200, json: async () => a.body };
  };
  return Object.assign(fn, { calls });
}

const ok = (output) => ({ body: { id: "job", status: "COMPLETED", output } });

test("starting a live moot posts moot_start to /runsync and returns an empty moot", async () => {
  const f = fakeFetch(ok({ moot_id: "abc", id: "meditations-the-prince-virtue", topic: "virtue", date: "2026-10-22", model: "m", backend: "omlx", turns: 4, trees: TREES }));
  const started = await live().startLiveMoot(WORKER, { books: [TREES[0].key, TREES[1].key], topic: "virtue", turns: 4 }, f);
  assert.equal(f.calls[0].url, "http://localhost:8000/runsync");
  assert.deepEqual(f.calls[0].body.input, { op: "moot_start", books: [TREES[0].key, TREES[1].key], topic: "virtue", turns: 4 });
  assert.equal(started.mootId, "abc");
  assert.equal(started.total, 4);
  assert.equal(started.moot.trees[0].voice.gender, "male");
  assert.deepEqual(started.moot.turns, []);
});

test("a token is sent only when set", async () => {
  const f = fakeFetch(ok({ stopped: false }));
  await live().callWorker({ url: "http://w", token: "t" }, { op: "moot_stop", moot_id: "x" }, f);
  assert.equal(f.calls[0].body.input.token, "t");
});

test("turns come back with whether the moot is done", async () => {
  const f = fakeFetch(ok({ turn: TURN, done: false }), ok({ turn: { ...TURN, turn: 2, speaker: 1 }, done: true }));
  assert.deepEqual(await live().nextLiveTurn(WORKER, "abc", f), { turn: TURN, done: false });
  assert.equal((await live().nextLiveTurn(WORKER, "abc", f)).done, true);
  assert.deepEqual(f.calls[0].body.input, { op: "moot_turn", moot_id: "abc" });
});

test("worker errors become MootErrors with the worker's message", async () => {
  const { callWorker } = live();
  const failed = fakeFetch({ body: { id: "job", status: "FAILED", error: "no such moot; it may have ended" } });
  await assert.rejects(callWorker(WORKER, { op: "moot_turn" }, failed), /no such moot/);
  await assert.rejects(callWorker(WORKER, {}, fakeFetch(ok({ error: "unauthorized" }))), /unauthorized/);
  await assert.rejects(callWorker(WORKER, {}, fakeFetch({ status: 500, body: {} })), /HTTP 500/);
  await assert.rejects(callWorker(WORKER, {}, fakeFetch(new TypeError("Failed to fetch"))), /cannot reach the worker at http:\/\/localhost:8000/);
});

test("a malformed turn is refused", async () => {
  await assert.rejects(live().nextLiveTurn(WORKER, "abc", fakeFetch(ok({ turn: { text: "no number" }, done: false }))), /malformed turn/);
});

test("stopping never throws", async () => {
  await live().stopLiveMoot(WORKER, "abc", fakeFetch(new TypeError("Failed to fetch")));
});

test("the player steps to the next turn, waits on a live worker, and stops at the end", () => {
  const { stepAfter } = live();
  assert.equal(stepAfter(1, 3, true), 2);
  assert.equal(stepAfter(3, 3, true), null);
  // Live, caught up: step past the last arrived turn and wait there.
  assert.equal(stepAfter(3, 3, false), 4);
  assert.equal(stepAfter(0, 0, false), 1);
});

test("the worker setting defaults to a local worker and keeps what was saved", () => {
  const { readPreferences, DEFAULT_MOOT_WORKER } = prefs();
  assert.equal(readPreferences().mootWorker, DEFAULT_MOOT_WORKER);
  assert.equal(readPreferences({ mootWorker: "  " }).mootWorker, DEFAULT_MOOT_WORKER);
  assert.equal(readPreferences({ mootWorker: "http://box:8000" }).mootWorker, "http://box:8000");
  assert.equal(readPreferences({ mootToken: 3 }).mootToken, "");
});
