import type { RoadLine } from "./forest";

/**
 * Exhibits: set pieces that stand at the end of short side spokes off the ring
 * roads, each on its own paved plaza, with a plaque between the spur and the
 * piece. Placement is deterministic: each exhibit in turn takes the spur that
 * puts it farthest round the rings from those already placed, among the spurs
 * whose plaza is a clear glade and whose road runs clear of trunks and roads.
 */

export type ExhibitSpec = {
  id: string;
  label: string;
  /** Radius the cart cannot enter (the piece's plinth). */
  obstacle: number;
  /** Clear ground needed from any trunk, crowns included. */
  treeClearance: number;
};

export type Exhibit = ExhibitSpec & {
  x: number;
  z: number;
  /** The paved plaza's radius; its edge reaches over the end of the spur. */
  plazaR: number;
  /** Where the spur meets the plaza: the plaque faces it and a jump lands just past it. */
  roadX: number;
  roadZ: number;
  /** The side spoke's centreline, from the ring road's centreline into the plaza. */
  spur: [number, number][];
};

export const EXHIBITS: ExhibitSpec[] = [
  { id: "mysterium", label: "Mysterium Cosmographicum", obstacle: 2.6, treeClearance: 10 },
  // George B. Suchanek's sculpture (FlameOfKnowledge.tsx): 4.6 m across, 8.5 m tall.
  { id: "flame", label: "The Flame of Knowledge", obstacle: 2.6, treeClearance: 10 },
  // The wind sculptures (WindSculptures.tsx): narrow plinths, but rotors that need open air.
  { id: "helix", label: "Helical Rotor", obstacle: 1.8, treeClearance: 8 },
  { id: "darrieus", label: "Darrieus Rotor", obstacle: 2.0, treeClearance: 8 },
  { id: "savonius", label: "Savonius Tower", obstacle: 1.8, treeClearance: 8 },
  { id: "dna", label: "Double Helix", obstacle: 1.8, treeClearance: 8 },
  { id: "mast", label: "Weather Mast", obstacle: 1.4, treeClearance: 8 },
];

/** Keep exhibits out from under the redwood's crown and apart from one another. */
const MIN_HUB_DIST = 30;
const MIN_SPACING = 45;
// Road centreline clearance: half the widest road (1.7 m) + the cart (1.05 m).
const ROAD_CLEARANCE = 2.75;
/** Half the ring road's width. */
const RING_HALF = 1.7;
/** Spur centreline to any other road's centreline: half a spoke, half a spur, and a verge. */
const SPUR_ROAD_CLEAR = 3.6;
/** Spur road showing between the ring's edge and the plaza's, shortest and longest. */
const SPUR_MIN = 7;
const SPUR_MAX = 18;

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

/** Smallest angle between two bearings, in [0, pi]. */
function bearingGap(a: number, b: number) {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}

/**
 * :param avoid: Discs a spur may not leave the ring inside: grove stops with
 *   room for their signposts, and spoke junctions.
 */
export function placeExhibits(opts: {
  specs: ExhibitSpec[];
  roadLines: RoadLine[];
  trees: { x: number; z: number; trunkRadius: number }[];
  worldRadius: number;
  avoid: { x: number; z: number; r: number }[];
}): Exhibit[] {
  const { roadLines, trees, worldRadius, avoid } = opts;
  // Every road's straight pieces, tagged with the line they belong to.
  const segs: { line: number; s: [number, number, number, number] }[] = [];
  roadLines.forEach((line, li) => {
    const n = line.pts.length;
    for (let i = 0; i < (line.closed ? n : n - 1); i++) {
      const [ax, az] = line.pts[i]!;
      const [bx, bz] = line.pts[(i + 1) % n]!;
      segs.push({ line: li, s: [ax, az, bx, bz] });
    }
  });
  // Ring roads are circles about the hub.
  const rings = roadLines.flatMap((l, li) => (l.kind === "ring" ? [{ li, R: Math.hypot(...l.pts[0]!) }] : []));
  const placed: Exhibit[] = [];
  for (const spec of opts.specs) {
    // Plaza centre to where the spur meets it.
    const standOff = spec.obstacle + ROAD_CLEARANCE + 1.5;
    let best: Exhibit | null = null;
    let bestScore = -Infinity;
    for (const { li, R } of rings) {
      const steps = Math.ceil((2 * Math.PI * R) / 2);
      for (let k = 0; k < steps; k++) {
        const a = (2 * Math.PI * k) / steps;
        const ux = Math.cos(a), uz = Math.sin(a);
        const px = R * ux, pz = R * uz;
        if (avoid.some((c) => Math.hypot(c.x - px, c.z - pz) < c.r)) continue;
        for (const dir of [-1, 1]) {
          // The shortest spur that reaches a clear glade on this side.
          for (let len = RING_HALF + SPUR_MIN; len <= RING_HALF + SPUR_MAX; len += 1) {
            const hub = R + dir * (len + standOff);
            if (hub < MIN_HUB_DIST || hub > worldRadius - 12) break;
            const x = hub * ux, z = hub * uz;
            if (placed.some((e) => Math.hypot(e.x - x, e.z - z) < MIN_SPACING)) continue;
            let clear = Infinity;
            for (const t of trees) clear = Math.min(clear, Math.hypot(t.x - x, t.z - z) - t.trunkRadius);
            if (clear < spec.treeClearance) continue;
            // The plaza stays off every road but its own spur.
            if (segs.some(({ s }) => segDist(x, z, ...s) < standOff + 3)) continue;
            const rx = (R + dir * len) * ux, rz = (R + dir * len) * uz;
            if (trees.some((t) => segDist(t.x, t.z, px, pz, rx, rz) - t.trunkRadius < ROAD_CLEARANCE)) continue;
            // The spur leaves its ring square, so only the other roads can come near it.
            let hit = false;
            for (let s = RING_HALF + 2; s <= len && !hit; s += 1) {
              const qx = (R + dir * s) * ux, qz = (R + dir * s) * uz;
              hit = segs.some(({ line, s: g }) => line !== li && segDist(qx, qz, ...g) < SPUR_ROAD_CLEAR);
            }
            if (hit) continue;
            // Spread round the rings first; a more open glade, then a shorter spur, break ties.
            const spread = placed.length ? Math.min(...placed.map((e) => bearingGap(Math.atan2(e.z, e.x), a))) : Math.PI;
            const score = spread + 0.005 * Math.min(clear, spec.treeClearance + 8) - 0.001 * len;
            if (score > bestScore) {
              bestScore = score;
              // Into the plaza a little, so the paving closes over the spur's end.
              const ex = (R + dir * (len + 1)) * ux, ez = (R + dir * (len + 1)) * uz;
              best = { ...spec, x, z, plazaR: standOff - 0.4, roadX: rx, roadZ: rz, spur: [[px, pz], [ex, ez]] };
            }
            break;
          }
        }
      }
    }
    if (best) placed.push(best);
  }
  return placed;
}

/** Stand on the spur just short of the plaza, facing the exhibit (yaw convention of sim.yawToward). */
export function exhibitApproach(e: Exhibit): { x: number; z: number; yaw: number } {
  const dx = e.roadX - e.x, dz = e.roadZ - e.z;
  const d = Math.hypot(dx, dz) || 1;
  const x = e.x + (dx / d) * (d + 3);
  const z = e.z + (dz / d) * (d + 3);
  return { x, z, yaw: Math.atan2(-(e.x - x), -(e.z - z)) };
}
