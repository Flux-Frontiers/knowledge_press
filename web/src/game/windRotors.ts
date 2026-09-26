/**
 * Geometry for the wind sculptures (WindSculptures.tsx): three vertical-axis
 * rotors, each a real turbine type. Plain numbers only, so the node tests can
 * check where the blades reach without three.js.
 */

export type Vec3 = [number, number, number];

/** One cross-section of a blade: its centre, and unit vectors along the chord and the thickness. */
export type BladeFrame = { c: Vec3; chord: Vec3; thick: Vec3 };

/** Plinth top: every rotor's static column starts here. */
export const PLINTH_TOP = 1.0;

export const HELIX = {
  columnTop: 3.0,
  y0: 3.6,
  height: 6.8,
  radius: 1.1,
  blades: 3,
  /** Each blade wraps half a turn, so the three together cover the circle more than once. */
  twist: Math.PI,
  chord: 0.38,
  thickness: 0.06,
  /** Heights, as fractions of the rotor, of the arms from shaft to blades. */
  arms: [0, 0.5, 1],
  spin: 0.9,
} as const;

export const DARRIEUS = {
  columnTop: 2.6,
  y0: 3.0,
  height: 8.2,
  /** Widest bow, at mid-height. */
  radius: 1.9,
  blades: 3,
  chord: 0.3,
  thickness: 0.05,
  spin: 1.4,
} as const;

export const SAVONIUS = {
  columnTop: 1.8,
  y0: 2.0,
  tiers: 6,
  tierHeight: 1.15,
  /** Each half-drum's radius, and how far its centre sits off the shaft (less than the radius, so they overlap). */
  scoopR: 0.52,
  scoopOffset: 0.43,
  plateR: 1.0,
  /** Each tier is turned this much from the one below, so one always faces the wind. */
  stagger: Math.PI / 6,
  spin: 0.55,
} as const;

/**
 * Wind strength at time t for a sculpture at x: the gust term of the leaf
 * shader in Trees.tsx, so a rotor speeds up in the same gusts that shake the leaves.
 */
export function gust(t: number, x: number): number {
  return 0.65 + 0.35 * Math.sin(t * 0.35 + x * 0.02);
}

/** A Gorlov blade: a helix around the shaft, cut horizontally, chord along the circle. */
export function helixBlade(index: number, samples = 48): BladeFrame[] {
  const { y0, height, radius, blades, twist } = HELIX;
  const out: BladeFrame[] = [];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const a = (index / blades) * Math.PI * 2 + twist * f;
    const cos = Math.cos(a), sin = Math.sin(a);
    out.push({ c: [radius * cos, y0 + height * f, radius * sin], chord: [-sin, 0, cos], thick: [cos, 0, sin] });
  }
  return out;
}

/**
 * A Darrieus blade, bowed out between the shaft's ends. The troposkein, the
 * shape a spinning rope takes, is close to a sine arch; that is what the blade follows.
 */
export function darrieusBlade(index: number, samples = 48): BladeFrame[] {
  const { y0, height, radius, blades } = DARRIEUS;
  const a = (index / blades) * Math.PI * 2;
  const cos = Math.cos(a), sin = Math.sin(a);
  // A little clear of the shaft at the ends, where the blades clamp to the hubs.
  const hub = 0.14;
  const chord: Vec3 = [-sin, 0, cos];
  const out: BladeFrame[] = [];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    const r = hub + (radius - hub) * Math.sin(Math.PI * f);
    const dr = (radius - hub) * Math.PI * Math.cos(Math.PI * f) / height;
    // Thickness is normal to the blade within its own plane: tangent x chord.
    const tx = dr * cos, ty = 1, tz = dr * sin;
    const n = Math.hypot(tx, ty, tz);
    const thick: Vec3 = [(ty * chord[2] - tz * chord[1]) / n, (tz * chord[0] - tx * chord[2]) / n, (tx * chord[1] - ty * chord[0]) / n];
    out.push({ c: [r * cos, y0 + height * f, r * sin], chord, thick });
  }
  return out;
}

/** Farthest any part of a rotor reaches from the shaft, and the lowest height it reaches. */
export function rotorEnvelope(id: "helix" | "darrieus" | "savonius"): { reach: number; lowest: number } {
  if (id === "savonius") {
    return { reach: Math.max(SAVONIUS.plateR, SAVONIUS.scoopOffset + SAVONIUS.scoopR), lowest: SAVONIUS.y0 };
  }
  const { blades, chord } = id === "helix" ? HELIX : DARRIEUS;
  const blade = id === "helix" ? helixBlade : darrieusBlade;
  let reach = 0, lowest = Infinity;
  for (let b = 0; b < blades; b++) {
    for (const { c } of blade(b)) {
      reach = Math.max(reach, Math.hypot(Math.hypot(c[0], c[2]), chord / 2));
      lowest = Math.min(lowest, c[1]);
    }
  }
  return { reach, lowest };
}
