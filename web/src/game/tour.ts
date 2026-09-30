import type { Forest } from "./forest";
import { clamp } from "./math";
import { wrapAngle, yawToward } from "./sim";

/**
 * The guided tour as a route along the roads: from wherever the cart is, out
 * the nearest spoke to the first ring it meets (unless the loop is nearer),
 * then around the tour loop forever. The cart follows it by pure pursuit: it steers for the route
 * point LOOKAHEAD metres past the one it has reached, so it keeps to the brick
 * instead of cutting across the grass toward a point somewhere ahead. At each
 * grove stop it pulls up, turns to face the grove's signpost, holds there for
 * DWELL seconds, turns back to the road and carries on.
 */
export type Tour = {
  pts: [number, number][];
  /** The grove each point is heading for, for signposts and the atlas. */
  genre: string[];
  /** Points from here on are the ring, which repeats. */
  loopStart: number;
  /** Progress: the route point the cart has reached. */
  i: number;
  /** Grove stops on the loop in route order: the route point and the grove's signpost. */
  stops: { k: number; genre: string; x: number; z: number }[];
  /** The stop the cart is heading for. */
  next: number;
  /** Times the cart has been through every grove and started round again. */
  laps: number;
  /** Pulled up at a stop: braking, turning to the sign, holding, turning back. */
  dwell: { phase: "brake" | "face" | "hold" | "back"; left: number } | null;
};

/** Seconds the tour holds at each grove's signpost. */
export const DWELL = 5;

/** How many points ahead progress may jump in one step (samples are ~2 m apart). */
const SEARCH = 6;
const CRUISE = 0.42;

/** The route shared by the cart (Player) and the lanterns that light it (World). */
export const tourState: { tour: Tour | null } = { tour: null };

export function planTour(forest: Pick<Forest, "ringPath" | "roadLines" | "circuit" | "signs">, x: number, z: number, yaw: number): Tour {
  const ring = forest.ringPath;
  const nearestRing = (px: number, pz: number) => {
    let k = 0, best = Infinity;
    ring.forEach((p, i) => {
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < best) { best = d; k = i; }
    });
    return { k, d: best };
  };
  let spoke: [number, number][] | null = null, ks = 0, ds = Infinity;
  for (const line of forest.roadLines) {
    if (line.kind !== "spoke") continue;
    line.pts.forEach(([px, pz], k) => {
      const d = Math.hypot(px - x, pz - z);
      if (d < ds) { ds = d; ks = k; spoke = line.pts; }
    });
  }
  const pts: [number, number][] = [];
  const onRing = nearestRing(x, z);
  let join = onRing.k;
  // The heading the cart will arrive at the ring with.
  let hx = -Math.sin(yaw), hz = -Math.cos(yaw);
  // Spokes run from the hub out across the rings; ride one out to the first
  // ring it meets if the spoke is clearly nearer.
  const s = spoke as [number, number][] | null;
  if (s && ds + 2 < onRing.d) {
    let k = ks;
    for (; k < s.length; k++) {
      pts.push(s[k]!);
      if (k > ks && nearestRing(...s[k]!).d < 2) break;
    }
    const [ex, ez] = pts[pts.length - 1]!;
    const [px, pz] = s[Math.max(0, Math.min(k, s.length - 1) - 1)]!;
    join = nearestRing(ex, ez).k;
    hx = ex - px; hz = ez - pz;
  }
  // Where the loop passes a point twice (the junction behind home, where it
  // leaves for the outer ring and later comes back), join it at the earlier
  // pass: the loop starts with the inner ring.
  const [jx, jz] = pts.length ? pts[pts.length - 1]! : [x, z];
  const reach = nearestRing(jx, jz).d + 1.5;
  const gap = (i: number) => Math.hypot(ring[i]!.x - jx, ring[i]!.z - jz);
  join = ring.findIndex((_, i) => gap(i) < reach);
  for (let i = join + 1; i < ring.length && gap(i) < reach; i++) if (gap(i) < gap(join)) join = i;
  // The loop runs the inner ring first; follow it, unless the cart is already
  // on the loop heading clearly the other way, when turning round would be a U-turn.
  const n = ring.length;
  const fwd = ring[(join + 1) % n]!, at = ring[join]!;
  const along = ((fwd.x - at.x) * hx + (fwd.z - at.z) * hz) / ((Math.hypot(fwd.x - at.x, fwd.z - at.z) * Math.hypot(hx, hz)) || 1);
  const dir = !pts.length && along < -0.5 ? -1 : 1;
  const loopStart = pts.length;
  for (let k = 0; k < n; k++) {
    const p = ring[(join + dir * k + n * n) % n]!;
    pts.push([p.x, p.z]);
  }
  // Each point heads for the next grove stop the route reaches.
  const stopAt = new Map<number, string>();
  for (const wp of forest.circuit) {
    let k = loopStart, best = Infinity;
    for (let i = loopStart; i < pts.length; i++) {
      const d = Math.hypot(pts[i]![0] - wp.x, pts[i]![1] - wp.z);
      if (d < best) { best = d; k = i; }
    }
    stopAt.set(k, wp.genre);
  }
  const genre: string[] = new Array(pts.length);
  let upcoming = "";
  for (let pass = 0; pass < 2; pass++) {
    for (let i = pts.length - 1; i >= loopStart; i--) {
      upcoming = stopAt.get(i) ?? upcoming;
      genre[i] = upcoming;
    }
  }
  for (let i = loopStart - 1; i >= 0; i--) genre[i] = genre[loopStart]!;
  const stops = [...stopAt.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, g]) => {
      const sign = forest.signs.find((sg) => sg.genre === g);
      return { k, genre: g, x: sign?.x ?? pts[k]![0], z: sign?.z ?? pts[k]![1] };
    });
  return { pts, genre, loopStart, i: 0, stops, next: 0, laps: 0, dwell: null };
}

/** Route points from `from` forward to `to`, following the loop. */
function stepsTo(t: Tour, from: number, to: number): number {
  if (to >= from) return to - from;
  return to - t.loopStart + (t.pts.length - from);
}

function next(t: Tour, i: number): number {
  return i + 1 < t.pts.length ? i + 1 : t.loopStart;
}

/** The point `dist` metres along the route past point `i`. */
function along(t: Tour, i: number, dist: number): number {
  let j = i, acc = 0;
  for (let guard = 0; acc < dist && guard < t.pts.length; guard++) {
    const n = next(t, j);
    acc += Math.hypot(t.pts[n]![0] - t.pts[j]![0], t.pts[n]![1] - t.pts[j]![1]);
    j = n;
  }
  return j;
}

/** The largest change of heading along the route in the next `dist` metres, in radians. */
function turnAhead(t: Tour, i: number, dist: number): number {
  const heading = (j: number) => {
    const n = next(t, j);
    return Math.atan2(t.pts[n]![1] - t.pts[j]![1], t.pts[n]![0] - t.pts[j]![0]);
  };
  const h0 = heading(i);
  let worst = 0, j = i, acc = 0;
  for (let guard = 0; acc < dist && guard < t.pts.length; guard++) {
    const n = next(t, j);
    acc += Math.hypot(t.pts[n]![0] - t.pts[j]![0], t.pts[n]![1] - t.pts[j]![1]);
    j = n;
    worst = Math.max(worst, Math.abs(wrapAngle(heading(j) - h0)));
  }
  return worst;
}

/** Turn in place toward `target`; true once facing it within `tol` radians. */
function turnTo(yaw: number, target: number, tol: number): { steer: number; done: boolean } {
  const err = wrapAngle(target - yaw);
  return { steer: clamp(err * 2.5, -1, 1), done: Math.abs(err) < tol };
}

/** The grove the cart is pulled up at, facing or about to face its sign; null while driving. */
export function tourStop(t: Tour): string | null {
  if (!t.dwell || t.dwell.phase === "brake") return null;
  return t.stops[t.next]?.genre ?? null;
}

/**
 * Advance progress and return the controls that hold the cart to the route.
 *
 * :param dt: Seconds since the last call, for the hold at each grove.
 * :param busy: The grove is still being narrated; the hold lasts at least
 *   DWELL seconds and until this is false.
 */
export function steerTour(t: Tour, x: number, z: number, yaw: number, speed: number, dt: number, busy = false): { steer: number; throttle: number; brake: boolean; genre: string } {
  const stop = t.stops[t.next];
  if (t.dwell && stop) {
    const d = t.dwell;
    const hold = { throttle: 0, brake: true, genre: stop.genre };
    if (d.phase === "brake") {
      if (Math.abs(speed) < 0.05) d.phase = "face";
      return { steer: 0, ...hold };
    }
    if (d.phase === "face") {
      const turn = turnTo(yaw, yawToward(x, z, stop.x, stop.z), 0.04);
      if (turn.done) d.phase = "hold";
      return { steer: turn.steer, ...hold };
    }
    if (d.phase === "hold") {
      d.left -= dt;
      if (d.left <= 0 && !busy) d.phase = "back";
      return { steer: 0, ...hold };
    }
    const [tx, tz] = t.pts[along(t, t.i, 5)]!;
    const turn = turnTo(yaw, yawToward(x, z, tx, tz), 0.08);
    if (!turn.done) return { steer: turn.steer, ...hold };
    t.dwell = null;
    t.next = (t.next + 1) % t.stops.length;
    if (t.next === 0) t.laps++;
  }
  let best = t.i, bestD = Math.hypot(t.pts[t.i]![0] - x, t.pts[t.i]![1] - z);
  for (let k = 1, j = t.i; k <= SEARCH; k++) {
    j = next(t, j);
    const d = Math.hypot(t.pts[j]![0] - x, t.pts[j]![1] - z);
    if (d < bestD) { bestD = d; best = j; }
  }
  t.i = best;
  // Pull up at the next grove stop once progress reaches it.
  const at = t.stops[t.next];
  if (at && t.i >= t.loopStart && stepsTo(t, at.k, t.i) <= SEARCH) {
    t.dwell = { phase: "brake", left: DWELL };
    return { steer: 0, throttle: 0, brake: true, genre: at.genre };
  }
  // Distance off the route: to the segments either side of the point reached.
  const seg = (a: number, b: number) => {
    const [ax, az] = t.pts[a]!, [bx, bz] = t.pts[b]!;
    const dx = bx - ax, dz = bz - az;
    const u = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    return Math.hypot(x - ax - dx * u, z - az - dz * u);
  };
  const off = Math.min(seg(t.i, next(t, t.i)), t.i > 0 ? seg(t.i - 1, t.i) : Infinity);
  // Look further ahead the faster the cart goes: tight at a crawl, smooth at speed.
  const [tx, tz] = t.pts[along(t, t.i, clamp(2.5 + 0.8 * Math.abs(speed), 3, 6))]!;
  const err = wrapAngle(yawToward(x, z, tx, tz) - yaw);
  // Slow for the bends ahead (the ring doubles back at some grove stops):
  // coast when over the bend's speed, so drag brakes the cart before the turn.
  const bend = Math.max(turnAhead(t, t.i, 10), Math.abs(err));
  // Off the centreline (coming out of a turn), hold back until it is regained.
  let limit = (1.2 + 3 * Math.max(0, 1 - bend / 1.9)) * Math.max(0.45, 1 - Math.max(0, off - 0.5) / 2);
  // Ease off approaching the stop, so the cart pulls up rather than stands on the brake.
  if (at && t.i >= t.loopStart) limit = Math.min(limit, 0.8 + 0.35 * Math.hypot(t.pts[at.k]![0] - x, t.pts[at.k]![1] - z));
  return {
    steer: clamp(err * 1.8, -1, 1),
    throttle: speed > limit ? 0 : CRUISE,
    brake: false,
    genre: t.genre[t.i]!,
  };
}

/** `n` points along the route ahead of the cart, `spacing` metres apart, for the lantern trail. */
export function tourAhead(t: Tour, n: number, spacing: number): [number, number][] {
  const out: [number, number][] = [];
  let j = t.i;
  for (let k = 0; k < n; k++) {
    j = along(t, j, spacing);
    out.push(t.pts[j]!);
  }
  return out;
}
