import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector2,
  type BufferGeometry,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { cinema } from "./cinema";
import { activeEvent, stage } from "./events";
import type { Exhibit } from "./exhibits";
import { reflectionMap } from "./FlameOfKnowledge";
import { setHum, sigh } from "./hum";
import { ExhibitPlaque } from "./Signposts";
import { sim, wrapAngle } from "./sim";
import { useGame } from "./store";
import {
  LEG_H, LIFT_R, PAD_R, PAD_TOP, SAUCER_R, SHAFT_R, VISITOR_END, visitorPose, visitorShot, type Walker,
} from "./visitorScript";

/**
 * The landing field: a raised pad in an open glade, kept for in-app events
 * (events.ts). Empty on most days. During the visitor event a craft lands on
 * it when the rider comes near (visitorScript.ts has the timeline) and lowers
 * a lift from a shaft up its axis, so nothing passes through the hull. Drawn to
 * the Art Techno rules (~/repos/art_techno, docs/STYLE.md): an obsidian hull
 * ruled with copper traces and gold pads, server lights for running lights,
 * an iris for a door, a stepped crown with a green die, and figures carved in
 * a few flat facets. Everything is primitives and lathes except the visitor's
 * head, cut from the Art Techno statue of Knowledge (public/models/visitor_head.glb,
 * ~2,600 triangles, no textures; the brow band is its second material).
 */

const FIELD_BODY =
  "A pad in an open glade with nothing above it but sky. It is kept clear for visitors. " +
  "Most days nobody comes. Now and then someone does.";

const HEAD_URL = "models/visitor_head.glb";
/** The rider is this close when the craft starts its approach. */
const TRIGGER_DIST = 90;
const MARKERS = 16;
const RIM_LIGHTS = 48;
const TRACES = 16;
/** Legs at these bearings, clear of the way out toward the road at 0. */
const LEG_BEARINGS = [Math.PI / 3, Math.PI, (5 * Math.PI) / 3];
const LEG_TOP_R = 3.0;
const LEG_FOOT_R = 4.1;
/** The craft is modeled 4.6 m in radius and drawn at SAUCER_R. */
const BASE_R = 4.6;
const K = SAUCER_R / BASE_R;
/** The shaft in model units. */
const WELL_R = SHAFT_R / K;
const WELL_H = 2.0;

/** Seconds into the landing: null until it starts. Kept for the session, so it plays once. */
let landingT: number | null = null;
let sighed = false;

const PALETTE = {
  obsidian: "#161d1a", panel: "#121a17", copper: "#c77c48", gold: "#d4af5a",
  green: "#2f8f74", mint: "#7fbfa8", silk: "#ede6d3",
};

/** The craft's hull, belly center at the origin, open round the shaft: faceted, 16 planes round. */
function hullGeometry() {
  const pts = [[WELL_R, 0], [1.6, 0.06], [3.6, 0.4], [BASE_R, 0.74], [BASE_R, 1.0], [4.0, 1.34], [2.8, 1.9], [2.4, 2.1], [0, 2.1]];
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
      band: new MeshStandardMaterial({ color: PALETTE.green, emissive: PALETTE.green, emissiveIntensity: 0.5, roughness: 0.35, flatShading: true }),
    };
  }, []);
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  // The painted sky fades with the real one, as on the flame.
  const daylight = useGame((s) => s.sky.daylight);
  for (const k of ["obsidian", "panel", "copper", "gold"] as const) m[k].envMapIntensity = 0.05 + 0.95 * daylight;
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
      {via ? <mesh rotation={[Math.PI / 2, 0, 0]} material={m.gold}><cylinderGeometry args={[top * 0.55, top * 0.55, top * 2.1, 8]} /></mesh> : null}
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
        <Limb key={z} at={[0, 1.15, z]} len={1.15} top={0.17} bottom={0.13} sides={6} m={m} mat={m.obsidian} via
          setRef={(g) => { if (i) limbs.legR = g; else limbs.legL = g; }}>
          <mesh position={[0.06, -1.12, 0]} material={m.copper}><boxGeometry args={[0.42, 0.08, 0.24]} /></mesh>
        </Limb>
      ))}
      <mesh position={[0, 1.62, 0]} material={m.copper}><cylinderGeometry args={[0.44, 0.33, 0.95, 8]} /></mesh>
      <mesh position={[0.3, 1.66, 0]} material={m.obsidian}><boxGeometry args={[0.14, 0.62, 0.42]} /></mesh>
      {[-0.1, 0, 0.1].map((z) => (
        <mesh key={z} position={[0.375, 1.66, z]} material={m.gold}><boxGeometry args={[0.012, 0.56, 0.025]} /></mesh>
      ))}
      {[-0.5, 0.5].map((z) => [0, 1, 2, 3].map((k) => (
        <mesh key={`${z}${k}`} position={[0, 2.0 + k * 0.055, z * (1 - k * 0.08)]} material={m.copper}>
          <boxGeometry args={[0.42 - k * 0.06, 0.03, 0.28]} />
        </mesh>
      )))}
      {[-0.56, 0.56].map((z, i) => (
        <Limb key={z} at={[0, 2.0, z]} len={1.0} top={0.12} bottom={0.09} sides={6} m={m} mat={m.obsidian} via
          setRef={(g) => { if (i) limbs.armR = g; else limbs.armL = g; }} />
      ))}
      <mesh position={[0, 2.22, 0]} material={m.gold}><cylinderGeometry args={[0.13, 0.16, 0.1, 8]} /></mesh>
      <mesh position={[0, 2.42, 0]} material={m.obsidian}><cylinderGeometry args={[0.22, 0.25, 0.32, 8]} /></mesh>
      <mesh position={[0, 2.62, 0]} material={m.obsidian}><cylinderGeometry args={[0.15, 0.21, 0.1, 8]} /></mesh>
      <mesh position={[0, 2.71, 0]} material={m.gold}><cylinderGeometry args={[0.07, 0.13, 0.07, 8]} /></mesh>
      {/* The band where eyes would be, and the light that sweeps along it. */}
      <mesh position={[0.22, 2.45, 0]} material={m.visor}><boxGeometry args={[0.06, 0.06, 0.34]} /></mesh>
      <mesh ref={sweepRef} position={[0.255, 2.45, 0]} material={m.lights} visible={false}><boxGeometry args={[0.02, 0.065, 0.08]} /></mesh>
    </group>
  );
}

/** Knowledge's head, loaded once and painted in the series' gold and green; null until it arrives. */
function useHead(m: Materials): Object3D | null {
  const [head, setHead] = useState<Object3D | null>(null);
  useEffect(() => {
    let live = true;
    new GLTFLoader().load(HEAD_URL, (gltf) => {
      gltf.scene.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        // Exported without normals; the materials shade it flat, facet by facet.
        o.geometry.computeVertexNormals();
        const band = (o.material as { name?: string }).name === "band";
        (o.material as MeshStandardMaterial).dispose();
        o.material = band ? m.band : m.gold;
      });
      if (live) setHead(gltf.scene);
    }, undefined, () => { /* no head: the visitor stays headless rather than breaking the scene */ });
    return () => { live = false; };
  }, [m]);
  return head;
}

/**
 * The visitor: 1.85 m, carved in gold facets like the statue whose head it
 * wears, a green belt with gold studs, copper traces down the legs, and a
 * slate with a green die in the right hand. Faces +x.
 */
function Guest({ m, groupRef, limbs }: { m: Materials; groupRef: Ref<Group>; limbs: Limbs }) {
  const head = useHead(m);
  return (
    <group ref={groupRef} visible={false}>
      {[-0.11, 0.11].map((z, i) => (
        <Limb key={z} at={[0, 0.9, z]} len={0.9} top={0.095} bottom={0.065} sides={6} m={m} mat={m.gold}
          setRef={(g) => { if (i) limbs.legR = g; else limbs.legL = g; }}>
          <mesh position={[0, -0.45, z > 0 ? 0.075 : -0.075]} material={m.copper}><boxGeometry args={[0.02, 0.8, 0.012]} /></mesh>
          <mesh position={[0.05, -0.88, 0]} material={m.gold}><boxGeometry args={[0.22, 0.06, 0.1]} /></mesh>
        </Limb>
      ))}
      <mesh position={[0, 1.2, 0]} material={m.gold}><cylinderGeometry args={[0.2, 0.17, 0.62, 8]} /></mesh>
      <mesh position={[0, 0.97, 0]} material={m.band}><cylinderGeometry args={[0.185, 0.185, 0.07, 8]} /></mesh>
      {[-0.07, 0, 0.07].map((z) => (
        <mesh key={z} position={[0.18, 0.97, z]} rotation={[0, 0, Math.PI / 2]} material={m.gold}><cylinderGeometry args={[0.022, 0.022, 0.02, 8]} /></mesh>
      ))}
      <mesh position={[0, 1.5, 0]} material={m.gold}><cylinderGeometry args={[0.12, 0.2, 0.08, 8]} /></mesh>
      {[-0.26, 0.26].map((z, i) => (
        <Limb key={z} at={[0, 1.46, z]} len={0.62} top={0.06} bottom={0.045} sides={6} m={m} mat={m.gold}
          setRef={(g) => { if (i) limbs.armR = g; else limbs.armL = g; }}>
          {i ? (
            <group position={[0.07, -0.66, 0]} rotation={[0, 0, 0.35]}>
              <mesh material={m.gold}><boxGeometry args={[0.24, 0.035, 0.31]} /></mesh>
              <mesh position={[0, 0.02, 0]} material={m.obsidian}><boxGeometry args={[0.21, 0.02, 0.28]} /></mesh>
              <mesh position={[0, 0.034, 0]} material={m.die}><boxGeometry args={[0.05, 0.012, 0.05]} /></mesh>
            </group>
          ) : null}
        </Limb>
      ))}
      {head ? <primitive object={head} position={[0, 1.47, 0]} scale={0.95} /> : null}
    </group>
  );
}

/** The craft: hull, gold rim, server lights, copper traces, stepped crown, belly lights and iris. */
function Craft({ m, rimLights, iris }: { m: Materials; rimLights: Ref<InstancedMesh>; iris: Ref<Group> }) {
  const hull = useMemo(hullGeometry, []);
  useEffect(() => () => hull.dispose(), [hull]);
  const box = useMemo(() => ({
    light: () => new LatheGeometry([new Vector2(0, -0.04), new Vector2(0.09, -0.04), new Vector2(0.09, 0.04), new Vector2(0, 0.04)], 4),
  }), []);
  // Copper traces up the upper hull, each from a gold pad at the rim to one at the crown.
  const slope = Math.atan2(1.9 - 1.34, 4.0 - 2.8);
  const traceGeo = useMemo(() => new LatheGeometry([new Vector2(0, 0), new Vector2(0.02, 0), new Vector2(0.02, 1.25), new Vector2(0, 1.25)], 4), []);
  const placeTrace = useMemo(() => (i: number, o: Object3D) => {
    const a = (2 * Math.PI * (i + 0.5)) / TRACES;
    o.rotation.set(0, -a, 0);
    o.position.set(Math.cos(a) * 3.98, 1.36, Math.sin(a) * 3.98);
    // Lie the trace along the hull, rising inward.
    o.rotateZ(Math.PI / 2 - slope);
  }, [slope]);
  const padGeo = useMemo(() => new LatheGeometry([new Vector2(0, 0), new Vector2(0.07, 0), new Vector2(0.07, 0.03), new Vector2(0, 0.03)], 8), []);
  const placePad = useMemo(() => (i: number, o: Object3D) => {
    const a = (2 * Math.PI * ((i >> 1) + 0.5)) / TRACES;
    const r = i & 1 ? 2.85 : 3.95;
    o.position.set(Math.cos(a) * r, i & 1 ? 1.88 : 1.36, Math.sin(a) * r);
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
      {/* The stepped crown, Deco's setback tower, with the green die at its peak. */}
      <mesh position={[0, 2.25, 0]} material={m.panel}><cylinderGeometry args={[2.25, 2.4, 0.3, 16]} /></mesh>
      <mesh position={[0, 2.43, 0]} material={m.gold}><cylinderGeometry args={[1.82, 1.82, 0.06, 16]} /></mesh>
      <mesh position={[0, 2.62, 0]} material={m.obsidian}><cylinderGeometry args={[1.65, 1.8, 0.35, 16]} /></mesh>
      <mesh position={[0, 2.84, 0]} material={m.gold}><cylinderGeometry args={[1.16, 1.16, 0.06, 16]} /></mesh>
      <mesh position={[0, 3.02, 0]} material={m.obsidian}><cylinderGeometry args={[1.0, 1.12, 0.32, 16]} /></mesh>
      <mesh position={[0, 3.22, 0]} material={m.gold}><boxGeometry args={[0.78, 0.08, 0.78]} /></mesh>
      <mesh position={[0, 3.34, 0]} material={m.die}><boxGeometry args={[0.56, 0.16, 0.56]} /></mesh>
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
function Visitor({ exhibit, face, m }: { exhibit: Exhibit; face: number; m: Materials }) {
  const craft = useRef<Group>(null);
  const rimLights = useRef<InstancedMesh>(null);
  const iris = useRef<Group>(null);
  const legs = useRef<(Group | null)[]>([]);
  const lift = useRef<Group>(null);
  const shaft = useRef<Mesh>(null);
  const beam = useRef<Mesh>(null);
  const dust = useRef<Mesh>(null);
  const robot = useRef<Group>(null);
  const guest = useRef<Group>(null);
  const sweep = useRef<Mesh>(null);
  const robotLimbs = useMemo(newLimbs, []);
  const guestLimbs = useMemo(newLimbs, []);
  const tint = useMemo(() => ({ c: new Color(), mint: new Color(PALETTE.mint), green: new Color(PALETTE.green), white: new Color("#ffffff") }), []);
  const legLen = Math.hypot(LEG_FOOT_R - LEG_TOP_R, LEG_H + 0.3);
  const legTilt = Math.atan2(LEG_FOOT_R - LEG_TOP_R, LEG_H + 0.3);
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
      lift.current.visible = p.iris > 0.5;
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
    poseWalker(robot.current, robotLimbs, p.robot, 0.35, dt);
    poseWalker(guest.current, guestLimbs, p.guest, 0.5, dt);
    m.visor.opacity = 0.15 + 0.85 * p.visor;
    if (sweep.current) {
      sweep.current.visible = p.visor > 0.05;
      sweep.current.position.z = 0.13 * p.sweep;
    }
    // Standing, the visitor's right arm comes up and forward, the slate held out.
    if (guestLimbs.armR && p.guest.stride === null) guestLimbs.armR.rotation.z = 1.6 * p.offer;

    // The camera follows the landing while the rider sits still, and lets go a little after.
    const watching = landingT < VISITOR_END + 3 && s.preferences.motion && cinema.idle > 1.2 && Math.abs(sim.speed) < 0.3;
    cinema.weight += ((watching ? 1 : 0) - cinema.weight) * (1 - Math.exp(-1.6 * dt));
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
          <group key={a} position={[Math.cos(a) * LEG_TOP_R, 0.3, Math.sin(a) * LEG_TOP_R]} rotation={[0, -a, 0]}>
            <group rotation={[0, 0, legTilt]} ref={(g) => { legs.current[i] = g; }}>
              <mesh position={[0, -legLen / 2, 0]} material={m.copper}><boxGeometry args={[0.16, legLen, 0.16]} /></mesh>
              <mesh position={[0, -legLen, 0]} rotation={[0, 0, -legTilt]} material={m.gold}><cylinderGeometry args={[0.38, 0.45, 0.08, 8]} /></mesh>
            </group>
          </group>
        ))}
      </group>
      <mesh ref={beam} material={m.beam} visible={false}>
        <cylinderGeometry args={[2.2, 4.8, 1, 16, 1, true]} />
      </mesh>
      <mesh ref={dust} rotation={[-Math.PI / 2, 0, 0]} position={[0, PAD_TOP + 0.03, 0]} material={m.dust} visible={false}>
        <ringGeometry args={[4.6, 5.4, 32]} />
      </mesh>
      {/* The lift: a gold platform ringed in copper, in a shaft of light from the iris to the pad. */}
      <group ref={lift} visible={false}>
        <mesh position={[0, -0.04, 0]} material={m.gold}><cylinderGeometry args={[LIFT_R, LIFT_R, 0.08, 16]} /></mesh>
        <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.copper}><torusGeometry args={[LIFT_R, 0.04, 4, 16]} /></mesh>
      </group>
      <mesh ref={shaft} position={[0, PAD_TOP + LEG_H / 2, 0]} material={m.shaft} visible={false}>
        <cylinderGeometry args={[SHAFT_R * 0.97, SHAFT_R * 0.97, LEG_H, 16, 1, true]} />
      </mesh>
      <Sentinel m={m} groupRef={robot} limbs={robotLimbs} sweepRef={sweep} />
      <Guest m={m} groupRef={guest} limbs={guestLimbs} />
    </>
  );
}

export function LandingField({ exhibit }: { exhibit: Exhibit }) {
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
        {event === "visitor" ? <Visitor exhibit={exhibit} face={face} m={m} /> : null}
      </group>
    </group>
  );
}
