import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { volley, sparkAt, SPARKS, SHELLS, SPARK_LIFE, SHELL_GAP } = require(`${process.env.FOREST_TEST_BUILD}/fireworks.js`);

let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test("a volley bursts ahead of and above the viewer, even looking straight down", () => {
  for (const ahead of [[0, 0, -1], [0, -1, 0]]) {
    const sparks = volley(rng, [0, 2, 0], ahead);
    assert.equal(sparks.length, SPARKS * SHELLS);
    for (const s of sparks) {
      assert.ok(s.oy > 15, "above");
      assert.ok(Math.hypot(s.ox, s.oz) > 50, "well ahead");
    }
  }
  assert.ok(volley(rng, [0, 2, 0], [0, 0, -1]).every((s) => s.oz < 0), "in front, not behind");
});

test("a spark is dark before its shell bursts and after it fades, bright in between", () => {
  const [s] = volley(rng, [0, 2, 0], [1, 0, 0]).slice(-1);
  assert.equal(sparkAt(s, s.delay - 0.01)[3], 0);
  assert.ok(sparkAt(s, s.delay + 0.2)[3] > 0.5);
  assert.equal(sparkAt(s, s.delay + SPARK_LIFE + 0.01)[3], 0);
  assert.equal(s.delay, (SHELLS - 1) * SHELL_GAP);
});
