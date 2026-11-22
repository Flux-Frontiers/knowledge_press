/**
 * The forest's outdoor sounds: recorded loops (public/sounds, CC0; see
 * CREDITS.md there) mixed by the sky and the season. Crickets and frogs come
 * up at dusk, a dawn chorus with the sunrise, birdsong by day, wind under it
 * all; winter nights are wind and owls. An owl or a woodpecker now and then.
 *
 * Each loop plays as overlapping passes that crossfade, so the seam never
 * clicks whatever padding the codec adds. Files load the first time their bed
 * is wanted.
 */

import { audioContext } from "./audio";
import type { SeasonName } from "./seasons";

export type Bed = "crickets" | "frogs" | "dawn" | "birds" | "wind";

/** Each bed's file and its level at full weight. */
const BEDS: Record<Bed, { file: string; level: number }> = {
  crickets: { file: "crickets.m4a", level: 1 },
  frogs: { file: "frogs.m4a", level: 0.7 },
  dawn: { file: "dawn.m4a", level: 1 },
  birds: { file: "birds.m4a", level: 0.9 },
  wind: { file: "wind.m4a", level: 0.7 },
};

/** Calls now and then: mean seconds between them, and when (night or day). */
const CALLS = {
  owl: { files: ["owl-1.m4a", "owl-2.m4a", "owl-3.m4a", "owl-4.m4a"], every: 45, level: 0.8 },
  woodpecker: { files: ["woodpecker-1.m4a", "woodpecker-2.m4a", "woodpecker-3.m4a"], every: 70, level: 0.7 },
};

/** Seconds two passes of a loop overlap. */
const CROSSFADE = 4;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Each bed's weight, 0 to 1, for the sky and season.
 *
 * :param daylight: The sky's daylight, 0 at night, 1 in full day.
 * :param morning: How much this is a morning sky, 0 to 1.
 * :param season: The forest's season.
 */
export function ambienceMix(daylight: number, morning: number, season: SeasonName): Record<Bed, number> {
  const night = 1 - smooth(0.15, 0.55, daylight);
  const day = smooth(0.3, 0.8, daylight);
  const winter = season === "winter";
  const warm = season === "summer" ? 1 : season === "spring" ? 0.8 : season === "autumn" ? 0.7 : 0;
  const birdy = season === "spring" ? 1 : season === "summer" ? 0.85 : season === "autumn" ? 0.5 : 0.2;
  const chorus = morning * smooth(0.05, 0.4, daylight);
  return {
    crickets: night * warm,
    frogs: night * (season === "spring" || season === "summer" ? 1 : 0),
    dawn: chorus * birdy,
    birds: day * birdy * (1 - 0.6 * chorus),
    wind: winter ? 1 : 0.6,
  };
}

/** Which calls can sound now: owls at night, woodpeckers on warm days. */
export function callsNow(daylight: number, season: SeasonName): Record<keyof typeof CALLS, boolean> {
  return {
    owl: daylight < 0.25,
    woodpecker: daylight > 0.6 && season !== "winter",
  };
}

type Live = {
  ctx: AudioContext;
  master: GainNode;
  beds: Record<Bed, { gain: GainNode; buffer: AudioBuffer | null; loading: boolean; next: number }>;
  calls: Map<string, AudioBuffer | null>;
};
let live: Live | null = null;

async function load(ctx: AudioContext, file: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(`sounds/${file}`);
    if (!res.ok) return null;
    return await ctx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function start(): Live | null {
  if (live) return live;
  const ctx = audioContext();
  if (!ctx) return null;
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const beds = {} as Live["beds"];
  for (const name of Object.keys(BEDS) as Bed[]) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    beds[name] = { gain, buffer: null, loading: false, next: 0 };
  }
  live = { ctx, master, beds, calls: new Map() };
  return live;
}

/** Queue the bed's next pass if the last one ends soon. */
function keepPlaying(l: Live, name: Bed) {
  const bed = l.beds[name];
  const buf = bed.buffer;
  if (!buf) return;
  const now = l.ctx.currentTime;
  if (bed.next > now + 3) return;
  const first = bed.next < now;
  const at = first ? now + 0.05 : bed.next;
  // A fresh start picks up somewhere in the loop, so every visit does not open on the same bird.
  const offset = first ? Math.random() * Math.max(0, buf.duration - 3 * CROSSFADE) : 0;
  const length = buf.duration - offset;
  const src = l.ctx.createBufferSource();
  src.buffer = buf;
  const env = l.ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(1, at + CROSSFADE);
  env.gain.setValueAtTime(1, at + length - CROSSFADE);
  env.gain.linearRampToValueAtTime(0, at + length);
  src.connect(env).connect(bed.gain);
  src.start(at, offset);
  src.stop(at + length);
  bed.next = at + length - CROSSFADE;
}

function call(l: Live, kind: keyof typeof CALLS) {
  const spec = CALLS[kind];
  const file = spec.files[Math.floor(Math.random() * spec.files.length)];
  const buf = l.calls.get(file);
  if (buf === undefined) {
    l.calls.set(file, null);
    void load(l.ctx, file).then((b) => { if (b) l.calls.set(file, b); else l.calls.delete(file); });
    return;
  }
  if (!buf) return;
  const src = l.ctx.createBufferSource();
  src.buffer = buf;
  const g = l.ctx.createGain();
  // Near or far, left or right: one owl, somewhere out in the trees.
  g.gain.value = spec.level * (0.35 + 0.65 * Math.random());
  const pan = l.ctx.createStereoPanner();
  pan.pan.value = Math.random() * 1.6 - 0.8;
  src.connect(g).connect(pan).connect(l.master);
  src.start();
}

/**
 * Bring the sounds toward the mix for now; call about once a second.
 *
 * :param volume: The player's setting, 0 (off) to 1.
 * :param daylight: The sky's daylight.
 * :param morning: How much this is a morning sky.
 * :param season: The forest's season.
 * :param duck: Lower everything, as while a voice is reading.
 * :param dt: Seconds since the last call, for the calls' odds.
 */
export function stepAmbience(volume: number, daylight: number, morning: number, season: SeasonName, duck: boolean, dt: number) {
  const l = volume > 0.001 ? start() : live;
  if (!l) return;
  const t = l.ctx.currentTime;
  // The loops are mastered at -23 LUFS; the slider's middle plays them at about that, its top 6 dB up.
  l.master.gain.setTargetAtTime(2 * volume * (duck ? 0.35 : 1), t, 0.6);
  if (volume <= 0.001) return;
  const mix = ambienceMix(daylight, morning, season);
  for (const name of Object.keys(BEDS) as Bed[]) {
    const bed = l.beds[name];
    const want = mix[name] * BEDS[name].level;
    // Dusk and dawn are slow; a season or clock changed in settings crossfades over a few seconds.
    bed.gain.gain.setTargetAtTime(want, t, 2);
    if (want > 0.001) {
      if (!bed.buffer && !bed.loading) {
        bed.loading = true;
        void load(l.ctx, BEDS[name].file).then((b) => { bed.buffer = b; });
      }
      keepPlaying(l, name);
    } else if (bed.next + CROSSFADE < t) {
      // Out of season or out of hours and its last pass is over: a decoded minute is
      // about 10 MB, so let it go; it loads again, or retries a failed load, when wanted.
      bed.buffer = null;
      bed.loading = false;
    }
  }
  const can = callsNow(daylight, season);
  for (const kind of Object.keys(CALLS) as (keyof typeof CALLS)[]) {
    if (can[kind] && Math.random() < dt / CALLS[kind].every) call(l, kind);
  }
}
