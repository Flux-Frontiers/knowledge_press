// Export the forest as raw arrays plus manifest.json, for build_blend.py.
//
// Builds the forest from the game's own modules (src/game/*.ts, compiled as
// scripts/test.mjs does), so the geometry is the game's. What the game's
// shaders do is baked as they look at ground level with the timeline off:
// leafScale 1, the season's leaf density, no wind.
//
//   node scripts/forest3d/export.mjs OUT_DIR [--season summer] [--region X Z R]
//        [--time noon|sunrise|sunset|night|ISO] [--date YYYY-MM-DD] [--sun-alt DEG]
//        [--place LAT LON]
//
// --time puts the game's sky (sky.ts) at that moment: sun, moon and the Yale
// Bright Star catalog turned to it. sunrise and sunset are when today's sun
// passes --sun-alt (default 10 degrees; the game's own dawn and dusk use 4,
// whose light is nearly pure orange); noon is the sun's highest; night is the
// game's own choice (the darkest hour, or when the moon is highest).
//
// --region keeps the trees whose trunks stand within R meters of (X, Z), and
// clips the roads and grove grounds to that disc: one grove as a diorama.
// Coordinates stay three.js (Y-up, meters); build_blend.py turns them Z-up.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(join(web, "package.json"));
const ts = require("typescript");
const THREE = await import("three");

// --- compile the game modules ------------------------------------------------
const build = join(web, "node_modules/.forest-export");
mkdirSync(build, { recursive: true });
writeFileSync(join(build, "package.json"), '{"type":"commonjs"}');
for (const f of readdirSync(join(web, "src/game")).filter((f) => f.endsWith(".ts"))) {
  const { outputText } = ts.transpileModule(readFileSync(join(web, "src/game", f), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  writeFileSync(join(build, f.replace(/\.ts$/, ".js")), outputText);
}
const game = (m) => require(join(build, `${m}.js`));
const { getForest } = game("forest");
const { SPECIES, leafOutline } = game("species");
const { SEASONS } = game("seasons");
const { leafHash } = game("leafLod");
const { ribbon, fillets, disc, RING_W, SPOKE_W, SPUR_W } = game("roads");
const { DAY_OVERRIDE } = game("daylight");
const sky = game("sky");
const { starBuffers, applyMatrix } = game("stars");

// --- arguments ---------------------------------------------------------------
const args = process.argv.slice(2);
const out = resolve(args[0] ?? "");
if (!args[0] || args[0].startsWith("--")) {
  console.error("usage: export.mjs OUT_DIR [--season NAME] [--region X Z R]");
  process.exit(2);
}
const opt = (name, n) => {
  const i = args.indexOf(name);
  return i < 0 ? null : args.slice(i + 1, i + 1 + n);
};
const season = opt("--season", 1)?.[0] ?? "summer";
const reg = opt("--region", 3);
const region = reg ? { x: +reg[0], z: +reg[1], r: +reg[2] } : null;
const within = (x, z, pad = 0) => !region || Math.hypot(x - region.x, z - region.z) <= region.r + pad;

mkdirSync(out, { recursive: true });

// --- the sky at a moment (sky.ts) ------------------------------------------------
const RAD = Math.PI / 180;
const placeArg = opt("--place", 2);
const place = placeArg ? { lat: +placeArg[0], lon: +placeArg[1] } : { lat: 40, lon: -75 };
const timeArg = opt("--time", 1)?.[0] ?? "noon";
const dateArg = opt("--date", 1)?.[0];
const sunAlt = +(opt("--sun-alt", 1)?.[0] ?? 10);
/** The moment for a preset: scans the local day in one-minute steps, as effectiveTime does in ten. */
function presetTime(name) {
  // Without --date, the season's own solstice or equinox, so the light matches the leaves.
  const SEASON_DATE = { spring: "03-20", summer: "06-21", autumn: "09-22", winter: "12-21" };
  const day = new Date(`${dateArg ?? `${new Date().getFullYear()}-${SEASON_DATE[season]}`}T00:00:00`);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).valueOf();
  if (name === "night") return sky.effectiveTime("night", new Date(start), place);
  let best = start, bestAlt = -Infinity, rise = null, set = null;
  let prev = sky.sunPosition(new Date(start), place).altitude - sunAlt * RAD;
  for (let t = start + 60000; t < start + 86400000; t += 60000) {
    const a = sky.sunPosition(new Date(t), place).altitude;
    if (a > bestAlt) { bestAlt = a; best = t; }
    const cur = a - sunAlt * RAD;
    if (prev < 0 && cur >= 0 && rise === null) rise = t;
    if (prev >= 0 && cur < 0) set = t;
    prev = cur;
  }
  if (name === "sunrise" && rise !== null) return new Date(rise);
  if (name === "sunset" && set !== null) return new Date(set);
  return new Date(best);
}
const at = ["noon", "sunrise", "sunset", "night"].includes(timeArg) ? presetTime(timeArg) : new Date(timeArg);
const state = sky.skyState(at, place);
const forest = getForest();
const pal = SEASONS[season];
const files = {};
function dump(name, arr) {
  writeFileSync(join(out, `${name}.bin`), Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength));
  files[name] = { dtype: arr.constructor.name, length: arr.length };
}
/** Keeps the triangles of a flat mesh that lie wholly in the region. */
function clipFlat(m) {
  if (!region) return m;
  const inside = (v) => within(m.pos[v * 3], m.pos[v * 3 + 2], 1e-3);
  const index = [];
  for (let k = 0; k < m.index.length; k += 3) {
    const tri = [m.index[k], m.index[k + 1], m.index[k + 2]];
    if (tri.every(inside)) index.push(...tri);
  }
  return { ...m, index };
}
function dumpFlat(name, m) {
  m = clipFlat(m);
  if (!m.index.length) return false;
  dump(`${name}_pos`, new Float32Array(m.pos));
  dump(`${name}_uv`, new Float32Array(m.uv));
  dump(`${name}_index`, new Uint32Array(m.index));
  if (m.alpha) dump(`${name}_alpha`, new Float32Array(m.alpha));
  return true;
}

// --- book trees: bark per grove, one point per leaf ---------------------------
const chunks = [];
forest.chunks.forEach((c, ci) => {
  // Whole trees whose trunk stands in the region (Trees.tsx subjectBark cuts the same way).
  const ranges = forest.trees.filter((t) => t.chunk === ci && within(t.x, t.z)).map((t) => [t.woodStart, t.woodStart + t.woodCount]);
  if (!ranges.length) return;
  const idx = [];
  for (let k = 0; k < c.bark.index.length; k += 3) {
    const a = c.bark.index[k];
    if (ranges.some(([s, e]) => a >= s && a < e)) idx.push(a, c.bark.index[k + 1], c.bark.index[k + 2]);
  }
  dump(`bark_${ci}_pos`, c.bark.pos);
  dump(`bark_${ci}_normal`, c.bark.normal);
  dump(`bark_${ci}_uv`, c.bark.uv);
  dump(`bark_${ci}_index`, new Uint32Array(idx));
  // Leaves kept and tinted as Trees.tsx does.
  const [dh, ds, dl] = SPECIES[c.species].foliageShift;
  const foliage = pal.foliage.map((h) => new THREE.Color(h).offsetHSL(dh, ds, dl));
  const { pos, scale, quat, tint, treeIndex } = forest.leaves;
  const P = [], Q = [], S = [], C = [];
  for (let i = c.leafStart; i < c.leafStart + c.leafCount; i++) {
    if (pal.density < 0.999 && leafHash(i) >= pal.density) continue;
    const t = forest.trees[treeIndex[i]];
    if (!within(t.x, t.z)) continue;
    P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    Q.push(quat[i * 4 + 3], quat[i * 4], quat[i * 4 + 1], quat[i * 4 + 2]); // w, x, y, z for Blender
    S.push(scale[i * 3], scale[i * 3 + 1], scale[i * 3 + 2]);
    const col = foliage[tint[i] % foliage.length];
    C.push(col.r, col.g, col.b); // linear
  }
  dump(`leaf_${ci}_pos`, new Float32Array(P));
  dump(`leaf_${ci}_quat`, new Float32Array(Q));
  dump(`leaf_${ci}_scale`, new Float32Array(S));
  dump(`leaf_${ci}_color`, new Float32Array(C));
  chunks.push({ id: ci, genre: c.genre, species: SPECIES[c.species].name, x: c.x, z: c.z, radius: c.radius, leaves: P.length / 3 });
});

const leafShapes = SPECIES.map((s) => {
  const g = new THREE.ShapeGeometry(new THREE.Shape(leafOutline(s.leaf).map(([x, y]) => new THREE.Vector2(x, y))));
  dump(`shape_${s.name}_pos`, g.getAttribute("position").array);
  dump(`shape_${s.name}_index`, new Uint32Array(g.getIndex().array));
  return s.name;
});

// --- the corpus redwood at the hub (CorpusRedwood.tsx) ------------------------
// Its sprays' color per season, as CorpusRedwood.tsx FOLIAGE has it.
const REDWOOD_FOLIAGE = { spring: "#3d6236", summer: "#2f5130", autumn: "#35502e", winter: "#4a5d52" };
let redwood = null;
if (within(0, 0, forest.corpusTree.baseRadius)) {
  const ct = forest.corpusTree;
  dump("redwood_bark_pos", ct.bark.pos);
  dump("redwood_bark_normal", ct.bark.normal);
  dump("redwood_bark_uv", ct.bark.uv);
  dump("redwood_bark_index", ct.bark.index);
  const { pos, scale, quat, shade, count } = ct.foliage;
  const Q = new Float32Array(count * 4), C = new Float32Array(count * 3);
  const base = new THREE.Color(REDWOOD_FOLIAGE[season]), col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    Q.set([quat[i * 4 + 3], quat[i * 4], quat[i * 4 + 1], quat[i * 4 + 2]], i * 4);
    col.copy(base).offsetHSL(0, 0, (shade[i] - 3.5) * 0.012);
    C.set([col.r, col.g, col.b], i * 3);
  }
  dump("redwood_spray_pos", pos.slice(0, count * 3));
  dump("redwood_spray_quat", Q);
  dump("redwood_spray_scale", scale.slice(0, count * 3));
  dump("redwood_spray_color", C);
  // The spray card: a unit plane in the ground plane, x along the spray (CorpusRedwood.tsx).
  const card = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  dump("spray_card_pos", card.getAttribute("position").array);
  dump("spray_card_uv", card.getAttribute("uv").array);
  dump("spray_card_index", new Uint32Array(card.getIndex().array));
  redwood = { height: ct.height, baseRadius: ct.baseRadius, sprays: count };
}

// --- roads and plazas (World.tsx Roads): spokes and spurs lowest, ring and plazas above ---
const spokes = { pos: [], uv: [], index: [] }, ring = { pos: [], uv: [], index: [] };
for (const line of forest.roadLines) {
  if (line.kind === "spoke") ribbon(line, SPOKE_W, 0.035, spokes);
  else if (line.kind === "spur") ribbon(line, SPUR_W, 0.035, spokes);
  else ribbon(line, RING_W, 0.045, ring);
}
for (const j of forest.junctions) fillets(j, 0.045, ring);
for (const p of forest.plazas) disc(p.x, p.z, p.r, 0.055, ring);
const roads = ["road_spokes", "road_ring"].filter((n, i) => dumpFlat(n, [spokes, ring][i]));

// --- the ground and each grove's tinted patch (World.tsx GroveGrounds) --------------
const night = new THREE.Color(pal.ground);
const ground = night.clone().lerp(night.clone().offsetHSL(0, -0.08, DAY_OVERRIDE.groundLightness), 1);
if (season === "winter") ground.set("#c8d1ce");
const groves = [];
for (const g of forest.groves) {
  const m = { pos: [], uv: [], index: [] };
  const r = g.radius + 3;
  // In a region the patch is cut to the plinth: a disc over the plinth, faded about the grove's own center.
  if (region) {
    if (Math.hypot(g.x - region.x, g.z - region.z) > r + region.r) continue;
    disc(region.x, region.z, region.r, 0.015, m, 96);
  } else disc(g.x, g.z, r, 0.015, m, 48);
  // The game's radial alpha: opaque to 72% of the radius, fading to the rim, times opacity 0.6.
  m.alpha = [];
  for (let k = 0; k < m.pos.length; k += 3) {
    const d = Math.hypot(m.pos[k] - g.x, m.pos[k + 2] - g.z) / r;
    m.alpha.push(0.6 * Math.min(1, Math.max(0, (1 - d) / 0.28)));
  }
  const name = `grove_ground_${groves.length}`;
  if (!dumpFlat(name, m)) continue;
  const tint = new THREE.Color(season === "winter" ? "#c8d1ce" : ground).lerp(new THREE.Color(g.color), season === "winter" ? 0.25 : 0.4);
  groves.push({ name, genre: g.genre, color: [tint.r, tint.g, tint.b] });
}

// The fixed stars, turned to this moment: world directions (three.js axes), magnitude, color.
const stars = starBuffers();
const starDir = new Float32Array(stars.dir.length);
for (let i = 0; i < stars.mag.length; i++) {
  starDir.set(applyMatrix(state.starMatrix, [stars.dir[i * 3], stars.dir[i * 3 + 1], stars.dir[i * 3 + 2]]), i * 3);
}
dump("star_dir", starDir);
dump("star_mag", stars.mag);
dump("star_color", stars.color);
const sunPos = sky.sunPosition(at, place);
const skyOut = {
  time: timeArg,
  at: at.toISOString(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  place,
  sunAltitude: sunPos.altitude / RAD,
  sunAzimuth: sunPos.azimuth / RAD,
  sunDir: state.sunDir,
  moonDir: state.moonDir,
  moonFraction: state.moonFraction,
  daylight: state.daylight,
  warmth: state.warmth,
  light: state.light,
};

const manifest = {
  season, region, files, chunks, leafShapes, redwood, roads, groves,
  ground: [ground.r, ground.g, ground.b],
  barkTint: (() => { const w = new THREE.Color(pal.wood).lerp(new THREE.Color("#ffffff"), 0.55); return [w.r, w.g, w.b]; })(),
  textures: join(web, "public/textures"),
  worldRadius: forest.worldRadius,
  home: forest.home,
  sky: skyOut,
  trees: forest.trees.map((t) => ({ x: t.x, z: t.z, slug: t.book.slug, chunk: t.chunk })),
};
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest));
console.log(`sky: ${timeArg} at ${at.toISOString()} (${skyOut.timeZone}), sun ${skyOut.sunAltitude.toFixed(1)} deg up, `
  + `moon ${(state.moonFraction * 100).toFixed(0)}% lit`);
console.log(`${chunks.length} groves, ${chunks.reduce((n, c) => n + c.leaves, 0)} leaves, redwood ${redwood ? "yes" : "no"}, `
  + `roads ${roads.length}, grove grounds ${groves.length} -> ${out}`);
