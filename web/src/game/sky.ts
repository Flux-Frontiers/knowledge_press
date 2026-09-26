/**
 * The sky's clock: where the sun and moon stand for a time and place, and the
 * light that follows from them. The astronomy is SunCalc's (Vladimir
 * Agafonkin, BSD-2-Clause), good to a fraction of a degree, which is plenty
 * for a sky. Plain numbers only, so the node tests can check it.
 */

export type Vec3 = [number, number, number];
export type Place = { lat: number; lon: number };
/** Live follows the device clock; the rest pin the sky to today's sunrise, noon, sunset or tonight. */
export type TimeMode = "live" | "dawn" | "day" | "dusk" | "night";
/** Radians. Azimuth is SunCalc's: from south, positive toward the west. */
export type BodyPosition = { altitude: number; azimuth: number };

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

const toDays = (date: Date) => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
const rightAscension = (l: number, b: number) => Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
const declination = (l: number, b: number) => Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));
const siderealTime = (d: number, lw: number) => RAD * (280.16 + 360.9856235 * d) - lw;

function sunCoords(d: number) {
  const m = RAD * (357.5291 + 0.98560028 * d);
  const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  const l = m + c + RAD * 102.9372 + Math.PI;
  return { dec: declination(l, 0), ra: rightAscension(l, 0) };
}

function moonCoords(d: number) {
  const l0 = RAD * (218.316 + 13.176396 * d);
  const m = RAD * (134.963 + 13.064993 * d);
  const f = RAD * (93.272 + 13.22935 * d);
  const l = l0 + RAD * 6.289 * Math.sin(m);
  const b = RAD * 5.128 * Math.sin(f);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: 385001 - 20905 * Math.cos(m) };
}

function horizontal(d: number, place: Place, ra: number, dec: number): BodyPosition {
  const phi = RAD * place.lat;
  const h = siderealTime(d, RAD * -place.lon) - ra;
  return {
    altitude: Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)),
    azimuth: Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)),
  };
}

export function sunPosition(date: Date, place: Place): BodyPosition {
  const d = toDays(date);
  const c = sunCoords(d);
  return horizontal(d, place, c.ra, c.dec);
}

export function moonPosition(date: Date, place: Place): BodyPosition {
  const d = toDays(date);
  const c = moonCoords(d);
  return horizontal(d, place, c.ra, c.dec);
}

/** Lit fraction of the disc (0 new, 1 full), and phase through the month (0 new, 0.5 full). */
export function moonIllumination(date: Date): { fraction: number; phase: number } {
  const d = toDays(date);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const sdist = 149598000;
  const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return { fraction: (1 + Math.cos(inc)) / 2, phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI };
}

export function moonPhaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.03 || p > 0.97) return "New moon";
  if (p < 0.22) return "Waxing crescent";
  if (p < 0.28) return "First quarter";
  if (p < 0.47) return "Waxing gibbous";
  if (p < 0.53) return "Full moon";
  if (p < 0.72) return "Waning gibbous";
  if (p < 0.78) return "Last quarter";
  return "Waning crescent";
}

/**
 * World direction toward a body. The forest's +x is east and +z is south, so
 * the old fixed light at (40, 55, 18) was a mid-morning sun.
 */
export function bodyDirection(p: BodyPosition): Vec3 {
  const c = Math.cos(p.altitude);
  return [-Math.sin(p.azimuth) * c, Math.sin(p.altitude), Math.cos(p.azimuth) * c];
}

/**
 * Where to put the sky without the browser's location: latitude 40° N, and
 * the longitude of the device's standard (not daylight-saving) time zone.
 */
export function timeZonePlace(now: Date): Place {
  const y = now.getFullYear();
  const standard = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
  return { lat: 40, lon: -standard / 4 };
}

const STEP = 10 * 60000;

function localMidnight(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).valueOf();
}

/** Sun altitude for dawn and dusk: near the peak of the glow, and high enough for faint long shadows. */
const LOW_SUN = 4 * RAD;

/**
 * The moment the sky shows. Dawn and dusk are when today's sun rises or
 * sets through LOW_SUN; where it never climbs that high, noon. Day is today's solar noon. Night is the darkest
 * part of tonight when the moon is highest, so a moon, if there is one up
 * tonight, is in the sky; with none, the darkest hour.
 */
export function effectiveTime(mode: TimeMode, now: Date, place: Place): Date {
  if (mode === "live") return now;
  if (mode === "day" || mode === "dawn" || mode === "dusk") {
    const start = localMidnight(now);
    let best = start, bestAlt = -Infinity;
    let rise = -1, set = -1;
    let prev = sunPosition(new Date(start), place).altitude - LOW_SUN;
    for (let t = start; t < start + DAY_MS; t += STEP) {
      const a = sunPosition(new Date(t), place).altitude;
      if (a > bestAlt) { bestAlt = a; best = t; }
      const cur = a - LOW_SUN;
      if (t > start && (prev < 0) !== (cur < 0)) {
        const at = t - STEP * (cur / (cur - prev));
        if (cur > 0 && rise < 0) rise = at;
        if (cur < 0) set = at;
      }
      prev = cur;
    }
    if (mode === "dawn" && rise >= 0) return new Date(rise);
    if (mode === "dusk" && set >= 0) return new Date(set);
    return new Date(best);
  }
  const start = localMidnight(now) + DAY_MS / 2;
  let darkest = start, darkestAlt = Infinity;
  let moonlit = -1, moonAlt = 5 * RAD;
  for (let t = start; t < start + DAY_MS; t += STEP) {
    const date = new Date(t);
    const sun = sunPosition(date, place).altitude;
    if (sun < darkestAlt) { darkestAlt = sun; darkest = t; }
    if (sun < -12 * RAD) {
      const moon = moonPosition(date, place).altitude;
      if (moon > moonAlt) { moonAlt = moon; moonlit = t; }
    }
  }
  return new Date(moonlit >= 0 ? moonlit : darkest);
}

/** The next sunrise or sunset after `now` (sun's upper limb on the horizon, with refraction), within 36 hours. */
export function nextSunEvent(now: Date, place: Place): { kind: "sunrise" | "sunset"; at: Date } | null {
  const h0 = -0.833 * RAD;
  const step = 5 * 60000;
  let prev = sunPosition(now, place).altitude - h0;
  for (let t = now.valueOf() + step; t < now.valueOf() + 1.5 * DAY_MS; t += step) {
    const cur = sunPosition(new Date(t), place).altitude - h0;
    if ((prev < 0) !== (cur < 0)) {
      const at = t - step * (cur / (cur - prev));
      return { kind: cur > 0 ? "sunrise" : "sunset", at: new Date(at) };
    }
    prev = cur;
  }
  return null;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Mix two #rrggbb colours. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

export type SkyState = {
  /** 0 at night, 1 in full day, easing through twilight. */
  daylight: number;
  /** Strength of the sunrise or sunset glow, 0 to 1. */
  warmth: number;
  sunDir: Vec3;
  moonDir: Vec3;
  moonFraction: number;
  moonPhase: number;
  /**
   * The one directional light: the sun by day, the moon by night, faint
   * starlight with neither up. `shadow` is how strongly it casts shadows, 0 to 1.
   */
  light: { dir: Vec3; color: string; intensity: number; shadow: number };
};

export function skyState(at: Date, place: Place): SkyState {
  const sun = sunPosition(at, place);
  const moon = moonPosition(at, place);
  const { fraction, phase } = moonIllumination(at);
  const sunDir = bodyDirection(sun);
  const moonDir = bodyDirection(moon);
  const alt = sun.altitude;
  const daylight = smoothstep(-8 * RAD, 8 * RAD, alt);
  const warmth = smoothstep(-6 * RAD, 0, alt) * (1 - smoothstep(2 * RAD, 14 * RAD, alt));
  // Whichever gives more light is the light, so twilight hands over without a jump.
  const sunI = 2.4 * smoothstep(-4 * RAD, 6 * RAD, alt);
  const moonI = 0.55 * (0.3 + 0.7 * fraction) * smoothstep(0, 8 * RAD, moon.altitude) * (1 - smoothstep(-10 * RAD, -2 * RAD, alt));
  const starI = 0.16 * (1 - daylight);
  let light: SkyState["light"];
  if (sunI >= moonI && sunI >= starI) {
    // Only the sun casts shadows, fading out over its last few degrees. A low light
    // drives the shadow camera's slanted box through far more forest, which
    // halved the frame rate at sunset, and shadows that long are lost in the haze.
    light = { dir: sunDir, color: mixHex("#ff9a52", "#fff0d2", smoothstep(0, 25 * RAD, alt)), intensity: sunI, shadow: smoothstep(3 * RAD, 8 * RAD, alt) };
  } else if (moonI >= starI) {
    // Moonlight is too faint for its shadows to earn a shadow pass.
    light = { dir: moonDir, color: "#94b7e5", intensity: moonI, shadow: 0 };
  } else {
    const n = Math.hypot(0.3, 1, 0.2);
    light = { dir: [0.3 / n, 1 / n, 0.2 / n], color: "#7f93b8", intensity: starI, shadow: 0 };
  }
  return { daylight, warmth, sunDir, moonDir, moonFraction: fraction, moonPhase: phase, light };
}
