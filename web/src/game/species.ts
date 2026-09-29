/**
 * Genre -> tree species. A species picks the bark texture, the leaf outline,
 * a small shift of the season's foliage colour, and its habit: the envelope
 * the book's chunks are laid out in and how the wood grows toward them.
 */
export type SpeciesName = "oak" | "chestnut" | "fir" | "plane" | "blackthorn" | "pine" | "birch" | "willow" | "poplar";

/**
 * A leaf outline. `ovate` is the original chestnut-style leaf at a half-width.
 * `outline` is the right half from the tip (0, 1) down to the stalk (0, -1) in
 * true proportions, mirrored for the left half; `smooth` rounds it through a
 * Catmull-Rom spline, otherwise the corners stay sharp.
 */
export type LeafShape =
  | { shape: "ovate"; width: number }
  | { shape: "outline"; half: [number, number][]; smooth: boolean };

/**
 * Crown silhouette as a width profile over the crown's height, s in [0, 1]
 * from its base to its top (after Weber & Penn's crown shapes).
 */
export type Envelope = "ellipsoid" | "cone" | "dome" | "ovoid" | "column" | "vase" | "umbrella" | "spindle";

/**
 * A species' growth habit. The book still decides everything that carries
 * meaning (height, section count, one crown point per chunk); the habit only
 * decides where in space those points sit and how the wood reaches them.
 */
export type Habit = {
  envelope: Envelope;
  /** Crown half-width as a multiple of the book's branch length. */
  width: number;
  /** Bare trunk below the lowest section, as a fraction of height. */
  clearBole: number;
  /**
   * How far into the crown the trunk rises plumb before growth takes over, as
   * a fraction of the crown's height: 0 forks at the crown base (oak), near 1
   * keeps one central leader (fir).
   */
  leader: number;
  /** Sections per whorl: >1 sets sections in level tiers around the stem (conifers), 1 spirals them. */
  whorl: number;
  /** Chunk cluster radius around each section tip, as a multiple of the default. */
  spread: number;
  /** Chunks lift above (+) or hang below (-) their section tip, as a multiple of the default. */
  lift: number;
  /** Tropism: the upward pull added to every growth step (colonize). */
  tropism: number;
  /** Influence radius in internodes; small makes twiggy, bushy wood, large long straight limbs. */
  influence: number;
  /** Internode length as a multiple of the crown-derived default. */
  step: number;
  /** Direction noise per growth step: 0.12 is clean, 0.3 gnarled. */
  jitter: number;
  /** Pipe-model exponent: 2 is Leonardo's rule, higher tapers faster. */
  pipeExp: number;
  /**
   * Gravity after growth: thin wood bends toward the ground, carrying its
   * chunks with it. 0 is stiff; a willow's 2.5 hangs its twigs straight down.
   */
  droop: number;
};

/** Crown half-width at crown height s in [0, 1], as a fraction of the widest. */
export function envelopeWidth(env: Envelope, s: number): number {
  const t = Math.min(1, Math.max(0, s));
  switch (env) {
    case "ellipsoid": return Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) * 0.8 + 0.2;
    case "ovoid": return Math.sqrt(Math.max(0, 1 - ((t - 0.4) / (t < 0.4 ? 0.4 : 0.6)) ** 2)) * 0.8 + 0.2;
    case "cone": return 1 - 0.92 * t;
    case "dome": return Math.sqrt(Math.max(0, 1 - t * t)) * 0.8 + 0.2;
    case "vase": return 0.35 + 0.65 * Math.sin((Math.PI / 2) * Math.min(1, t * 1.25));
    case "column": return 1 - 0.4 * t;
    case "umbrella": return t < 0.6 ? 0.25 + 0.75 * Math.sin((Math.PI / 2) * (t / 0.6)) : Math.sqrt(Math.max(0, 1 - ((t - 0.6) / 0.4) ** 2)) * 0.9 + 0.1;
    case "spindle": return Math.sqrt(Math.sin(Math.PI * (0.08 + 0.84 * t)));
  }
}

export type Species = {
  name: SpeciesName;
  /** For the grove's signpost: the tree's common and scientific names. */
  common: string;
  latin: string;
  /** Height / width of the bark image (textures/bark/<name>_color.jpg). */
  barkAspect: number;
  leaf: LeafShape;
  /** HSL offset applied to the season's foliage colours. */
  foliageShift: [h: number, s: number, l: number];
  habit: Habit;
};

// English oak: rounded lobes, widest above the middle, small ears at the base.
const OAK_HALF: [number, number][] = [
  [0.16, 0.97], [0.27, 0.86], [0.19, 0.74], [0.4, 0.64], [0.45, 0.5], [0.26, 0.42],
  [0.47, 0.31], [0.49, 0.16], [0.29, 0.1], [0.44, -0.02], [0.42, -0.17], [0.24, -0.22],
  [0.32, -0.36], [0.27, -0.5], [0.13, -0.55], [0.18, -0.68], [0.1, -0.8], [0.03, -0.86],
];

// London plane: three broad upper lobes, two smaller outward ones, a rounded base.
const PLANE_HALF: [number, number][] = [
  [0.06, 0.84], [0.11, 0.66], [0.17, 0.46], [0.33, 0.58], [0.55, 0.72], [0.5, 0.52],
  [0.44, 0.34], [0.38, 0.24], [0.56, 0.2], [0.8, 0.12], [0.66, -0.02], [0.52, -0.16],
  [0.36, -0.26], [0.2, -0.3], [0.07, -0.26], [0.04, -0.32], [0.03, -0.75],
];

// A fir spray rather than a lone needle: slender needles either side of a stem,
// angled toward the tip, longest mid-spray.
const FIR_HALF: [number, number][] = (() => {
  const out: [number, number][] = [];
  const n = 12;
  for (let k = 0; k < n; k++) {
    const y = 0.86 - (1.62 * k) / (n - 1);
    const reach = 0.12 + 0.2 * Math.sin((Math.PI * (k + 1)) / (n + 1));
    // Flat, blunt needles: wide at the stem, a squared-off tip.
    out.push([0.05, y + 0.045], [reach, y + 0.12], [reach + 0.01, y + 0.08], [0.05, y - 0.04]);
  }
  out.push([0.04, -1]);
  return out;
})();

// A pine tuft: fewer, longer needles than the fir spray, fanning toward the tip.
const PINE_HALF: [number, number][] = (() => {
  const out: [number, number][] = [];
  const n = 7;
  for (let k = 0; k < n; k++) {
    const y = 0.68 - (1.2 * k) / (n - 1);
    const reach = 0.3 + 0.28 * Math.sin((Math.PI * (k + 1)) / (n + 1));
    out.push([0.04, y + 0.03], [reach, y + 0.3], [reach + 0.015, y + 0.26], [0.04, y - 0.05]);
  }
  out.push([0.035, -1]);
  return out;
})();

// Habits mirror kg_utils.viz3d.SPECIES (kgmodule-utils). 0.25.1 lengthened the
// blackthorn's reach (influence 6 -> 10, jitter 0.3 -> 0.18) and the fir's
// (7 -> 12): too short a reach let limbs random-walk -- the blackthorn's into
// helices, the fir's back down to its lowest whorl.
export const SPECIES: Species[] = [
  {
    // English oak: short bole, broad low dome, long gnarled horizontal limbs.
    name: "oak", common: "English oak", latin: "Quercus robur",
    barkAspect: 2, leaf: { shape: "outline", half: OAK_HALF, smooth: true }, foliageShift: [0, 0, 0],
    habit: { envelope: "dome", whorl: 1, droop: 0.05, leader: 0, width: 1.55, clearBole: 0.22, spread: 1.1, lift: 0.6, tropism: 0.02, influence: 16, step: 1.1, jitter: 0.24, pipeExp: 2 },
  },
  {
    // Horse chestnut: a full rounded ellipsoid on a medium bole.
    name: "chestnut", common: "Horse chestnut", latin: "Aesculus hippocastanum",
    barkAspect: 1, leaf: { shape: "ovate", width: 0.36 }, foliageShift: [0.01, 0.04, -0.03],
    habit: { envelope: "ellipsoid", whorl: 1, droop: 0.08, leader: 0.15, width: 1.15, clearBole: 0.28, spread: 1, lift: 1, tropism: 0.14, influence: 12, step: 1, jitter: 0.14, pipeExp: 2.2 },
  },
  {
    // Fir: a narrow cone from near the ground, flat sprays, a fast-tapering stem.
    name: "fir", common: "Silver fir", latin: "Abies alba",
    barkAspect: 1, leaf: { shape: "outline", half: FIR_HALF, smooth: false }, foliageShift: [0.05, -0.12, -0.12],
    habit: { envelope: "cone", whorl: 1, droop: 0.05, leader: 0.92, width: 0.95, clearBole: 0.1, spread: 0.7, lift: -0.3, tropism: 0.3, influence: 12, step: 0.8, jitter: 0.08, pipeExp: 2.6 },
  },
  {
    // London plane: a long clean bole under a tall egg-shaped crown of long, rising limbs.
    name: "plane", common: "London plane", latin: "Platanus × acerifolia",
    barkAspect: 1, leaf: { shape: "outline", half: PLANE_HALF, smooth: false }, foliageShift: [-0.01, 0.02, 0.05],
    habit: { envelope: "ovoid", whorl: 1, droop: 0, leader: 0.3, width: 1.05, clearBole: 0.38, spread: 1, lift: 1.2, tropism: 0.24, influence: 18, step: 1.15, jitter: 0.1, pipeExp: 2.1 },
  },
  {
    // Blackthorn: a low, dense, twiggy thicket-tree that spreads upward from low down.
    name: "blackthorn", common: "Blackthorn", latin: "Prunus spinosa",
    barkAspect: 1, leaf: { shape: "ovate", width: 0.7 }, foliageShift: [0.02, -0.1, -0.1],
    habit: { envelope: "vase", whorl: 1, droop: 0, leader: 0, width: 1.3, clearBole: 0.12, spread: 1.25, lift: 0.8, tropism: 0.1, influence: 10, step: 0.7, jitter: 0.18, pipeExp: 2.5 },
  },
  {
    // Stone pine: a tall bare stem under a flat-topped parasol of tufts.
    name: "pine", common: "Stone pine", latin: "Pinus pinea",
    barkAspect: 1, leaf: { shape: "outline", half: PINE_HALF, smooth: false }, foliageShift: [0.04, -0.08, -0.08],
    habit: { envelope: "umbrella", whorl: 1, droop: 0, leader: 0.45, width: 1.45, clearBole: 0.5, spread: 1.1, lift: 0.4, tropism: 0.12, influence: 14, step: 1.1, jitter: 0.12, pipeExp: 2.2 },
  },
  {
    // Silver birch: a slender stem, a narrow open crown, fine twigs that hang at the ends.
    name: "birch", common: "Silver birch", latin: "Betula pendula",
    barkAspect: 1, leaf: { shape: "ovate", width: 0.5 }, foliageShift: [0.02, 0.06, 0.07],
    habit: { envelope: "ovoid", whorl: 1, droop: 0.45, leader: 0.7, width: 0.75, clearBole: 0.25, spread: 0.9, lift: 0.6, tropism: 0.3, influence: 9, step: 0.85, jitter: 0.1, pipeExp: 2.7 },
  },
  {
    // Weeping willow: a short stout trunk, arching limbs, curtains of twigs to the ground.
    name: "willow", common: "Weeping willow", latin: "Salix babylonica",
    barkAspect: 1, leaf: { shape: "ovate", width: 0.16 }, foliageShift: [0.03, 0.02, 0.06],
    habit: { envelope: "dome", whorl: 1, droop: 2.5, leader: 0.45, width: 1.3, clearBole: 0.5, spread: 1.2, lift: -0.9, tropism: 0.2, influence: 12, step: 1, jitter: 0.12, pipeExp: 2.3 },
  },
  {
    // Lombardy poplar: a tall narrow spindle of steeply rising branches.
    name: "poplar", common: "Lombardy poplar", latin: "Populus nigra ‘Italica’",
    barkAspect: 1, leaf: { shape: "ovate", width: 0.62 }, foliageShift: [-0.01, 0.05, 0.02],
    habit: { envelope: "spindle", whorl: 1, droop: 0, leader: 0.85, width: 0.42, clearBole: 0.08, spread: 0.7, lift: 1.2, tropism: 0.7, influence: 8, step: 0.9, jitter: 0.08, pipeExp: 2.4 },
  },
];

// Leaf instances are scaled 1.12 wide by 1.78 tall (emitLeaves); true-proportion
// outlines are pre-widened by the inverse so they render as drawn.
const INSTANCE_ASPECT = 1.78 / 1.12;

function cubic(p0: number[], p1: number[], p2: number[], p3: number[], n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const f = (k: number) => u * u * u * p0[k]! + 3 * u * u * t * p1[k]! + 3 * u * t * t * p2[k]! + t * t * t * p3[k]!;
    out.push([f(0), f(1)]);
  }
  return out;
}

function catmullRom(pts: [number, number][], per: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const f = (k: number) => 0.5 * (2 * p1[k]! + (p2[k]! - p0[k]!) * t + (2 * p0[k]! - 5 * p1[k]! + 4 * p2[k]! - p3[k]!) * t2 + (3 * p1[k]! - p0[k]! - 3 * p2[k]! + p3[k]!) * t3);
      out.push([f(0), f(1)]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** Closed leaf polygon in instance coordinates, starting at the tip (ShapeGeometry fixes the winding). */
export function leafOutline(leaf: LeafShape): [number, number][] {
  if (leaf.shape === "ovate") {
    const k = leaf.width / 0.36;
    const right = cubic([0, 1], [0.62, 0.58], [0.48, -0.12], [0.1, -0.82], 7);
    const left = cubic([-0.1, -0.82], [-0.48, -0.12], [-0.62, 0.58], [0, 1], 7);
    return withStalk([...right, [0, -1], ...left.slice(0, -1)].map(([x, y]) => [x * k, y]));
  }
  const right = [[0, 1] as [number, number], ...leaf.half];
  // Two samples per span: ~73 triangles for the oak instead of 180, still round at leaf size.
  const half = leaf.smooth ? catmullRom(right, 2) : right;
  const bottom = half[half.length - 1]!;
  const full: [number, number][] = [...half, [0, bottom[1] - 0.02], ...half.slice(1).reverse().map(([x, y]) => [-x, y] as [number, number])];
  return withStalk(full.map(([x, y]) => [x * INSTANCE_ASPECT, y]));
}

/**
 * Give a leaf a stalk: squeeze the blade into y in [STALK_TOP, 1] and hang it
 * from a thin petiole down to y = -1, the point the instance pins to the twig.
 */
const STALK_TOP = -0.62;
const STALK_HALF_WIDTH = 0.04;
function withStalk(pts: [number, number][]): [number, number][] {
  const squeezed = pts.map(([x, y]) => [x, STALK_TOP + ((y + 1) * (1 - STALK_TOP)) / 2] as [number, number]);
  let low = 0;
  for (let i = 1; i < squeezed.length; i++) if (squeezed[i]![1] < squeezed[low]![1]) low = i;
  const y0 = squeezed[low]![1];
  return [
    ...squeezed.slice(0, low),
    [STALK_HALF_WIDTH, y0], [STALK_HALF_WIDTH, -1], [-STALK_HALF_WIDTH, -1], [-STALK_HALF_WIDTH, y0],
    ...squeezed.slice(low + 1),
  ];
}

const GENRE_SPECIES: Record<string, SpeciesName> = {
  philosophy: "oak",
  "english-literature": "chestnut",
  "american-literature": "chestnut",
  biography: "chestnut",
  "science-fiction": "fir",
  "natural-history": "fir",
  "french-literature": "plane",
  "world-literature": "plane",
  spanish: "plane",
  curiosities: "plane",
  horror: "blackthorn",
  "german-literature": "blackthorn",
  "ancient-classical": "pine",
  "sacred-texts": "pine",
  "russian-literature": "birch",
  letters: "birch",
  diaries: "birch",
  shakespeare: "willow",
  drama: "willow",
  travel: "poplar",
  "audel-electric": "poplar",
};

/** Index into SPECIES; unmapped genres grow chestnut. */
export function speciesFor(genre: string): number {
  const name = GENRE_SPECIES[genre] ?? "chestnut";
  return SPECIES.findIndex((s) => s.name === name);
}
