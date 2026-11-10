/**
 * The visitor event's timeline: a craft glides in over the crowns, comes
 * straight down over the landing field's pad, puts down its legs, opens an
 * iris in its belly and lowers a lift, which brings down its sentinel and
 * then its visitor, who holds out a slate. Pure math: the pose of everything
 * at `t` seconds after the start, in the plaza's frame, +x toward the road
 * (where the rider watches from), y up. LandingField.tsx draws it.
 */

/** Height of the pad the craft rests on. */
export const PAD_TOP = 0.35;
export const PAD_R = 5;
/** 17 m across: it overhangs the pad and roofs most of the paved plaza. */
export const SAUCER_R = 8.5;
/** The craft's belly stands this high over the pad on its legs: room for the sentinel under it. */
export const LEG_H = 3.3;
export const REST_Y = PAD_TOP + LEG_H;
/**
 * The approach flies above everything in the forest, the corpus redwood
 * included (63 m with the 1.40 corpus; the tests check it against the real
 * forest), and comes down only over the pad. The camera follows it in.
 */
export const CRUISE_Y = 75;
/** The lift's shaft up the craft's axis, and its platform. Everything above the belly stays inside it. */
export const SHAFT_R = 1.05;
export const LIFT_R = 0.9;

const T_APPROACH = 14;
/** Down the column to a hover low enough to be in the rider's view, then settle. */
const T_HOVER = 21;
const HOVER_Y = 9;
const T_SETTLE = 24.5;
const T_LANDED = 27;
const T_IRIS = 29;
const T_LIFT = 31;
const LIFT_SPEED = 0.8;
const RIDE = (REST_Y - PAD_TOP) / LIFT_SPEED;
const ROBOT_SPEED = 0.9;
const GUEST_SPEED = 0.8;

type P = [number, number, number];
/** A leg of a walker's path: to this point, riding the lift or on foot. */
type Leg = { to: P; ride?: boolean };
const ROBOT_PATH: { from: P; legs: Leg[] } = {
  from: [0, REST_Y, 0],
  legs: [{ to: [0, PAD_TOP, 0], ride: true }, { to: [4.8, PAD_TOP, 1.2] }, { to: [5.4, 0, 1.5] }, { to: [7.0, 0, 2.6] }],
};
const GUEST_PATH: { from: P; legs: Leg[] } = {
  from: [0, REST_Y, 0],
  legs: [{ to: [0, PAD_TOP, 0], ride: true }, { to: [4.8, PAD_TOP, 0.4] }, { to: [5.4, 0, 0.6] }, { to: [7.4, 0, 0.8] }],
};

const dist = (a: P, b: P) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
function pathTime(path: { from: P; legs: Leg[] }, speed: number) {
  let at = path.from, s = 0;
  for (const leg of path.legs) { s += dist(at, leg.to) / (leg.ride ? LIFT_SPEED : speed); at = leg.to; }
  return s;
}

const T_ROBOT_DOWN = T_LIFT + RIDE;
const T_ROBOT_STOP = T_LIFT + pathTime(ROBOT_PATH, ROBOT_SPEED);
/** The empty platform goes back up once the sentinel is off it. */
const T_LIFT_BACK = T_ROBOT_DOWN + 2;
const T_VISOR = T_ROBOT_STOP + 0.5;
const T_GUEST = Math.max(T_VISOR + 4, T_LIFT_BACK + RIDE + 0.5);
const T_GUEST_STOP = T_GUEST + pathTime(GUEST_PATH, GUEST_SPEED);
const T_OFFER = T_GUEST_STOP + 0.6;
/** Seconds from the start until everything rests in its final pose. */
export const VISITOR_END = T_OFFER + 2.5;

export type Walker = {
  x: number; y: number; z: number;
  /** Turn about y; 0 faces +x, the road. */
  yaw: number;
  /** Gait phase in radians while walking, null while standing or riding. */
  stride: number | null;
  shown: boolean;
};

export type VisitorPose = {
  /** The craft's belly, at its center. */
  saucer: P;
  /** Bank about the craft's own z axis, radians. */
  bank: number;
  /** Legs let down, 0 to 1. */
  legs: number;
  /** The light under the craft as it comes down, 0 to 1. */
  beam: number;
  /** The dust ring thrown out at touchdown: 0 before, rising to 1 as it fades. */
  dust: number;
  /** The belly's iris, 0 shut to 1 open. */
  iris: number;
  /** The lift platform's height (its top), and the glow of its shaft of light, 0 to 1. */
  lift: number;
  shaft: number;
  robot: Walker;
  guest: Walker;
  /** Sentinel's visor glow, 0 to 1, and its sweep across the visor, -1 to 1. */
  visor: number;
  sweep: number;
  /** The visitor's arm and slate raised, 0 to 1. */
  offer: number;
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp3 = (a: P, b: P, f: number): P => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

function walk(path: { from: P; legs: Leg[] }, t: number, start: number, speed: number, stepLength: number): Walker {
  let at = path.from, clock = start, walked = 0;
  for (let i = 0; i < path.legs.length; i++) {
    const leg = path.legs[i]!;
    const len = dist(at, leg.to);
    const dur = len / (leg.ride ? LIFT_SPEED : speed);
    if (t < clock + dur || i === path.legs.length - 1) {
      const f = dur ? clamp01((t - clock) / dur) : 1;
      const moving = t >= start && f < 1;
      const [x, y, z] = lerp3(at, leg.to, f);
      const step = !leg.ride && moving;
      return {
        x, y, z,
        yaw: step ? Math.atan2(-(leg.to[2] - at[2]), leg.to[0] - at[0]) : 0,
        stride: step ? ((walked + len * f) / stepLength) * Math.PI : null,
        shown: t >= start,
      };
    }
    if (!leg.ride) walked += len;
    at = leg.to;
    clock += dur;
  }
  throw new Error("unreachable: a path has at least one leg");
}

/** The platform: down with the sentinel, back up empty, down with the visitor, and left down. */
function liftY(t: number): number {
  const ride = (a: number) => REST_Y + (PAD_TOP - REST_Y) * span(t, a, a + RIDE);
  if (t < T_LIFT_BACK) return ride(T_LIFT);
  if (t < T_GUEST) return PAD_TOP + (REST_Y - PAD_TOP) * span(t, T_LIFT_BACK, T_LIFT_BACK + RIDE);
  return ride(T_GUEST);
}

/** Everything's pose `t` seconds into the landing; past VISITOR_END it holds still. */
export function visitorPose(t: number): VisitorPose {
  let saucer: P;
  let bank = 0;
  if (t < T_APPROACH) {
    // A wide arc in across the far sky, low over the crowns so it stays in the
    // rider's view, easing out as it comes over the pad.
    const e = 1 - Math.pow(1 - clamp01(t / T_APPROACH), 3);
    const k = 1 - e;
    // Quadratic Bezier: far off to one side, swinging round behind the pad.
    const p0: P = [-230, CRUISE_Y + 12, -150], p1: P = [-90, CRUISE_Y + 2, 110], p2: P = [0, CRUISE_Y, 0];
    saucer = [0, 1, 2].map((i) => k * k * p0[i]! + 2 * k * e * p1[i]! + e * e * p2[i]!) as P;
    bank = 0.25 * k;
  } else if (t < T_SETTLE) {
    // Straight down the open column, then a hover with a slow bob.
    const f = smooth(span(t, T_APPROACH, T_HOVER));
    const bob = 0.25 * Math.sin((t - T_HOVER) * 2.4) * span(t, T_HOVER, T_HOVER + 0.5);
    saucer = [0, CRUISE_Y + (HOVER_Y - CRUISE_Y) * f + bob, 0];
    bank = 0.03 * Math.sin(t * 2.1);
  } else {
    const f = smooth(span(t, T_SETTLE, T_LANDED));
    const from = HOVER_Y + 0.25 * Math.sin((T_SETTLE - T_HOVER) * 2.4);
    saucer = [0, from + (REST_Y - from) * f, 0];
    bank = 0.03 * Math.sin(t * 2.1) * (1 - f);
  }
  const touch = T_LANDED - 0.4;
  return {
    saucer,
    bank,
    legs: smooth(span(t, T_HOVER, T_SETTLE)),
    beam: smooth(span(t, T_APPROACH - 1, T_APPROACH + 1)) * (1 - smooth(span(t, T_SETTLE + 0.5, T_LANDED + 0.5))),
    dust: t < touch ? 0 : span(t, touch, touch + 2.8),
    iris: smooth(span(t, T_IRIS, T_IRIS + 1.5)),
    lift: liftY(t),
    shaft: smooth(span(t, T_IRIS + 0.5, T_LIFT)) * (1 - 0.6 * smooth(span(t, T_GUEST + RIDE, T_GUEST + RIDE + 2))),
    robot: walk(ROBOT_PATH, t, T_LIFT, ROBOT_SPEED, 0.95),
    guest: walk(GUEST_PATH, t, T_GUEST, GUEST_SPEED, 0.7),
    visor: smooth(span(t, T_VISOR, T_VISOR + 0.8)),
    sweep: t < T_VISOR ? 0 : Math.sin((t - T_VISOR) * 1.6) * (1 - span(t, T_GUEST, T_GUEST + 3)),
    offer: smooth(span(t, T_OFFER, T_OFFER + 2)),
  };
}

/**
 * Where the camera watches from, and what it looks at, `t` seconds in: from
 * the spur, low, tracking the craft in and down, then on the lift and the
 * two it brings down. Every position is on the spur's centreline or
 * within a step of it (|z| <= 1.5), so it never stands in the trees.
 */
export function visitorShot(t: number): { cam: P; look: P } {
  const p = visitorPose(t);
  const craft: P = [p.saucer[0], p.saucer[1] + 1.2, p.saucer[2]];
  const keys: { t: number; cam: P; look: P }[] = [
    { t: 0, cam: [14, 1.7, -1.5], look: craft },
    { t: T_LANDED - 1, cam: [15, 1.9, -1.5], look: craft },
    { t: T_IRIS + 1, cam: [10.8, 1.2, -1.4], look: [0, 2.6, 0] },
    { t: T_GUEST, cam: [10.8, 1.3, -1.2], look: [2, 2.2, 0.6] },
    // Square on to the two of them, the visitor holding out the slate.
    { t: T_OFFER, cam: [10.8, 1.5, 0.3], look: [6.5, 1.6, 1.5] },
  ];
  let i = 0;
  while (i < keys.length - 1 && t >= keys[i + 1]!.t) i++;
  const a = keys[i]!, b = keys[Math.min(i + 1, keys.length - 1)]!;
  // Hold each shot, then ease into the next over its last 2.5 s.
  const f = b === a ? 0 : smooth(span(t, b.t - 2.5, b.t));
  return { cam: lerp3(a.cam, b.cam, f), look: lerp3(a.look, b.look, f) };
}
