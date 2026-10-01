import type { Vec3 } from "./sky";

/**
 * The armillary sundial's geometry: an equatorial ring dial built for 39
 * degrees north. A rod (the style) points at the celestial pole, and a ring
 * stands square to it, so the sun's shadow moves round the ring 15 degrees an
 * hour whatever the season. Plain numbers only, so the node tests can check
 * the dial against the sky's own sun (sky.ts).
 *
 * World frame, as everywhere in the forest: +x east, +y up, +z south. The
 * dial's own frame is the group tilted by RING_TILT: local y along the style,
 * local x east, local z toward the noon sun on the meridian.
 */

export const SUNDIAL_LAT = 39;
const PHI = (SUNDIAL_LAT * Math.PI) / 180;

/** The style's direction: north, and up by the latitude. */
export const POLE: Vec3 = [0, Math.sin(PHI), -Math.cos(PHI)];
/** In the ring's plane, on the meridian: where the equinox sun stands at noon. */
export const NOON: Vec3 = [0, Math.cos(PHI), Math.sin(PHI)];
export const EAST: Vec3 = [1, 0, 0];

/** The rotation about x that takes the dial's local y to POLE and local z to NOON. */
export const RING_TILT = PHI - Math.PI / 2;

/** The equatorial ring: radius to its inner face, and its width along the style, m. */
export const RING_R = 1.5;
export const RING_W = 0.3;
/** The style's half-length, and its thickness: a stout rod, so its shadow reads from the cart. */
export const STYLE_HALF = 1.8;
export const STYLE_R = 0.035;

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The sun's hour angle: 0 at noon, 15 degrees an hour, positive in the afternoon. Radians. */
export function hourAngle(sun: Vec3): number {
  return Math.atan2(-dot(sun, EAST), dot(sun, NOON));
}

/** The sun's angle north of the celestial equator (its declination), radians. */
export function declination(sun: Vec3): number {
  return Math.asin(Math.max(-1, Math.min(1, dot(sun, POLE))));
}

/**
 * Where on the ring the hour falls: the angle about the style in the dial's
 * local xz plane, from +x toward +z. Noon is the bottom of the ring, on its
 * north side; the morning hours run up the west side.
 */
export function ringAngle(hour: number): number {
  return hour - Math.PI / 2;
}

/** The ring's angle for an hour of local apparent solar time, 0 to 24. */
export const ringAngleOfHour = (h: number) => ringAngle(((h - 12) * Math.PI) / 12);

export type RingShadow = {
  /** Where the style's shadow falls: `ringAngle` of the hour it reads. */
  angle: number;
  /** The part of the ring's width the shadow reaches, along the style (local y), m. */
  from: number;
  to: number;
};

/**
 * The style's shadow on the inside of the ring for a sun direction, or null
 * with the sun down. It lies opposite the sun about the style. The ring's
 * near edge shades the far side when the sun is close to the equator's plane,
 * which is how a real ring dial fails around the equinoxes: the shadow narrows
 * to nothing there.
 */
export function ringShadow(sun: Vec3, radius = RING_R, width = RING_W): RingShadow | null {
  if (sun[1] <= 0) return null;
  const sx = dot(sun, EAST), sy = dot(sun, POLE), sz = dot(sun, NOON);
  const perp = Math.hypot(sx, sz);
  if (perp < 1e-6) return null;
  // Rays leave the far face's point a distance 2 R tan(dec) along the style before
  // they cross the near face's circle; an edge of the ring there blocks them.
  const k = (2 * radius * sy) / perp;
  const half = width / 2;
  const lit = Math.min(Math.abs(k), width);
  if (lit < 1e-3) return null;
  return {
    angle: Math.atan2(-sz, -sx),
    from: k > 0 ? half - lit : -half,
    to: k > 0 ? half : -half + lit,
  };
}

/** Roman numerals for the hours the ring is engraved with: IV in the morning to VIII in the evening. */
const ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
export const FIRST_HOUR = 4;
export const LAST_HOUR = 20;

export function hourLabel(h: number): string {
  return ROMAN[((h % 12) + 12) % 12]!;
}
