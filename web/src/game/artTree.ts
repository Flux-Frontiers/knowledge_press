import { mulberry32, seedFromKey } from "./math";

/**
 * An Art Techno tree, grown from a seed the visitor's cart plants
 * (LandingField.tsx). It is routed like a circuit board: every branch runs
 * either straight up or at 45 degrees from vertical, each 45-degree run
 * followed by a short vertical riser, as traces jog on a board. Junctions are
 * gold vias and the tips carry glowing green dies. Pure numbers, so the tests
 * can check its shape; `along` orders growth from the root out.
 */

export type ArtSeg = {
  /** Base and tip, metres, the root at the origin. */
  from: [number, number, number];
  to: [number, number, number];
  radius: number;
  /** Path length from the root to this segment's base, and its own length. */
  along: number;
  length: number;
};

export type ArtLeaf = { at: [number, number, number]; size: number; along: number; spin: number };

/** A gold via at a junction, and how far along the tree it is. */
export type ArtVia = { at: [number, number, number]; along: number; size: number };

export type ArtTree = { segs: ArtSeg[]; vias: ArtVia[]; leaves: ArtLeaf[]; height: number; reach: number; total: number };

const TRUNK = 4.6;
const TRUNK_R = 0.34;
/** Per level: the 45-degree run, the vertical riser after it, and the branch radius. */
const LEVELS = [
  { run: 3.0, riser: 1.1, r: 0.19 },
  { run: 2.2, riser: 0.85, r: 0.12 },
  { run: 1.6, riser: 0.65, r: 0.08 },
  { run: 1.15, riser: 0.45, r: 0.055 },
  { run: 0.8, riser: 0, r: 0.04 },
];
const DIAG = Math.SQRT1_2;

export function artTree(key = "visitor"): ArtTree {
  const rand = mulberry32(seedFromKey(key));
  const segs: ArtSeg[] = [];
  const vias: ArtVia[] = [];
  const leaves: ArtLeaf[] = [];
  const add = (from: ArtSeg["from"], to: ArtSeg["from"], radius: number, along: number) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    segs.push({ from, to, radius, along, length });
    return along + length;
  };
  const top: ArtSeg["from"] = [0, TRUNK, 0];
  const trunkEnd = add([0, 0, 0], top, TRUNK_R, 0);
  vias.push({ at: top, along: trunkEnd, size: 0.42 });

  const grow = (at: ArtSeg["from"], azimuth: number, level: number, along: number) => {
    const spec = LEVELS[level]!;
    const run = spec.run * (0.85 + 0.3 * rand());
    const bend: ArtSeg["from"] = [
      at[0] + Math.cos(azimuth) * run * DIAG,
      at[1] + run * DIAG,
      at[2] + Math.sin(azimuth) * run * DIAG,
    ];
    let end = bend;
    let a = add(at, bend, spec.r, along);
    if (spec.riser > 0) {
      end = [bend[0], bend[1] + spec.riser * (0.8 + 0.4 * rand()), bend[2]];
      a = add(bend, end, spec.r, a);
    }
    vias.push({ at: end, along: a, size: spec.r * 1.9 });
    if (level === LEVELS.length - 1) {
      // A cluster of dies at the tip.
      for (let k = 0; k < 3; k++) {
        const t = azimuth + (k - 1) * 0.9;
        leaves.push({
          at: [end[0] + Math.cos(t) * 0.35, end[1] + 0.15 + 0.2 * k, end[2] + Math.sin(t) * 0.35],
          size: 0.32 + 0.14 * rand(),
          along: a,
          spin: rand() * Math.PI,
        });
      }
      return;
    }
    // Two ways at every fork after the trunk's three, spread about the parent's heading.
    const spread = level < 2 ? 0.75 : 0.6;
    for (let k = 0; k < 2; k++) grow(end, azimuth + (k - 0.5) * spread * 2 + (rand() - 0.5) * 0.3, level + 1, a);
  };
  const turn = rand() * Math.PI * 2;
  for (let k = 0; k < 3; k++) grow(top, turn + (k * 2 * Math.PI) / 3, 0, trunkEnd);

  let height = 0, reach = 0, total = 0;
  for (const s of segs) {
    height = Math.max(height, s.to[1]);
    reach = Math.max(reach, Math.hypot(s.to[0], s.to[2]) + s.radius);
    total = Math.max(total, s.along + s.length);
  }
  for (const l of leaves) {
    height = Math.max(height, l.at[1] + l.size);
    reach = Math.max(reach, Math.hypot(l.at[0], l.at[2]) + l.size);
  }
  return { segs, vias, leaves, height, reach, total };
}

/** How much of a piece that starts `along` the tree and runs `length` is grown when `grow` (0 to 1) of `total` is. */
export function grownFraction(grow: number, along: number, length: number, total: number): number {
  return Math.min(1, Math.max(0, (grow * total - along) / Math.max(length, 1e-6)));
}

/** Seconds for the power-on to run from the root to the furthest tip once the tree is grown. */
export const POWER_TIME = 3;

/**
 * How bright a via or die is, 0 to 1, `since` seconds after the tree finished
 * growing: dark until the power-on's front reaches it, a flare as the front
 * passes, then a steady 0.75, breathing slowly (`breathe`) once the whole tree is on.
 */
export function powerLevel(since: number, along: number, total: number, breathe = true): number {
  if (since < 0) return 0;
  const front = (since / POWER_TIME) * total;
  if (along > front) return 0;
  const flare = Math.max(0, 1 - (front - along) / (total * 0.15));
  const settled = 0.75 + 0.25 * flare;
  if (!breathe || since < POWER_TIME) return settled;
  // A slow shimmer that climbs the tree.
  return settled * (0.85 + 0.15 * Math.sin(since * 1.5 - along * 0.4));
}

/** Dies lit before any book is read, so the tree is never dark. */
export const DIES_ALWAYS = 8;

/**
 * How many of the tree's dies are lit by the rider's reading: DIES_ALWAYS,
 * then the rest in proportion to the books pressed, all of them once every
 * book is.
 */
export function litDieCount(dies: number, pressed: number, books: number): number {
  const base = Math.min(dies, DIES_ALWAYS);
  const share = books > 0 ? Math.min(1, Math.max(0, pressed / books)) : 0;
  return base + Math.round((dies - base) * share);
}

/** The order the dies light in as the rider reads: from the root out, lowest first. */
export function dieOrder(tree: Pick<ArtTree, "leaves">): number[] {
  return tree.leaves.map((l, i) => i).sort((a, b) => tree.leaves[a]!.along - tree.leaves[b]!.along || tree.leaves[a]!.at[1] - tree.leaves[b]!.at[1]);
}
