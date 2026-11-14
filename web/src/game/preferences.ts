export type Preferences = {
  pace: "gentle" | "brisk";
  sensitivity: number;
  /** "god" looks down on the whole forest from above the hub. */
  camera: "follow" | "high" | "cart" | "god";
  motion: boolean;
  /** The sun's shadows. Off by default: on an iPad mini they halved the frame rate. */
  shadows: boolean;
  /** Grass and stones on the forest floor. */
  undergrowth: boolean;
  /** Leaf complexity; see LEAF_SCALE. */
  leaves: LeafDetail;
  /** Show triangles, draw calls, leaves and frame rate. */
  stats: boolean;
  /** Silent mode: no cards pop up on their own (nearby book, redwood, quest hints). */
  silent: boolean;
  /** Fog density; see FOG_SCALE. */
  fog: FogLevel;
  /** Random weather: morning fogs that burn off, up to pea soup, and drifting cloud (weather.ts). */
  weather: boolean;
  /** Riding the ring, read each grove's summary aloud at its stop. */
  narrate: boolean;
  /** Read a moot's turns aloud, a voice per tree; off, turns advance at reading pace. */
  speakMoots: boolean;
  /** Each tree's voice by name, first tree first; "" picks one automatically. */
  mootVoices: [string, string];
  /** The book reader's text size; see READING_SIZES. */
  readingSize: ReadingSize;
  /** The GutenbergKG worker that holds live moots (liveMoots.ts); "" for none, the default. */
  mootWorker: string;
  /** The worker's MOOT_TOKEN, when it sets one; "" otherwise. */
  mootToken: string;
};

export type ReadingSize = "small" | "medium" | "large" | "larger";

/** The reader's text sizes, smallest first, with each one's Tailwind type scale. */
export const READING_SIZES: Record<ReadingSize, string> = {
  small: "text-base",
  medium: "text-lg sm:text-xl",
  large: "text-xl sm:text-2xl",
  larger: "text-2xl sm:text-3xl",
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

/** The camera views' names, in the order the C key and the bar's button step through them. */
export const CAMERA_NAME = { follow: "Behind the cart", high: "High view", cart: "In the cart", god: "God's eye" } as const;

/** The view after this one. */
export function nextCamera(camera: Preferences["camera"]): Preferences["camera"] {
  return ({ follow: "high", high: "cart", cart: "god", god: "follow" } as const)[camera];
}

export function readPreferences(value?: Partial<Preferences>): Preferences {
  return {
    pace: value?.pace === "brisk" ? "brisk" : "gentle",
    sensitivity: typeof value?.sensitivity === "number" && Number.isFinite(value.sensitivity)
      ? Math.max(0.5, Math.min(1.5, value.sensitivity)) : 1,
    camera: value?.camera === "high" || value?.camera === "cart" || value?.camera === "god" ? value.camera : "follow",
    motion: typeof value?.motion === "boolean" ? value.motion
      : !(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches),
    // The old `detail` setting is ignored on purpose: it was saved on for everyone, so reading it would keep shadows on.
    shadows: value?.shadows === true,
    undergrowth: value?.undergrowth !== false,
    // Touch devices start at High.
    leaves: value?.leaves && value.leaves in LEAF_SCALE ? value.leaves
      : typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches ? "high" : "medium",
    stats: value?.stats === true,
    silent: value?.silent === true,
    fog: value?.fog && value.fog in FOG_SCALE ? value.fog : "normal",
    weather: value?.weather === true,
    narrate: value?.narrate === true,
    speakMoots: value?.speakMoots !== false,
    mootVoices: Array.isArray(value?.mootVoices) && value.mootVoices.length === 2
      && value.mootVoices.every((n) => typeof n === "string")
      ? [value.mootVoices[0], value.mootVoices[1]] : ["", ""],
    readingSize: value?.readingSize && value.readingSize in READING_SIZES ? value.readingSize : "medium",
    mootWorker: typeof value?.mootWorker === "string" && value.mootWorker.trim() ? value.mootWorker.trim() : "",
    mootToken: typeof value?.mootToken === "string" ? value.mootToken : "",
  };
}
