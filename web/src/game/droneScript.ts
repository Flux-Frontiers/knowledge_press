/**
 * A drone's fly-in to the corpus redwood (`?flyin`): from beyond the forest's
 * edge, low over the crowns, down into the spoke road that points at home,
 * along it to the hub, round the redwood, and out onto the start screen's slow
 * circle (startOrbit.ts), where it goes on circling as the start screen does:
 * the film ends on the view the app opens with. Pure math: the pose at `t`
 * seconds, in world meters (three.js axes), so the game (FlyIn.tsx) and a
 * Blender render can fly the same path. The tests keep every position clear of
 * the leaves, the redwood and the ground.
 */
import { ORBIT_LOOK, ORBIT_R, ORBIT_RATE, ORBIT_UP, orbitAngle, orbitPose } from "./startOrbit";

export type P3 = [number, number, number];
export type DronePose = { cam: P3; look: P3 };
/** `duration` is when the flight joins the start screen's circle; `pose` goes on circling after it. */
export type DroneFlight = { duration: number; pose: (t: number) => DronePose };

/** What the flight needs from the forest. */
export type DroneSite = {
  /** The spoke road's far end (its point on the outer ring), ground plane x, z. */
  spokeEnd: [number, number];
  /** The redwood's height: where the camera looks while circling. */
  redwoodHeight: number;
  /**
   * Where the flight joins the start screen's circle, as a bearing from the hub
   * (atan2(z, x)): chosen so the circle is clear of leaves from there on (droneSite).
   */
  joinBearing: number;
};

/** Distance from the hub where the flight starts, beyond the forest's edge. */
const START_R = 340;
const START_Y = 40;
/** Over the outer ring: low over the last crowns (29 m tops) as it drops into the road. */
const RING_Y = 14;
/** The close orbit: well outside the redwood's limbs (15.4 m at most). */
const NEAR_R = 26;
/** Where the road gives way to the curve onto the close orbit, and how far that curve turns. */
const ENTRY_R = 45;
const ENTRY_TURN = (50 * Math.PI) / 180;
/** How far round the close orbit goes, clockwise like the start screen's circle. */
const NEAR_TURN = (300 * Math.PI) / 180;
/** The spiral out to the start screen's circle turns at least this much further. */
const MIN_OUT_TURN = (40 * Math.PI) / 180;
/** Then the last stretch runs along the circle itself at the circle's own pace. */
const SETTLE_TURN = (35 * Math.PI) / 180;
/** The circle must be clear for the settle and this long after (FlyIn.tsx circles on 12 s). */
const CLEAR_AFTER_S = 25;
/** The spiral's last stretch before the join, which runs close to the circle: checked as well. */
const SPIRAL_TAIL = (35 * Math.PI) / 180;
/** How far the circle keeps from every leaf over that stretch. */
const CIRCLE_CLEARANCE = 3;

/** Ground speeds over each leg, meters per second; the last is the start screen circle's own. */
const SPEED = { approach: 16, road: 10, orbit: 7, out: 6, settle: ORBIT_RATE * ORBIT_R };
/** Meters of path either side over which the legs' speeds are blended. */
const SPEED_WINDOW = 15;
/** Seconds of ease in at the start. The end needs none: it already moves at the circle's pace. */
const EASE_IN = 3;

type Leg = keyof typeof SPEED;
type Sample = { p: P3; leg: Leg };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (k: number) => k * k * (3 - 2 * k);

/** A point on a circle round the hub at bearing `phi` (atan2(z, x)). */
const ring = (phi: number, r: number, y: number): P3 => [Math.cos(phi) * r, y, Math.sin(phi) * r];

/**
 * The path as dense samples, each tagged with its leg. Joins are rounded
 * afterwards by a moving average, which leaves the last stretch, on the start
 * screen's circle, untouched.
 */
function samples(site: DroneSite): Sample[] {
  const [ex, ez] = site.spokeEnd;
  const ringR = Math.hypot(ex, ez);
  const ux = ex / ringR, uz = ez / ringR; // outward along the spoke
  const out: Sample[] = [];
  const push = (p: P3, leg: Leg) => out.push({ p, leg });
  // Approach: from far out, high, to the outer ring, low.
  for (let i = 0; i <= 120; i++) {
    const k = i / 120;
    const r = lerp(START_R, ringR, k);
    push([ux * r, lerp(START_Y, RING_Y, smooth(k)), uz * r], "approach");
  }
  // The road: in along the spoke, down to 9 m, rising a little toward the end.
  const a0 = Math.atan2(uz, ux);
  for (let i = 1; i <= 70; i++) {
    const k = i / 70;
    const r = lerp(ringR, ENTRY_R, k);
    push([ux * r, lerp(RING_Y, 9, smooth(Math.min(1, k * 1.6))) + 3 * smooth(Math.max(0, (k - 0.7) / 0.3)), uz * r], "road");
  }
  // The entry: a curve from the road onto the close orbit. It leaves heading straight in, as the
  // road does (radius falling fastest, bearing still), and arrives heading round, as the orbit
  // does (radius still, bearing turning), so the camera never swings round a corner.
  const yIn = out[out.length - 1]!.p[1];
  for (let i = 1; i <= 50; i++) {
    const k = i / 50;
    const r = ENTRY_R - (ENTRY_R - NEAR_R) * (1 - (1 - k) * (1 - k));
    push(ring(a0 - ENTRY_TURN * k * k, r, yIn), "road");
  }
  // The close orbit, clockwise: most of a turn round the redwood, rising to the mid crown and back.
  const y0 = yIn;
  const aOrbit = a0 - ENTRY_TURN;
  for (let i = 1; i <= 150; i++) {
    const k = i / 150;
    push(ring(aOrbit - NEAR_TURN * k, NEAR_R, y0 + 16 * Math.sin(Math.PI * k)), "orbit");
  }
  // Out: a spiral from the close orbit to the start screen's circle and its eye height, joining
  // it where it is clear (site.joinBearing), at least MIN_OUT_TURN on, clockwise.
  const a1 = aOrbit - NEAR_TURN;
  let outTurn = ((a1 - site.joinBearing) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  if (outTurn < MIN_OUT_TURN) outTurn += 2 * Math.PI;
  for (let i = 1; i <= 80; i++) {
    const k = smooth(i / 80);
    push(ring(a1 - outTurn * (i / 80), lerp(NEAR_R, ORBIT_R, k), lerp(y0, ORBIT_UP, k)), "out");
  }
  // Settle: along the start screen's circle itself.
  const a2 = a1 - outTurn;
  for (let i = 1; i <= 40; i++) push(ring(a2 - SETTLE_TURN * (i / 40), ORBIT_R, ORBIT_UP), "settle");
  return out;
}

/** Rounds the corners where legs meet: a moving average over `w` samples; the ends and the settle are kept. */
function rounded(s: Sample[], w: number): Sample[] {
  return s.map((x, i) => {
    if (i < w || i >= s.length - w || x.leg === "settle") return x;
    const acc: P3 = [0, 0, 0];
    for (let j = i - w; j <= i + w; j++) for (let c = 0; c < 3; c++) acc[c] += s[j]!.p[c]!;
    return { p: acc.map((v) => v / (2 * w + 1)) as P3, leg: x.leg };
  });
}

/**
 * The fly-in for a forest.
 *
 * :param site: The spoke and redwood the flight is laid out from.
 * :return: When it joins the start screen's circle, and its pose at any time:
 *     before 0 the start, after `duration` circling on as the start screen does.
 */
export function droneFlight(site: DroneSite): DroneFlight {
  const path = rounded(samples(site), 6);
  // Speed at each sample, eased between legs so it never jumps: the legs' speeds averaged over
  // SPEED_WINDOW meters of path either side. By distance, not by sample: the samples bunch where
  // the spiral meets the circle. The settle is longer than the window, so the flight reaches the
  // circle's own pace before it ends.
  const dist = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!.p, b = path[i]!.p;
    dist.push(dist[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const raw = path.map((x) => SPEED[x.leg]);
  const speed = raw.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = i; j >= 0 && dist[i]! - dist[j]! <= SPEED_WINDOW; j--) { sum += raw[j]!; n++; }
    for (let j = i + 1; j < raw.length && dist[j]! - dist[i]! <= SPEED_WINDOW; j++) { sum += raw[j]!; n++; }
    return sum / n;
  });
  const time = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!.p, b = path[i]!.p;
    time.push(time[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / ((speed[i - 1]! + speed[i]!) / 2));
  }
  const travel = time[time.length - 1]!;
  // Ease in: the clock runs slow for the first seconds (a speed ramp of length E costs E/2 more).
  const duration = travel + EASE_IN / 2;
  const toTravel = (t: number) => {
    const T = Math.max(0, t);
    return T < EASE_IN ? (T * T) / (2 * EASE_IN) : T - EASE_IN / 2;
  };
  const at = (s: number): P3 => {
    let lo = 0, hi = time.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (time[m]! <= s) lo = m; else hi = m; }
    const k = time[hi] === time[lo] ? 0 : (s - time[lo]!) / (time[hi]! - time[lo]!);
    const a = path[lo]!.p, b = path[hi]!.p;
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  };
  const last = path[path.length - 1]!.p;
  const endAngle = orbitAngle(last[0], last[2]);
  const tree: P3 = [0, site.redwoodHeight * ORBIT_LOOK, 0];
  return {
    duration,
    pose(t) {
      // After the flight: the start screen's circle, going on at its own rate.
      if (t >= duration) return orbitPose(endAngle + ORBIT_RATE * (t - duration), site.redwoodHeight);
      const s = toTravel(t);
      const p = at(s);
      // Look ahead along the path (three seconds on) while crossing the forest, drawn to the
      // redwood as it nears, then held where the start screen looks.
      const ahead = at(Math.min(travel, s + SPEED.approach * 3));
      const pull = smooth(Math.max(0, Math.min(1, (90 - Math.hypot(p[0], p[2])) / 60)));
      const look: P3 = [lerp(ahead[0], tree[0], pull), lerp(ahead[1] - 4, tree[1], pull), lerp(ahead[2], tree[2], pull)];
      return { cam: p, look };
    },
  };
}

/**
 * The site for a forest: the spoke road whose far end points nearest the home
 * plaza's bearing (the redwood's plaque faces that way), so the drone comes in
 * along it toward the plaque; and where it joins the start screen's circle, the
 * first bearing clockwise after the close orbit (and at least MIN_OUT_TURN on)
 * from which the circle keeps CIRCLE_CLEARANCE from every leaf for the settle and
 * CLEAR_AFTER_S seconds of circling after it. The start screen's circle itself
 * brushes a few crowns on its way round; the film should not end in one.
 */
export function droneSite(forest: {
  roadLines: { kind: string; pts: [number, number][] }[];
  home: { x: number; z: number };
  corpusTree: { height: number };
  leaves: { count: number; pos: Float32Array };
}): DroneSite {
  const homeA = Math.atan2(forest.home.z, forest.home.x);
  let best: [number, number] = [forest.home.x * 10, forest.home.z * 10], bestD = Infinity;
  for (const l of forest.roadLines) {
    if (l.kind !== "spoke") continue;
    const end = l.pts.reduce((a, b) => (Math.hypot(b[0], b[1]) > Math.hypot(a[0], a[1]) ? b : a));
    const d = Math.abs(Math.atan2(Math.sin(Math.atan2(end[1], end[0]) - homeA), Math.cos(Math.atan2(end[1], end[0]) - homeA)));
    if (d < bestD) { bestD = d; best = end; }
  }
  // Leaves near the circle, as bearings, with how close each comes to it.
  const near: { a: number; d: number }[] = [];
  const P = forest.leaves.pos;
  for (let i = 0; i < forest.leaves.count; i++) {
    const x = P[i * 3]!, y = P[i * 3 + 1]!, z = P[i * 3 + 2]!;
    const d = Math.hypot(Math.hypot(x, z) - ORBIT_R, y - ORBIT_UP);
    if (d < CIRCLE_CLEARANCE) near.push({ a: Math.atan2(z, x), d });
  }
  // The arc the camera covers once on the circle: the settle, then circling at the start screen's rate.
  const span = SETTLE_TURN + ORBIT_RATE * CLEAR_AFTER_S;
  // Clear if no near leaf's bearing lies in [join - span, join] (clockwise from the join), widened a little.
  const pad = CIRCLE_CLEARANCE / ORBIT_R;
  // The spiral's tail runs nearly on the circle for the last stretch before the join, too.
  const before = SPIRAL_TAIL + pad;
  const clear = (join: number) => near.every(({ a }) => {
    const back = ((join - a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    return back > span + pad && back < 2 * Math.PI - before;
  });
  const a0 = Math.atan2(best[1], best[0]);
  const start = a0 - ENTRY_TURN - NEAR_TURN - MIN_OUT_TURN;
  let joinBearing = start;
  for (let k = 0; k < 360; k++) {
    const j = start - (k * Math.PI) / 180;
    if (clear(j)) { joinBearing = j; break; }
  }
  return { spokeEnd: best, redwoodHeight: forest.corpusTree.height, joinBearing };
}
