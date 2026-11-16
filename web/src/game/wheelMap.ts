/**
 * The Wayfarer's Wheel drawn flat for its plaque (WayfarerMap.tsx): the same
 * roads and grove studs as the bronze table (WayfarersWheel.tsx), north up,
 * in SVG units with the redwood at the origin.
 */

import type { Forest } from "./forest";

/** The table's top above the ground, and its radius, m (WayfarersWheel.tsx). */
export const WHEEL_TOP_Y = 0.95;
export const WHEEL_TABLE_R = 0.82;
/**
 * How far the Wheel's view leans off straight down, from the south: oblique
 * enough that the studs show their height, with north still at the top.
 */
export const WHEEL_VIEW_LEAN = (40 * Math.PI) / 180;

export type WheelMapStud = {
  /** The grove's place in the ride's order, from 1. */
  n: number;
  genre: string;
  label: string;
  color: string;
  x: number;
  y: number;
  /** Stopped at on the ride under way. */
  seen: boolean;
  /** Visits to the grove and readings of its books, all told (groveTally). */
  count: number;
};

export type WheelMap = {
  rings: number[];
  spokes: [number, number, number, number][];
  studs: WheelMapStud[];
};

/**
 * :param stops: Groves stopped at on the ride under way.
 * :param radius: The outer ring's radius in SVG units.
 * :param tally: Visits and readings per grove (groveTally).
 */
export function wayfarerMap(forest: Pick<Forest, "circuit" | "groves" | "roadLines">, stops: readonly string[], radius = 90, tally: Record<string, number> = {}): WheelMap {
  const rings = forest.roadLines.filter((l) => l.kind === "ring").map((l) => Math.hypot(...l.pts[0]!));
  const scale = radius / (Math.max(...rings) || 1);
  const spokes = forest.roadLines.filter((l) => l.kind === "spoke").map((l) => {
    const [ax, az] = l.pts[0]!, [bx, bz] = l.pts[l.pts.length - 1]!;
    return [ax * scale, az * scale, bx * scale, bz * scale] as [number, number, number, number];
  });
  // The forest's +x is east and +z south (sky.ts), so they are the SVG's x and y as they stand.
  const studs = forest.circuit.map((wp, i) => ({
    n: i + 1,
    genre: wp.genre,
    label: wp.label,
    color: forest.groves.find((g) => g.genre === wp.genre)?.color ?? "#888888",
    x: wp.x * scale,
    y: wp.z * scale,
    seen: stops.includes(wp.genre),
    count: tally[wp.genre] ?? 0,
  }));
  return { rings: rings.map((R) => R * scale), spokes, studs };
}

/**
 * The camera looking down on the Wheel's table at a slant (camera mode
 * "wheel"), close enough that the table, foreshortened top to bottom, just
 * fills the screen.
 *
 * :param fov: The camera's vertical field of view, degrees.
 * :param aspect: The screen's width over its height.
 */
export function wheelViewPose(wheel: { x: number; z: number }, fov: number, aspect: number): { cam: [number, number, number]; look: [number, number, number] } {
  const t = Math.tan(((fov / 2) * Math.PI) / 180);
  // Top to bottom wants more room: the near rim, closer to the camera, looms larger than the far one.
  const d = WHEEL_TABLE_R * Math.max(1.15 / (t * aspect), (1.5 * Math.cos(WHEEL_VIEW_LEAN)) / t);
  return {
    cam: [wheel.x, WHEEL_TOP_Y + d * Math.cos(WHEEL_VIEW_LEAN), wheel.z + d * Math.sin(WHEEL_VIEW_LEAN)],
    look: [wheel.x, WHEEL_TOP_Y, wheel.z],
  };
}

/**
 * Each grove's visits plus the readings of its books: what grows its stud.
 *
 * :param visits: Times each grove has been arrived at, by genre.
 * :param reads: Times each book has been opened in the reader, by slug.
 */
export function groveTally(forest: Pick<Forest, "trees">, visits: Record<string, number>, reads: Record<string, number>): Record<string, number> {
  const tally: Record<string, number> = { ...visits };
  for (const t of forest.trees) {
    const n = reads[t.book.slug];
    if (n) tally[t.book.genre] = (tally[t.book.genre] ?? 0) + n;
  }
  return tally;
}

/** A stud's flat height on an untouched grove, m. */
export const STUD_H = 0.02;

/**
 * How a stud stands after `n` visits and readings: it rises and fattens a
 * little with each, by the square root so the first few show most, and stops
 * at a pin about a hand high so the map stays legible.
 *
 * :returns: Its height, m, and its radius as a multiple of the untouched stud's.
 */
export function studSize(n: number): { h: number; r: number } {
  const k = Math.sqrt(Math.min(Math.max(n, 0), 100));
  return { h: STUD_H + 0.012 * k, r: 1 + 0.08 * k };
}
