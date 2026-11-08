import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedMesh, MeshDepthMaterial, MeshStandardMaterial, Object3D, RepeatWrapping, RGBADepthPacking, Shape, ShapeGeometry, SRGBColorSpace, TextureLoader, Vector2 } from "three";
import { textureAnisotropy } from "./Environment";
import { useGame } from "./store";
import type { Forest } from "./forest";
import { bookMatchesQuery } from "./forest";
import { SEASONS, type SeasonName } from "./seasons";
import { leafLod, leafOrder } from "./foliageLod";
import { leafOutline, SPECIES, type LeafShape, type Species } from "./species";

const dummy = new Object3D();
const color = new Color();
const white = new Color("#ffffff");

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
  return new MeshStandardMaterial({
    map: load("color", true),
    normalMap: load("normal"),
    roughness: 0.92,
    vertexColors: true,
    metalness: 0,
  });
}

function leafGeometry(leaf: LeafShape) {
  const g = new ShapeGeometry(new Shape(leafOutline(leaf).map(([x, y]) => new Vector2(x, y))));
  g.computeVertexNormals();
  return g;
}

/** `?nolod` turns off distance thinning (foliageLod.ts), to compare. */
const LEAF_LOD = typeof window === "undefined" || !new URLSearchParams(window.location.search).has("nolod");

/**
 * A grove's leaf and shadow-depth materials. Each grove has its own pair, all
 * on one shader program, so that each can carry its own `leafScale`: three
 * uploads a material's uniforms only when the material changes between draws.
 */
function leafMaterials(wind: { value: number }, windStrength: { value: number }) {
  const leafScale = { value: 1 };
  const leaf = new MeshStandardMaterial({ roughness: 0.8, side: DoubleSide });
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: DoubleSide });
  for (const material of [leaf, depth]) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.windTime = wind;
      shader.uniforms.windStrength = windStrength;
      shader.uniforms.leafScale = leafScale;
      shader.vertexShader = "uniform float windTime; uniform float windStrength; uniform float leafScale;\n" + shader.vertexShader;
      // A far grove draws fewer leaves, each enlarged about its stalk (foliageLod.ts).
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n          transformed *= leafScale;");
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
        mvPosition.xyz += leafNormal * flap * tip * w * .35 * leafScale * length(instanceMatrix[1].xyz);
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
      `);
    };
    material.customProgramCacheKey = () => "forest-leaf-wind-v4";
  }
  return { leaf, depth, leafScale };
}

function keepLeaf(i: number, density: number): boolean {
  if (density >= 0.999) return true;
  // Mix adjacent indices; the old sequence kept almost every early winter leaf.
  const h = ((Math.imul(i + 1, 1664525) ^ Math.imul(i + 7, 1013904223)) >>> 0) / 4294967296;
  return h < density;
}

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
  const materials = useMemo(() => forest.chunks.map(() => leafMaterials(wind, windStrength)), [forest, wind, windStrength]);
  useEffect(() => () => materials.forEach((m) => { m.leaf.dispose(); m.depth.dispose(); }), [materials]);
  // Per grove, how many instances lead its leaf order shown (foliageLod.ts leafOrder).
  const leafShown = useRef<number[]>([]);

  // A tree portrait (portrait.ts) shows one tree and nothing else of the forest.
  const only = useGame((s) => s.portrait?.tree ?? null);
  // The tree speaking in a moot (MootOverlay.tsx) gets a ring in its moot color.
  const mootSpeaker = useGame((s) => s.mootSpeaker);

  const bark = useMemo(() => forest.chunks.map(({ bark: b }) => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(b.pos, 3));
    g.setAttribute("normal", new BufferAttribute(b.normal, 3));
    g.setAttribute("uv", new BufferAttribute(b.uv, 2));
    g.setAttribute("color", new BufferAttribute(new Float32Array(b.count * 3), 3));
    g.setIndex(new BufferAttribute(b.index, 1));
    g.computeBoundingSphere();
    return g;
  }), [forest]);
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
    for (const name of ["position", "normal", "uv", "color"]) g.setAttribute(name, source.getAttribute(name));
    g.setIndex(kept);
    g.computeBoundingSphere();
    return g;
  }, [forest, bark, only]);
  useEffect(() => () => subjectBark?.dispose(), [subjectBark]);
  const barkMats = useMemo(() => SPECIES.map(barkMaterial), []);
  const leafGeoms = useMemo(() => SPECIES.map((s) => leafGeometry(s.leaf)), []);
  const leafRefs = useRef<(InstancedMesh | null)[]>([]);
  const chunkRefs = useRef<(Group | null)[]>([]);
  useEffect(() => () => bark.forEach((g) => g.dispose()), [bark]);
  useEffect(() => () => leafGeoms.forEach((g) => g.dispose()), [leafGeoms]);
  useEffect(() => () => {
    for (const m of barkMats) {
      m.map?.dispose();
      m.normalMap?.dispose();
      m.dispose();
    }
  }, [barkMats]);
  useFrame(({ camera, scene }, delta) => {
    const s = useGame.getState();
    windStrength.value = s.preferences.motion ? 1 : 0;
    if (s.preferences.motion && !s.paused) wind.value += Math.min(delta, 0.1);
    // Hide groves the fog has swallowed (exp2 fog is 99.9% opaque at 2.6 / density);
    // hidden chunks also drop out of the shadow pass.
    const density = scene.fog && "density" in scene.fog ? (scene.fog.density as number) : 0;
    const cutoff = density > 0 ? 2.6 / density : Infinity;
    forest.chunks.forEach((c, i) => {
      const g = chunkRefs.current[i];
      if (!g) return;
      const subject = s.portrait ? forest.trees[s.portrait.tree]!.chunk : null;
      const ground = Math.hypot(c.x - camera.position.x, c.z - camera.position.z) - c.radius;
      g.visible = subject !== null ? i === subject : ground < cutoff;
      // Far groves draw a share of their leaves, enlarged; a portrait draws every leaf.
      const mesh = leafRefs.current[i];
      const shown = leafShown.current[i] ?? 0;
      if (!mesh || !g.visible) return;
      // From the camera to the nearest point of the grove, up to the height of the crowns.
      const lod = LEAF_LOD && subject === null ? leafLod(Math.hypot(Math.max(0, ground), Math.max(0, camera.position.y - 12))) : { fraction: 1, scale: 1 };
      mesh.count = Math.min(shown, Math.ceil(shown * lod.fraction));
      materials[i]!.leafScale.value = lod.scale;
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
      const [dh, ds, dl] = SPECIES[chunk.species]!.foliageShift;
      const foliage = palette.foliage.map((hex) => new Color(hex).offsetHSL(dh, ds, dl));
      // Size of each leaf: 1, small for a grove the search passed over, 0 for one the season dropped.
      const sizes = new Float32Array(chunk.leafCount);
      for (let n = 0; n < chunk.leafCount; n++) {
        const i = chunk.leafStart + n;
        const dim = match && !match.has(treeIndex[i]!);
        sizes[n] = keepLeaf(i, palette.density) && !dim ? 1 : match && dim && only === null ? 0.15 : 0;
      }
      // Shown leaves first, shuffled, so the first share of them thins every crown evenly.
      const { order, shown } = leafOrder(Array.from(sizes, (v) => v > 0), ci + 1);
      leafShown.current[ci] = shown;
      for (let slot = 0; slot < chunk.leafCount; slot++) {
        const n = order[slot]!;
        const i = chunk.leafStart + n;
        const treeI = treeIndex[i]!;
        dummy.position.set(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
        const s = sizes[n]!;
        dummy.scale.set(scale[i * 3]! * s, scale[i * 3 + 1]! * s, scale[i * 3 + 2]! * s);
        dummy.quaternion.set(quat[i * 4]!, quat[i * 4 + 1]!, quat[i * 4 + 2]!, quat[i * 4 + 3]!);
        dummy.updateMatrix();
        mesh.setMatrixAt(slot, dummy.matrix);
        color.copy(foliage[tint[i]! % foliage.length]!);
        if (match && match.has(treeI)) color.offsetHSL(0, 0.05, 0.08);
        mesh.setColorAt(slot, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // Leaves the season dropped are not drawn at all; useFrame thins the rest with distance.
      mesh.count = shown;
      // Bounds from the real instances, so frustum culling can skip this grove.
      mesh.computeBoundingSphere();
    });
  }, [forest, palette, match, only]);

  useLayoutEffect(() => {
    const mesh = ringRef.current;
    if (!mesh) return;
    forest.trees.forEach((t, i) => {
      dummy.position.set(t.x, 0.05, t.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      const speaking = only === null && t.book.slug === mootSpeaker?.slug;
      const on = speaking || (match && only === null ? match.has(i) : false);
      const r = t.trunkRadius * (speaking ? 7 : 4.2);
      dummy.scale.set(on ? r : 0.0001, on ? r : 0.0001, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(speaking ? mootSpeaker.color : t.color);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [forest, match, only, mootSpeaker]);

  return (
    <group>
      {forest.chunks.map((chunk, ci) => (
        <group key={`chunk-${ci}`} ref={(g) => { chunkRefs.current[ci] = g; }}
          visible={only === null || ci === forest.trees[only]!.chunk}>
          <mesh geometry={subjectBark && ci === forest.trees[only!]!.chunk ? subjectBark : bark[ci]} material={barkMats[chunk.species]} castShadow receiveShadow />
          <instancedMesh ref={(m) => { leafRefs.current[ci] = m; }}
            args={[leafGeoms[chunk.species], materials[ci]!.leaf, Math.max(1, chunk.leafCount)]} customDepthMaterial={materials[ci]!.depth}
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
