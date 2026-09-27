export type Preferences = {
  pace: "gentle" | "brisk";
  sensitivity: number;
  camera: "follow" | "high" | "cart";
  motion: boolean;
  detail: boolean;
  /** Leaf complexity; see LEAF_SCALE. */
  leaves: LeafDetail;
  /** Show triangles, draw calls, leaves and frame rate. */
  stats: boolean;
  /** Silent mode: no cards pop up on their own (nearby book, redwood, quest hints). */
  silent: boolean;
  /** Fog density; see FOG_SCALE. */
  fog: FogLevel;
};

export type FogLevel = "clear" | "light" | "normal" | "heavy";

/** Multiplier on the season's fog density (World.tsx). */
export const FOG_SCALE: Record<FogLevel, number> = { clear: 0.3, light: 0.6, normal: 1, heavy: 1.8 };

export type LeafDetail = "low" | "medium" | "high" | "ultra";

/**
 * Fraction of each book's chunks that carry a leaf. Ultra is the truthful
 * forest, one leaf per chunk (~398k); every level is the same fraction of every
 * book, so crowns stay proportional to the books.
 */
export const LEAF_SCALE: Record<LeafDetail, number> = { low: 0.1, medium: 0.25, high: 0.5, ultra: 1 };

export function readPreferences(value?: Partial<Preferences>): Preferences {
  return {
    pace: value?.pace === "brisk" ? "brisk" : "gentle",
    sensitivity: typeof value?.sensitivity === "number" && Number.isFinite(value.sensitivity)
      ? Math.max(0.5, Math.min(1.5, value.sensitivity)) : 1,
    camera: value?.camera === "high" || value?.camera === "cart" ? value.camera : "follow",
    motion: typeof value?.motion === "boolean" ? value.motion
      : !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches),
    detail: typeof value?.detail === "boolean" ? value.detail : true,
    // Touch devices start at Low.
    leaves: value?.leaves && value.leaves in LEAF_SCALE ? value.leaves
      : typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches ? "low" : "medium",
    stats: value?.stats === true,
    silent: value?.silent === true,
    fog: value?.fog && value.fog in FOG_SCALE ? value.fog : "normal",
  };
}
