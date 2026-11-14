import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, InstancedMesh, MeshDepthMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, RepeatWrapping, RGBADepthPacking, SRGBColorSpace } from "three";
import { textureAnisotropy } from "./Environment";
import { corpusTreeAt, HUB_PLAQUE_DIR, HUB_PLAQUE_DIST, type Forest } from "./forest";
import type { SeasonName } from "./seasons";
import { Lectern } from "./Signposts";
import { redwoodBarkPixels, sprayStrokes, SPRAY_SIZE } from "./redwoodTextures";
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

/**
 * Redwood bark, drawn once: long fibrous ridges between deep furrows that
 * wander as they climb, cinnamon on the ridges and near-black in the cracks.
 * A height field gives both the colour and the normal map, and every term is
 * periodic, so the tile repeats without a seam (REDWOOD_BARK sets its size).
 */
function redwoodBark() {
  const px = redwoodBarkPixels();
  const color = document.createElement("canvas");
  const normal = document.createElement("canvas");
  color.width = normal.width = px.width;
  color.height = normal.height = px.height;
  const cctx = color.getContext("2d")!, nctx = normal.getContext("2d")!;
  const cimg = cctx.createImageData(px.width, px.height), nimg = nctx.createImageData(px.width, px.height);
  cimg.data.set(px.color);
  nimg.data.set(px.normal);
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
  c.width = SPRAY_SIZE.width;
  c.height = SPRAY_SIZE.height;
  const ctx = c.getContext("2d")!;
  ctx.lineCap = "round";
  for (const s of sprayStrokes()) {
    ctx.strokeStyle = s.style;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
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

/** The redwood as the timeline shows it: grown from the books standing at its year, or whole in a portrait. */
export function useCorpusTree(forest: Forest) {
  const year = useGame((s) => (s.portrait === null ? s.timelineYear : null));
  return useMemo(() => corpusTreeAt(forest, year), [forest, year]);
}

function pointer(on: boolean) {
  document.body.style.cursor = on ? "pointer" : "";
}

function RedwoodPlaque({ c }: { c: Forest["corpusTree"] }) {
  const byline = `${c.limbs} books · ${c.totalChunks.toLocaleString("en-US")} chunks · ${Math.round(c.height)} m`;
  const x = Math.cos(HUB_PLAQUE_DIR) * HUB_PLAQUE_DIST;
  const z = Math.sin(HUB_PLAQUE_DIR) * HUB_PLAQUE_DIST;
  // Tapping the plaque shows it at reading size, as an exhibit's does; tapping the tree lists every book.
  return (
    <group position={[x, 0, z]} rotation={[0, Math.atan2(x, z), 0]}
      onClick={(e) => { e.stopPropagation(); useGame.getState().openPlaque({ title: "The Corpus Redwood", byline, body: REDWOOD_BODY }); }}
      onPointerOver={() => pointer(true)} onPointerOut={() => pointer(false)}>
      <Lectern title="The Corpus Redwood" byline={byline} body={REDWOOD_BODY} />
    </group>
  );
}

/** The hub's redwood: one bark mesh and one instanced draw of foliage sprays. */
export function CorpusRedwood({ forest, season }: { forest: Forest; season: SeasonName }) {
  const c = useCorpusTree(forest);
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
      <mesh geometry={bark} material={barkMat} castShadow receiveShadow />
      {/* Tapping the trunk lists every book. An invisible cone takes the click:
          hit-testing the bark itself, one limb per book, on every pointer move costs too much. */}
      <mesh position={[0, c.height * 0.3, 0]}
        onClick={(e) => { e.stopPropagation(); useGame.getState().openCatalog(null); }}
        onPointerOver={() => pointer(true)} onPointerOut={() => pointer(false)}>
        <cylinderGeometry args={[c.baseRadius * 0.35, c.baseRadius, c.height * 0.6, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {/* Sized for the whole redwood, so the timeline's smaller ones reuse it (mesh.count). */}
      <instancedMesh ref={ref} args={[spray, sprayMat, Math.max(1, forest.corpusTree.foliage.count)]} customDepthMaterial={sprayDepth}
        castShadow receiveShadow />
      <RedwoodPlaque c={c} />
      <UplightFixtures radius={c.baseRadius + 0.5} count={6} pool={3.5} />
    </group>
  );
}
