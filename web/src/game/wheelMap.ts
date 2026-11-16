/**
 * The Wayfarer's Wheel drawn flat for its plaque (WayfarerMap.tsx): the same
 * roads and grove studs as the bronze table (WayfarersWheel.tsx), north up,
 * in SVG units with the redwood at the origin.
 */

import type { Forest } from "./forest";

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
};

export type WheelMap = {
  rings: number[];
  spokes: [number, number, number, number][];
  studs: WheelMapStud[];
};

/**
 * :param stops: Groves stopped at on the ride under way.
 * :param radius: The outer ring's radius in SVG units.
 */
export function wayfarerMap(forest: Pick<Forest, "circuit" | "groves" | "roadLines">, stops: readonly string[], radius = 90): WheelMap {
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
  }));
  return { rings: rings.map((R) => R * scale), spokes, studs };
}
