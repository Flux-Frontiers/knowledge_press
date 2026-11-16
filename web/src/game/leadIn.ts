import type { Forest } from "./forest";

/**
 * The way out of a grove to the road, for a tour that sets off among the trees.
 * The tour used to steer straight for the nearest road point and drove into
 * whatever trunk stood between. This finds a path that keeps the cart clear of
 * every trunk and plinth: A* over a half-metre grid round the cart, to the first
 * cell on a spoke or ring, then pulled taut and resampled at the tour's spacing.
 */

export type LeadForest = Pick<Forest, "trees" | "obstacles" | "roads" | "plazas" | "worldRadius">;

/** The cart's collision radius (sim.ts) and the air it keeps besides. */
const CART_R = 1.05;
const MARGIN = 0.45;
/** Within this of a spoke or ring centreline counts as reaching the road. */
const ON_ROAD = 0.6;
/** Route samples, about the ring path's spacing (tour.ts pure pursuit expects ~2 m). */
const SPACING = 2;

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - dx * u, z - az - dz * u);
}

/** Distance to the nearest spoke or ring centreline: the roads a tour rides. */
export function tourRoadDistance(forest: Pick<Forest, "roads">, x: number, z: number): number {
  let best = Infinity;
  for (const r of forest.roads) {
    if (r.kind === "spur") continue;
    best = Math.min(best, segDist(x, z, r.ax, r.az, r.bx, r.bz));
  }
  return best;
}

/** True when a start this far off the road needs a way out, not a beeline. */
export function needsLeadIn(forest: LeadForest, x: number, z: number): boolean {
  if (forest.plazas.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) return false;
  return tourRoadDistance(forest, x, z) > 1.2;
}

type Disc = { x: number; z: number; r: number };

/**
 * A clear path from (x, z) to the nearest reachable spoke or ring, as points
 * about SPACING apart, the first the start and the last on the road's centreline;
 * null if there is none within reach (the beeline is the fallback).
 */
export function pathToRoad(forest: LeadForest, sx: number, sz: number): [number, number][] | null {
  // A tight grove may leave no way out with the full margin: then squeeze, as a careful driver would.
  return wayOut(forest, sx, sz, MARGIN) ?? wayOut(forest, sx, sz, 0.15);
}

function wayOut(forest: LeadForest, sx: number, sz: number, margin: number): [number, number][] | null {
  const reach = Math.min(160, tourRoadDistance(forest, sx, sz) + 25);
  // Half-metre cells among the groves; a coarser grid for a long way in from the forest's edge.
  const CELL = reach > 60 ? 1 : 0.5;
  const full: Disc[] = [
    ...forest.trees.filter((t) => Math.abs(t.x - sx) < reach + 4 && Math.abs(t.z - sz) < reach + 4)
      .map((t) => ({ x: t.x, z: t.z, r: t.trunkRadius + CART_R + margin })),
    ...forest.obstacles.map((o) => ({ x: o.x, z: o.z, r: o.r + CART_R + margin })),
  ];
  // Parked closer to a trunk than the margin (beside a tree to read it): first back off
  // to clear air beside it, straight away from what it is nearest, so the drive out does
  // not clip that trunk cutting its first corner.
  let x = sx, z = sz;
  for (let k = 0; k < 8; k++) {
    let px = 0, pz = 0;
    for (const d of full) {
      const at = Math.hypot(x - d.x, z - d.z);
      if (at >= d.r) continue;
      const ux = at > 1e-3 ? (x - d.x) / at : 1, uz = at > 1e-3 ? (z - d.z) / at : 0;
      px += ux * (d.r - at + 0.5);
      pz += uz * (d.r - at + 0.5);
    }
    if (!px && !pz) break;
    x += px; z += pz;
  }
  const backOff = Math.hypot(x - sx, z - sz) > 0.05;
  const discs = full.map((d) => {
    // Parked inside a trunk's margin: that trunk still blocks, but only as close as the cart already is.
    const at = Math.hypot(x - d.x, z - d.z);
    return at < d.r ? { ...d, r: Math.max(0, at - 0.1) } : d;
  });
  const n = Math.ceil((2 * reach) / CELL) + 1;
  const x0 = x - reach, z0 = z - reach;
  const blocked = new Uint8Array(n * n);
  for (const d of discs) {
    const i0 = Math.max(0, Math.floor((d.x - d.r - x0) / CELL)), i1 = Math.min(n - 1, Math.ceil((d.x + d.r - x0) / CELL));
    const j0 = Math.max(0, Math.floor((d.z - d.r - z0) / CELL)), j1 = Math.min(n - 1, Math.ceil((d.z + d.r - z0) / CELL));
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        if (Math.hypot(x0 + i * CELL - d.x, z0 + j * CELL - d.z) < d.r) blocked[j * n + i] = 1;
      }
    }
  }
  const si = Math.round((x - x0) / CELL), sj = Math.round((z - z0) / CELL);
  // The grid snaps the start up to a quarter cell off: free the cells round it so it can set out.
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const a = si + di, b = sj + dj;
    if (a >= 0 && b >= 0 && a < n && b < n && !discs.some((d) => Math.hypot(x0 + a * CELL - d.x, z0 + b * CELL - d.z) < d.r - 0.35)) blocked[b * n + a] = 0;
  }
  blocked[sj * n + si] = 0;
  // Only the roads near the window: the distance is asked of every cell the search opens.
  const local = { roads: forest.roads.filter((r) => r.kind !== "spur"
    && Math.max(r.ax, r.bx) > x0 - reach && Math.min(r.ax, r.bx) < x0 + 3 * reach
    && Math.max(r.az, r.bz) > z0 - reach && Math.min(r.az, r.bz) < z0 + 3 * reach) };
  const roadMemo = new Float32Array(n * n).fill(-1);
  const roadD = (i: number, j: number) => {
    const k = j * n + i;
    if (roadMemo[k]! < 0) roadMemo[k] = tourRoadDistance(local, x0 + i * CELL, z0 + j * CELL);
    return roadMemo[k]!;
  };
  const goal = (i: number, j: number) => roadD(i, j) < ON_ROAD;

  // A* with the road distance as heuristic.
  const g = new Float32Array(n * n).fill(Infinity);
  const from = new Int32Array(n * n).fill(-1);
  const open: { k: number; f: number }[] = [];
  const push = (k: number, f: number) => {
    open.push({ k, f });
    let c = open.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (open[p]!.f <= open[c]!.f) break;
      [open[p], open[c]] = [open[c]!, open[p]!];
      c = p;
    }
  };
  const pop = () => {
    const top = open[0]!, last = open.pop()!;
    if (open.length) {
      open[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1, r = l + 1;
        let m = c;
        if (l < open.length && open[l]!.f < open[m]!.f) m = l;
        if (r < open.length && open[r]!.f < open[m]!.f) m = r;
        if (m === c) break;
        [open[m], open[c]] = [open[c]!, open[m]!];
        c = m;
      }
    }
    return top;
  };
  // Weighted toward the road: a near-shortest way is plenty, as it is pulled taut after,
  // and it opens far fewer cells than a strictly shortest search.
  const h = (i: number, j: number) => 1.6 * roadD(i, j);
  const start = sj * n + si;
  g[start] = 0;
  push(start, h(si, sj));
  let end = -1;
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
  for (let guard = 0; open.length && guard < n * n; guard++) {
    const { k, f } = pop();
    const i = k % n, j = (k - i) / n;
    if (f > g[k]! + h(i, j) + 1e-3) continue; // stale entry
    if (goal(i, j)) { end = k; break; }
    for (const [di, dj] of steps) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= n || b >= n) continue;
      const q = b * n + a;
      if (blocked[q]) continue;
      // No squeezing diagonally between two blocked cells.
      if (di && dj && (blocked[j * n + a] || blocked[b * n + i])) continue;
      const cost = g[k]! + (di && dj ? Math.SQRT2 : 1) * CELL;
      if (cost < g[q]!) {
        g[q] = cost;
        from[q] = k;
        push(q, cost + h(a, b));
      }
    }
  }
  if (end < 0) return null;
  const cells: [number, number][] = [];
  for (let k = end; k >= 0; k = from[k]!) {
    const i = k % n, j = (k - i) / n;
    cells.push([x0 + i * CELL, z0 + j * CELL]);
    if (k === start) break;
  }
  cells.reverse();
  cells[0] = [x, z];
  if (backOff) cells.unshift([sx, sz]);

  // Pull taut: from each kept point, the farthest later point in clear sight.
  const clear = (a: [number, number], b: [number, number]) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(len / 0.25));
    for (let s = 1; s <= steps; s++) {
      const u = s / steps, px = a[0] + (b[0] - a[0]) * u, pz = a[1] + (b[1] - a[1]) * u;
      if (discs.some((d) => Math.hypot(px - d.x, pz - d.z) < d.r - 0.05)) return false;
    }
    return true;
  };
  const taut: [number, number][] = [cells[0]!];
  for (let a = 0; a < cells.length - 1;) {
    let b = cells.length - 1;
    while (b > a + 1 && !clear(cells[a]!, cells[b]!)) b--;
    taut.push(cells[b]!);
    a = b;
  }
  // Resample at the tour's spacing.
  const out: [number, number][] = [taut[0]!];
  for (let k = 1; k < taut.length; k++) {
    const [ax, az] = taut[k - 1]!, [bx, bz] = taut[k]!;
    const len = Math.hypot(bx - ax, bz - az);
    const m = Math.max(1, Math.round(len / SPACING));
    for (let s = 1; s <= m; s++) out.push([ax + ((bx - ax) * s) / m, az + ((bz - az) * s) / m]);
  }
  return out;
}
