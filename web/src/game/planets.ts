import type { Vec3 } from "./sky";
import { equatorialVector } from "./stars";

/**
 * The five naked-eye planets for a moment: where they stand among the stars and
 * how bright they shine. Positions come from JPL's approximate Keplerian elements
 * (Standish, "Keplerian Elements for Approximate Positions of the Major Planets",
 * valid 1800 to 2050, good to about an arcminute), magnitudes from Mallama and
 * Hilton (2018), Saturn without its rings' tilt.
 */

const RAD = Math.PI / 180;
const OBLIQUITY = 23.43928 * RAD; // J2000, matching the star catalogue's frame

type Elements = [a: number, da: number, e: number, de: number, i: number, di: number, l: number, dl: number, w: number, dw: number, o: number, dO: number];

/** a (AU), e, I, L, long. perihelion, long. ascending node (degrees), each with its rate per Julian century. */
const ELEMENTS: Record<string, Elements> = {
  mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.2503235, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  venus: [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889, 181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
  mars: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  jupiter: [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  saturn: [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
};

export type PlanetInfo = { key: string; name: string; tint: Vec3; mag: (i: number) => number };

export const PLANETS: readonly PlanetInfo[] = [
  { key: "mercury", name: "Mercury", tint: [0.95, 0.9, 0.84], mag: (i) => -0.613 + 6.328e-2 * i - 1.6336e-3 * i ** 2 + 3.3644e-5 * i ** 3 - 3.4265e-7 * i ** 4 + 1.6893e-9 * i ** 5 - 3.0334e-12 * i ** 6 },
  { key: "venus", name: "Venus", tint: [1, 0.98, 0.93], mag: (i) => -4.384 - 1.044e-3 * i + 3.687e-4 * i ** 2 - 2.814e-6 * i ** 3 + 8.938e-9 * i ** 4 },
  { key: "mars", name: "Mars", tint: [1, 0.62, 0.42], mag: (i) => -1.601 + 2.267e-2 * i - 1.302e-4 * i ** 2 },
  { key: "jupiter", name: "Jupiter", tint: [1, 0.94, 0.84], mag: (i) => -9.395 - 3.7e-4 * i + 6.16e-4 * i ** 2 },
  { key: "saturn", name: "Saturn", tint: [1, 0.9, 0.7], mag: () => -8.914 },
];

/** Heliocentric ecliptic position (AU, J2000) at T Julian centuries from J2000. */
function heliocentric(el: Elements, T: number): Vec3 {
  const [a0, da, e0, de, i0, di, l0, dl, w0, dw, o0, dO] = el;
  const a = a0 + da * T, e = e0 + de * T, I = (i0 + di * T) * RAD, L = l0 + dl * T, peri = w0 + dw * T, node = (o0 + dO * T) * RAD;
  const w = peri * RAD - node; // argument of perihelion
  let M = (((L - peri) % 360) + 540) % 360 - 180;
  M *= RAD;
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const [cw, sw, cO, sO, cI, sI] = [Math.cos(w), Math.sin(w), Math.cos(node), Math.sin(node), Math.cos(I), Math.sin(I)];
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

export type PlanetSky = Omit<PlanetInfo, "mag"> & { raDeg: number; decDeg: number; mag: number; dir: Vec3 };

/** Each naked-eye planet's right ascension and declination (J2000 degrees), magnitude, and equatorial unit vector. */
export function planetPositions(date: Date): PlanetSky[] {
  const T = (date.valueOf() / 86400000 + 2440587.5 - 2451545) / 36525;
  const earth = heliocentric(ELEMENTS.earth!, T);
  const R = Math.hypot(...earth);
  return PLANETS.map((p) => {
    const h = heliocentric(ELEMENTS[p.key]!, T);
    const g: Vec3 = [h[0] - earth[0], h[1] - earth[1], h[2] - earth[2]];
    const r = Math.hypot(...h), delta = Math.hypot(...g);
    const x = g[0], y = g[1] * Math.cos(OBLIQUITY) - g[2] * Math.sin(OBLIQUITY), z = g[1] * Math.sin(OBLIQUITY) + g[2] * Math.cos(OBLIQUITY);
    const raDeg = ((Math.atan2(y, x) / RAD) + 360) % 360, decDeg = Math.asin(z / delta) / RAD;
    const phase = Math.acos(Math.max(-1, Math.min(1, (r * r + delta * delta - R * R) / (2 * r * delta)))) / RAD;
    return { ...p, raDeg, decDeg, mag: p.mag(phase) + 5 * Math.log10(r * delta), dir: equatorialVector(raDeg, decDeg) };
  });
}
