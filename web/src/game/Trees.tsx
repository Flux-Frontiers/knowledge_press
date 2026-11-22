import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedBufferAttribute, InstancedMesh, MeshDepthMaterial, MeshStandardMaterial, Object3D, RepeatWrapping, RGBADepthPacking, Shape, ShapeGeometry, SRGBColorSpace, TextureLoader, Vector2, Vector4, type WebGLProgramParametersWithUniforms } from "three";
import { COARSE_POINTER, textureAnisotropy } from "./Environment";
import { useGame } from "./store";
import type { Forest } from "./forest";
import { bookMatchesQuery, treesNear } from "./forest";
import { godLeafBlend, leafFraction, leafHash, leafOrder } from "./leafLod";
import { SEASONS, type SeasonName } from "./seasons";
import { treeExtent } from "./portrait";
import { sim } from "./sim";
import { leafOutline, SPECIES, type LeafShape, type Species } from "./species";
import { bookShown, TIMELINE_OFF } from "./timeline";
import { nightLamps } from "./Uplights";

const dummy = new Object3D();
const color = new Color();
const white = new Color("#ffffff");

/** The literary timeline's year (timeline.ts), shared by every tree shader; a vertex whose `bookYear` is later collapses to nothing. */
const timelineYear = { value: TIMELINE_OFF };
/** The year an undated book's vertices carry: before any timeline stop, so it always stands. */
const UNDATED = -1e6;

/**
 * The tree lit at night as the rider comes near it (Trees' frame loop): its trunk's x and z,
 * the crown's reach and the tree's height in `at`, and how far up its lamps are in `amount`.
 * Like the redwood's uplights (Uplights.tsx) it is a glow in the shader, not a three.js light,
 * which would be shaded on every fragment of the forest.
 */
const treeLight = {
  at: { value: new Vector4(0, 0, 1, 1) },
  amount: { value: 0 },
  color: { value: new Color("#ffe2c0") },
};
/** The rider lights the nearest tree within this many metres of its trunk, fully within TREE_LIGHT_FULL. */
const TREE_LIGHT_REACH = 32;
const TREE_LIGHT_FULL = 16;
/** The lit tree's glow at full: a fraction of its own colour added, so it reads in the dark without washing out. */
const TREE_LIGHT_STRENGTH = 0.5;
/** How fast the lamps fade, in full swings per second. */
const TREE_LIGHT_RATE = 1.2;
/** `?treelight=pool` lights a pool round the rider instead of the nearest tree, to compare. */
const TREE_LIGHT_POOL = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("treelight") === "pool";

/**
 * Adds the tree light to a colour shader: a warm glow in the surface's own colour, across the
 * lit tree's crown and fading from the ground up. `world` is the GLSL for the vertex's world position.
 */
function addTreeLight(shader: WebGLProgramParametersWithUniforms, world: string) {
  shader.uniforms.treeLightAt = treeLight.at;
  shader.uniforms.treeLightAmount = treeLight.amount;
  shader.uniforms.treeLightColor = treeLight.color;
  shader.vertexShader = "varying vec3 vTreeLightWorld;\n" + shader.vertexShader.replace(
    "#include <project_vertex>", `vTreeLightWorld = ${world};\n#include <project_vertex>`);
  shader.fragmentShader = "uniform vec4 treeLightAt; uniform float treeLightAmount; uniform vec3 treeLightColor; varying vec3 vTreeLightWorld;\n"
    + shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      float treeLightAcross = 1.0 - smoothstep(treeLightAt.z * 0.85, treeLightAt.z * 1.35, length(vTreeLightWorld.xz - treeLightAt.xy));
      float treeLightUp = 0.3 + 0.7 * exp(-max(vTreeLightWorld.y, 0.0) / (treeLightAt.w * 0.9));
      totalEmissiveRadiance += treeLightColor * treeLightAmount * ${TREE_LIGHT_STRENGTH.toFixed(3)} * treeLightAcross * treeLightUp * diffuseColor.rgb;`);
}

/** Collapses the vertices of trees whose year has not come (bark, and its shadow); the bark also takes the tree light. */
function gateByYear(material: MeshStandardMaterial | MeshDepthMaterial, key: string, lit = false) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.timelineYear = timelineYear;
    shader.vertexShader = "attribute float bookYear; uniform float timelineYear;\n" + shader.vertexShader.replace(
      "#include <begin_vertex>", "#include <begin_vertex>\n          transformed *= step(bookYear, timelineYear);");
    if (lit) addTreeLight(shader, "(modelMatrix * vec4(transformed, 1.0)).xyz");
  };
  material.customProgramCacheKey = () => key;
}

// CC0 bark from ambientCG; see public/textures/bark/CREDITS.md.
function barkMaterial(species: Species) {
  const loader = new TextureLoader();
  const load = (map: string, srgb = false) => {
    const tex = loader.load(`textures/bark/${species.name}_${map}.jpg`);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.anisotropy = textureAnisotropy(8);
    if (srgb) tex.colorSpace = SRGBColorSpace;
    return tex;
  };
  const material = new MeshStandardMaterial({
    map: load("color", true),
    normalMap: load("normal"),
    roughness: 0.92,
    vertexColors: true,
    metalness: 0,
  });
  gateByYear(material, "forest-bark-year-v2", true);
  return material;
}

function barkDepthMaterial() {
  const material = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  gateByYear(material, "forest-bark-depth-year-v1");
  return material;
}

function leafGeometry(leaf: LeafShape) {
  const g = new ShapeGeometry(new Shape(leafOutline(leaf).map(([x, y]) => new Vector2(x, y))));
  g.computeVertexNormals();
  return g;
}

function keepLeaf(i: number, density: number): boolean {
  if (density >= 0.999) return true;
  return leafHash(i) < density;
}

/** Groves nearer than this, metres from the camera to the grove's edge, draw every leaf; pointer screens (Macs, desktops) never thin. */
const LEAF_FULL = COARSE_POINTER ? 60 : Infinity;
/** The fewest leaves a far grove keeps, as a fraction of its own. */
const LEAF_FLOOR = 0.15;
/** About where the crowns are, metres: god's-eye thinning reads the camera's height above them. */
const CROWN_HEIGHT = 12;
/** `?nolod` draws god's eye with every leaf, as before godLeafBlend, to compare. */
const GOD_LOD = typeof window === "undefined" || !new URLSearchParams(window.location.search).has("nolod");

export function Trees({
  forest,
  season,
  query,
}: {
  forest: Forest;
  season: SeasonName;
  query: string;
}) {
  const ringRef = useRef<InstancedMesh>(null);
  const palette = SEASONS[season];
  const q = query.trim();
  const wind = useMemo(() => ({ value: 0 }), []);
  const windStrength = useMemo(() => ({ value: 0 }), []);
  // One leaf and depth material per grove, all on one shader program, so each can carry its own
  // `leafScale`: three uploads a material's uniforms only when the material changes between draws.
  const materials = useMemo(() => forest.chunks.map(() => {
    const leafScale = { value: 1 };
    const leaf = new MeshStandardMaterial({ roughness: 0.8, side: DoubleSide });
    const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
    for (const material of [leaf, depth]) {
      material.onBeforeCompile = (shader) => {
        shader.uniforms.windTime = wind;
        shader.uniforms.windStrength = windStrength;
        shader.uniforms.leafScale = leafScale;
        shader.uniforms.timelineYear = timelineYear;
        shader.vertexShader = "uniform float windTime; uniform float windStrength; uniform float leafScale;\n"
          + "attribute float bookYear; uniform float timelineYear;\n" + shader.vertexShader;
        // God's eye draws fewer leaves, each enlarged about its stalk (leafLod.ts godLeafBlend).
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n          float shown = step(bookYear, timelineYear);\n          transformed *= leafScale * shown;");
        // Leaves replace project_vertex below, so the tree light's world position is set here, from the instance.
        if (material === leaf) addTreeLight(shader, "(modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz");
        // Three's project_vertex, with the wind added in world space after the
        // instance matrix: in leaf space a flap along the face normal would be
        // scaled down by the blade's thin z.
        shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", `
          vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
          vec3 base = instanceMatrix[3].xyz;
          float phase = base.x * .31 + base.z * .27;
          // Slow gusts roll across the forest (windRotors.ts gust(), which turns the sculptures).
          float gust = 0.65 + 0.35 * sin(windTime * 0.35 + base.x * .02);
          float w = gust * windStrength;
          // The crown sways together, more the higher the leaf, in waves across the grove.
          vec2 windDir = vec2(0.93, 0.37);
          float sway = sin(windTime * 1.1 + base.x * .05 + base.z * .04) + 0.4 * sin(windTime * 2.3 + base.z * .07);
          mvPosition.xz += windDir * sway * w * .009 * base.y;
          // Each leaf flaps about its stalk (the shape's y = -1 end), along its face normal.
          float tip = (position.y + 1.0) * 0.5;
          float flap = sin(windTime * 4.0 + phase * 3.0) + 0.5 * sin(windTime * 6.4 + phase * 1.7);
          // Divided, not normalize(): a hidden leaf is scaled to zero, and normalize(0) is NaN.
          vec3 leafNormal = instanceMatrix[2].xyz / max(length(instanceMatrix[2].xyz), 1e-6);
          mvPosition.xyz += leafNormal * flap * tip * w * .35 * leafScale * shown * length(instanceMatrix[1].xyz);
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;
        `);
      };
      material.customProgramCacheKey = () => (material === leaf ? "forest-leaf-wind-lit-v6" : "forest-leaf-wind-v5");
    }
    return { leaf, depth, leafScale };
  }), [forest, wind, windStrength]);
  useEffect(() => () => materials.forEach((m) => { m.leaf.dispose(); m.depth.dispose(); }), [materials]);

  // A tree portrait (portrait.ts) shows one tree and nothing else of the forest.
  const only = useGame((s) => s.portrait?.tree ?? null);
  // The tree speaking in a moot (MootOverlay.tsx) gets a ring in its moot color.
  const mootSpeaker = useGame((s) => s.mootSpeaker);
  const year = useGame((s) => s.timelineYear);

  // Each vertex and leaf carries its book's year, for the timeline's shader gate.
  const treeYears = useMemo(() => forest.trees.map((t) => t.book.year ?? UNDATED), [forest]);
  const bark = useMemo(() => forest.chunks.map(({ bark: b }, ci) => {
    const g = new BufferGeometry();
    const years = new Float32Array(b.count);
    forest.trees.forEach((t, ti) => {
      if (t.chunk === ci) years.fill(treeYears[ti]!, t.woodStart, t.woodStart + t.woodCount);
    });
    g.setAttribute("bookYear", new BufferAttribute(years, 1));
    g.setAttribute("position", new BufferAttribute(b.pos, 3));
    g.setAttribute("normal", new BufferAttribute(b.normal, 3));
    g.setAttribute("uv", new BufferAttribute(b.uv, 2));
    g.setAttribute("color", new BufferAttribute(new Float32Array(b.count * 3), 3));
    g.setIndex(new BufferAttribute(b.index, 1));
    g.computeBoundingSphere();
    return g;
  }), [forest, treeYears]);
  // The subject's own triangles: its grove's bark with the index cut down to the tree's vertex range.
  const subjectBark = useMemo(() => {
    if (only === null) return null;
    const tree = forest.trees[only]!;
    const source = bark[tree.chunk]!;
    const index = forest.chunks[tree.chunk]!.bark.index;
    const end = tree.woodStart + tree.woodCount;
    const kept: number[] = [];
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i]!;
      if (a >= tree.woodStart && a < end) kept.push(a, index[i + 1]!, index[i + 2]!);
    }
    const g = new BufferGeometry();
    for (const name of ["position", "normal", "uv", "color", "bookYear"]) g.setAttribute(name, source.getAttribute(name));
    g.setIndex(kept);
    g.computeBoundingSphere();
    return g;
  }, [forest, bark, only]);
  useEffect(() => () => subjectBark?.dispose(), [subjectBark]);
  const barkMats = useMemo(() => SPECIES.map(barkMaterial), []);
  const barkDepth = useMemo(barkDepthMaterial, []);
  const leafGeoms = useMemo(() => SPECIES.map((s) => leafGeometry(s.leaf)), []);
  const leafRefs = useRef<(InstancedMesh | null)[]>([]);
  const chunkRefs = useRef<(Group | null)[]>([]);
  const orders = useMemo(() => forest.chunks.map((c) => leafOrder(c.leafStart, c.leafCount)), [forest]);
  // Per grove, its species' leaf shape plus each instance slot's year, in the slot order the layout effect writes.
  const groveLeafGeoms = useMemo(() => forest.chunks.map((c, ci) => {
    const base = leafGeoms[c.species]!;
    const g = new BufferGeometry();
    for (const name of Object.keys(base.attributes)) g.setAttribute(name, base.getAttribute(name));
    g.setIndex(base.getIndex());
    const years = new Float32Array(Math.max(1, c.leafCount));
    const order = orders[ci]!;
    for (let n = 0; n < c.leafCount; n++) years[n] = treeYears[forest.leaves.treeIndex[c.leafStart + order[n]!]!]!;
    g.setAttribute("bookYear", new InstancedBufferAttribute(years, 1));
    return g;
  }), [forest, leafGeoms, orders, treeYears]);
  useEffect(() => () => groveLeafGeoms.forEach((g) => g.dispose()), [groveLeafGeoms]);
  useEffect(() => () => barkDepth.dispose(), [barkDepth]);
  // Per grove, the slots up to the last leaf with any size; the frame loop cuts the count below it by distance.
  const kept = useRef<number[]>([]);
  useEffect(() => () => bark.forEach((g) => g.dispose()), [bark]);
  useEffect(() => () => leafGeoms.forEach((g) => g.dispose()), [leafGeoms]);
  useEffect(() => () => {
    for (const m of barkMats) {
      m.map?.dispose();
      m.normalMap?.dispose();
      m.dispose();
    }
  }, [barkMats]);
  // The lit tree and how far up its lamps are; a new tree waits for the old one's lamps to go out.
  const lit = useRef({ tree: -1, amount: 0 });
  useFrame(({ camera }, delta) => {
    const s = useGame.getState();
    const night = nightLamps(s.sky.daylight);
    const step = Math.min(delta, 0.1) * TREE_LIGHT_RATE;
    if (TREE_LIGHT_POOL) {
      treeLight.at.value.set(sim.x, sim.z, 12, 14);
      treeLight.amount.value = night;
    } else {
      // A portrait lights its own tree; otherwise the nearest standing tree within reach of the rider.
      let want = -1;
      let near = 0;
      if (s.portrait !== null) {
        want = s.portrait.tree;
        near = 1;
      } else if (night > 0) {
        let best = Infinity;
        for (const t of treesNear(forest, sim.x, sim.z, TREE_LIGHT_REACH)) {
          if (!bookShown(t.book, s.timelineYear)) continue;
          const d = Math.hypot(t.x - sim.x, t.z - sim.z);
          if (d < best) { best = d; want = forest.trees.indexOf(t); }
        }
        // Keep the lit tree unless another is clearly nearer, so riding between two does not flicker.
        const cur = forest.trees[lit.current.tree];
        if (cur && want !== lit.current.tree) {
          const dc = Math.hypot(cur.x - sim.x, cur.z - sim.z);
          if (dc < TREE_LIGHT_REACH && dc < best + 2) { want = lit.current.tree; best = dc; }
        }
        if (want >= 0) near = 1 - Math.min(1, Math.max(0, (best - TREE_LIGHT_FULL) / (TREE_LIGHT_REACH - TREE_LIGHT_FULL)));
      }
      const l = lit.current;
      if (want !== l.tree && (l.amount <= 0.01 || s.portrait !== null)) {
        l.tree = want;
        if (want >= 0) {
          const t = forest.trees[want]!;
          const e = treeExtent(forest.chunks[t.chunk]!.bark.pos, t.woodStart, t.woodCount, t.x, t.z);
          treeLight.at.value.set(t.x, t.z, Math.max(e.radius * 1.1, t.trunkRadius * 4), Math.max(e.maxY, 1));
        }
      }
      const target = want === l.tree && want >= 0 ? night * near : 0;
      l.amount = s.portrait !== null ? target : l.amount + Math.max(-step, Math.min(step, target - l.amount));
      treeLight.amount.value = l.amount;
    }
    windStrength.value = s.preferences.motion ? 1 : 0;
    // A portrait shows its tree whatever the timeline's year.
    timelineYear.value = s.portrait === null && s.timelineYear !== null ? s.timelineYear : TIMELINE_OFF;
    if (s.preferences.motion && !s.paused) wind.value += Math.min(delta, 0.1);
    // Every grove is drawn, however thick the fog. Hiding the ones the fog had swallowed
    // made them pop in as it thinned or the cart came near, since a fogged grove still
    // stands out against the sky; the leaf thinning by distance keeps the cost down.
    // God's eye sees every grove from far above: thinning by count alone would bare the
    // whole forest, so there it draws fewer, larger leaves instead, eased in from the
    // ground's thinning by height so a dive to the cart lands without a change (godLeafBlend).
    // The camera mode stays "god" through a dive until it lands.
    const god = s.preferences.camera === "god" && s.portrait === null;
    const thin = !god && s.portrait === null;
    forest.chunks.forEach((c, i) => {
      const g = chunkRefs.current[i];
      if (!g) return;
      const subject = s.portrait ? forest.trees[s.portrait.tree]!.chunk : null;
      const dist = Math.hypot(c.x - camera.position.x, c.z - camera.position.z) - c.radius;
      g.visible = subject === null || i === subject;
      const mesh = leafRefs.current[i];
      const full = kept.current[i] ?? c.leafCount;
      const above = camera.position.y - CROWN_HEIGHT;
      const lod = god && GOD_LOD
        ? godLeafBlend(Math.hypot(Math.max(0, dist), Math.max(0, above)), above, leafFraction(dist, LEAF_FULL, LEAF_FLOOR))
        : null;
      if (mesh) mesh.count = lod ? Math.max(1, Math.ceil(full * lod.fraction)) : thin ? Math.max(1, Math.ceil(full * leafFraction(dist, LEAF_FULL, LEAF_FLOOR))) : full;
      materials[i]!.leafScale.value = lod ? lod.scale : 1;
    });
  });

  const match = useMemo(() => {
    if (only !== null) return new Set([only]);
    if (!q) return null;
    const set = new Set<number>();
    forest.trees.forEach((t, i) => {
      if (bookMatchesQuery(t.book, q)) set.add(i);
    });
    return set;
  }, [forest, q, only]);

  useLayoutEffect(() => {
    // The season's wood colour tints the photo bark rather than replacing it.
    const colors = bark.map((g) => g.getAttribute("color") as BufferAttribute);
    const tint = new Color(palette.wood).lerp(white, 0.55);
    for (let ti = 0; ti < forest.trees.length; ti++) {
      const tree = forest.trees[ti]!;
      const attr = colors[tree.chunk]!;
      color.copy(tint);
      if (match && !match.has(ti)) color.multiplyScalar(0.45);
      for (let k = 0; k < tree.woodCount; k++) attr.setXYZ(tree.woodStart + k, color.r, color.g, color.b);
    }
    for (const attr of colors) attr.needsUpdate = true;
  }, [forest, bark, palette.wood, match]);

  useLayoutEffect(() => {
    const { pos, scale, quat, tint, treeIndex } = forest.leaves;
    forest.chunks.forEach((chunk, ci) => {
      const mesh = leafRefs.current[ci];
      if (!mesh) return;
      const species = SPECIES[chunk.species]!;
      const [dh, ds, dl] = species.foliageShift;
      // Conifers keep their needles through the year: evergreen colours, every leaf drawn.
      // The needle palette is already the conifer's own, so the species shift (tuned for
      // the season's broadleaf colours, and darkening) is not applied to it.
      const foliage = species.evergreen
        ? palette.evergreen.map((hex) => new Color(hex))
        : palette.foliage.map((hex) => new Color(hex).offsetHSL(dh, ds, dl));
      const density = species.evergreen ? 1 : palette.density;
      const order = orders[ci]!;
      let last = -1;
      for (let n = 0; n < chunk.leafCount; n++) {
        const i = chunk.leafStart + order[n]!;
        const treeI = treeIndex[i]!;
        const dim = match && !match.has(treeI);
        const visible = keepLeaf(i, density) && !dim;
        dummy.position.set(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
        const s = visible ? 1 : match && dim && only === null ? 0.15 : 0;
        if (s > 0) last = n;
        dummy.scale.set(scale[i * 3]! * s, scale[i * 3 + 1]! * s, scale[i * 3 + 2]! * s);
        dummy.quaternion.set(quat[i * 4]!, quat[i * 4 + 1]!, quat[i * 4 + 2]!, quat[i * 4 + 3]!);
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        color.copy(foliage[tint[i]! % foliage.length]!);
        if (match && match.has(treeI)) color.offsetHSL(0, 0.05, 0.08);
        mesh.setColorAt(n, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      kept.current[ci] = last + 1;
      mesh.count = chunk.leafCount;
      // Bounds from the real instances, so frustum culling can skip this grove.
      mesh.computeBoundingSphere();
    });
  }, [forest, palette, match, only, orders]);

  useLayoutEffect(() => {
    const mesh = ringRef.current;
    if (!mesh) return;
    forest.trees.forEach((t, i) => {
      dummy.position.set(t.x, 0.05, t.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      const speaking = only === null && t.book.slug === mootSpeaker?.slug;
      const on = speaking || (match && only === null ? match.has(i) && bookShown(t.book, year) : false);
      const r = t.trunkRadius * (speaking ? 7 : 4.2);
      dummy.scale.set(on ? r : 0.0001, on ? r : 0.0001, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(speaking ? mootSpeaker.color : t.color);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [forest, match, only, mootSpeaker, year]);

  return (
    <group>
      {forest.chunks.map((chunk, ci) => (
        <group key={`chunk-${ci}`} ref={(g) => { chunkRefs.current[ci] = g; }}
          visible={only === null || ci === forest.trees[only]!.chunk}>
          <mesh geometry={subjectBark && ci === forest.trees[only!]!.chunk ? subjectBark : bark[ci]} material={barkMats[chunk.species]} customDepthMaterial={barkDepth} castShadow receiveShadow />
          <instancedMesh ref={(m) => { leafRefs.current[ci] = m; }}
            args={[groveLeafGeoms[ci], materials[ci]!.leaf, Math.max(1, chunk.leafCount)]} customDepthMaterial={materials[ci]!.depth}
            castShadow receiveShadow />
        </group>
      ))}
      <instancedMesh ref={ringRef} args={[undefined, undefined, forest.trees.length]} frustumCulled={false}>
        <ringGeometry args={[0.72, 1, 20]} />
        <meshBasicMaterial transparent opacity={0.85} />
      </instancedMesh>
    </group>
  );
}
