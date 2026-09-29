import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, InstancedMesh, MeshDepthMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, RepeatWrapping, RGBADepthPacking, SRGBColorSpace } from "three";
import { COARSE_POINTER, textureAnisotropy } from "./Environment";
import { HUB_PLAQUE_DIR, HUB_PLAQUE_DIST, type Forest } from "./forest";
import type { SeasonName } from "./seasons";
import { Lectern } from "./Signposts";
import { useGame } from "./store";
import { UplightFixtures, useUplitMaterials } from "./Uplights";

// Redwoods are evergreen: the crown keeps its colour through the year, a touch
// fresher in spring and frosted in winter.
const FOLIAGE: Record<SeasonName, string> = {
  spring: "#3d6236",
  summer: "#2f5130",
  autumn: "#35502e",
  winter: "#4a5d52",
};

/** Seamless value noise on a gx by gy lattice, smoothly interpolated; u and v in [0, 1). */
function tiledNoise(u: number, v: number, gx: number, gy: number, seed: number): number {
  const hash = (i: number, j: number) => {
    let h = (((i % gx) + gx) % gx) * 374761393 + (((j % gy) + gy) % gy) * 668265263 + seed * 2147483647;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const x = u * gx, y = v * gy;
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Redwood bark, drawn once: long fibrous ridges between deep furrows that
 * wander as they climb, cinnamon on the ridges and near-black in the cracks.
 * A height field gives both the colour and the normal map, and every term is
 * periodic, so the tile repeats without a seam (REDWOOD_BARK sets its size).
 */
function redwoodBark() {
  const W = 256, H = 512, RIDGES = 8;
  const height = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // Furrows meander: whole-number frequencies in both directions keep the tile seamless.
      const wander = 0.22 * Math.sin(2 * Math.PI * (2 * v + u)) + 0.14 * Math.sin(2 * Math.PI * (3 * v - 2 * u) + 1.3)
        + 0.5 * (tiledNoise(u, v, 8, 3, 1) - 0.5);
      const t = (((u * RIDGES + wander) % 1) + 1) % 1;
      const ridge = Math.pow(Math.sin(Math.PI * t), 0.55);
      // Fibres: noise stretched up the trunk, fine across it.
      const fibre = tiledNoise(u, v, 96, 10, 2) * 0.6 + tiledNoise(u, v, 48, 5, 3) * 0.4;
      height[y * W + x] = ridge * (0.72 + 0.28 * fibre) - 0.12 * tiledNoise(u, v, 16, 4, 4);
    }
  }
  const color = document.createElement("canvas");
  const normal = document.createElement("canvas");
  color.width = normal.width = W;
  color.height = normal.height = H;
  const cctx = color.getContext("2d")!, nctx = normal.getContext("2d")!;
  const cimg = cctx.createImageData(W, H), nimg = nctx.createImageData(W, H);
  const at = (x: number, y: number) => height[((y + H) % H) * W + ((x + W) % W)]!;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h = Math.max(0, at(x, y));
      const k = (y * W + x) * 4;
      const tone = Math.pow(h, 1.3);
      // Furrow (38, 17, 11) to cinnamon ridge (156, 74, 44), greying a little on the most weathered tops.
      const grey = Math.max(0, h - 0.82) * 1.6;
      cimg.data[k] = 38 + (156 - 38) * tone + (150 - 156) * grey;
      cimg.data[k + 1] = 17 + (74 - 17) * tone + (118 - 74) * grey;
      cimg.data[k + 2] = 11 + (44 - 11) * tone + (100 - 44) * grey;
      cimg.data[k + 3] = 255;
      // Tangent-space normal, +v up the image (textures load flipped).
      const dx = (at(x + 1, y) - at(x - 1, y)) * 3.2, dy = (at(x, y + 1) - at(x, y - 1)) * 3.2;
      const len = Math.hypot(dx, dy, 1);
      nimg.data[k] = ((-dx / len) * 0.5 + 0.5) * 255;
      nimg.data[k + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      nimg.data[k + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      nimg.data[k + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  nctx.putImageData(nimg, 0, 0);
  const wrap = (c: HTMLCanvasElement, srgb: boolean) => {
    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.anisotropy = textureAnisotropy(8);
    if (srgb) tex.colorSpace = SRGBColorSpace;
    return tex;
  };
  return new MeshStandardMaterial({ map: wrap(color, true), normalMap: wrap(normal, false), roughness: 0.95, metalness: 0 });
}

/**
 * One flat redwood spray, drawn once: a stem from the base (left) to the tip,
 * short flat needles either side, longest mid-spray. Near-white so each
 * instance's colour tints it; the transparent ground is cut away by alphaTest.
 */
function sprayTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#c9d3ad";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(4, 64);
  ctx.lineTo(250, 64);
  ctx.stroke();
  ctx.lineWidth = 5;
  for (let x = 10; x < 248; x += 6) {
    const t = (x - 10) / 238;
    const len = 54 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) + 6;
    for (const side of [-1, 1]) {
      const l = 78 + ((x * 7 + side * 13) % 17);
      ctx.strokeStyle = `hsl(95 30% ${l}%)`;
      ctx.beginPath();
      ctx.moveTo(x, 64);
      ctx.lineTo(x + len * 0.3, 64 + side * len);
      ctx.stroke();
    }
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = textureAnisotropy(4);
  return tex;
}

const REDWOOD_BODY =
  "One tree for the whole library. It grows by the same rule as every book tree, doubled: " +
  "3.4 m of height for each doubling of the corpus's chunks. It carries one limb per book, " +
  "the biggest books lowest, and each limb reaches toward that book's own tree in the forest. " +
  "The trunk is as thick as its limbs together: at any height its cross-section is the sum of " +
  "theirs above it. Click the tree or press B to browse every book and jump to its tree.";

function pointer(on: boolean) {
  document.body.style.cursor = on ? "pointer" : "";
}

function RedwoodPlaque({ forest }: { forest: Forest }) {
  const c = forest.corpusTree;
  const byline = `${c.limbs} books · ${c.totalChunks.toLocaleString("en-US")} chunks · ${Math.round(c.height)} m`;
  const x = Math.cos(HUB_PLAQUE_DIR) * HUB_PLAQUE_DIST;
  const z = Math.sin(HUB_PLAQUE_DIR) * HUB_PLAQUE_DIST;
  // Tapping the plaque lists every book, as tapping the tree does.
  return (
    <group position={[x, 0, z]} rotation={[0, Math.atan2(x, z), 0]}
      onClick={(e) => { e.stopPropagation(); useGame.getState().openCatalog(null); }}
      onPointerOver={() => pointer(true)} onPointerOut={() => pointer(false)}>
      <Lectern title="The Corpus Redwood" byline={byline} body={REDWOOD_BODY} />
    </group>
  );
}

/** The hub's redwood: one bark mesh and one instanced draw of foliage sprays. */
export function CorpusRedwood({ forest, season }: { forest: Forest; season: SeasonName }) {
  const c = forest.corpusTree;
  const bark = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(c.bark.pos, 3));
    g.setAttribute("normal", new BufferAttribute(c.bark.normal, 3));
    g.setAttribute("uv", new BufferAttribute(c.bark.uv, 2));
    g.setIndex(new BufferAttribute(c.bark.index, 1));
    g.computeBoundingSphere();
    return g;
  }, [c]);
  const barkMat = useMemo(redwoodBark, []);
  // Floodlit from lamps round the root flare at night (Uplights.tsx), fading up the trunk.
  useUplitMaterials(useMemo(() => [barkMat], [barkMat]), "#ffe2c0", 1.0, 8);
  // A unit card in the ground plane: x along the spray, z across it.
  const spray = useMemo(() => new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const sprayMap = useMemo(sprayTexture, []);
  const sprayMat = useMemo(() => new MeshStandardMaterial({ map: sprayMap, alphaTest: 0.5, side: DoubleSide, roughness: 0.85 }), [sprayMap]);
  const sprayDepth = useMemo(() => new MeshDepthMaterial({ depthPacking: RGBADepthPacking, map: sprayMap, alphaTest: 0.5, side: DoubleSide }), [sprayMap]);
  useEffect(() => () => bark.dispose(), [bark]);
  useEffect(() => () => {
    barkMat.map?.dispose();
    barkMat.normalMap?.dispose();
    barkMat.dispose();
    spray.dispose();
    sprayMap.dispose();
    sprayMat.dispose();
    sprayDepth.dispose();
  }, [barkMat, spray, sprayMap, sprayMat, sprayDepth]);

  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const { pos, scale, quat, shade, count } = c.foliage;
    const o = new Object3D();
    const base = new Color(FOLIAGE[season]);
    const color = new Color();
    for (let i = 0; i < count; i++) {
      o.position.set(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
      o.scale.set(scale[i * 3]!, scale[i * 3 + 1]!, scale[i * 3 + 2]!);
      o.quaternion.set(quat[i * 4]!, quat[i * 4 + 1]!, quat[i * 4 + 2]!, quat[i * 4 + 3]!);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, color.copy(base).offsetHSL(0, 0, (shade[i]! - 3.5) * 0.012));
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [c, season]);

  return (
    <group>
      {/* Touch devices skip the redwood's shadows, as they do the book trees' leaves. */}
      <mesh geometry={bark} material={barkMat} castShadow={!COARSE_POINTER} receiveShadow />
      {/* Tapping the trunk lists every book. An invisible cone takes the click:
          hit-testing the bark itself, one limb per book, on every pointer move costs too much. */}
      <mesh position={[0, c.height * 0.3, 0]}
        onClick={(e) => { e.stopPropagation(); useGame.getState().openCatalog(null); }}
        onPointerOver={() => pointer(true)} onPointerOut={() => pointer(false)}>
        <cylinderGeometry args={[c.baseRadius * 0.35, c.baseRadius, c.height * 0.6, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <instancedMesh ref={ref} args={[spray, sprayMat, Math.max(1, c.foliage.count)]} customDepthMaterial={sprayDepth}
        castShadow={!COARSE_POINTER} receiveShadow={!COARSE_POINTER} />
      <RedwoodPlaque forest={forest} />
      <UplightFixtures radius={c.baseRadius + 0.5} count={6} pool={3.5} />
    </group>
  );
}
