import type { Vec3 } from "./sky";
import { applyMatrix, equatorialVector } from "./stars";

/**
 * Meteor showers as the sky would show them tonight. Each shower is a stream
 * the Earth crosses at the same solar longitude every year; its meteors fan
 * out from a radiant fixed among the stars. Plain numbers only, so the node
 * tests can check it; MeteorSky.tsx draws them.
 */

const RAD = Math.PI / 180;

export type Shower = {
  key: string;
  name: string;
  /** Solar longitude of the peak, degrees (J2000). */
  peak: number;
  /** Radiant at the peak, J2000 degrees. Its drift over the days around the peak is left out. */
  ra: number;
  dec: number;
  /** Zenithal hourly rate at the peak: a dark sky, the radiant overhead. */
  zhr: number;
  /** Profile steepness: ZHR falls tenfold every 1 / b degrees of solar longitude from the peak. */
  b: number;
  /** Entry speed, km/s: fast meteors are quick and greenish, slow ones linger and run yellow. */
  v: number;
};

/**
 * The major annual showers. Peaks, radiants, speeds and rates are the
 * International Meteor Organization's calendar values, rounded; the profile
 * widths are rounded from Jenniskens (1994). Rates swing from year to year,
 * the Draconids' most of all.
 */
export const SHOWERS: readonly Shower[] = [
  { key: "quadrantids", name: "Quadrantids", peak: 283.15, ra: 230, dec: 49, zhr: 110, b: 1.8, v: 41 },
  { key: "lyrids", name: "Lyrids", peak: 32.32, ra: 271, dec: 34, zhr: 18, b: 0.22, v: 49 },
  { key: "eta-aquariids", name: "Eta Aquariids", peak: 45.5, ra: 338, dec: -1, zhr: 50, b: 0.08, v: 66 },
  { key: "delta-aquariids", name: "Southern Delta Aquariids", peak: 127, ra: 340, dec: -16, zhr: 25, b: 0.09, v: 41 },
  { key: "perseids", name: "Perseids", peak: 140.0, ra: 48, dec: 58, zhr: 100, b: 0.2, v: 59 },
  { key: "draconids", name: "Draconids", peak: 195.4, ra: 262, dec: 54, zhr: 10, b: 2, v: 21 },
  { key: "orionids", name: "Orionids", peak: 208, ra: 95, dec: 16, zhr: 20, b: 0.12, v: 66 },
  { key: "leonids", name: "Leonids", peak: 235.27, ra: 152, dec: 22, zhr: 15, b: 0.39, v: 71 },
  { key: "geminids", name: "Geminids", peak: 262.2, ra: 112, dec: 33, zhr: 150, b: 0.39, v: 35 },
  { key: "ursids", name: "Ursids", peak: 270.7, ra: 217, dec: 76, zhr: 10, b: 0.6, v: 33 },
];

/** Sporadic meteors, from no shower, per hour under a dark sky. */
export const SPORADIC_HR = 10;
/** Sporadics' typical entry speed, km/s. */
const SPORADIC_V = 40;
/** Population index: each magnitude fainter, this many times more meteors. */
const POPULATION_R = 2.5;
/** The faintest meteor a dark sky shows, magnitude. */
const LIMIT_MAG = 6.5;

/** Shortest way round from one solar longitude to another, degrees. */
function lonGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** The shower's zenithal hourly rate at this solar longitude. */
export function showerZhr(s: Shower, solarLon: number): number {
  return s.zhr * 10 ** (-s.b * lonGap(solarLon, s.peak));
}

export type MeteorSource = { shower: Shower | null; radiant: Vec3 | null; perHour: number; v: number };

/**
 * What is falling now, and how fast: each shower above a meteor an hour, at
 * its observed rate (ZHR times the sine of the radiant's altitude, nothing
 * with the radiant down), plus the sporadic background. Darkness, cloud and
 * moonlight are the caller's to apply.
 *
 * :param solarLon: `solarLongitude` of the moment, degrees.
 * :param starMatrix: `equatorialToWorld` of the moment.
 */
export function meteorSources(solarLon: number, starMatrix: readonly number[]): MeteorSource[] {
  const out: MeteorSource[] = [{ shower: null, radiant: null, perHour: SPORADIC_HR, v: SPORADIC_V }];
  for (const s of SHOWERS) {
    const zhr = showerZhr(s, solarLon);
    if (zhr < 1) continue;
    const radiant = applyMatrix(starMatrix, equatorialVector(s.ra, s.dec));
    if (radiant[1] <= 0) continue;
    out.push({ shower: s, radiant, perHour: zhr * radiant[1], v: s.v });
  }
  return out;
}

/** The shower a `?meteors=` query pins to its peak, and how many times its rate to show ("perseids" or "perseids:20"). */
export function meteorOverride(search: string): { shower: Shower; boost: number } | null {
  const raw = new URLSearchParams(search).get("meteors");
  if (!raw) return null;
  const [key, n] = raw.split(":");
  const shower = SHOWERS.find((s) => s.key === key);
  if (!shower) return null;
  const boost = Number(n);
  return { shower, boost: Number.isFinite(boost) && boost > 0 ? boost : 1 };
}

export type Meteor = {
  /** Where it lights up: a unit world direction. */
  start: Vec3;
  /** Unit tangent at `start`, pointing away from the radiant. */
  along: Vec3;
  /** Its whole path across the sky, radians. */
  arc: number;
  /** Seconds from lighting up to burning out. */
  life: number;
  /** Seconds since it lit up. */
  age: number;
  /** Magnitude at its brightest. */
  mag: number;
  color: Vec3;
};

function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Slow meteors burn yellow-orange, fast ones white with a green cast (sodium against magnesium and nickel). */
function meteorColor(v: number): Vec3 {
  const t = Math.min(1, Math.max(0, (v - 20) / 50));
  return [1 - 0.22 * t, 0.86 + 0.12 * t, 0.62 + 0.3 * t];
}

/**
 * One meteor from a source. Where it lights up is anywhere in the sky above
 * 12 degrees; it runs along the great circle away from the radiant, its
 * apparent length and speed both shrinking toward the radiant, where meteors
 * come head-on. A sporadic gets a radiant of its own, anywhere.
 *
 * :param src: From `meteorSources`.
 * :param rand: Uniform in [0, 1), so the tests can drive it.
 * :return: The meteor, or null when the draw lands too near the radiant to show a trail.
 */
export function spawnMeteor(src: MeteorSource, rand: () => number): Meteor | null {
  const z = Math.sin(12 * RAD) + rand() * (1 - Math.sin(12 * RAD));
  const phi = rand() * Math.PI * 2;
  const rxz = Math.sqrt(1 - z * z);
  const start: Vec3 = [rxz * Math.cos(phi), z, rxz * Math.sin(phi)];
  let radiant = src.radiant;
  if (!radiant) {
    const rz = rand() * 2 - 1;
    const rphi = rand() * Math.PI * 2;
    const rr = Math.sqrt(1 - rz * rz);
    radiant = [rr * Math.cos(rphi), rz, rr * Math.sin(rphi)];
  }
  const c = dot(start, radiant);
  const sinD = Math.sqrt(Math.max(0, 1 - c * c));
  if (sinD < Math.sin(3 * RAD)) return null;
  // Away from the radiant: the radiant's direction, flattened onto the sky at `start`, reversed.
  const along = normalize([start[0] * c - radiant[0], start[1] * c - radiant[1], start[2] * c - radiant[2]]);
  const arc = (6 + 22 * rand()) * RAD * sinD;
  // About 0.5 degree per second per km/s, side-on.
  const omega = 0.5 * src.v * RAD * Math.max(sinD, 0.15);
  return { start, along, arc, life: arc / omega, age: 0, mag: LIMIT_MAG + Math.log(1 - rand()) / Math.log(POPULATION_R), color: meteorColor(src.v) };
}

/** The meteor's head after `t` of its life (0 to 1): `start` turned `t * arc` along the great circle. */
export function meteorAt(m: Meteor, t: number): Vec3 {
  const a = m.arc * t;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return [m.start[0] * ca + m.along[0] * sa, m.start[1] * ca + m.along[1] * sa, m.start[2] * ca + m.along[2] * sa];
}

/** How bright the head is through its life, 0 to 1: it flares and fades rather than switching. */
export function meteorGlow(m: Meteor): number {
  const t = m.age / m.life;
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t) ** 0.7;
}

/** The trail follows the head for this fraction of the whole path. */
export const TRAIL = 0.35;
