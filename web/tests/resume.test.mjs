import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("a reload resumes a recent ride and ignores a stale or broken one", () => {
  const { parseResume, RESUME_MAX_AGE_MS } = require(`${process.env.FOREST_TEST_BUILD}/resume.js`);
  const now = 1_000_000_000;
  const pose = { x: 12.5, z: -40, yaw: 1.2, circuit: true, at: now - 5000 };
  assert.deepEqual(parseResume(JSON.stringify(pose), now), pose);
  assert.equal(parseResume(JSON.stringify({ ...pose, at: now - RESUME_MAX_AGE_MS - 1 }), now), null);
  assert.equal(parseResume(JSON.stringify({ ...pose, at: now + 1000 }), now), null);
  assert.equal(parseResume(JSON.stringify({ ...pose, x: "12" }), now), null);
  assert.equal(parseResume("{not json", now), null);
  assert.equal(parseResume(null, now), null);
  assert.equal(parseResume(JSON.stringify({ ...pose, circuit: undefined }), now).circuit, false);
});
