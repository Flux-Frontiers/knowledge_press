/**
 * Geometry for the wind exhibits (WindSculptures.tsx): three vertical-axis
 * rotors, each a real turbine type, a DNA double helix spinning on a spike,
 * and a weather mast. Plain numbers only, so the node tests can check where
 * everything reaches without three.js.
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

/**
 * The way the wind blows, as a bearing in the ground plane (atan2(z, x)) at
 * time t: veering slowly either side of the prevailing wind, which blows
 * along the axis the leaf shader sways the crowns (Trees.tsx windDir).
 */
export function windHeading(t: number): number {
  return Math.atan2(0.37, 0.93) + 0.3 * Math.sin(t * 0.021) + 0.12 * Math.sin(t * 0.083 + 1.7);
}

/** 2 bits to a base, high bits first: A 00, C 01, G 10, T 11. */
const BASES = "ACGT";
export function encodeBases(text: string): string {
  let out = "";
  for (const ch of text) {
    const b = ch.charCodeAt(0);
    for (let s = 6; s >= 0; s -= 2) out += BASES[(b >> s) & 3];
  }
  return out;
}
export function decodeBases(seq: string): string {
  let out = "";
  for (let i = 0; i + 4 <= seq.length; i += 4) {
    let b = 0;
    for (let k = 0; k < 4; k++) b = (b << 2) | BASES.indexOf(seq[i + k]!);
    out += String.fromCharCode(b);
  }
  return out;
}
export const PAIR: Record<string, string> = { A: "T", T: "A", C: "G", G: "C" };

/**
 * B-DNA at sculpture scale: 10.5 base pairs a turn, a pitch of 1.7 helix
 * diameters (34 A a turn on a 20 A helix), and the second strand trailing
 * the first by 12/34 of a turn, so the grooves between them alternate
 * narrow (minor, 12 A) and wide (major, 22 A). The first strand's bases,
 * read from the bottom, spell `message`.
 */
export const DNA = {
  columnTop: 2.2,
  y0: 2.6,
  radius: 0.75,
  pitch: 1.7 * 2 * 0.75,
  bpPerTurn: 10.5,
  minorGroove: 12 / 34,
  message: "KNOWLEDGE",
  /** Backbone tube and base-pair rung radii. */
  tube: 0.07,
  rung: 0.045,
  spin: 0.5,
} as const;

export const DNA_SEQUENCE = encodeBases(DNA.message);

/** Height of the helix: one rise per base pair. */
export function dnaHeight(): number {
  return (DNA_SEQUENCE.length / DNA.bpPerTurn) * DNA.pitch;
}

/** Strand s (0 or 1) at helix angle a; right-handed, so it turns z toward x as it climbs. */
function dnaPoint(s: 0 | 1, a: number): Vec3 {
  const phase = a + s * DNA.minorGroove * 2 * Math.PI;
  return [DNA.radius * Math.sin(phase), DNA.y0 + (a / (2 * Math.PI)) * DNA.pitch, DNA.radius * Math.cos(phase)];
}

/** A backbone, sampled from the first base pair to the last, with a round section. */
export function dnaStrand(s: 0 | 1, samples = 96): BladeFrame[] {
  const turns = (DNA_SEQUENCE.length - 1) / DNA.bpPerTurn;
  const out: BladeFrame[] = [];
  for (let i = 0; i <= samples; i++) {
    const a = (i / samples) * turns * 2 * Math.PI;
    const c = dnaPoint(s, a);
    const phase = a + s * DNA.minorGroove * 2 * Math.PI;
    // Outward, and the section's other axis across the strand (tangent x outward).
    const out1: Vec3 = [Math.sin(phase), 0, Math.cos(phase)];
    const tx = DNA.radius * Math.cos(phase), ty = DNA.pitch / (2 * Math.PI), tz = -DNA.radius * Math.sin(phase);
    const tl = Math.hypot(tx, ty, tz);
    const across: Vec3 = [(ty * out1[2] - tz * out1[1]) / tl, (tz * out1[0] - tx * out1[2]) / tl, (tx * out1[1] - ty * out1[0]) / tl];
    out.push({ c, chord: out1, thick: across });
  }
  return out;
}

/** Each base pair: its two backbone ends and its bases, the first strand's from DNA_SEQUENCE. */
export function dnaPairs(): { a: Vec3; b: Vec3; bases: [string, string] }[] {
  return [...DNA_SEQUENCE].map((base, i) => {
    const angle = (i / DNA.bpPerTurn) * 2 * Math.PI;
    return { a: dnaPoint(0, angle), b: dnaPoint(1, angle), bases: [base, PAIR[base]!] as [string, string] };
  });
}

/**
 * A weather mast: cup anemometer at the top, a vane below it, and a wind
 * sock on an arm, which hangs at `sockSlack` below level in a lull and lifts
 * to `sockFull` as the gust fills it.
 */
export const MAST = {
  top: 7.6,
  cupsY: 7.75,
  cupArm: 0.42,
  cupR: 0.11,
  vaneY: 7.05,
  vaneHalf: 0.7,
  armY: 5.6,
  arm: 0.8,
  sockLength: 1.7,
  sockMouth: 0.26,
  sockTail: 0.11,
  sockSlack: 1.0,
  sockFull: 0.08,
  /** Cups turn at this many rad/s at full gust. */
  cupSpin: 5,
} as const;

/** How far the sock has filled, 0 slack to 1 full, for a gust in gust()'s range. */
export function sockFill(g: number): number {
  return Math.min(1, Math.max(0, (g - 0.3) / 0.7));
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

/** Farthest any moving part reaches from the shaft, and the lowest height it reaches. */
export function rotorEnvelope(id: "helix" | "darrieus" | "savonius" | "dna" | "mast"): { reach: number; lowest: number } {
  if (id === "dna") return { reach: DNA.radius + DNA.tube, lowest: DNA.y0 - DNA.tube };
  if (id === "mast") {
    // The sock swings round the mast on its arm; slack, its tail hangs lowest.
    const sockReach = MAST.arm + MAST.sockLength + MAST.sockMouth;
    const sockLowest = MAST.armY - MAST.sockMouth - MAST.sockLength * Math.sin(MAST.sockSlack);
    return { reach: Math.max(sockReach, MAST.vaneHalf, MAST.cupArm + MAST.cupR), lowest: Math.min(sockLowest, MAST.vaneY, MAST.cupsY) - 0.2 };
  }
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
