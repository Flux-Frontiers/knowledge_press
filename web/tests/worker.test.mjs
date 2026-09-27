import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("worker replies unwrap the runsync envelope and surface errors", () => {
  const { decodeWorker, WorkerError } = require(`${process.env.FOREST_TEST_BUILD}/worker.js`);
  assert.deepEqual(decodeWorker({ id: "x", status: "COMPLETED", output: { book: "Hamlet", chapters: [] } }), { book: "Hamlet", chapters: [] });
  assert.deepEqual(decodeWorker({ title: "Bare" }), { title: "Bare" });
  assert.throws(() => decodeWorker({ status: "FAILED", error: "unknown section: " }), WorkerError);
  assert.throws(() => decodeWorker({ output: { error: "no such book" } }), /no such book/);
  assert.throws(() => decodeWorker(null), WorkerError);
});
