import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { isNewerVersion, parseVersionFile, fetchPublishedVersion } = require(`${process.env.FOREST_TEST_BUILD}/updateCheck.js`);

test("only a strictly higher version is newer, compared part by part", () => {
  assert.equal(isNewerVersion("1.51.0", "1.50.0"), true);
  assert.equal(isNewerVersion("1.100.0", "1.99.9"), true);
  assert.equal(isNewerVersion("2.0", "1.99.9"), true);
  assert.equal(isNewerVersion("1.50.0", "1.50.0"), false);
  assert.equal(isNewerVersion("1.49.0", "1.50.0"), false);
  assert.equal(isNewerVersion("1.50", "1.50.0"), false);
  assert.equal(isNewerVersion("garbage", "1.50.0"), false);
});

test("version.json must declare a non-empty string version", () => {
  assert.equal(parseVersionFile({ version: "1.51.0" }), "1.51.0");
  assert.equal(parseVersionFile({ version: "" }), null);
  assert.equal(parseVersionFile({ version: 151 }), null);
  assert.equal(parseVersionFile(null), null);
  assert.equal(parseVersionFile("1.51.0"), null);
});

test("a missing file or no network reads as no published version", async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
    assert.equal(await fetchPublishedVersion(), null);
    globalThis.fetch = async () => { throw new TypeError("offline"); };
    assert.equal(await fetchPublishedVersion(), null);
    let asked;
    globalThis.fetch = async (url, init) => { asked = init; return { ok: true, json: async () => ({ version: "1.51.0" }) }; };
    assert.equal(await fetchPublishedVersion(), "1.51.0");
    assert.equal(asked.cache, "no-store");
  } finally { globalThis.fetch = saved; }
});
