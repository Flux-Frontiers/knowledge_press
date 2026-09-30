import { clamp, mulberry32 } from "./math";

/**
 * Random weather: fog and cloud cover as a pure function of the wall clock,
 * so it needs no state machine, every viewer sees the same sky, and the node
 * tests can check it.
 *
 * Time is cut into slots. Each slot rolls whether a fog forms in it and how
 * thick: mist, fog or pea soup. Inside a fog slot the fog builds, holds and
 * then burns off, so it ends in a few minutes instead of the hours the real
 * sun would take. Fog is far likelier in the morning (`morning`, from sky.ts),
 * and the sky's own time is what decides that, so pinning the sky to dawn
 * gives the best chance of a foggy start.
 */

export type WeatherKind = "clear" | "mist" | "fog" | "soup";

export type Weather = {
  /** Extra exp2 fog density on top of the season's, per metre. */
  fogDensity: number;
  /** Cloud cover, 0 clear to 1 overcast. */
  cloud: number;
  kind: WeatherKind;
};

/** Length of one fog slot, ms: the fog builds, holds and burns off inside it. */
export const FOG_SLOT_MS = 12 * 60000;
/** Length of one cloud step, ms; cover eases from one step's value to the next. */
export const CLOUD_SLOT_MS = 40 * 60000;

/** Extra fog density at the peak of each kind. exp2 fog is 99.9% opaque at 2.6 / density: 115 m, 80 m, 30 m. */
export const FOG_PEAK: Record<Exclude<WeatherKind, "clear">, number> = { mist: 0.012, fog: 0.03, soup: 0.085 };

/** Chance a slot holds a fog: rare by day and night, a coin flip at dawn. */
export function fogChance(morning: number): number {
  return 0.04 + 0.5 * clamp(morning, 0, 1);
}

const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** How much of its peak a fog has at `p`, 0 to 1 through its slot: up over the first fifth, gone over the last 45%. */
export function fogEnvelope(p: number): number {
  return smooth(0, 0.2, p) * (1 - smooth(0.55, 1, p));
}

/** The roll for slot `k`: the same k always gives the same numbers. */
function rolls(k: number, salt: number): () => number {
  return mulberry32(Math.imul(k | 0, 2654435761) ^ salt);
}

function cloudAt(nowMs: number): number {
  const s = nowMs / CLOUD_SLOT_MS, k = Math.floor(s);
  const value = (i: number) => {
    const v = rolls(i, 0x51ed)();
    // About a third of the steps are clear; the rest run up to overcast.
    return clamp((v - 0.35) / 0.55, 0, 1);
  };
  return value(k) + (value(k + 1) - value(k)) * smooth(0, 1, s - k);
}

/**
 * The weather at `nowMs`.
 *
 * :param nowMs: Wall-clock time, ms since the epoch.
 * :param morning: 0 to 1, how much the sky is at dawn (sky.ts); the higher, the likelier a fog.
 */
export function weatherAt(nowMs: number, morning: number): Weather {
  const k = Math.floor(nowMs / FOG_SLOT_MS);
  const p = nowMs / FOG_SLOT_MS - k;
  const roll = rolls(k, 0xf06);
  const forms = roll() < fogChance(morning);
  const kindRoll = roll();
  const strength = 0.8 + 0.2 * roll();
  let kind: WeatherKind = "clear", fogDensity = 0, fogAmount = 0;
  if (forms) {
    kind = kindRoll < 0.16 ? "soup" : kindRoll < 0.55 ? "fog" : "mist";
    fogAmount = fogEnvelope(p);
    fogDensity = FOG_PEAK[kind] * strength * fogAmount;
    // A fog that has burned away is a clear sky again.
    if (fogAmount < 0.02) kind = "clear";
  }
  // Fog and low cloud go together; the sun is lost in it.
  return { fogDensity, cloud: Math.max(cloudAt(nowMs), 0.6 * fogAmount), kind };
}

/** What `?weather=` can pin the sky to, for testing. */
export const WEATHER_OVERRIDES: Record<string, Weather> = {
  clear: { fogDensity: 0, cloud: 0, kind: "clear" },
  clouds: { fogDensity: 0, cloud: 0.85, kind: "clear" },
  mist: { fogDensity: FOG_PEAK.mist, cloud: 0.4, kind: "mist" },
  fog: { fogDensity: FOG_PEAK.fog, cloud: 0.6, kind: "fog" },
  soup: { fogDensity: FOG_PEAK.soup, cloud: 0.6, kind: "soup" },
};

/** The pinned weather named by a query string ("?weather=soup"), or null. */
export function weatherOverride(search: string): Weather | null {
  const name = new URLSearchParams(search).get("weather");
  return name && Object.hasOwn(WEATHER_OVERRIDES, name) ? WEATHER_OVERRIDES[name]! : null;
}

/** The weather the scene draws now: eased toward the target so a toggle or a new fog never jumps. */
export const weather: Weather = { fogDensity: 0, cloud: 0, kind: "clear" };

/** Seconds for the drawn weather to close about two thirds of the way to its target. */
const EASE = 3;

export function stepWeather(target: Weather, dt: number): void {
  const k = 1 - Math.exp(-dt / EASE);
  weather.fogDensity += (target.fogDensity - weather.fogDensity) * k;
  weather.cloud += (target.cloud - weather.cloud) * k;
  weather.kind = target.kind;
}

/** How much the air is thick enough to hide the sun and stars and gray the sky: 0 clear to 1. */
export function overcast(w: Weather): number {
  return Math.max(fogMix(w), 0.75 * w.cloud);
}

/** How far the sky and fog go to fog gray: none in the season's haze, all the way in pea soup. */
export function fogMix(w: Weather): number {
  return smooth(0.004, 0.05, w.fogDensity);
}

const NAMES: Record<WeatherKind, string> = { clear: "Clear", mist: "Mist", fog: "Fog", soup: "Dense fog" };

/** A word for the weather, for the settings dialog. */
export function weatherName(w: Weather): string {
  if (w.kind !== "clear") return NAMES[w.kind];
  return w.cloud > 0.7 ? "Overcast" : w.cloud > 0.35 ? "Cloudy" : "Clear";
}
