import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, BufferAttribute, BufferGeometry, Group, MeshStandardMaterial } from "three";
import type { Exhibit } from "./exhibits";
import { ExhibitPlaque } from "./Signposts";
import { useGame } from "./store";
import { UplightFixtures, useUplitMaterials } from "./Uplights";
import { DARRIEUS, HELIX, PLINTH_TOP, SAVONIUS, darrieusBlade, gust, helixBlade, type BladeFrame } from "./windRotors";

/**
 * Three wind sculptures, each a vertical-axis rotor of a real design: Gorlov's
 * helical rotor, Darrieus's eggbeater and a Savonius tower. Vertical-axis
 * rotors take wind from any side, so none of them turns to face it; each spins
 * faster in the forest's gusts. Exhibits in roadside glades (exhibits.ts);
 * the blade geometry is in windRotors.ts.
 */

/** An elliptical section swept along the frames, capped at both ends. */
function bladeGeometry(frames: BladeFrame[], chord: number, thickness: number, sides = 10): BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  const ring = (f: BladeFrame) => {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const u = (Math.cos(a) * chord) / 2, v = (Math.sin(a) * thickness) / 2;
      pos.push(f.c[0] + f.chord[0] * u + f.thick[0] * v, f.c[1] + f.chord[1] * u + f.thick[1] * v, f.c[2] + f.chord[2] * u + f.thick[2] * v);
    }
  };
  frames.forEach(ring);
  for (let i = 0; i < frames.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k, b = i * sides + ((k + 1) % sides);
      index.push(a, b, a + sides, b, b + sides, a + sides);
    }
  }
  // Caps get their own vertices so the flat ends do not bend the side normals.
  for (const [f, out] of [[frames[0]!, false], [frames[frames.length - 1]!, true]] as const) {
    const base = pos.length / 3;
    ring(f);
    pos.push(...f.c);
    for (let k = 0; k < sides; k++) {
      const a = base + k, b = base + ((k + 1) % sides);
      if (out) index.push(base + sides, a, b);
      else index.push(base + sides, b, a);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function useWindMaterials() {
  const m = useMemo(() => ({
    stone: new MeshStandardMaterial({ color: "#7d776c", roughness: 0.88 }),
    // Metalness stays moderate: the scene has no environment map, and a
    // fully metallic surface with nothing to reflect renders nearly black.
    steel: new MeshStandardMaterial({ color: "#5d646d", metalness: 0.5, roughness: 0.45 }),
    stainless: new MeshStandardMaterial({ color: "#e4e9ec", metalness: 0.5, roughness: 0.28 }),
    enamel: new MeshStandardMaterial({ color: "#eef0ec", metalness: 0.1, roughness: 0.35 }),
    // Copper outside, cream enamel inside each cup, so the turning tiers flash both.
    copper: new MeshStandardMaterial({ color: "#d4854a", metalness: 0.45, roughness: 0.34 }),
    cupInside: new MeshStandardMaterial({ color: "#efe6d2", roughness: 0.5, side: BackSide }),
    verdigris: new MeshStandardMaterial({ color: "#5f9e8a", metalness: 0.3, roughness: 0.6 }),
  }), []);
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  // Floodlit from the plinth at night (Uplights.tsx); the whole rotor, fading toward the top.
  useUplitMaterials(useMemo(() => Object.values(m), [m]), "#ffe2b0", 0.9, 9);
  return m;
}

/**
 * Turn each group about the shaft at its rate (rad/s, sign is direction),
 * scaled by the gust. Rotation is only ever added here, never set as a prop,
 * so a re-render does not snap a rotor back to its start.
 */
function useSpinners(x: number, rates: number[]) {
  const groups = useRef<(Group | null)[]>([]);
  const t = useRef(0);
  useFrame((_, delta) => {
    const s = useGame.getState();
    if (!s.preferences.motion || s.paused) return;
    const dt = Math.min(delta, 0.1);
    t.current += dt;
    const g = gust(t.current, x);
    rates.forEach((w, i) => {
      const grp = groups.current[i];
      if (grp) grp.rotation.y += w * g * dt;
    });
  });
  return (i: number) => (grp: Group | null) => { groups.current[i] = grp; };
}

/** Stepped plinth up to PLINTH_TOP; the cart collides with its lowest step (exhibit.obstacle). Lamps stand round its foot. */
function Plinth({ r, stone }: { r: number; stone: MeshStandardMaterial }) {
  return (
    <>
      <UplightFixtures radius={r + 0.35} count={3} pool={2.2} />
      <mesh position={[0, 0.25, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[r - 0.2, r, 0.5, 8]} />
      </mesh>
      <mesh position={[0, 0.75, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.55, r * 0.62, 0.5, 8]} />
      </mesh>
    </>
  );
}

/** A vertical rod from y0 to y1. */
function Rod({ y0, y1, r, material }: { y0: number; y1: number; r: number; material: MeshStandardMaterial }) {
  return (
    <mesh position={[0, (y0 + y1) / 2, 0]} material={material} castShadow>
      <cylinderGeometry args={[r, r, y1 - y0, 10]} />
    </mesh>
  );
}

/** A red obstruction light on the mast top, blinking at night as on any tall structure. */
function Beacon({ y }: { y: number }) {
  const day = useGame((s) => s.timeOfDay === "day");
  const mat = useMemo(() => new MeshStandardMaterial({ color: "#5a1410", emissive: "#ff2a1a", emissiveIntensity: 0, roughness: 0.4 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    mat.emissiveIntensity = !day && clock.elapsedTime % 1.5 < 0.25 ? 3 : 0;
  });
  return (
    <mesh position={[0, y, 0]} material={mat}>
      <sphereGeometry args={[0.1, 10, 8]} />
    </mesh>
  );
}

function useBlades(make: (b: number) => BladeFrame[], count: number, chord: number, thickness: number) {
  const blades = useMemo(() => Array.from({ length: count }, (_, b) => bladeGeometry(make(b), chord, thickness)), [make, count, chord, thickness]);
  useEffect(() => () => blades.forEach((g) => g.dispose()), [blades]);
  return blades;
}

const HELIX_BODY =
  "Three blades twisted around a vertical shaft, each wrapping half a turn. A rotor with " +
  "straight blades pulls hardest as a blade crosses the wind and slackens between, so it " +
  "shakes. Twisting the blades spreads every blade around the circle, so some part of each is " +
  "always at its best angle and the pull stays nearly even. Alexander Gorlov designed the helical " +
  "turbine for river and tidal currents; it works the same way in air.";

export function HelixSculpture({ exhibit }: { exhibit: Exhibit }) {
  const m = useWindMaterials();
  const blades = useBlades(helixBlade, HELIX.blades, HELIX.chord, HELIX.thickness);
  const spin = useSpinners(exhibit.x, [HELIX.spin]);
  const { y0, height, radius, columnTop } = HELIX;
  const top = y0 + height;
  return (
    <group position={[exhibit.x, 0, exhibit.z]}>
      <ExhibitPlaque exhibit={exhibit} title="Helical Rotor" byline="After Alexander Gorlov · 1990s" body={HELIX_BODY} />
      <Plinth r={exhibit.obstacle} stone={m.stone} />
      <Rod y0={PLINTH_TOP} y1={columnTop} r={0.2} material={m.steel} />
      <group ref={spin(0)}>
        <Rod y0={columnTop} y1={top + 0.45} r={0.07} material={m.stainless} />
        {blades.map((g, b) => <mesh key={b} geometry={g} material={m.stainless} castShadow />)}
        {HELIX.arms.map((f) => (
          <group key={f}>
            <mesh position={[0, y0 + height * f, 0]} material={m.steel}>
              <cylinderGeometry args={[0.14, 0.14, 0.16, 10]} />
            </mesh>
            {blades.map((_, b) => (
              // Radial arm from the shaft to where blade b crosses this height.
              <group key={b} rotation={[0, -((b / HELIX.blades) * Math.PI * 2 + HELIX.twist * f), 0]}>
                <mesh position={[radius / 2, y0 + height * f, 0]} rotation={[0, 0, Math.PI / 2]} material={m.stainless}>
                  <cylinderGeometry args={[0.03, 0.03, radius, 6]} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>
      <Beacon y={top + 0.55} />
    </group>
  );
}

const DARRIEUS_BODY =
  "Three blades bowed out between the top and bottom of the shaft, in the curve a spinning " +
  "rope takes, so spinning pulls them taut instead of bending them. The blades are wings: lift " +
  "draws them around, not the push of the wind, so they can run several times faster than the " +
  "wind itself. At rest they make almost no torque, so a full-size Darrieus needs a motor to start.";

export function DarrieusSculpture({ exhibit }: { exhibit: Exhibit }) {
  const m = useWindMaterials();
  const blades = useBlades(darrieusBlade, DARRIEUS.blades, DARRIEUS.chord, DARRIEUS.thickness);
  const spin = useSpinners(exhibit.x, [DARRIEUS.spin]);
  const { y0, height, columnTop } = DARRIEUS;
  const top = y0 + height;
  return (
    <group position={[exhibit.x, 0, exhibit.z]}>
      <ExhibitPlaque exhibit={exhibit} title="Darrieus Rotor" byline="Georges Darrieus · patented 1931" body={DARRIEUS_BODY} />
      <Plinth r={exhibit.obstacle} stone={m.stone} />
      <Rod y0={PLINTH_TOP} y1={columnTop} r={0.24} material={m.steel} />
      <group ref={spin(0)}>
        <Rod y0={columnTop} y1={top + 0.3} r={0.11} material={m.steel} />
        {[y0, top].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={m.steel}>
            <cylinderGeometry args={[0.22, 0.22, 0.3, 12]} />
          </mesh>
        ))}
        {blades.map((g, b) => <mesh key={b} geometry={g} material={m.enamel} castShadow />)}
      </group>
      <Beacon y={top + 0.42} />
    </group>
  );
}

const SAVONIUS_BODY =
  "Each tier is two half-drums, open sides facing and overlapping at the middle. The wind " +
  "pushes harder into a cup than across a curved back, and some slips through the gap to push " +
  "the returning cup from inside. It turns by drag, so it can never run faster than the wind, " +
  "but it starts in the lightest breeze. The tiers are staggered so one always faces the wind; " +
  "here alternate tiers are built mirrored, and turn the other way.";

export function SavoniusSculpture({ exhibit }: { exhibit: Exhibit }) {
  const m = useWindMaterials();
  const { y0, tiers, tierHeight, scoopR, scoopOffset, plateR, stagger, columnTop } = SAVONIUS;
  // An unmirrored S turns clockwise from above (negative about y); a mirrored one the other way.
  // Each tier runs a little faster than the one below, so they drift in and out of step.
  const rates = useMemo(() => Array.from({ length: tiers }, (_, t) => SAVONIUS.spin * (1 + t * 0.08) * (t % 2 ? 1 : -1)), [tiers]);
  const spin = useSpinners(exhibit.x, rates);
  const top = y0 + tiers * tierHeight;
  const scoopH = tierHeight - 0.06;
  return (
    <group position={[exhibit.x, 0, exhibit.z]}>
      <ExhibitPlaque exhibit={exhibit} title="Savonius Tower" byline="After Sigurd Savonius · 1920s" body={SAVONIUS_BODY} />
      <Plinth r={exhibit.obstacle} stone={m.stone} />
      <Rod y0={PLINTH_TOP} y1={columnTop} r={0.22} material={m.steel} />
      <Rod y0={columnTop} y1={top + 0.35} r={0.06} material={m.steel} />
      {rates.map((_, t) => {
        const mirror = t % 2 === 1;
        return (
          // Stagger on the outer group, spin on the inner, so re-renders never reset the spin.
          <group key={t} position={[0, y0 + t * tierHeight, 0]} rotation={[0, t * stagger, 0]}>
            <group ref={spin(t)}>
              {[0.02, tierHeight - 0.02].map((y) => (
                <mesh key={y} position={[0, y, 0]} material={m.verdigris} castShadow>
                  <cylinderGeometry args={[plateR, plateR, 0.04, 24]} />
                </mesh>
              ))}
              {/* The S: each half-drum on its own side of the diameter, concave sides overlapping at the shaft. */}
              {[1, -1].flatMap((side) => [m.copper, m.cupInside].map((material, k) => (
                // The same open half-drum twice: copper on its outer faces, enamel on its inner.
                <mesh key={`${side}${k}`} position={[side * scoopOffset, tierHeight / 2, 0]} material={material} castShadow={k === 0}>
                  <cylinderGeometry args={[scoopR, scoopR, scoopH, 20, 1, true, (side > 0) !== mirror ? -Math.PI / 2 : Math.PI / 2, Math.PI]} />
                </mesh>
              )))}
            </group>
          </group>
        );
      })}
      <Beacon y={top + 0.45} />
    </group>
  );
}
