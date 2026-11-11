import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PointLight,
  Vector2,
  Vector3,
  type BufferGeometry,
} from "three";
import { cinema } from "./cinema";
import { artTree, dieOrder, grownFraction, litDieCount, powerLevel } from "./artTree";
import { activeEvent, stage } from "./events";
import type { Exhibit } from "./exhibits";
import { treeApproach, type Forest } from "./forest";
import { reflectionMap } from "./FlameOfKnowledge";
import { setHum, sigh } from "./hum";
import { ExhibitPlaque } from "./Signposts";
import { sim, wrapAngle } from "./sim";
import { useGame } from "./store";
import {
  GROWN_AT, LEG_H, LIFT_R, PAD_R, PAD_TOP, PAVE_Y, SAUCER_R, SHAFT_R, TREE_AT, VISITOR_END, visitorPose, visitorShot, WEDGE, WHEEL_R, type Walker,
} from "./visitorScript";

/**
 * The landing field: a raised pad in an open glade, kept for in-app events
 * (events.ts). Empty on most days. During the visitor event a craft lands on
 * it when the rider comes near (visitorScript.ts has the timeline) and lowers
 * a lift from a shaft up its axis, so nothing passes through the hull. Drawn to
 * the Art Techno rules (~/repos/art_techno, docs/STYLE.md): an obsidian hull
 * ruled with copper traces and gold pads, server lights for running lights,
 * an iris for a door, a stepped crown with a green die, a sentinel carved in a
 * few flat facets, a cart, and a tree routed like a circuit board
 * (artTree.ts). Everything is primitives and lathes: no models or textures.
 */

const FIELD_BODY =
  "A pad in an open glade with nothing above it but sky. It is kept clear for visitors. " +
  "Most days nobody comes. Now and then someone does.";

/** The rider is this close, on the spur or the plaza, when the craft starts its approach (home is about 40 m off). */
const TRIGGER_DIST = 30;
const MARKERS = 16;
const RIM_LIGHTS = 24;
const TRACES = 16;
const WEDGE_TILT = Math.atan2(PAD_TOP - PAVE_Y, WEDGE.to - WEDGE.from);
/** Legs at these bearings, clear of the way out toward the road at 0. */
const LEG_BEARINGS = [Math.PI / 3, Math.PI, (5 * Math.PI) / 3];
/** Legs from under the hull out to feet near the pad's edge. */
const LEG_TOP_R = 6.0;
const LEG_FOOT_R = 6.9;
/** Where the legs meet the hull's underside, over the belly. */
const LEG_TOP_Y = 0.6;
/** The craft is modeled 4.6 m in radius and drawn at SAUCER_R. */
const BASE_R = 4.6;
const K = SAUCER_R / BASE_R;
/** The shaft in model units. */
const WELL_R = SHAFT_R / K;
const WELL_H = 1.6;

/** Seconds into the landing: null until it starts. Kept for the session, so it plays once. */
let landingT: number | null = null;
let sighed = false;
/** Once the landing has been watched to the end on this device, later visits find it already down, the tree grown. */
const SEEN_KEY = "kp.event.visitor.seen";
function landingSeen(): boolean {
  try { return window.localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}
function markLandingSeen() {
  try { window.localStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode: it plays again next time */ }
}
/** The camera is the landing's (cinema weight past half), and whether clean view was turned on for it. */
let holding = false;
let cleanedForShot = false;

const PALETTE = {
  obsidian: "#161d1a", panel: "#121a17", copper: "#c77c48", gold: "#d4af5a",
  green: "#2f8f74", mint: "#7fbfa8", silk: "#ede6d3",
};

/** The craft's hull, belly center at the origin, open round the shaft: faceted, 16 planes round. */
function hullGeometry() {
  const pts = [[WELL_R, 0], [1.6, 0.06], [3.6, 0.4], [BASE_R, 0.74], [BASE_R, 1.0], [4.0, 1.25], [2.8, 1.55], [2.4, 1.65], [0, 1.65]];
  return new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), 16);
}

function useMaterials() {
  const m = useMemo(() => {
    const env = reflectionMap();
    const metal = (color: string, metalness: number, roughness: number) =>
      new MeshStandardMaterial({ color, metalness, roughness, envMap: env, flatShading: true });
    return {
      env,
      pad: new MeshStandardMaterial({ color: "#3d4442", roughness: 0.75, metalness: 0.2 }),
      marker: new MeshBasicMaterial({ color: PALETTE.mint }),
      obsidian: metal(PALETTE.obsidian, 0.55, 0.3),
      // Double-sided: it also lines the shaft, seen from inside.
      panel: Object.assign(metal(PALETTE.panel, 0.4, 0.45), { side: DoubleSide }),
      copper: metal(PALETTE.copper, 0.8, 0.32),
      gold: metal(PALETTE.gold, 0.85, 0.26),
      die: new MeshStandardMaterial({ color: PALETTE.green, emissive: PALETTE.green, emissiveIntensity: 1.2, roughness: 0.3 }),
      lights: new MeshBasicMaterial({ color: "#ffffff" }),
      beam: new MeshBasicMaterial({ color: PALETTE.mint, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      dust: new MeshBasicMaterial({ color: PALETTE.silk, transparent: true, opacity: 0, depthWrite: false }),
      shaft: new MeshBasicMaterial({ color: PALETTE.mint, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      iris: new MeshBasicMaterial({ color: "#e8fff6", transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      visor: new MeshBasicMaterial({ color: "#5fe0b8", transparent: true, opacity: 0.15 }),
      // The figures in less metal than the craft, so the light under it shows them, not just glints.
      fgold: new MeshStandardMaterial({ color: PALETTE.gold, metalness: 0.35, roughness: 0.42, envMap: env, flatShading: true }),
      fcopper: new MeshStandardMaterial({ color: PALETTE.copper, metalness: 0.35, roughness: 0.45, envMap: env, flatShading: true }),
      fobsidian: new MeshStandardMaterial({ color: "#2a3330", metalness: 0.3, roughness: 0.5, envMap: env, flatShading: true }),
      treeCopper: new MeshStandardMaterial({ color: PALETTE.copper, emissive: "#5a2a10", emissiveIntensity: 0.2, metalness: 0.5, roughness: 0.38, envMap: env, flatShading: true }),
      via: new MeshBasicMaterial({ color: "#f0d690" }),
      // The tree's vias and dies take their light from instance colours (the power-on, the reading).
      treeVia: new MeshBasicMaterial({ color: "#ffffff" }),
      treeDie: new MeshBasicMaterial({ color: "#ffffff" }),
      hit: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      band: new MeshStandardMaterial({ color: PALETTE.green, emissive: PALETTE.green, emissiveIntensity: 0.5, roughness: 0.35, flatShading: true }),
    };
  }, []);
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  // The painted sky fades with the real one, as on the flame.
  const daylight = useGame((s) => s.sky.daylight);
  for (const k of ["obsidian", "panel", "copper", "gold", "fgold", "fcopper", "fobsidian", "treeCopper"] as const) m[k].envMapIntensity = 0.05 + 0.95 * daylight;
  return m;
}

type Materials = ReturnType<typeof useMaterials>;

/** Copies of one shape, one per placement, as a single instanced mesh. */
function Instances({ geometry, material, place, count }: {
  geometry: BufferGeometry; material: MeshStandardMaterial | MeshBasicMaterial; count: number;
  place: (i: number, o: Object3D) => void;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
      place(i, o);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, place]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={ref} args={[geometry, material, count]} />;
}

/** The pad's ring of marker lights. */
function PadMarkers({ m }: { m: Materials }) {
  const geometry = useMemo(() => new LatheGeometry([new Vector2(0, 0), new Vector2(0.09, 0), new Vector2(0, 0.03)], 6), []);
  const place = useMemo(() => (i: number, o: Object3D) => {
    const a = (2 * Math.PI * i) / MARKERS;
    o.position.set(Math.cos(a) * (PAD_R - 0.35), PAD_TOP + 0.005, Math.sin(a) * (PAD_R - 0.35));
  }, []);
  return <Instances geometry={geometry} material={m.marker} count={MARKERS} place={place} />;
}

/** Limbs a walker swings: legs and arms, each a group pivoting at hip or shoulder about z. */
type Limbs = { legL: Group | null; legR: Group | null; armL: Group | null; armR: Group | null };
const newLimbs = (): Limbs => ({ legL: null, legR: null, armL: null, armR: null });

/** Place a walker and swing its limbs; its turn eases toward the pose's yaw. */
function poseWalker(g: Group | null, limbs: Limbs, w: Walker, swing: number, dt: number) {
  if (!g) return;
  g.visible = w.shown;
  g.position.set(w.x, w.y, w.z);
  g.rotation.y += wrapAngle(w.yaw - g.rotation.y) * Math.min(1, dt * 4);
  const s = w.stride === null ? 0 : Math.sin(w.stride) * swing;
  if (limbs.legL) limbs.legL.rotation.z = s;
  if (limbs.legR) limbs.legR.rotation.z = -s;
  if (limbs.armL) limbs.armL.rotation.z = -s * 0.7;
  if (limbs.armR) limbs.armR.rotation.z = s * 0.7;
}

/** A limb pivoting at its top: a faceted taper hanging `len` below the joint, with a gold via at the joint. */
function Limb({ at, len, top, bottom, sides, m, mat, via, setRef, children }: {
  at: [number, number, number]; len: number; top: number; bottom: number; sides: number; m: Materials;
  mat: MeshStandardMaterial; via?: boolean; setRef: (g: Group | null) => void; children?: ReactNode;
}) {
  return (
    <group position={at} ref={setRef}>
      <mesh position={[0, -len / 2, 0]} material={mat}><cylinderGeometry args={[top, bottom, len, sides]} /></mesh>
      {via ? <mesh rotation={[Math.PI / 2, 0, 0]} material={m.fgold}><cylinderGeometry args={[top * 0.55, top * 0.55, top * 2.1, 8]} /></mesh> : null}
      {children}
    </group>
  );
}

/**
 * The sentinel: 2.5 m, faceless as the series asks of anything that is not a
 * person. Obsidian limbs, a copper body with a gold bus down the chest,
 * heat-sink fins for shoulders, gold vias at the joints, and a stepped head
 * with a green band where eyes would be. Faces +x.
 */
function Sentinel({ m, groupRef, limbs, sweepRef }: { m: Materials; groupRef: Ref<Group>; limbs: Limbs; sweepRef: Ref<Mesh> }) {
  return (
    <group ref={groupRef} visible={false}>
      {[-0.2, 0.2].map((z, i) => (
        <Limb key={z} at={[0, 1.15, z]} len={1.15} top={0.17} bottom={0.13} sides={6} m={m} mat={m.fobsidian} via
          setRef={(g) => { if (i) limbs.legR = g; else limbs.legL = g; }}>
          <mesh position={[0.06, -1.105, 0]} material={m.fcopper}><boxGeometry args={[0.42, 0.08, 0.24]} /></mesh>
        </Limb>
      ))}
      <mesh position={[0, 1.62, 0]} material={m.fcopper}><cylinderGeometry args={[0.44, 0.33, 0.95, 8]} /></mesh>
      <mesh position={[0.3, 1.66, 0]} material={m.fobsidian}><boxGeometry args={[0.14, 0.62, 0.42]} /></mesh>
      {[-0.1, 0, 0.1].map((z) => (
        <mesh key={z} position={[0.375, 1.66, z]} material={m.fgold}><boxGeometry args={[0.012, 0.56, 0.025]} /></mesh>
      ))}
      {[-0.5, 0.5].map((z) => [0, 1, 2, 3].map((k) => (
        <mesh key={`${z}${k}`} position={[0, 2.0 + k * 0.055, z * (1 - k * 0.08)]} material={m.fcopper}>
          <boxGeometry args={[0.42 - k * 0.06, 0.03, 0.28]} />
        </mesh>
      )))}
      {[-0.56, 0.56].map((z, i) => (
        <Limb key={z} at={[0, 2.0, z]} len={1.0} top={0.12} bottom={0.09} sides={6} m={m} mat={m.fobsidian} via
          setRef={(g) => { if (i) limbs.armR = g; else limbs.armL = g; }} />
      ))}
      <mesh position={[0, 2.22, 0]} material={m.fgold}><cylinderGeometry args={[0.13, 0.16, 0.1, 8]} /></mesh>
      <mesh position={[0, 2.42, 0]} material={m.fobsidian}><cylinderGeometry args={[0.22, 0.25, 0.32, 8]} /></mesh>
      <mesh position={[0, 2.62, 0]} material={m.fobsidian}><cylinderGeometry args={[0.15, 0.21, 0.1, 8]} /></mesh>
      <mesh position={[0, 2.71, 0]} material={m.fgold}><cylinderGeometry args={[0.07, 0.13, 0.07, 8]} /></mesh>
      {/* The band where eyes would be, and the light that sweeps along it. */}
      <mesh position={[0.22, 2.45, 0]} material={m.visor}><boxGeometry args={[0.06, 0.06, 0.34]} /></mesh>
      <mesh ref={sweepRef} position={[0.255, 2.45, 0]} material={m.lights} visible={false}><boxGeometry args={[0.02, 0.065, 0.08]} /></mesh>
    </group>
  );
}

/**
 * The cart: an obsidian rover on four copper-tyred wheels with gold hubs, mint
 * headlamps, and the seed, a green die in a gold cradle, on its back. Faces +x.
 */
function Rover({ m, groupRef, wheels, seedRef }: { m: Materials; groupRef: Ref<Group>; wheels: (Group | null)[]; seedRef: Ref<Mesh> }) {
  // 1.4 x 0.9 m: its corners stay inside the lift's platform.
  return (
    <group ref={groupRef} visible={false}>
      <mesh position={[0, 0.5, 0]} material={m.fobsidian}><boxGeometry args={[1.4, 0.4, 0.9]} /></mesh>
      <mesh position={[0, 0.74, 0]} material={m.fobsidian}><boxGeometry args={[1.05, 0.1, 0.68]} /></mesh>
      <mesh position={[0, 0.705, 0]} material={m.fgold}><boxGeometry args={[1.42, 0.03, 0.92]} /></mesh>
      {/* A glowing trim round its waist, so it reads at night away from the light. */}
      <mesh position={[0, 0.42, 0]} material={m.marker}><boxGeometry args={[1.43, 0.04, 0.93]} /></mesh>
      {[-1, 1].map((sx) => [-1, 1].map((sz, k) => (
        <group key={`${sx}${sz}`} position={[sx * 0.48, WHEEL_R, sz * 0.5]} ref={(g) => { wheels[(sx > 0 ? 2 : 0) + k] = g; }}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={m.fcopper}><cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.14, 8]} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, sz * 0.075]} material={m.via}><cylinderGeometry args={[0.08, 0.08, 0.02, 8]} /></mesh>
        </group>
      )))}
      {[-0.25, 0.25].map((z) => (
        <mesh key={z} position={[0.71, 0.52, z]} material={m.lights}><boxGeometry args={[0.02, 0.08, 0.16]} /></mesh>
      ))}
      <mesh position={[0, 0.83, 0]} material={m.fgold}><cylinderGeometry args={[0.22, 0.18, 0.08, 8]} /></mesh>
      <mesh ref={seedRef} position={[0, 1.0, 0]} rotation={[Math.PI / 4, 0, Math.PI / 4]} material={m.die}><boxGeometry args={[0.26, 0.26, 0.26]} /></mesh>
    </group>
  );
}

/**
 * The tree the cart plants (artTree.ts): copper branches routed at 0 and 45
 * degrees, gold vias at the junctions, green dies for leaves. Grown once and
 * revealed root to tips as `grow` rises; the instances are only rewritten
 * while it is growing.
 */
function ArtTreeView({ m, forest }: { m: Materials; forest: Forest }) {
  const tree = useMemo(() => artTree(), []);
  const order = useMemo(() => dieOrder(tree), [tree]);
  const library = useGame((s) => s.library);
  // Which dies the rider's reading has lit, by leaf index.
  const lit = useMemo(() => {
    const on = new Set(order.slice(0, litDieCount(tree.leaves.length, library.length, forest?.trees.length ?? 0)));
    return tree.leaves.map((_, i) => on.has(i));
  }, [order, tree, library.length, forest]);
  const colors = useMemo(() => ({ c: new Color(), via: new Color("#f6dc96"), viaOff: new Color("#5a4a26"), die: new Color("#45e0ae"), dieOff: new Color("#123a2f") }), []);
  const segRef = useRef<InstancedMesh>(null);
  const viaRef = useRef<InstancedMesh>(null);
  const leafRef = useRef<InstancedMesh>(null);
  const geo = useMemo(() => ({
    seg: new CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0),
    via: new OctahedronGeometry(1, 0),
    leaf: new BoxGeometry(1, 1, 1),
  }), []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const tmp = useMemo(() => ({ o: new Object3D(), up: new Vector3(0, 1, 0), dir: new Vector3(), last: -1 }), []);
  const daylight = useGame((s) => s.sky.daylight);
  // A warm glow in the copper by night, as if lit from within; by day it is plain metal.
  m.treeCopper.emissiveIntensity = 0.15 + 0.5 * (1 - daylight);

  useFrame(() => {
    if (landingT === null) return;
    const segs = segRef.current, vias = viaRef.current, leaves = leafRef.current;
    if (!segs || !vias || !leaves) return;
    // The power-on and the dies the reading has lit: every frame, as the light moves.
    const since = landingT - GROWN_AT;
    const breathe = useGame.getState().preferences.motion;
    const { c } = colors;
    tree.vias.forEach((v, i) => {
      const k = powerLevel(since, v.along, tree.total, breathe);
      vias.setColorAt(i, c.copy(colors.viaOff).lerp(colors.via, k));
    });
    tree.leaves.forEach((l, i) => {
      const k = lit[i] ? powerLevel(since, l.along, tree.total, breathe) : 0;
      leaves.setColorAt(i, c.copy(colors.dieOff).lerp(colors.die, k));
    });
    if (vias.instanceColor) vias.instanceColor.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    // The shapes only while it grows.
    const g = visitorPose(Math.min(landingT, VISITOR_END)).grow;
    if (g === tmp.last) return;
    tmp.last = g;
    const { o } = tmp;
    tree.segs.forEach((s, i) => {
      const f = grownFraction(g, s.along, s.length, tree.total);
      tmp.dir.set(s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]).normalize();
      o.position.set(...s.from);
      o.quaternion.setFromUnitVectors(tmp.up, tmp.dir);
      // Thin while young, full girth once grown past.
      o.scale.set(s.radius * (0.4 + 0.6 * f), Math.max(1e-4, s.length * f), s.radius * (0.4 + 0.6 * f));
      o.updateMatrix();
      segs.setMatrixAt(i, o.matrix);
    });
    tree.vias.forEach((v, i) => {
      const f = grownFraction(g, v.along, 0.4, tree.total);
      o.position.set(...v.at);
      o.quaternion.identity();
      o.scale.setScalar(Math.max(1e-4, v.size * f));
      o.updateMatrix();
      vias.setMatrixAt(i, o.matrix);
    });
    tree.leaves.forEach((l, i) => {
      const f = grownFraction(g, l.along, 0.8, tree.total);
      o.position.set(...l.at);
      o.rotation.set(Math.PI / 4, l.spin, Math.PI / 4);
      o.scale.setScalar(Math.max(1e-4, l.size * f));
      o.updateMatrix();
      leaves.setMatrixAt(i, o.matrix);
    });
    segs.instanceMatrix.needsUpdate = vias.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true;
  });

  // Tapped once grown: off to a book the rider has not read yet, its card open, as a search hit lands.
  const [grown, setGrown] = useState(false);
  useFrame(() => { if (!grown && landingT !== null && landingT >= GROWN_AT) setGrown(true); });
  const visit = () => {
    const read = new Set(useGame.getState().library);
    const unread = forest.trees.filter((t) => !read.has(t.book.slug));
    const pool = unread.length ? unread : forest.trees;
    const tree = pool[Math.floor(Math.random() * pool.length)];
    if (!tree) return;
    const st = useGame.getState();
    st.pickSearch(tree.book.slug);
    st.pinTree(tree.book.slug);
    st.requestJump(treeApproach(tree, forest.home.x, forest.home.z), tree.book.title);
  };

  return (
    <group position={TREE_AT}>
      <instancedMesh ref={segRef} args={[geo.seg, m.treeCopper, tree.segs.length]} frustumCulled={false} />
      <instancedMesh ref={viaRef} args={[geo.via, m.treeVia, tree.vias.length]} frustumCulled={false} />
      <instancedMesh ref={leafRef} args={[geo.leaf, m.treeDie, tree.leaves.length]} frustumCulled={false} />
      {/* One invisible column to tap, once the tree is grown: the instances' own bounds go stale as they grow. */}
      {grown ? (
        <mesh position={[0, tree.height / 2, 0]} material={m.hit}
          onClick={(ev) => { ev.stopPropagation(); visit(); }}
          onPointerOver={() => { document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { document.body.style.cursor = ""; }}>
          <cylinderGeometry args={[tree.reach * 0.75, 1.2, tree.height, 8]} />
        </mesh>
      ) : null}
    </group>
  );
}

/** The craft: hull, gold rim, server lights, copper traces, a low stepped crown, glowing traces underneath, belly lights and iris. */
function Craft({ m, rimLights, iris }: { m: Materials; rimLights: Ref<InstancedMesh>; iris: Ref<Group> }) {
  const hull = useMemo(hullGeometry, []);
  useEffect(() => () => hull.dispose(), [hull]);
  const box = useMemo(() => ({
    light: () => new LatheGeometry([new Vector2(0, -0.04), new Vector2(0.09, -0.04), new Vector2(0.09, 0.04), new Vector2(0, 0.04)], 4),
  }), []);
  // Copper traces up the upper hull, each from a gold pad at the rim to one at the crown.
  const slope = Math.atan2(1.55 - 1.25, 4.0 - 2.8);
  const traceGeo = useMemo(() => new LatheGeometry([new Vector2(0, 0), new Vector2(0.02, 0), new Vector2(0.02, 1.22), new Vector2(0, 1.22)], 4), []);
  const placeTrace = useMemo(() => (i: number, o: Object3D) => {
    const a = (2 * Math.PI * (i + 0.5)) / TRACES;
    o.rotation.set(0, -a, 0);
    o.position.set(Math.cos(a) * 3.98, 1.27, Math.sin(a) * 3.98);
    // Lie the trace along the hull, rising inward.
    o.rotateZ(Math.PI / 2 - slope);
  }, [slope]);
  const padGeo = useMemo(() => new LatheGeometry([new Vector2(0, 0), new Vector2(0.07, 0), new Vector2(0.07, 0.03), new Vector2(0, 0.03)], 8), []);
  const placePad = useMemo(() => (i: number, o: Object3D) => {
    const a = (2 * Math.PI * ((i >> 1) + 0.5)) / TRACES;
    const r = i & 1 ? 2.85 : 3.95;
    o.position.set(Math.cos(a) * r, i & 1 ? 1.54 : 1.27, Math.sin(a) * r);
    o.rotation.set(0, -a, -slope);
  }, [slope]);
  const placeRim = useMemo(() => (i: number, o: Object3D) => {
    const a = (2 * Math.PI * i) / RIM_LIGHTS;
    o.position.set(Math.cos(a) * (BASE_R + 0.02), 0.87, Math.sin(a) * (BASE_R + 0.02));
    o.rotation.set(0, -a, 0);
    o.scale.set(0.5, 1, 1.4);
  }, []);
  const placeBelly = useMemo(() => (i: number, o: Object3D) => {
    const a = (2 * Math.PI * (i + 0.5)) / 12;
    o.position.set(Math.cos(a) * 3.3, 0.24, Math.sin(a) * 3.3);
    o.scale.set(1.2, 0.6, 1.2);
  }, []);
  const lightGeo = useMemo(() => box.light(), [box]);
  const bellyGeo = useMemo(() => box.light(), [box]);
  return (
    <>
      <mesh geometry={hull} material={m.obsidian} />
      {[0.76, 0.98].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={m.gold}><cylinderGeometry args={[BASE_R + 0.01, BASE_R + 0.01, 0.05, 16, 1, true]} /></mesh>
      ))}
      <instancedMesh ref={rimLights} args={[lightGeo, m.lights, RIM_LIGHTS]} />
      <RimLayout mesh={rimLights} place={placeRim} />
      <Instances geometry={traceGeo} material={m.copper} count={TRACES} place={placeTrace} />
      <Instances geometry={padGeo} material={m.gold} count={TRACES * 2} place={placePad} />
      <Instances geometry={bellyGeo} material={m.marker} count={12} place={placeBelly} />
      <UnderTraces m={m} />
      {/* The stepped crown, Deco's setback tower, with the green die at its peak. */}
      <mesh position={[0, 1.75, 0]} material={m.panel}><cylinderGeometry args={[2.25, 2.4, 0.2, 16]} /></mesh>
      <mesh position={[0, 1.875, 0]} material={m.gold}><cylinderGeometry args={[1.82, 1.82, 0.05, 16]} /></mesh>
      <mesh position={[0, 2.0, 0]} material={m.obsidian}><cylinderGeometry args={[1.65, 1.8, 0.2, 16]} /></mesh>
      <mesh position={[0, 2.125, 0]} material={m.gold}><cylinderGeometry args={[1.16, 1.16, 0.05, 16]} /></mesh>
      <mesh position={[0, 2.24, 0]} material={m.obsidian}><cylinderGeometry args={[1.0, 1.12, 0.18, 16]} /></mesh>
      <mesh position={[0, 2.36, 0]} material={m.gold}><boxGeometry args={[0.78, 0.06, 0.78]} /></mesh>
      <mesh position={[0, 2.44, 0]} material={m.die}><boxGeometry args={[0.56, 0.1, 0.56]} /></mesh>
      {/* The shaft up the axis, dark inside, lit at its head. */}
      <mesh position={[0, WELL_H / 2, 0]} material={m.panel}><cylinderGeometry args={[WELL_R, WELL_R, WELL_H, 16, 1, true]} /></mesh>
      <mesh position={[0, WELL_H, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.marker}><circleGeometry args={[WELL_R, 16]} /></mesh>
      {/* The iris across the shaft's mouth: eight copper blades over a disc of light. */}
      <group ref={iris} position={[0, -0.02, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} material={m.iris}><circleGeometry args={[WELL_R, 16]} /></mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 4, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} material={m.copper}>
              <circleGeometry args={[WELL_R + 0.05, 3, -Math.PI / 8 - 0.06, Math.PI / 4 + 0.12]} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

/** The underside's segments, each from (r, y) to (r, y) just under the hull: shaft lip to rim. */
const UNDER_SEGS: [[number, number], [number, number]][] = [[[WELL_R + 0.15, 0.02], [1.6, 0.06]], [[1.6, 0.06], [3.6, 0.4]], [[3.6, 0.4], [4.5, 0.71]]];
const SPOKES = 16;

/**
 * Glowing traces under the belly: sixteen radial runs from the shaft to the
 * rim, crossed by two ring buses, the light pulsing outward from the shaft
 * while the craft is busy and breathing slowly once it rests.
 */
function UnderTraces({ m }: { m: Materials }) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new BoxGeometry(1, 0.025, 0.07), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const tint = useMemo(() => ({ c: new Color(), mint: new Color(PALETTE.mint) }), []);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new Object3D();
    for (let sp = 0; sp < SPOKES; sp++) {
      const a = (2 * Math.PI * sp) / SPOKES;
      UNDER_SEGS.forEach(([[r0, y0], [r1, y1]], k) => {
        o.position.set(Math.cos(a) * (r0 + r1) / 2, (y0 + y1) / 2 - 0.018, Math.sin(a) * (r0 + r1) / 2);
        o.rotation.set(0, -a, Math.atan2(y1 - y0, r1 - r0));
        o.scale.set(Math.hypot(r1 - r0, y1 - y0), 1, 1);
        o.updateMatrix();
        im.setMatrixAt(sp * UNDER_SEGS.length + k, o.matrix);
        im.setColorAt(sp * UNDER_SEGS.length + k, tint.mint);
      });
    }
    im.instanceMatrix.needsUpdate = true;
  }, [tint]);
  useFrame(() => {
    const im = ref.current;
    if (!im || landingT === null) return;
    const busy = landingT < VISITOR_END;
    for (let k = 0; k < UNDER_SEGS.length; k++) {
      // A wave running outward from the shaft, or a slow breath at rest.
      const level = busy ? 0.35 + 0.65 * Math.max(0, Math.cos(landingT * 3 - k * 1.1)) : 0.6 + 0.2 * Math.sin(landingT * 0.8);
      tint.c.copy(tint.mint).multiplyScalar(level);
      for (let sp = 0; sp < SPOKES; sp++) im.setColorAt(sp * UNDER_SEGS.length + k, tint.c);
    }
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={ref} args={[geometry, m.lights, SPOKES * UNDER_SEGS.length]} />
      {[[1.6, 0.04], [3.6, 0.38]].map(([r, y]) => (
        <mesh key={r} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.marker}><torusGeometry args={[r, 0.03, 4, 48]} /></mesh>
      ))}
    </>
  );
}

/** Lays out the rim's server lights once; their colours change every frame. */
function RimLayout({ mesh, place }: { mesh: Ref<InstancedMesh>; place: (i: number, o: Object3D) => void }) {
  useLayoutEffect(() => {
    const im = (mesh as { current: InstancedMesh | null }).current;
    if (!im) return;
    const o = new Object3D();
    for (let i = 0; i < RIM_LIGHTS; i++) {
      o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
      place(i, o);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      im.setColorAt(i, new Color(PALETTE.mint));
    }
    im.instanceMatrix.needsUpdate = true;
  }, [mesh, place]);
  return null;
}

/** The craft, its legs, the lift, the light and dust, and the two who come down. */
function Visitor({ exhibit, forest, face, m }: { exhibit: Exhibit; forest: Forest; face: number; m: Materials }) {
  const craft = useRef<Group>(null);
  const rimLights = useRef<InstancedMesh>(null);
  const iris = useRef<Group>(null);
  const legs = useRef<(Group | null)[]>([]);
  const lift = useRef<Group>(null);
  const shaft = useRef<Mesh>(null);
  const beam = useRef<Mesh>(null);
  const dust = useRef<Mesh>(null);
  const robot = useRef<Group>(null);
  const cart = useRef<Group>(null);
  const wheels = useMemo<(Group | null)[]>(() => [], []);
  const seedOnCart = useRef<Mesh>(null);
  const seed = useRef<Mesh>(null);
  const sweep = useRef<Mesh>(null);
  const lamp = useRef<PointLight>(null);
  const robotLimbs = useMemo(newLimbs, []);
  const tint = useMemo(() => ({ c: new Color(), mint: new Color(PALETTE.mint), green: new Color(PALETTE.green), white: new Color("#ffffff") }), []);
  const legLen = Math.hypot(LEG_FOOT_R - LEG_TOP_R, LEG_H + LEG_TOP_Y);
  const legTilt = Math.atan2(LEG_FOOT_R - LEG_TOP_R, LEG_H + LEG_TOP_Y);
  const cos = Math.cos(face), sin = Math.sin(face);
  const toWorld = (p: [number, number, number], out: [number, number, number]) => {
    out[0] = exhibit.x + p[0] * cos + p[2] * sin;
    out[1] = p[1];
    out[2] = exhibit.z - p[0] * sin + p[2] * cos;
  };

  useEffect(() => () => { setHum(0); cinema.weight = 0; stage.swarm = 0; }, []);

  useFrame((state, delta) => {
    const s = useGame.getState();
    const dt = Math.min(delta, 0.1);
    if (landingT === null && landingSeen()) {
      // Seen before: already landed, the tree grown and powered, nothing to watch.
      landingT = VISITOR_END + 60;
    }
    if (landingT === null) {
      if (Math.hypot(sim.x - exhibit.x, sim.z - exhibit.z) > TRIGGER_DIST) {
        if (craft.current) craft.current.visible = false;
        return;
      }
      landingT = s.preferences.motion ? 0 : VISITOR_END;
    } else if (!s.paused) {
      landingT = s.preferences.motion ? landingT + dt : Math.max(landingT, VISITOR_END);
    }
    const t = Math.min(landingT, VISITOR_END);
    const p = visitorPose(t);
    if (craft.current) {
      craft.current.visible = true;
      craft.current.position.set(...p.saucer);
      craft.current.rotation.z = p.bank;
    }
    // Server lights: a chase round the rim in flight, a slow blink once down.
    const im = rimLights.current;
    if (im) {
      const run = landingT * (t < VISITOR_END ? 14 : 2);
      for (let i = 0; i < RIM_LIGHTS; i++) {
        const k = (i + Math.floor(run)) % 6;
        tint.c.copy(k === 0 ? tint.white : k < 3 ? tint.mint : tint.green).multiplyScalar(k > 3 ? 0.35 : 1);
        im.setColorAt(i, tint.c);
      }
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    legs.current.forEach((g) => { if (g) g.scale.set(1, Math.max(0.02, p.legs), 1); });
    if (iris.current) {
      // Each blade slides out along its own bisector and shrinks toward the rim.
      iris.current.children.slice(1).forEach((blade) => {
        const b = blade.children[0]!;
        b.position.set(0.75 * WELL_R * p.iris, -0.01, 0);
        b.scale.setScalar(1 - 0.75 * p.iris);
      });
    }
    // While the shaft is open its light reads from the iris, not the closed blades.
    m.iris.opacity = 0.9 * p.iris * (1 - p.shaft * 0.7);
    if (p.iris > 0.05 && !sighed) { sighed = true; if (!s.preferences.silent) sigh(); }
    if (lift.current) {
      lift.current.visible = p.iris > 0.05;
      lift.current.position.y = p.lift;
    }
    if (shaft.current) {
      shaft.current.visible = p.shaft > 0.01;
      m.shaft.opacity = 0.14 * p.shaft;
    }
    if (beam.current) {
      beam.current.visible = p.beam > 0.01;
      const h = Math.max(0.1, p.saucer[1]);
      beam.current.scale.set(1, h, 1);
      beam.current.position.set(p.saucer[0], h / 2, p.saucer[2]);
      m.beam.opacity = 0.16 * p.beam;
    }
    if (dust.current) {
      dust.current.visible = p.dust > 0 && p.dust < 1;
      dust.current.scale.setScalar(1 + 2.2 * p.dust);
      m.dust.opacity = 0.35 * (1 - p.dust);
    }
    // The light under the craft: up as the legs come down, full once the iris opens, stronger by night.
    if (lamp.current) lamp.current.intensity = 60 * Math.max(p.iris, 0.4 * p.legs) * (0.55 + 0.45 * (1 - s.sky.daylight));
    poseWalker(robot.current, robotLimbs, p.robot, 0.35, dt);
    const c = cart.current;
    if (c) {
      c.visible = p.cart.shown;
      c.position.set(p.cart.x, p.cart.y, p.cart.z);
      c.rotation.y += wrapAngle(p.cart.yaw - c.rotation.y) * Math.min(1, dt * 5);
      // On the wedge: nose down going out, nose up coming back.
      const outward = Math.abs(wrapAngle(c.rotation.y + WEDGE.bearing)) < Math.PI / 2;
      c.rotation.z = p.cart.y > PAVE_Y + 0.001 && p.cart.y < PAD_TOP - 0.001 ? (outward ? -WEDGE_TILT : WEDGE_TILT) : 0;
      for (const w of wheels) if (w && p.cart.stride !== null) w.rotation.z = -p.cart.stride;
    }
    // The seed hops from the cart's back to the ground at the tree's foot, and sinks in.
    if (seedOnCart.current) seedOnCart.current.visible = p.plant === 0;
    if (seed.current) {
      seed.current.visible = p.plant > 0 && p.grow < 0.02;
      const k = p.plant;
      seed.current.position.set(
        p.cart.x + (TREE_AT[0] - p.cart.x) * k,
        1.0 * (1 - k) + 2.2 * k * (1 - k) * 2,
        p.cart.z + (TREE_AT[2] - p.cart.z) * k,
      );
    }

    m.visor.opacity = 0.15 + 0.85 * p.visor;
    if (sweep.current) {
      sweep.current.visible = p.visor > 0.05;
      sweep.current.position.z = 0.13 * p.sweep;
    }

    // The camera follows the landing while the rider sits still, and lets go a little after.
    if (landingT >= VISITOR_END && !landingSeen()) markLandingSeen();
    // Only near the field: a tap on the tree that flies the rider off ends the watching.
    const atField = Math.hypot(sim.x - exhibit.x, sim.z - exhibit.z) < 40;
    const watching = atField && landingT < VISITOR_END + 3 && s.preferences.motion && cinema.idle > 1.2 && Math.abs(sim.speed) < 0.3;
    cinema.weight += ((watching ? 1 : 0) - cinema.weight) * (1 - Math.exp(-1.6 * dt));
    // Clean view while the camera is the landing's, put back as it was after.
    if (!holding && cinema.weight > 0.5) {
      holding = true;
      if (!s.cleanView) { useGame.setState({ cleanView: true }); cleanedForShot = true; }
    } else if (holding && cinema.weight < 0.5) {
      holding = false;
      if (cleanedForShot && useGame.getState().cleanView) useGame.setState({ cleanView: false });
      cleanedForShot = false;
    }
    if (cinema.weight > 0.001) {
      const shot = visitorShot(t);
      toWorld(shot.cam, cinema.cam);
      toWorld(shot.look, cinema.look);
    }
    // A meteor swarm over the whole landing, dying away for half a minute after.
    stage.swarm = Math.min(1, landingT / 5) * (landingT < VISITOR_END ? 1 : Math.max(0, 1 - (landingT - VISITOR_END) / 30));
    // The drone: loud in flight, fading once down, quieter with distance.
    const near = 1 / (1 + Math.hypot(state.camera.position.x - exhibit.x, state.camera.position.z - exhibit.z) / 25);
    const phase = landingT < VISITOR_END ? 1 - 0.6 * p.legs : Math.max(0, 0.4 - (landingT - VISITOR_END) * 0.1);
    setHum(s.paused || s.preferences.silent ? 0 : phase * near);
  });

  return (
    <>
      <group ref={craft} visible={false}>
        <group scale={K}>
          <Craft m={m} rimLights={rimLights} iris={iris} />
        </group>
        {LEG_BEARINGS.map((a, i) => (
          <group key={a} position={[Math.cos(a) * LEG_TOP_R, LEG_TOP_Y, Math.sin(a) * LEG_TOP_R]} rotation={[0, -a, 0]}>
            <group rotation={[0, 0, legTilt]} ref={(g) => { legs.current[i] = g; }}>
              <mesh position={[0, -legLen / 2, 0]} material={m.copper}><boxGeometry args={[0.24, legLen, 0.24]} /></mesh>
              <mesh position={[0, -legLen, 0]} rotation={[0, 0, -legTilt]} material={m.gold}><cylinderGeometry args={[0.5, 0.6, 0.08, 8]} /></mesh>
            </group>
          </group>
        ))}
      </group>
      <mesh ref={beam} material={m.beam} visible={false}>
        <cylinderGeometry args={[3.6, 8.0, 1, 16, 1, true]} />
      </mesh>
      <mesh ref={dust} rotation={[-Math.PI / 2, 0, 0]} position={[0, PAD_TOP + 0.03, 0]} material={m.dust} visible={false}>
        <ringGeometry args={[8.2, 9.2, 48]} />
      </mesh>
      {/* The lift: a gold platform ringed in copper, in a shaft of light from the iris to the pad. */}
      <group ref={lift} visible={false}>
        <mesh position={[0, -0.04, 0]} material={m.gold}><cylinderGeometry args={[LIFT_R, LIFT_R, 0.08, 16]} /></mesh>
        <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.copper}><torusGeometry args={[LIFT_R, 0.04, 4, 16]} /></mesh>
      </group>
      <mesh ref={shaft} position={[0, PAD_TOP + LEG_H / 2, 0]} material={m.shaft} visible={false}>
        <cylinderGeometry args={[SHAFT_R * 0.97, SHAFT_R * 0.97, LEG_H, 16, 1, true]} />
      </mesh>
      {/* One real light, only while the event is on: at the rim on the road side, over where the two stand. */}
      <pointLight ref={lamp} position={[9.6, 3.6, 1.5]} color="#e4fbf1" intensity={0} distance={20} decay={2} />
      <Sentinel m={m} groupRef={robot} limbs={robotLimbs} sweepRef={sweep} />
      <Rover m={m} groupRef={cart} wheels={wheels} seedRef={seedOnCart} />
      <mesh ref={seed} rotation={[Math.PI / 4, 0, Math.PI / 4]} material={m.die} visible={false}><boxGeometry args={[0.24, 0.24, 0.24]} /></mesh>
      <ArtTreeView m={m} forest={forest} />

    </>
  );
}

export function LandingField({ exhibit, forest }: { exhibit: Exhibit; forest: Forest }) {
  const m = useMaterials();
  const event = useMemo(() => activeEvent(new Date(), window.location.search), []);
  // Local +x runs from the pad toward the road, where the rider stands to watch.
  const face = Math.atan2(-(exhibit.roadZ - exhibit.z), exhibit.roadX - exhibit.x);
  return (
    <group position={[exhibit.x, 0, exhibit.z]}>
      {/* Swung aside, clear of the way the two walk out. */}
      <ExhibitPlaque exhibit={exhibit} title="The Landing Field" byline="Kept clear" body={FIELD_BODY} aside={1.0} />
      <group rotation={[0, face, 0]}>
        {/* The cart collides with the pad's edge (exhibit.obstacle). */}
        <mesh position={[0, PAD_TOP / 2, 0]} material={m.pad} receiveShadow>
          <cylinderGeometry args={[PAD_R, PAD_R + 0.15, PAD_TOP, 32]} />
        </mesh>
        <PadMarkers m={m} />
        {/* The wedge the cart rolls down off the pad's edge. */}
        <group rotation={[0, -WEDGE.bearing, 0]}>
          <mesh position={[(WEDGE.from + WEDGE.to) / 2, (PAD_TOP + PAVE_Y) / 2 - 0.03, 0]} rotation={[0, 0, -WEDGE_TILT]} material={m.pad}>
            <boxGeometry args={[Math.hypot(WEDGE.to - WEDGE.from, PAD_TOP - PAVE_Y) + 0.1, 0.08, 1.7]} />
          </mesh>
        </group>
        {event === "visitor" ? <Visitor exhibit={exhibit} forest={forest} face={face} m={m} /> : null}
      </group>
    </group>
  );
}
