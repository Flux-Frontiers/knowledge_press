import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const build = process.env.FOREST_TEST_BUILD;
const w = () => require(`${build}/weather.js`);
const sky = () => require(`${build}/sky.js`);

const SLOT = 12 * 60000;
const slots = (n, from = 1_800_000_000_000) => Array.from({ length: n }, (_, i) => Math.floor(from / SLOT) * SLOT + i * SLOT);

test("the same moment always has the same weather", () => {
  const { weatherAt } = w();
  const t = 1_800_000_123_456;
  assert.deepEqual(weatherAt(t, 0.7), weatherAt(t, 0.7));
});

test("a fog builds, holds and burns off, and is gone at both ends of its slot", () => {
  const { fogEnvelope } = w();
  assert.equal(fogEnvelope(0), 0);
  assert.equal(fogEnvelope(1), 0);
  assert.ok(fogEnvelope(0.1) > 0 && fogEnvelope(0.1) < 1);
  assert.equal(fogEnvelope(0.3), 1);
  assert.equal(fogEnvelope(0.55), 1);
  let prev = 1;
  for (let p = 0.55; p <= 1; p += 0.05) { assert.ok(fogEnvelope(p) <= prev + 1e-12); prev = fogEnvelope(p); }
});

test("weather never jumps across a slot boundary", () => {
  const { weatherAt } = w();
  for (const t of slots(400)) {
    const a = weatherAt(t - 1000, 1), b = weatherAt(t + 1000, 1);
    assert.ok(Math.abs(a.fogDensity - b.fogDensity) < 0.002, `${a.fogDensity} vs ${b.fogDensity}`);
    assert.ok(Math.abs(a.cloud - b.cloud) < 0.02);
  }
});

test("fog is likely at dawn and rare otherwise, and pea soup is the rare kind", () => {
  const { weatherAt, FOG_PEAK } = w();
  // Sample the middle of each slot, where a fog that formed is at full strength.
  const hold = (t) => t + 0.35 * SLOT;
  const dawn = slots(4000).map((t) => weatherAt(hold(t), 1));
  const dawnFog = dawn.filter((x) => x.kind !== "clear");
  assert.ok(dawnFog.length / dawn.length > 0.45 && dawnFog.length / dawn.length < 0.63, `${dawnFog.length / dawn.length}`);
  const soup = dawnFog.filter((x) => x.kind === "soup").length / dawnFog.length;
  assert.ok(soup > 0.1 && soup < 0.22, `soup share ${soup}`);
  const noon = slots(4000).map((t) => weatherAt(hold(t), 0)).filter((x) => x.kind !== "clear");
  assert.ok(noon.length / 4000 < 0.08 && noon.length / 4000 > 0.01, `${noon.length / 4000}`);
  // Densities stay inside each kind's band.
  for (const x of dawnFog) {
    assert.ok(x.fogDensity <= FOG_PEAK[x.kind] && x.fogDensity >= 0.8 * FOG_PEAK[x.kind] - 1e-9, `${x.kind} ${x.fogDensity}`);
  }
});

test("a fog that formed has cloud with it, and cover stays between 0 and 1", () => {
  const { weatherAt } = w();
  for (const t of slots(500)) {
    const x = weatherAt(t + 0.35 * SLOT, 1);
    assert.ok(x.cloud >= 0 && x.cloud <= 1);
    if (x.kind !== "clear") assert.ok(x.cloud >= 0.6 * 0.99);
  }
});

test("?weather= pins the weather, and unknown names do nothing", () => {
  const { weatherOverride, FOG_PEAK } = w();
  assert.equal(weatherOverride("?weather=soup").fogDensity, FOG_PEAK.soup);
  assert.equal(weatherOverride("?qa=1&weather=clear").fogDensity, 0);
  assert.equal(weatherOverride("?weather=hail"), null);
  assert.equal(weatherOverride(""), null);
  assert.equal(weatherOverride("?weather=toString"), null);
});

test("the drawn weather eases to its target and never overshoots", () => {
  const { stepWeather, weather, WEATHER_OVERRIDES } = w();
  stepWeather(WEATHER_OVERRIDES.clear, 100);
  assert.ok(weather.fogDensity < 1e-6);
  const target = WEATHER_OVERRIDES.soup;
  let prev = 0;
  for (let i = 0; i < 60; i++) {
    stepWeather(target, 0.5);
    assert.ok(weather.fogDensity >= prev && weather.fogDensity <= target.fogDensity);
    prev = weather.fogDensity;
  }
  assert.ok(weather.fogDensity > 0.99 * target.fogDensity);
  assert.equal(weather.kind, "soup");
  stepWeather(WEATHER_OVERRIDES.clear, 100);
});

test("sky and fog gray in step: pea soup hides the sun, mist barely", () => {
  const { fogMix, overcast, WEATHER_OVERRIDES: o } = w();
  assert.equal(fogMix(o.clear), 0);
  assert.equal(fogMix(o.soup), 1);
  assert.ok(fogMix(o.mist) > 0 && fogMix(o.mist) < 0.3);
  assert.ok(overcast(o.soup) > overcast(o.fog) && overcast(o.fog) > overcast(o.mist));
  assert.ok(Math.abs(overcast(o.clouds) - 0.75 * 0.85) < 1e-9);
});

test("the sky is a morning sky from the last hours of dark until the sun is well up", () => {
  const { skyState } = sky();
  const NYC = { lat: 40.71, lon: -74.01 };
  // New York, 29 September 2026: sunrise about 06:50 EDT, solar noon about 12:50 EDT... check by altitude, not by memory.
  const at = (iso) => skyState(new Date(iso), NYC);
  const dawn = at("2026-09-29T10:40:00Z");     // 06:40 EDT, sun just below the horizon and rising
  const noon = at("2026-09-29T16:50:00Z");
  const evening = at("2026-09-29T22:30:00Z");  // sun setting
  const night = at("2026-09-29T03:00:00Z");    // 23:00 EDT
  const small = at("2026-09-29T07:00:00Z");    // 03:00 EDT: still deep night
  assert.ok(dawn.morning > 0.8, `dawn ${dawn.morning}`);
  assert.equal(noon.morning, 0);
  assert.equal(evening.morning, 0);
  assert.equal(night.morning, 0);
  assert.ok(small.morning < dawn.morning);
});

test("weather names read well", () => {
  const { weatherName, WEATHER_OVERRIDES: o } = w();
  assert.equal(weatherName(o.soup), "Dense fog");
  assert.equal(weatherName(o.clear), "Clear");
  assert.equal(weatherName(o.clouds), "Overcast");
});
