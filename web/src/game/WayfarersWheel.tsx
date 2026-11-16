import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, InstancedMesh, LatheGeometry, MeshStandardMaterial, Object3D, TorusGeometry, Vector2 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TIER_COLOR, TIER_NAME, tracks, type Tier } from "./achievements";
import type { Forest } from "./forest";
import { useGame, type PlaqueText } from "./store";
import { groveTally, STUD_H, studSize, WHEEL_TABLE_R, WHEEL_TOP_Y } from "./wheelMap";

/**
 * The Wayfarer's Wheel: a waist-high bronze table on the hub plaza with the
 * forest's roads in relief, true to north and to scale, and a stud for every
 * grove on the ring. A stud lights in its grove's colour once the ring has
 * stopped there on the lap under way; a whole lap home to the redwood lights
 * the gold pin at the centre, and the rim turns bronze, silver, then gold with
 * the Wayfarer level (achievements.ts). Each stud rises a little with every
 * visit to its grove and every reading of one of its books (studSize).
 *
 * Built light for phones: no textures, the bronze in one merged mesh, the
 * studs as two instanced meshes, a handful of draw calls in all.
 */

const TOP_Y = WHEEL_TOP_Y;
/** Table radius; the map fills MAP_R of it. */
const TABLE_R = WHEEL_TABLE_R;
const MAP_R = 0.7;
const STUD_R = 0.028;
/**
 * The lamp: its post this far north of the centre, inside the cart's keep-off
 * radius; its hood this high, this far north, near enough the edge to stay out
 * of the view from above (wheelViewPose).
 */
const LAMP_POST = 0.9;
const LAMP_Y = 1.75;
const LAMP_REACH = 0.62;

const BODY =
  "The forest from above, in bronze: the redwood at the hub, its spoke roads, the two ring roads, " +
  "and a stud for every grove. Ride the ring (the Guided tour) and each stud lights as the tour stops " +
  "at its grove. Ride it all the way home to the redwood and the gold pin lights: that is the Wayfarer's " +
  "bronze. Three rides make silver; a ride in every season, gold. A ride broken off picks up where it left off. " +
  "Each stud also rises a little every time you visit its grove or open one of its books.";

const bronze = () => new MeshStandardMaterial({ color: "#7a5a32", metalness: 0.75, roughness: 0.42 });

/** The Wheel's Wayfarer level and its plaque, as the table's tap and the card beside it (HUD) open it. */
export function useWheelPlaque(forest: Forest): { tier: Tier; plaque: PlaqueText } {
  const ring = useGame((s) => s.ring);
  const library = useGame((s) => s.library);
  const grovesVisited = useGame((s) => s.grovesVisited);
  const plaques = useGame((s) => s.plaques);
  const tier = tracks({ library, grovesVisited, plaques, ring },
    { books: forest.trees.length, groves: forest.groves.length, exhibits: forest.exhibits.length })[0]!.tier;
  const n = forest.circuit.length;
  const byline = `${TIER_NAME[tier] || "Not yet ridden"} · ${ring.stops.length} of ${n} groves this ride · ${ring.laps} ${ring.laps === 1 ? "ride" : "rides"} home`;
  return { tier, plaque: { title: "The Wayfarer's Wheel", byline, body: BODY, figure: "wayfarer" } };
}

export function WayfarersWheel({ forest }: { forest: Forest }) {
  const { x, z } = forest.wayfarer;
  const stops = useGame((s) => s.ring.stops);
  const ring = useGame((s) => s.ring);
  const { tier, plaque } = useWheelPlaque(forest);
  const day = useGame((s) => s.timeOfDay === "day");
  const groveVisits = useGame((s) => s.groveVisits);
  const reads = useGame((s) => s.reads);
  const tally = useMemo(() => groveTally(forest, groveVisits, reads), [forest, groveVisits, reads]);
  // The map's scale: the farthest grove stud just inside MAP_R.
  const scale = useMemo(() => {
    const far = Math.max(...forest.circuit.map((wp) => Math.hypot(wp.x, wp.z)),
      ...forest.roadLines.filter((l) => l.kind === "ring").map((l) => Math.hypot(...l.pts[0]!)));
    return MAP_R / (far || 1);
  }, [forest]);

  const body = useMemo(() => {
    const parts: BufferGeometry[] = [];
    // Pedestal: a turned column on a round foot, flaring to carry the top.
    const profile = [[0.34, 0], [0.34, 0.06], [0.2, 0.1], [0.12, 0.22], [0.1, 0.6], [0.14, 0.8], [0.3, TOP_Y - 0.05], [0.3, TOP_Y - 0.04], [0, TOP_Y - 0.04]]
      .map(([r, y]) => new Vector2(r, y));
    parts.push(new LatheGeometry(profile, 32));
    const top = new CylinderGeometry(TABLE_R, TABLE_R - 0.03, 0.05, 48);
    top.translate(0, TOP_Y - 0.02, 0);
    parts.push(top);
    // A lamp post at the table's north edge, its arm reaching over the map.
    const post = new CylinderGeometry(0.024, 0.032, LAMP_Y + 0.08, 10);
    post.translate(0, (LAMP_Y + 0.08) / 2, -LAMP_POST);
    parts.push(post);
    const arm = new CylinderGeometry(0.016, 0.016, LAMP_POST - LAMP_REACH, 8);
    arm.rotateX(Math.PI / 2);
    arm.translate(0, LAMP_Y + 0.08, -(LAMP_POST + LAMP_REACH) / 2);
    parts.push(arm);
    const hood = new CylinderGeometry(0.03, 0.11, 0.08, 16, 1, true);
    hood.translate(0, LAMP_Y + 0.04, -LAMP_REACH);
    parts.push(hood);
    const body = mergeGeometries(parts.map((p) => p.toNonIndexed()));
    parts.forEach((p) => p.dispose());
    parts.length = 0;
    // The roads in relief: rings as thin tori, spokes as bars from hub to the last ring.
    const lastRing = Math.max(...forest.roadLines.filter((l) => l.kind === "ring").map((l) => Math.hypot(...l.pts[0]!)));
    for (const l of forest.roadLines) {
      if (l.kind === "ring") {
        const t = new TorusGeometry(Math.hypot(...l.pts[0]!) * scale, 0.008, 4, 72);
        t.rotateX(Math.PI / 2);
        t.translate(0, TOP_Y + 0.005, 0);
        parts.push(t);
      } else if (l.kind === "spoke") {
        const a = Math.atan2(l.pts[0]![1], l.pts[0]![0]);
        const len = lastRing * scale;
        const b = new BoxGeometry(len, 0.01, 0.014);
        b.translate(len / 2, TOP_Y + 0.005, 0);
        b.rotateY(-a);
        parts.push(b);
      }
    }
    // The redwood's boss at the hub.
    const boss = new CylinderGeometry(0.045, 0.06, 0.03, 16);
    boss.translate(0, TOP_Y + 0.015, 0);
    parts.push(boss);
    const relief = mergeGeometries(parts.map((p) => p.toNonIndexed()));
    parts.forEach((p) => p.dispose());
    return { body, relief };
  }, [forest, scale]);
  const materials = useMemo(() => ({
    bronze: bronze(),
    // The roads in gilt, bright against the bronze so the map reads from the cart.
    gilt: new MeshStandardMaterial({ color: "#e0bb62", metalness: 0.7, roughness: 0.3 }),
    bulb: new MeshStandardMaterial({ color: "#fff2d0", roughness: 0.4 }),
    dark: new MeshStandardMaterial({ color: "#5a4128", metalness: 0.6, roughness: 0.45 }),
    // Enamel in each grove's colour (the instance colour), lit and shaded like the bronze round it.
    lit: new MeshStandardMaterial({ metalness: 0.15, roughness: 0.45 }),
    rim: new MeshStandardMaterial({ metalness: 0.85, roughness: 0.3 }),
    pin: new MeshStandardMaterial({ metalness: 0.9, roughness: 0.25 }),
  }), []);
  const parts = useMemo(() => {
    const rim = new TorusGeometry(TABLE_R, 0.022, 8, 64);
    rim.rotateX(Math.PI / 2);
    rim.translate(0, TOP_Y, 0);
    // Standing on its base, so a stud scaled taller rises off the table.
    // A peg, a little narrower at the top, so a tall one reads as a pin rather than a can.
    const stud = new CylinderGeometry(STUD_R * 0.78, STUD_R, STUD_H, 16);
    stud.translate(0, STUD_H / 2, 0);
    const pin = new CylinderGeometry(0.018, 0.018, 0.09, 10);
    pin.translate(0, TOP_Y + 0.07, 0);
    return { rim, stud, pin };
  }, []);
  useEffect(() => () => {
    body.body.dispose();
    body.relief.dispose();
  }, [body]);
  useEffect(() => () => {
    Object.values(parts).forEach((g) => g.dispose());
    Object.values(materials).forEach((m) => m.dispose());
  }, [parts, materials]);

  materials.rim.color.set(TIER_COLOR[tier]);
  materials.bulb.emissive.set(day ? "#000000" : "#ffd99a");
  const home = ring.laps > 0;
  materials.pin.color.set(home ? "#e2b83f" : "#4a3a26");
  materials.pin.emissive.set(home ? "#6a4a08" : "#000000");

  // Studs: lit ones in their grove's colour, the rest dark bronze.
  const litRef = useRef<InstancedMesh>(null);
  const darkRef = useRef<InstancedMesh>(null);
  const n = forest.circuit.length;
  useLayoutEffect(() => {
    const lit = litRef.current, dark = darkRef.current;
    if (!lit || !dark) return;
    const o = new Object3D();
    const c = new Color();
    let li = 0, di = 0;
    for (const wp of forest.circuit) {
      const g = forest.groves.find((gr) => gr.genre === wp.genre);
      // Each visit to the grove, and each reading of one of its books, raises its stud a little.
      const size = studSize(tally[wp.genre] ?? 0);
      o.position.set(wp.x * scale, TOP_Y, wp.z * scale);
      o.scale.set(size.r, size.h / STUD_H, size.r);
      o.updateMatrix();
      if (stops.includes(wp.genre)) {
        lit.setMatrixAt(li, o.matrix);
        lit.setColorAt(li, c.set(g?.color ?? "#ffffff"));
        li++;
      } else {
        dark.setMatrixAt(di++, o.matrix);
      }
    }
    lit.count = li;
    dark.count = di;
    lit.instanceMatrix.needsUpdate = dark.instanceMatrix.needsUpdate = true;
    if (lit.instanceColor) lit.instanceColor.needsUpdate = true;
  }, [forest, scale, stops, tally]);

  return (
    <group position={[x, 0, z]}
      onClick={(ev) => { ev.stopPropagation(); useGame.getState().openPlaque(plaque); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}>
      <mesh geometry={body.body} material={materials.bronze} castShadow receiveShadow />
      <mesh geometry={body.relief} material={materials.gilt} />
      <mesh position={[0, LAMP_Y + 0.01, -LAMP_REACH]} material={materials.bulb}><sphereGeometry args={[0.04, 12, 8]} /></mesh>
      {/* After dark the lamp lights the map, as the Mysterium's sun lights its orrery. */}
      {!day ? <pointLight position={[0, LAMP_Y - 0.06, -LAMP_REACH]} color="#ffd99a" intensity={2.2} distance={6} decay={2} /> : null}
      <mesh geometry={parts.rim} material={materials.rim} />
      <mesh geometry={parts.pin} material={materials.pin} />
      {/* Allocated for every grove once; `count` says how many of each are shown. */}
      <instancedMesh ref={litRef} args={[parts.stud, materials.lit, n]} frustumCulled={false} />
      <instancedMesh ref={darkRef} args={[parts.stud, materials.dark, n]} frustumCulled={false} />
    </group>
  );
}
