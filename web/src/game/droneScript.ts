/**
 * A drone's fly-in to the corpus redwood (`?flyin`): from beyond the forest's
 * edge, low over the crowns, down into the spoke road that points at home,
 * along it to the hub, round the redwood, and down onto the home plaza looking
 * up the trunk. Pure math: the pose at `t` seconds, in world meters (three.js
 * axes), so the game (FlyIn.tsx) and a Blender render can fly the same path.
 * The tests keep every position clear of the leaves, the redwood and the ground.
 */

export type P3 = [number, number, number];
export type DronePose = { cam: P3; look: P3 };
export type DroneFlight = { duration: number; pose: (t: number) => DronePose };

/** What the flight needs from the forest. */
export type DroneSite = {
  /** The spoke road's far end (its point on the outer ring), ground plane x, z. */
  spokeEnd: [number, number];
  /** Where the flight lands: the home plaza, behind the redwood's plaque. */
  home: { x: number; z: number };
  /** The redwood's height, for where the camera looks while circling. */
  redwoodHeight: number;
};

/** Distance from the hub where the flight starts, beyond the forest's edge. */
const START_R = 340;
const START_Y = 40;
/** Over the outer ring: low over the last crowns (29 m tops) as it drops into the road. */
const RING_Y = 14;
/** The orbit: well outside the redwood's limbs (15.4 m at most). */
const ORBIT_R = 26;
const ORBIT_TURN = (330 * Math.PI) / 180;
const EYE_Y = 1.7;

/** Ground speeds over each leg, meters per second: quick across the forest, slower round the tree. */
const SPEED = { approach: 16, road: 10, orbit: 7, land: 3.2 };
/** Seconds of ease in at the start and out at the landing. */
const EASE_IN = 3;
const EASE_OUT = 4;

type Leg = keyof typeof SPEED;
type Sample = { p: P3; leg: Leg };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (k: number) => k * k * (3 - 2 * k);

/**
 * The path as dense samples, each tagged with its leg: a straight glide in,
 * the road, the orbit, the landing. Joins are rounded afterwards by a moving average.
 */
function samples(site: DroneSite): Sample[] {
  const [ex, ez] = site.spokeEnd;
  const ringR = Math.hypot(ex, ez);
  const ux = ex / ringR, uz = ez / ringR; // outward along the spoke
  const out: Sample[] = [];
  const push = (x: number, y: number, z: number, leg: Leg) => out.push({ p: [x, y, z], leg });
  // Approach: from far out, high, to the outer ring, low.
  for (let i = 0; i <= 120; i++) {
    const k = i / 120;
    const r = lerp(START_R, ringR, k);
    push(ux * r, lerp(START_Y, RING_Y, smooth(k)), uz * r, "approach");
  }
  // The road: in along the spoke to the orbit, coming down to 9 m and rising a little at the end.
  const a0 = Math.atan2(uz, ux);
  for (let i = 1; i <= 80; i++) {
    const k = i / 80;
    const r = lerp(ringR, ORBIT_R, k);
    push(ux * r, lerp(RING_Y, 9, smooth(Math.min(1, k * 1.6))) + 3 * smooth(Math.max(0, (k - 0.7) / 0.3)), uz * r, "road");
  }
  // The orbit: most of a turn round the redwood, rising to the mid crown and back down.
  const orbitStartY = out[out.length - 1]!.p[1];
  for (let i = 1; i <= 160; i++) {
    const k = i / 160;
    const a = a0 + ORBIT_TURN * k;
    push(Math.cos(a) * ORBIT_R, orbitStartY + 16 * Math.sin(Math.PI * k), Math.sin(a) * ORBIT_R, "orbit");
  }
  // The landing: across to the home plaza and down to eye height.
  const [lx, ly, lz] = out[out.length - 1]!.p;
  for (let i = 1; i <= 60; i++) {
    const k = smooth(i / 60);
    push(lerp(lx, site.home.x, k), lerp(ly, EYE_Y, smooth(i / 60)), lerp(lz, site.home.z, k), "land");
  }
  return out;
}

/** Rounds the corners where legs meet: a moving average over `w` samples, ends pinned. */
function rounded(s: Sample[], w: number): Sample[] {
  return s.map((x, i) => {
    if (i < w || i >= s.length - w) return x;
    const acc: P3 = [0, 0, 0];
    for (let j = i - w; j <= i + w; j++) for (let c = 0; c < 3; c++) acc[c] += s[j]!.p[c]!;
    return { p: acc.map((v) => v / (2 * w + 1)) as P3, leg: x.leg };
  });
}

/**
 * The fly-in for a forest.
 *
 * :param site: The spoke, home and redwood the flight is laid out from.
 * :return: Its duration in seconds and its pose at any time (clamped to the ends).
 */
export function droneFlight(site: DroneSite): DroneFlight {
  const path = rounded(samples(site), 6);
  // Time at each sample: distance over the leg's speed.
  const time = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!.p, b = path[i]!.p;
    time.push(time[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / SPEED[path[i]!.leg]);
  }
  const travel = time[time.length - 1]!;
  // Ease: the clock runs slow for the first and last few seconds, so the drone starts and settles gently.
  // Integrating a speed ramp of length E gives E/2 extra seconds at each end.
  const duration = travel + EASE_IN / 2 + EASE_OUT / 2;
  const toTravel = (t: number) => {
    const T = Math.max(0, Math.min(duration, t));
    // Speed factor ramps 0 -> 1 over EASE_IN and 1 -> 0 over the last EASE_OUT seconds.
    const a = Math.min(T, EASE_IN), inPart = (a * a) / (2 * EASE_IN);
    const mid = Math.max(0, Math.min(T, duration - EASE_OUT) - EASE_IN);
    const b = Math.max(0, T - (duration - EASE_OUT)), outPart = b - (b * b) / (2 * EASE_OUT);
    return Math.min(travel, inPart + mid + outPart);
  };
  const at = (s: number): { p: P3; leg: Leg; k: number } => {
    let lo = 0, hi = time.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (time[m]! <= s) lo = m; else hi = m; }
    const k = time[hi] === time[lo] ? 0 : (s - time[lo]!) / (time[hi]! - time[lo]!);
    const a = path[lo]!.p, b = path[hi]!.p;
    return { p: [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)], leg: path[hi]!.leg, k: lo / (path.length - 1) };
  };
  const trunk = (y: number): P3 => [0, y, 0];
  return {
    duration,
    pose(t) {
      const s = toTravel(t);
      const { p } = at(s);
      // Look: ahead along the path (three seconds on) while crossing the forest, drawn toward the
      // redwood as it nears, at the trunk while circling, and up the trunk once landed.
      const ahead = at(Math.min(travel, s + SPEED.approach * 3)).p;
      const toTree = Math.hypot(p[0], p[2]);
      const pull = smooth(Math.max(0, Math.min(1, (90 - toTree) / 60)));
      // Mid-crown while circling, easing down the trunk over the landing, so the last
      // view takes in the trunk and the lower limbs instead of a silhouette against the sky.
      const treeLookY = lerp(site.redwoodHeight * 0.35, site.redwoodHeight * 0.2, smooth(Math.max(0, Math.min(1, (s - (travel - 12)) / 12))));
      const tree = trunk(treeLookY);
      const look: P3 = [lerp(ahead[0], tree[0], pull), lerp(ahead[1] - 4, tree[1], pull), lerp(ahead[2], tree[2], pull)];
      return { cam: p, look };
    },
  };
}

/**
 * The site for a forest: the spoke road whose far end points nearest the home
 * plaza's bearing, so the drone comes in along it and lands at home.
 */
export function droneSite(forest: {
  roadLines: { kind: string; pts: [number, number][] }[];
  home: { x: number; z: number };
  corpusTree: { height: number };
}): DroneSite {
  const homeA = Math.atan2(forest.home.z, forest.home.x);
  let best: [number, number] = [forest.home.x * 10, forest.home.z * 10], bestD = Infinity;
  for (const l of forest.roadLines) {
    if (l.kind !== "spoke") continue;
    const end = l.pts.reduce((a, b) => (Math.hypot(b[0], b[1]) > Math.hypot(a[0], a[1]) ? b : a));
    const d = Math.abs(Math.atan2(Math.sin(Math.atan2(end[1], end[0]) - homeA), Math.cos(Math.atan2(end[1], end[0]) - homeA)));
    if (d < bestD) { bestD = d; best = end; }
  }
  return { spokeEnd: best, home: forest.home, redwoodHeight: forest.corpusTree.height };
}
