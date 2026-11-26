export type Preferences = {
  pace: "gentle" | "brisk";
  sensitivity: number;
  /** "god" looks down on the whole forest from above the hub; "wheel" down on the Wayfarer's Wheel. */
  camera: "follow" | "high" | "cart" | "wheel" | "god";
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
  /** Forest sounds' volume, 0 (off) to 1: night insects, birdsong, wind (ambience.ts). */
  sounds: number;
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
  /** The voice that reads a book aloud, by name; "" picks one from the book's author. */
  readVoice: string;
  /** Reading-aloud speed, 0.8 to 1.3. */
  readRate: number;
  /** Where each book was left, by slug: chapter index and block index. */
  readingAt: Record<string, [number, number]>;
  /** Each book's bookmarks, by slug: chapter and block pairs in reading order (bookmarks.ts). */
  bookmarks: Record<string, [number, number][]>;
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

/**
 * The leaves a level grows here: the Mac app (Environment.tsx DOUBLE_LEAVES) doubles every level, so Ultra
 * hangs two leaves per chunk (growTree.ts); an iPad, a phone and every browser keep LEAF_SCALE.
 */
export function leafScaleFor(detail: LeafDetail, desktop: boolean): number {
  return LEAF_SCALE[detail] * (desktop ? 2 : 1);
}

/** The leaf picker's labels, as `leafScaleFor` grows them. */
export function leafLabels(desktop: boolean): Record<LeafDetail, string> {
  return desktop
    ? { low: "Low · 1 in 5 chunks", medium: "Medium · 1 in 2", high: "High · every chunk", ultra: "Ultra · 2 per chunk" }
    : { low: "Low · 1 in 10 chunks", medium: "Medium · 1 in 4", high: "High · 1 in 2", ultra: "Ultra · every chunk" };
}

/** The camera views' names, in the order the C key and the bar's button step through them. */
export const CAMERA_NAME = { cart: "In the cart", follow: "Behind the cart", high: "High view", god: "God's eye", wheel: "The Wayfarer's Wheel" } as const;

/** The view after this one. */
export function nextCamera(camera: Preferences["camera"]): Preferences["camera"] {
  return ({ cart: "follow", follow: "high", high: "god", god: "wheel", wheel: "cart" } as const)[camera];
}

export function readPreferences(value?: Partial<Preferences>): Preferences {
  return {
    pace: value?.pace === "brisk" ? "brisk" : "gentle",
    sensitivity: typeof value?.sensitivity === "number" && Number.isFinite(value.sensitivity)
      ? Math.max(0.5, Math.min(1.5, value.sensitivity)) : 1,
    camera: value?.camera === "high" || value?.camera === "cart" || value?.camera === "wheel" || value?.camera === "god" ? value.camera : "follow",
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
    sounds: typeof value?.sounds === "number" && Number.isFinite(value.sounds)
      ? Math.max(0, Math.min(1, value.sounds)) : 0.5,
    fog: value?.fog && value.fog in FOG_SCALE ? value.fog : "normal",
    weather: value?.weather === true,
    narrate: value?.narrate === true,
    speakMoots: value?.speakMoots !== false,
    mootVoices: Array.isArray(value?.mootVoices) && value.mootVoices.length === 2
      && value.mootVoices.every((n) => typeof n === "string")
      ? [value.mootVoices[0], value.mootVoices[1]] : ["", ""],
    readingSize: value?.readingSize && value.readingSize in READING_SIZES ? value.readingSize : "medium",
    readVoice: typeof value?.readVoice === "string" ? value.readVoice : "",
    readRate: typeof value?.readRate === "number" && Number.isFinite(value.readRate)
      ? Math.max(0.8, Math.min(1.3, value.readRate)) : 0.95,
    readingAt: readingAt(value?.readingAt),
    bookmarks: bookmarks(value?.bookmarks),
    mootWorker: typeof value?.mootWorker === "string" && value.mootWorker.trim() ? value.mootWorker.trim() : "",
    mootToken: typeof value?.mootToken === "string" ? value.mootToken : "",
  };
}

/** Saved bookmarks, each a list of whole-number pairs; anything else is dropped. */
function bookmarks(value: unknown): Record<string, [number, number][]> {
  const out: Record<string, [number, number][]> = {};
  if (!value || typeof value !== "object") return out;
  for (const [slug, marks] of Object.entries(value)) {
    if (!Array.isArray(marks)) continue;
    const kept = marks.filter((at): at is [number, number] =>
      Array.isArray(at) && at.length === 2 && at.every((n) => Number.isInteger(n) && n >= 0));
    if (kept.length) out[slug] = kept.map(([c, b]) => [c, b]);
  }
  return out;
}

/** Saved reading positions, each a pair of whole numbers; anything else is dropped. */
function readingAt(value: unknown): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  if (!value || typeof value !== "object") return out;
  for (const [slug, at] of Object.entries(value)) {
    if (Array.isArray(at) && at.length === 2 && at.every((n) => Number.isInteger(n) && n >= 0)) out[slug] = [at[0], at[1]];
  }
  return out;
}
