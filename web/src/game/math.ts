/** Deterministic hash (FNV-1a) — same slug always grows the same tree. */
export function seedFromKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * n points spread evenly (equal area each) over an annulus from `inner`, about
 * `spacing` apart: a sunflower (Vogel) spiral, r = sqrt(inner^2 + c^2 i).
 * Returns the points and the outer radius they reach.
 */
export function sunflower(n: number, inner: number, spacing: number): { pts: { x: number; z: number }[]; outer: number } {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const c2 = (spacing * spacing) / Math.PI;
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(inner * inner + c2 * (i + 0.5));
    pts.push({ x: r * Math.cos(i * golden), z: r * Math.sin(i * golden) });
  }
  return { pts, outer: Math.sqrt(inner * inner + c2 * n) };
}

/**
 * A hub-and-spoke wheel of groves. Groves stand in one or two tiers around a
 * clear hub, each tier outside its own circular ring road: a grove's inner
 * edge sits `setback` beyond its tier's ring, so the road passes every grove
 * in the tier at the same distance. The smaller groves take the inner tier,
 * where a ring is short; the tier split is whichever gives the smallest world.
 * Within a tier big and small groves alternate (small ones stand nearer the
 * ring, so a big neighbour needs less angle) and any spare angle is shared
 * evenly. Spokes run straight from the hub out to the last ring, through the
 * gaps between inner-tier groves that leave a `lane` of clearance on both sides,
 * at most `spokes` of them, as evenly spread as the gaps allow.
 *
 * :param radii: Grove radii, in the caller's grove order.
 * :param opts: `hub`, the least radius of the first ring; `setback`, ring road
 *   to grove edge; `gap`, least clear distance between two groves; `lane`,
 *   least clear distance from a spoke's centreline to a grove edge; `spokes`,
 *   the most spokes.
 * :returns: Each grove's centre and tier, each tier's ring radius, the spoke
 *   bearings (radians), and the world radius (the outermost grove edge).
 */
export function wheelLayout(
  radii: number[],
  opts: { hub: number; setback: number; gap: number; lane: number; spokes: number },
): { centers: { x: number; z: number }[]; tier: number[]; rings: number[]; spokes: number[]; outer: number } {
  const { hub, setback, gap, lane } = opts;
  radii.forEach((r, i) => {
    if (!Number.isFinite(r) || r <= 0) throw new Error(`wheelLayout: radius ${i} is ${r}`);
  });
  const n = radii.length;
  // Angle between neighbours whose inner edges both sit `setback` outside ring R.
  const sep = (R: number, a: number, b: number) => {
    const ca = R + setback + a, cb = R + setback + b, d = a + b + gap;
    return Math.acos(clamp((ca * ca + cb * cb - d * d) / (2 * ca * cb), -1, 1));
  };
  // Big, small, next big, next small ...; ties by grove order so the layout is stable.
  const alternate = (idx: number[]) => {
    const s = [...idx].sort((a, b) => radii[b]! - radii[a]! || a - b);
    const out: number[] = [];
    while (s.length) {
      out.push(s.shift()!);
      if (s.length) out.push(s.pop()!);
    }
    return out;
  };
  const place = (order: number[], R: number): number[] | null => {
    const k = order.length;
    if (k === 1) return [0];
    const gaps = order.map((g, i) => sep(R, radii[g]!, radii[order[(i + 1) % k]!]!));
    const slack = 2 * Math.PI - gaps.reduce((a, b) => a + b, 0);
    if (slack < 0) return null;
    const ang: number[] = [0];
    for (let i = 1; i < k; i++) ang.push(ang[i - 1]! + gaps[i - 1]! + slack / k);
    const at = (i: number) => {
      const c = R + setback + radii[order[i]!]!;
      return { x: c * Math.cos(ang[i]!), z: c * Math.sin(ang[i]!) };
    };
    // Neighbours are spaced by construction; check every other pair too.
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
      const a = at(i), b = at(j);
      if (Math.hypot(a.x - b.x, a.z - b.z) < radii[order[i]!]! + radii[order[j]!]! + gap - 1e-6) return null;
    }
    return ang;
  };
  // The least ring radius, at or above `least`, that fits the tier.
  const fit = (order: number[], least: number) => {
    let lo = least, hi = least;
    while (!place(order, hi)) hi = hi * 2 + 1;
    if (hi === least) return least;
    for (let it = 0; it < 40; it++) {
      const mid = (lo + hi) / 2;
      if (place(order, mid)) hi = mid; else lo = mid;
    }
    return hi;
  };
  const bySize = [...radii.keys()].sort((a, b) => radii[a]! - radii[b]! || a - b);
  let best: { tiers: number[][]; rings: number[]; outer: number } | null = null;
  // k groves in the inner tier; k = 0 is a single ring.
  for (let k = 0; k < n; k++) {
    const tiers = (k ? [bySize.slice(0, k), bySize.slice(k)] : [bySize]).map(alternate);
    const rings: number[] = [];
    let least = hub;
    for (const t of tiers) {
      const R = fit(t, least);
      rings.push(R);
      least = R + setback + 2 * Math.max(...t.map((g) => radii[g]!)) + setback;
    }
    const last = tiers[tiers.length - 1]!;
    const outer = rings[rings.length - 1]! + setback + 2 * Math.max(...last.map((g) => radii[g]!));
    if (!best || outer < best.outer - 1e-6) best = { tiers, rings, outer };
  }
  const { tiers, rings, outer } = best!;
  const centers: { x: number; z: number }[] = new Array(n);
  const tier: number[] = new Array(n);
  const angles: number[][] = [];
  tiers.forEach((order, t) => {
    const ang = place(order, rings[t]!)!;
    angles.push(ang);
    order.forEach((g, i) => {
      const c = rings[t]! + setback + radii[g]!;
      centers[g] = { x: c * Math.cos(ang[i]!), z: c * Math.sin(ang[i]!) };
      tier[g] = t;
    });
  });
  // A spoke in each gap of the inner tier, at the bearing that keeps farthest
  // from the groves either side; only where it keeps `lane` from every grove.
  const first = tiers[0]!;
  const reach = rings[rings.length - 1]!;
  const clearOf = (a: number) => {
    const ux = Math.cos(a), uz = Math.sin(a);
    let worst = Infinity;
    centers.forEach((c, g) => {
      const along = c.x * ux + c.z * uz;
      if (along < 0) return;
      const d = along <= reach ? Math.abs(c.x * uz - c.z * ux) : Math.hypot(c.x - ux * reach, c.z - uz * reach);
      worst = Math.min(worst, d - radii[g]!);
    });
    return worst;
  };
  const open: number[] = [];
  const firstAng = angles[0]!;
  for (let i = 0; i < first.length; i++) {
    const a0 = firstAng[i]!, a1 = i + 1 < first.length ? firstAng[i + 1]! : firstAng[0]! + 2 * Math.PI;
    let bestA = 0, bestC = -Infinity;
    for (let s = 1; s < 64; s++) {
      const a = a0 + ((a1 - a0) * s) / 64;
      const c = clearOf(a);
      if (c > bestC) { bestC = c; bestA = a; }
    }
    if (bestC >= lane) open.push(Math.atan2(Math.sin(bestA), Math.cos(bestA)));
  }
  // Keep the most even `spokes` of the open gaps: try evenly spaced bearings at
  // every turn of the wheel, take the open gap nearest each, and keep the set
  // that strays least from even.
  const want = Math.min(opts.spokes, open.length);
  let spokes = open;
  if (want < open.length) {
    let bestErr = Infinity;
    for (let s = 0; s < 128; s++) {
      const used = new Set<number>();
      let err = 0;
      for (let j = 0; j < want; j++) {
        const target = (2 * Math.PI * (s / 128 + j)) / want;
        let pick = -1, d = Infinity;
        open.forEach((a, i) => {
          const e = Math.abs(Math.atan2(Math.sin(a - target), Math.cos(a - target)));
          if (!used.has(i) && e < d) { d = e; pick = i; }
        });
        used.add(pick);
        err = Math.max(err, d);
      }
      if (err < bestErr) {
        bestErr = err;
        spokes = open.filter((_, i) => used.has(i));
      }
    }
  }
  return { centers, tier, rings, spokes, outer };
}

export function fibonacciAnnulus(
  n: number,
  inner: number,
  outer: number,
): { x: number; z: number }[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts: { x: number; z: number }[] = [];
  const count = Math.max(n, 1);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const r = inner + t * (outer - inner);
    const a = i * golden;
    pts.push({ x: r * Math.cos(a), z: r * Math.sin(a) });
  }
  return pts;
}

export function fibonacciHemisphere(n: number, radius: number): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const need = Math.max(n, 1);
  let i = 0;
  let found = 0;
  const cap = need * 3 + 8;
  while (found < need && i < cap) {
    const y = 1 - (i / Math.max(cap - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * golden;
    const yy = Math.abs(y);
    pts.push({ x: Math.cos(a) * r * radius, y: yy * radius, z: Math.sin(a) * r * radius });
    found++;
    i++;
  }
  return pts.slice(0, need);
}
