/**
 * The grove narration, spoken with the browser's own speech synthesis (the
 * Web Speech API). On Apple devices that is the system's voices, the same ones
 * AVSpeechSynthesizer uses; nothing is downloaded. Where there is no speech
 * synthesis (Node, some embedded browsers) every call does nothing.
 */

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

type Voice = Pick<SpeechSynthesisVoice, "name" | "lang" | "default" | "localService">;

/** An English voice, the system default if it is English, else the first local one. */
function englishVoice<V extends Voice>(all: V[]): V | undefined {
  const voices = all.filter((v) => v.lang.toLowerCase().startsWith("en"));
  return voices.find((v) => v.default) ?? voices.find((v) => v.localService) ?? voices[0];
}

/** Novelty and effect voices macOS lists as English; they read a moot badly. */
const NOVELTY = new Set([
  "Albert", "Bad News", "Bahh", "Bells", "Boing", "Bubbles", "Cellos", "Fred", "Good News",
  "Jester", "Junior", "Kathy", "Organ", "Ralph", "Superstar", "Trinoids", "Whisper", "Wobble", "Zarvox",
]);

/**
 * British male voices to try for each moot speaker, best first (macOS and iOS,
 * Edge, Chrome). The second list holds only good voices other than the
 * first's: macOS's older UK voices (Reed, Rocko, Eddy) are listed by the
 * system but not offered to the browser, which then speaks with its default,
 * often a female voice. Without a second voice both trees share the first,
 * told apart by pitch.
 */
const PREFERRED: readonly [readonly string[], readonly string[]] = [
  ["Daniel", "Google UK English Male", "Microsoft Ryan", "Arthur", "Jamie", "Oliver", "Microsoft George"],
  ["Arthur", "Jamie", "Oliver", "Microsoft Thomas", "Microsoft George", "Microsoft Ryan"],
];

/** Pitch for each speaker when both share one voice: the second tree speaks deeper. */
const SHARED_PITCH: readonly [number, number] = [1, 0.8];

/** A voice's name without its locale suffix: "Samantha (English (US))" is "Samantha". */
function baseName(v: Voice): string {
  return v.name.replace(/\s*\(.*$/, "").trim();
}

/**
 * British male voices for a moot's two speakers.
 *
 * macOS lists one voice under several locales ("Samantha (English (US))"
 * twice), so voices are compared by base name; among one name's copies an
 * Enhanced or Premium download wins, then a UK one, and novelty voices are
 * skipped. Each speaker takes the first of its `PREFERRED` voices
 * the browser has, the second never the first's voice. With no second voice
 * both speakers share the first, which `speak` tells apart by pitch; with
 * no preferred voice at all, the usual English voice. A voice the listener
 * chose in Settings wins for its speaker when the browser has it.
 *
 * :param all: The browser's voices.
 * :param chosen: Each speaker's chosen voice name; "" for automatic.
 */
export function voicePair<V extends Voice>(all: V[], chosen: readonly [string, string] = ["", ""]): [V | undefined, V | undefined] {
  const english = all.filter((v) => v.lang.toLowerCase().startsWith("en") && !NOVELTY.has(baseName(v)));
  // Best copy of a voice first: an Enhanced or Premium download, then a UK one.
  const rank = (v: V) => (/\((Enhanced|Premium)\)/.test(v.name) ? 0 : 2)
    + (v.lang.toLowerCase().replace("_", "-") === "en-gb" ? 0 : 1);
  const pick = (names: readonly string[], other?: V) => {
    for (const n of names) {
      const found = english
        .filter((v) => baseName(v).startsWith(n) && (!other || baseName(v) !== baseName(other)))
        .sort((x, y) => rank(x) - rank(y))[0];
      if (found) return found;
    }
    return undefined;
  };
  const named = (i: 0 | 1) => (chosen[i] ? all.find((v) => v.name === chosen[i]) : undefined);
  const first = named(0) ?? pick(PREFERRED[0]) ?? englishVoice(english) ?? englishVoice(all);
  return [first, named(1) ?? pick(PREFERRED[1], first) ?? pick(PREFERRED[0], first) ?? first];
}

/** A moot is spoken slower than grove narration: it is argument, read aloud. */
export const MOOT_RATE = 0.85;

let active = false;
/** The utterance in flight: Safari can drop an utterance nothing refers to, and its end event with it. */
let held: SpeechSynthesisUtterance | null = null;

/** The browser's voices once it has listed them; Chrome fills the list after load. */
let voices: SpeechSynthesisVoice[] = [];
let watchingVoices = false;

/** The voice list, refreshed now and on every `voiceschanged` from here on. */
function loadVoices(s: SpeechSynthesis): SpeechSynthesisVoice[] {
  if (!watchingVoices) {
    watchingVoices = true;
    s.addEventListener?.("voiceschanged", () => loadVoices(s));
  }
  const listed = s.getVoices();
  if (listed.length) voices = listed;
  return voices;
}

/** How long a moot line waits for the voice list before speaking with the default voice. */
const VOICE_WAIT_MS = 1000;
/** Bumped by every `speak` and `hush`, so a line still waiting for voices knows it was overtaken. */
let generation = 0;
let waiting = false;

/**
 * Speak `text`, cutting off anything still being said.
 *
 * A moot line (`speaker` given) needs its voices by name. Right after the
 * browser starts its voice list can still be empty, and speaking then falls
 * back to the default voice, so such a line waits for the list (up to
 * VOICE_WAIT_MS) first.
 *
 * :param queue: Say it after whatever is being said instead of cutting it off.
 * :param speaker: 0 or 1, for one of `voicePair`'s voices at `MOOT_RATE`; the usual
 *     voice at the narration rate if omitted.
 * :param onEnd: Called when the utterance ends or fails.
 * :param chosen: For a moot line, each speaker's chosen voice name ("" for automatic).
 */
export function speak(
  text: string, queue = false, speaker?: 0 | 1, onEnd?: () => void, chosen?: readonly [string, string],
): void {
  const s = synth();
  if (!s) return;
  if (!queue) s.cancel();
  const turn = ++generation;
  const say = () => {
    waiting = false;
    if (turn !== generation) return;
    const u = new SpeechSynthesisUtterance(text);
    const pair = speaker === undefined ? null : voicePair(voices, chosen);
    const voice = pair ? pair[speaker!] : englishVoice(voices);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "en-US";
    u.rate = pair ? MOOT_RATE : 0.95;
    // One voice for both speakers: tell them apart by pitch.
    if (pair && pair[0] === pair[1]) u.pitch = SHARED_PITCH[speaker!];
    u.onend = u.onerror = () => {
      if (!s.speaking && !s.pending) active = false;
      onEnd?.();
    };
    held = u;
    active = true;
    s.speak(u);
  };
  if (speaker !== undefined && !loadVoices(s).length) {
    waiting = true;
    active = true;
    const ready = () => {
      s.removeEventListener?.("voiceschanged", ready);
      window.clearTimeout(timer);
      loadVoices(s);
      say();
    };
    const timer = window.setTimeout(ready, VOICE_WAIT_MS);
    s.addEventListener?.("voiceschanged", ready);
    return;
  }
  loadVoices(s);
  say();
}

let unlocked = false;

/**
 * Prime speech from inside a user gesture.
 *
 * iOS and iPadOS Safari ignore `speak()` until the page has spoken once from
 * a tap. The tour narrates from the render loop, never from a tap, so
 * without this an iPad tour is silent however the narration setting is set.
 * A silent utterance is enough to open the gate.
 *
 * :param force: Prime again even if it has been done. Once was not enough on
 *     an iPad Pro, so turning narration on does it afresh; it also clears a
 *     paused engine, which Safari can leave behind.
 */
export function unlockSpeech(force = false): void {
  if (unlocked && !force) return;
  const s = synth();
  if (!s) return;
  unlocked = true;
  s.resume();
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  s.speak(u);
}

/**
 * Unlock speech on the first tap, click or key press anywhere on the page.
 *
 * :returns: A function that removes the listeners.
 */
export function unlockSpeechOnGesture(): () => void {
  if (typeof window === "undefined") return () => {};
  const events = ["touchend", "click", "keydown"] as const;
  const remove = () => events.forEach((e) => window.removeEventListener(e, onGesture, true));
  function onGesture() {
    unlockSpeech();
    remove();
  }
  events.forEach((e) => window.addEventListener(e, onGesture, true));
  return remove;
}

/**
 * The English voices a listener can choose for a moot, by name, novelty voices
 * left out; empty until the browser has listed its voices.
 */
export function mootVoiceNames(): string[] {
  const s = synth();
  if (!s) return [];
  const names = loadVoices(s)
    .filter((v) => v.lang.toLowerCase().startsWith("en") && !NOVELTY.has(baseName(v)))
    .map((v) => v.name);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

/**
 * Call `fn` whenever the browser's voice list changes.
 *
 * :returns: A function that stops the calls.
 */
export function onVoicesChanged(fn: () => void): () => void {
  const s = synth();
  if (!s?.addEventListener) return () => {};
  s.addEventListener("voiceschanged", fn);
  return () => s.removeEventListener("voiceschanged", fn);
}

/** True where the browser can speak at all. */
export function canSpeak(): boolean {
  return synth() !== null;
}

/** Stop speaking at once. */
export function hush(): void {
  generation++;
  waiting = false;
  active = false;
  synth()?.cancel();
}

/** True while an utterance started by `speak` is still being said. */
export function speaking(): boolean {
  const s = synth();
  if (!s) return false;
  if (waiting) return true;
  // The end event can be lost (tab hidden, voice change); trust the engine too.
  if (active && !s.speaking && !s.pending) active = false;
  return active;
}
