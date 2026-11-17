/**
 * Fireworks for a quest done: a few shells bursting in front of the camera.
 *
 * Pure: where each spark is at a given age, so the drawing (FireworksSky.tsx)
 * only copies positions and colors into one point cloud.
 */

export type Spark = {
  /** Burst center, world meters. */
  ox: number; oy: number; oz: number;
  /** Initial velocity, m/s. */
  vx: number; vy: number; vz: number;
  /** Seconds after the volley starts that this spark's shell bursts. */
  delay: number;
  r: number; g: number; b: number;
};

/** Sparks per shell. */
export const SPARKS = 220;
/** Shells per volley, staggered. */
export const SHELLS = 3;
/** Seconds a spark lives after its shell bursts. */
export const SPARK_LIFE = 2.4;
/** Seconds between shells. */
export const SHELL_GAP = 0.45;
/** The volley is over this long after it starts. */
export const VOLLEY_SECONDS = (SHELLS - 1) * SHELL_GAP + SPARK_LIFE;

const GRAVITY = 9.8;
/** Air drag per second: sparks slow as real ones do, so a burst holds its round shape. */
const DRAG = 1.6;

const COLORS: [number, number, number][] = [
  [1, 0.78, 0.3], // gold
  [1, 0.35, 0.3], // red
  [0.45, 0.8, 1], // blue
  [0.6, 1, 0.5], // green
  [1, 0.55, 0.95], // pink
];

/**
 * The sparks of one volley, centered ahead of the viewer.
 *
 * :param rng: Random numbers in [0, 1).
 * :param eye: The camera position.
 * :param ahead: Unit vector the camera looks along.
 * :returns: SHELLS * SPARKS sparks.
 */
export function volley(rng: () => number, eye: [number, number, number], ahead: [number, number, number]): Spark[] {
  // A level heading, so the shells rise in front whether the camera looks down (god's eye) or along the road.
  let hx = ahead[0], hz = ahead[2];
  const h = Math.hypot(hx, hz);
  if (h < 1e-3) { hx = 0; hz = -1; } else { hx /= h; hz /= h; }
  const sparks: Spark[] = [];
  for (let s = 0; s < SHELLS; s++) {
    const side = (s - (SHELLS - 1) / 2) * 22 + (rng() - 0.5) * 8;
    const dist = 60 + rng() * 15;
    const ox = eye[0] + hx * dist - hz * side;
    const oz = eye[2] + hz * dist + hx * side;
    const oy = eye[1] + 16 + rng() * 10;
    const [r, g, b] = COLORS[Math.floor(rng() * COLORS.length)]!;
    const speed = 14 + rng() * 5;
    for (let i = 0; i < SPARKS; i++) {
      // Even over the sphere: z uniform in [-1, 1], angle uniform.
      const z = 2 * rng() - 1;
      const a = 2 * Math.PI * rng();
      const q = Math.sqrt(1 - z * z);
      const v = speed * (0.85 + 0.15 * rng());
      sparks.push({ ox, oy, oz, vx: q * Math.cos(a) * v, vy: z * v, vz: q * Math.sin(a) * v, delay: s * SHELL_GAP, r, g, b });
    }
  }
  return sparks;
}

/**
 * Where a spark is and how bright, `t` seconds into its volley.
 *
 * :param s: The spark.
 * :param t: Seconds since the volley started.
 * :returns: [x, y, z, brightness 0..1]; brightness 0 before its shell bursts and after it fades.
 */
export function sparkAt(s: Spark, t: number): [number, number, number, number] {
  const age = t - s.delay;
  if (age < 0 || age > SPARK_LIFE) return [s.ox, s.oy, s.oz, 0];
  // Velocity decays as e^(-DRAG t); position is its integral, with gravity on top.
  const k = (1 - Math.exp(-DRAG * age)) / DRAG;
  const x = s.ox + s.vx * k;
  const y = s.oy + s.vy * k - 0.5 * GRAVITY * age * age * 0.35;
  const z = s.oz + s.vz * k;
  const fade = 1 - age / SPARK_LIFE;
  return [x, y, z, fade * fade];
}
