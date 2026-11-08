// Where the forest's frame goes: triangles, draw calls and render time per view
// and leaf level, with and without the leaves, and the shadow pass on its own.
// Runs in headless Chromium with software WebGL (SwiftShader), so times are
// for comparing cases, not a device's frame rate; counts are exact.
//
//   npm run dev                                   # in another terminal
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/profile.mjs [label]
//
// Env: FOREST_URL (default http://127.0.0.1:5173); CASES, a JSON list of
// { camera, leaves, shadows, nolod?, day? }; BREAKDOWN=1 to list triangles by
// kind of mesh; OUT for results-<label>.jsonl and a screenshot per case
// (default ../screenshots/profile, which git ignores).
import { appendFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");

const base = process.env.FOREST_URL ?? "http://127.0.0.1:5173";
const out = resolve(process.env.OUT ?? "../screenshots/profile");
mkdirSync(out, { recursive: true });
const label = process.argv[2] ?? "run";
const cases = JSON.parse(process.env.CASES ?? JSON.stringify([
  { camera: "follow", leaves: "low", shadows: false },
  { camera: "god", leaves: "low", shadows: false },
  { camera: "follow", leaves: "ultra", shadows: false },
  { camera: "god", leaves: "ultra", shadows: false },
  { camera: "follow", leaves: "low", shadows: true },
  { camera: "god", leaves: "low", shadows: true },
]));

const results = [];
for (const c of cases) {
  const browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.error("pageerror", e.message));
    await page.addInitScript((prefs) => {
      localStorage.setItem("kpf-library-v1", JSON.stringify({ version: 1, library: [], grovesVisited: [], place: null,
        preferences: { ...prefs, motion: true, stats: true, silent: true, weather: false, fog: "normal" } }));
    }, { camera: c.camera, leaves: c.leaves, shadows: c.shadows });
    await page.goto(`${base}/?profile${c.nolod ? "&nolod" : ""}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 300000, polling: 500 });
    await page.getByRole("button", { name: "Start driving" }).click();
    await page.waitForFunction(() => !!window.__forestProfile, null, { timeout: 60000 });
    if (c.day) await page.evaluate(() => { const g = window.__forestProfile.game.getState(); g.setSeason("summer"); g.setTimeMode("day"); });
    // Let the camera settle (the god's-eye flight, the forest fading in).
    await page.waitForTimeout(6000);
    const r = await page.evaluate(async () => {
      const { gl, scene, camera, game } = window.__forestProfile;
      const ctx = gl.getContext();
      let shadowRenders = 0;
      const realShadow = gl.shadowMap.render.bind(gl.shadowMap);
      gl.shadowMap.render = (...a) => { if (gl.shadowMap.enabled && (gl.shadowMap.autoUpdate || gl.shadowMap.needsUpdate)) shadowRenders++; return realShadow(...a); };
      let rafFrames = 0;
      const rafFps = await new Promise((done) => {
        let n = 0; const t0 = performance.now();
        const tick = () => { n++; rafFrames++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else done(n / ((performance.now() - t0) / 1000)); };
        requestAnimationFrame(tick);
      });
      const shadowRendersInRaf = shadowRenders;
      const leafMeshes = [];
      let leafInstances = 0, leafTris = 0;
      scene.traverse((o) => {
        if (o.isInstancedMesh && o.customDepthMaterial) {
          leafMeshes.push(o);
          let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false;
          if (vis) { leafInstances += o.count; leafTris += o.count * o.geometry.index.count / 3; }
        }
      });
      const px = new Uint8Array(4);
      const once = () => { const t0 = performance.now(); gl.render(scene, camera); ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px); return performance.now() - t0; };
      const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
      const setLeaves = (on) => leafMeshes.forEach((m) => (m.visible = on));
      for (let i = 0; i < 3; i++) { once(); setLeaves(false); once(); setLeaves(true); }
      once(); const info = { tris: gl.info.render.triangles, calls: gl.info.render.calls };
      setLeaves(false); once(); const infoNo = { tris: gl.info.render.triangles, calls: gl.info.render.calls }; setLeaves(true);
      const tAll = [], tNo = [];
      for (let i = 0; i < 7; i++) { tAll.push(once()); setLeaves(false); tNo.push(once()); setLeaves(true); }
      const all = { ...info, ms: median(tAll) }, noLeaves = { ...infoNo, ms: median(tNo) };
      // The shadow pass alone: a render that redraws the map against one that does not.
      let shadow = null;
      if (gl.shadowMap.enabled) {
        const auto = gl.shadowMap.autoUpdate; gl.shadowMap.autoUpdate = false;
        const tWith = [], tWithout = [];
        for (let i = 0; i < 5; i++) { gl.shadowMap.needsUpdate = true; tWith.push(once()); gl.shadowMap.needsUpdate = false; tWithout.push(once()); }
        gl.shadowMap.autoUpdate = auto;
        shadow = { withMs: median(tWith), withoutMs: median(tWithout) };
      }
      // Where the triangles are: meshes three.js would draw this frame (visible and in the frustum), by kind.
      camera.updateMatrixWorld();
      const mul = (a, b) => { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return r; };
      const m = mul(camera.projectionMatrix.elements, camera.matrixWorldInverse.elements);
      const planes = [[m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]], [m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]],
        [m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]], [m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]],
        [m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]], [m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]]]
        .map(([a, b, c, d]) => { const l = Math.hypot(a, b, c); return [a / l, b / l, c / l, d / l]; });
      const inView = (o) => {
        if (!o.frustumCulled) return true;
        const bs = o.isInstancedMesh ? (o.boundingSphere ?? (o.computeBoundingSphere(), o.boundingSphere)) : (o.geometry.boundingSphere ?? (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere));
        if (!bs) return true;
        const e = o.matrixWorld.elements; const c = bs.center;
        const x = e[0] * c.x + e[4] * c.y + e[8] * c.z + e[12], y = e[1] * c.x + e[5] * c.y + e[9] * c.z + e[13], z = e[2] * c.x + e[6] * c.y + e[10] * c.z + e[14];
        const sc = Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
        return planes.every(([a, b, cc, d]) => a * x + b * y + cc * z + d >= -bs.radius * sc);
      };
      const groups = new Map();
      scene.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        for (let p = o; p; p = p.parent) if (!p.visible) return;
        if (!inView(o)) return;
        const g = o.geometry; const per = (g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3;
        const inst = o.isInstancedMesh ? o.count : 1;
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        const leaf = leafMeshes.includes(o);
        const key = leaf ? "LEAVES" : !o.isInstancedMesh && mat?.map && per > 10000 ? "BARK (one mesh per grove)" : per * inst < 2000 ? "SMALL (< 2k tris each)" : `${o.isInstancedMesh ? "inst" : "mesh"} ${g.type} ${mat?.type} #${mat?.color?.getHexString?.() ?? "-"}${mat?.map ? " map" : ""} per~${per < 50 ? Math.round(per) : Math.round(per / 100) * 100}`;
        const e = groups.get(key) ?? { meshes: 0, tris: 0, shadow: 0 }; e.meshes++; e.tris += per * inst; if (o.castShadow) e.shadow++; groups.set(key, e);
      });
      const breakdown = [...groups].sort((a, b) => b[1].tris - a[1].tris).slice(0, 8).map(([k, v]) => `  ${k.padEnd(64)} meshes=${String(v.meshes).padStart(4)} tris=${(v.tris / 1e6).toFixed(3)}M castShadow=${v.shadow}`);
      breakdown.push(`  total drawn meshes=${[...groups.values()].reduce((a, v) => a + v.meshes, 0)} tris=${([...groups.values()].reduce((a, v) => a + v.tris, 0) / 1e6).toFixed(2)}M`);
      const s = game.getState();
      return { camera: s.preferences.camera, leaves: s.preferences.leaves, shadows: s.preferences.shadows, shadowMap: gl.shadowMap.enabled,
        camPos: camera.position.toArray().map((v) => +v.toFixed(1)), rafFps: +rafFps.toFixed(1),
        leafMeshes: leafMeshes.length, leafInstances, leafTrisVisible: Math.round(leafTris), all, noLeaves, breakdown, shadow, shadowRedrawShare: rafFrames ? +(shadowRendersInRaf / rafFrames).toFixed(2) : null, casting: (() => { let on = false; scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) on = true; }); return on; })() };
    });
    r.nolod = !!c.nolod;
    try {
      await page.screenshot({ path: join(out, `shot-${label}-${c.camera}-${c.leaves}${c.shadows ? "-shadows" : ""}${c.nolod ? "-nolod" : ""}.png`), timeout: 240000 });
    } catch (e) { console.error(`no screenshot: ${e.message.split("\n")[0]}`); }
    results.push(r);
    appendFileSync(join(out, `results-${label}.jsonl`), JSON.stringify(r) + "\n");
    console.log(JSON.stringify(r));
  } finally {
    await browser.close();
  }
}
console.log("SUMMARY " + label);
for (const r of results) {
  if (process.env.BREAKDOWN) console.log(r.breakdown.join("\n"));
  console.log(`${r.nolod ? "nolod" : "lod  "} ${r.camera.padEnd(6)} leaves=${r.leaves.padEnd(5)} shadows=${String(r.shadows).padEnd(5)} | ${(r.all.tris / 1e6).toFixed(2)}M tris ${String(r.all.calls).padStart(4)} calls ${r.all.ms.toFixed(1).padStart(6)} ms/render | no leaves: ${(r.noLeaves.tris / 1e6).toFixed(2)}M ${r.noLeaves.ms.toFixed(1).padStart(6)} ms | leaf inst ${r.leafInstances} | raf ${r.rafFps} fps${r.shadow ? ` | shadow pass ${(r.shadow.withMs - r.shadow.withoutMs).toFixed(0)} ms, redrawn on ${Math.round(100 * r.shadowRedrawShare)}% of frames` : ""}`);
}
