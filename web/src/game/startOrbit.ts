/**
 * The start screen's and the timeline's slow circle round the redwood: radius and
 * eye height, m, radians a second, and the aim as a fraction of the redwood's height.
 * Far enough out and aimed high enough that the full-grown crown stays in frame
 * (its top about 3° inside the edge at a 58° fov).
 */
export const ORBIT_R = 62;
export const ORBIT_UP = 8;
export const ORBIT_RATE = 0.03;
export const ORBIT_LOOK = 0.4;

/**
 * Where the start screen's circle puts the camera at angle `a` (radians; the circle's
 * angle grows with time, which turns it clockwise seen from above), and where it looks.
 *
 * :param a: The circle's angle.
 * :param redwoodHeight: The corpus redwood's height, m.
 */
export function orbitPose(a: number, redwoodHeight: number): { cam: [number, number, number]; look: [number, number, number] } {
  return { cam: [Math.sin(a) * ORBIT_R, ORBIT_UP, Math.cos(a) * ORBIT_R], look: [0, redwoodHeight * ORBIT_LOOK, 0] };
}

/** The circle's angle for a point on it (or the bearing of any point from the hub, in its terms). */
export function orbitAngle(x: number, z: number): number {
  return Math.atan2(x, z);
}
