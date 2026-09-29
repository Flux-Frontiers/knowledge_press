import { STAR_DATA } from "./starCatalog";
import type { Vec3 } from "./sky";

/**
 * The fixed stars as vertex data. Each star is stored as its J2000 equatorial
 * unit vector; the sky shader turns it into a world direction with the matrix
 * from `equatorialToWorld` (sky.ts), so the whole field turns with one
 * uniform and nothing here depends on the time.
 */

const RAD = Math.PI / 180;

export const STAR_COUNT = STAR_DATA.length / 4;

/** Unit vector for a J2000 right ascension and declination, both in degrees. */
export function equatorialVector(raDeg: number, decDeg: number): Vec3 {
  const c = Math.cos(decDeg * RAD);
  return [c * Math.cos(raDeg * RAD), c * Math.sin(raDeg * RAD), Math.sin(decDeg * RAD)];
}

/** `m` (row-major 3x3) applied to `v`. */
export function applyMatrix(m: readonly number[], v: Vec3): Vec3 {
  return [
    m[0]! * v[0] + m[1]! * v[1] + m[2]! * v[2],
    m[3]! * v[0] + m[4]! * v[1] + m[5]! * v[2],
    m[6]! * v[0] + m[7]! * v[1] + m[8]! * v[2],
  ];
}

/** Star color by B-V: hot stars blue-white, the Sun's kind cream, cool ones orange. */
const COLOR_STOPS: [number, Vec3][] = [
  [-0.3, [0.61, 0.71, 1.0]],
  [0.0, [0.79, 0.85, 1.0]],
  [0.4, [1.0, 0.96, 0.92]],
  [0.8, [1.0, 0.82, 0.63]],
  [1.4, [1.0, 0.68, 0.42]],
  [2.0, [1.0, 0.56, 0.29]],
];

export function starColor(bv: number): Vec3 {
  if (bv <= COLOR_STOPS[0]![0]) return COLOR_STOPS[0]![1];
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const [b1, c1] = COLOR_STOPS[i]!;
    if (bv <= b1) {
      const [b0, c0] = COLOR_STOPS[i - 1]!;
      const t = (bv - b0) / (b1 - b0);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1]![1];
}

/** Vertex attributes for the star field: equatorial direction, magnitude and color. */
export function starBuffers(): { dir: Float32Array; mag: Float32Array; color: Float32Array } {
  const dir = new Float32Array(STAR_COUNT * 3);
  const mag = new Float32Array(STAR_COUNT);
  const color = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    dir.set(equatorialVector(STAR_DATA[i * 4]!, STAR_DATA[i * 4 + 1]!), i * 3);
    mag[i] = STAR_DATA[i * 4 + 2]!;
    color.set(starColor(STAR_DATA[i * 4 + 3]!), i * 3);
  }
  return { dir, mag, color };
}
