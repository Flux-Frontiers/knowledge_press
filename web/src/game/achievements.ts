/**
 * Achievements: four tracks, each with bronze, silver and gold. Pure, so the
 * HUD, the Wayfarer's Wheel on the hub plaza (WayfarersWheel.tsx) and the
 * tests read the same levels from the same saved progress.
 */

export type Tier = 0 | 1 | 2 | 3;
export const TIER_NAME = ["", "Bronze", "Silver", "Gold"] as const;
export const TIER_COLOR = ["#6b6b6b", "#b0773e", "#c9ccd2", "#e2b83f"] as const;

/** What the save keeps of the ring: groves stopped at on the lap under way, laps done, and their seasons. */
export type RingProgress = {
  stops: string[];
  laps: number;
  seasons: string[];
  /** The last lap was finished: its studs stay lit on the Wheel until the next ride sets off. */
  lapDone: boolean;
};

export type Progress = {
  library: string[];
  grovesVisited: string[];
  plaques: string[];
  ring: RingProgress;
};

/** The forest's totals, for the "all of them" levels. */
export type Totals = { books: number; groves: number; exhibits: number };

export type Track = {
  id: "ring" | "explorer" | "reader" | "curator";
  title: string;
  /** What each level asks, bronze to gold. */
  steps: [string, string, string];
  tier: Tier;
  /** Toward the next level, as "3 of 10"; empty at gold. */
  next: string;
};

const SEASONS = 4;

function tierOf(have: number, needs: [number, number, number]): Tier {
  return (needs.filter((n) => have >= n).length) as Tier;
}

function nextOf(have: number, needs: number[], tier: Tier, unit: string): string {
  return tier >= 3 ? "" : `${Math.min(have, needs[tier]!)} of ${needs[tier]} ${unit}`;
}

export function tracks(p: Progress, t: Totals): Track[] {
  const ringTier: Tier = p.ring.laps < 1 ? 0 : p.ring.laps < 3 ? 1 : new Set(p.ring.seasons).size < SEASONS ? 2 : 3;
  const ringNext = ringTier === 0 ? `${p.ring.stops.length} of ${t.groves} groves this ride`
    : ringTier === 1 ? `${p.ring.laps} of 3 rides`
    : ringTier === 2 ? `${new Set(p.ring.seasons).size} of ${SEASONS} seasons` : "";
  const explorer: [number, number, number] = [Math.min(4, t.groves), Math.min(10, t.groves), t.groves];
  const reader: [number, number, number] = [Math.min(3, t.books), Math.min(25, t.books), t.books];
  const curator: [number, number, number] = [Math.min(3, t.exhibits), Math.min(6, t.exhibits), t.exhibits];
  const ex = tierOf(p.grovesVisited.length, explorer);
  const rd = tierOf(p.library.length, reader);
  const cu = tierOf(p.plaques.length, curator);
  return [
    { id: "ring", title: "Wayfarer", steps: ["Ride the whole ring home to the redwood", "Ride it three times", "Ride it in every season"], tier: ringTier, next: ringNext },
    { id: "explorer", title: "Explorer", steps: [`Visit ${explorer[0]} groves`, `Visit ${explorer[1]} groves`, `Visit all ${explorer[2]} groves`], tier: ex, next: nextOf(p.grovesVisited.length, explorer, ex, "groves") },
    { id: "reader", title: "Reader", steps: [`Press ${reader[0]} books`, `Press ${reader[1]} books`, `Press all ${reader[2]} books`], tier: rd, next: nextOf(p.library.length, reader, rd, "books") },
    { id: "curator", title: "Curator", steps: [`Read ${curator[0]} exhibit plaques`, `Read ${curator[1]} plaques`, `Read all ${curator[2]} plaques`], tier: cu, next: nextOf(p.plaques.length, curator, cu, "plaques") },
  ];
}

/** Levels gained between two states of progress, highest first within a track. */
export function gained(before: Track[], after: Track[]): { title: string; tier: Tier }[] {
  return after.filter((a, i) => a.tier > before[i]!.tier).map((a) => ({ title: a.title, tier: a.tier }));
}

/** Read the ring's saved progress, tolerating anything an old or hand-edited save holds. */
export function readRing(raw: unknown): RingProgress {
  const r = (raw ?? {}) as Partial<RingProgress>;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
  return {
    stops: [...new Set(strings(r.stops))],
    laps: typeof r.laps === "number" && Number.isFinite(r.laps) && r.laps > 0 ? Math.floor(r.laps) : 0,
    seasons: [...new Set(strings(r.seasons))],
    lapDone: r.lapDone === true,
  };
}

/** A ride setting off: after a finished lap, the next one starts with every stud dark. */
export function startRide(r: RingProgress): RingProgress {
  return r.lapDone ? { ...r, stops: [], lapDone: false } : r;
}

/** A grove stopped at on the ring. */
export function ringStop(r: RingProgress, genre: string): RingProgress {
  return r.stops.includes(genre) ? r : { ...r, stops: [...r.stops, genre] };
}

/**
 * Home at the redwood: a lap counts once every grove on the ring has been
 * stopped at since the last one, across reloads and rides broken off.
 */
export function finishLap(r: RingProgress, groves: string[], season: string): { ring: RingProgress; counted: boolean } {
  if (r.lapDone || !groves.every((g) => r.stops.includes(g))) return { ring: r, counted: false };
  return {
    ring: { stops: r.stops, laps: r.laps + 1, seasons: r.seasons.includes(season) ? r.seasons : [...r.seasons, season], lapDone: true },
    counted: true,
  };
}
