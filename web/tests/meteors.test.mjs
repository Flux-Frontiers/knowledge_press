import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.window ??= { localStorage: { getItem: () => null, setItem() {} } };
const build = process.env.FOREST_TEST_BUILD;
const { SHOWERS, showerZhr, meteorSources, meteorOverride, spawnMeteor, meteorAt, meteorGlow } = require(`${build}/meteors.js`);
const { solarLongitude, equatorialToWorld } = require(`${build}/sky.js`);
const { mulberry32 } = require(`${build}/math.js`);

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const NYC = { lat: 40.71, lon: -74.01 };
const shower = (key) => SHOWERS.find((s) => s.key === key);
const angle = (a, b) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));

test("solar longitude is J2000: the 2026 equinox and solstice sit precession short of 0 and 90", () => {
  // 2026: equinox 20 March 14:46 UTC, solstice 21 June 08:24 UTC. The equinox
  // of date has moved 26 years x 50.3 arcsec = 0.36 degrees since J2000, the frame
  // the IMO dates showers in, so the J2000 longitudes are 359.64 and 89.64.
  const eq = solarLongitude(new Date("2026-03-20T14:46:00Z"));
  const sol = solarLongitude(new Date("2026-06-21T08:24:00Z"));
  assert.ok(Math.abs(eq - 359.64) < 0.15, `equinox ${eq}`);
  assert.ok(Math.abs(sol - 89.64) < 0.15, `solstice ${sol}`);
});

test("the Perseids peak on the night of 12 to 13 August", () => {
  const lon = solarLongitude(new Date("2026-08-13T00:00:00Z"));
  assert.ok(Math.abs(lon - shower("perseids").peak) < 1, `13 August is ${lon}`);
});

test("a shower's rate is its ZHR at the peak and falls tenfold every 1 / b degrees", () => {
  for (const s of SHOWERS) {
    assert.equal(showerZhr(s, s.peak), s.zhr);
    const tenth = showerZhr(s, s.peak + 1 / s.b);
    assert.ok(Math.abs(tenth - s.zhr / 10) < 1e-9, s.key);
  }
  // Across 0: the Quadrantids peak near 283, so 300 and 266 are equally far.
  const q = shower("quadrantids");
  assert.equal(showerZhr(q, q.peak + 17), showerZhr(q, q.peak - 17));
});

test("the sources are the sporadics plus the showers in season with their radiant up", () => {
  const perseids = shower("perseids");
  // Perseids at peak from New York at 3 a.m. EDT: the radiant is high in the northeast.
  const at = new Date("2026-08-13T07:00:00Z");
  const sources = meteorSources(solarLongitude(at), equatorialToWorld(at, NYC));
  assert.equal(sources[0].shower, null);
  const p = sources.find((s) => s.shower === perseids);
  assert.ok(p && p.perHour > 50 && p.perHour < perseids.zhr, `Perseids ${p?.perHour}`);
  // In March there is no Perseid.
  const march = new Date("2026-03-15T07:00:00Z");
  assert.ok(!meteorSources(solarLongitude(march), equatorialToWorld(march, NYC)).some((s) => s.shower === perseids));
  // A radiant below the horizon sends none: with the identity, "up" is sin(ra) cos(dec), negative for the Lyrids.
  const lyrids = shower("lyrids");
  assert.ok(!meteorSources(lyrids.peak, IDENTITY).some((s) => s.shower === lyrids));
});

test("a meteor starts above 12 degrees and runs away from its radiant", () => {
  const rand = mulberry32(7);
  const src = meteorSources(shower("geminids").peak, IDENTITY).find((s) => s.shower?.key === "geminids");
  let n = 0;
  for (let i = 0; i < 500; i++) {
    const m = spawnMeteor(src, rand);
    if (!m) continue;
    n++;
    assert.ok(m.start[1] >= Math.sin((12 * Math.PI) / 180) - 1e-9);
    assert.ok(Math.abs(Math.hypot(...m.along) - 1) < 1e-9);
    assert.ok(Math.abs(m.start[0] * m.along[0] + m.start[1] * m.along[1] + m.start[2] * m.along[2]) < 1e-9);
    assert.ok(angle(meteorAt(m, 1), src.radiant) > angle(m.start, src.radiant));
    assert.ok(m.mag <= 6.5 && m.life > 0);
  }
  assert.ok(n > 450, `${n} of 500 spawned`);
});

test("fast meteors are brief and slow ones linger", () => {
  const radiant = [0, 1, 0];
  const life = (v) => spawnMeteor({ shower: null, radiant, perHour: 1, v }, mulberry32(3)).life;
  assert.ok(Math.abs(life(21) / life(71) - 71 / 21) < 1e-9);
});

test("a meteor glows only while it lives, brightest midway", () => {
  const m = spawnMeteor({ shower: null, radiant: [0, 1, 0], perHour: 1, v: 40 }, mulberry32(5));
  assert.equal(meteorGlow({ ...m, age: 0 }), 0);
  assert.equal(meteorGlow({ ...m, age: m.life }), 0);
  assert.ok(Math.abs(meteorGlow({ ...m, age: m.life / 2 }) - 1) < 1e-9);
});

test("?meteors= pins a shower, with an optional boost", () => {
  assert.equal(meteorOverride("?meteors=perseids").shower.key, "perseids");
  assert.equal(meteorOverride("?meteors=perseids").boost, 1);
  assert.equal(meteorOverride("?meteors=geminids:20").boost, 20);
  assert.equal(meteorOverride("?meteors=nope"), null);
  assert.equal(meteorOverride("?weather=fog"), null);
});
