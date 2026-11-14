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

/** What a moot speaker should sound like: its author's gender and accent, from the pack. */
export type VoiceWant = { gender: "male" | "female" | null; accent: string | null };
const ANY: VoiceWant = { gender: null, accent: null };

/**
 * Voices whose gender is known, best first within each; browsers do not
 * report gender, so a voice not listed here is never picked for a gendered
 * speaker (a listener can still choose it in Settings). macOS and iOS first,
 * then Chrome's Google voices and Edge's Microsoft voices, then optional macOS
 * downloads.
 */
const GENDERED: Record<"male" | "female", readonly string[]> = {
  male: ["Daniel", "Google UK English Male", "Microsoft Ryan", "Microsoft Guy", "Microsoft Davis",
    "Microsoft Andrew", "Microsoft Christopher", "Microsoft George", "Microsoft Thomas", "Microsoft David",
    "Arthur", "Jamie", "Oliver", "Tom", "Alex", "Aaron", "Evan", "Nathan", "Lee", "Gordon"],
  female: ["Samantha", "Google US English", "Google UK English Female", "Microsoft Aria", "Microsoft Jenny",
    "Microsoft Ava", "Microsoft Sonia", "Microsoft Libby", "Microsoft Zira", "Microsoft Hazel", "Moira", "Karen",
    "Tessa", "Serena", "Kate", "Stephanie", "Ava", "Allison", "Susan", "Zoe", "Fiona", "Victoria"],
};

/**
 * Voices that always speak where they are listed: the six macOS and iOS ship
 * with (exactly the English voices Safari offers a page), plus Chrome's and
 * Edge's own voices (by name). Chrome also lists every optional macOS
 * download whether or not it is installed, and a listed voice that cannot
 * speak becomes the browser's default, so these come first.
 */
const BUILT_IN = new Set(["Daniel", "Samantha", "Karen", "Moira", "Tessa", "Rishi"]);

/** Accents close to each wanted one, nearest first. */
const ACCENT_FAMILY: Record<string, readonly string[]> = {
  "en-gb": ["en-gb", "en-ie", "en-au", "en-nz", "en-za"],
  "en-us": ["en-us", "en-ca"],
};

/** Pitch for each speaker when both share one voice: the second tree speaks deeper. */
const SHARED_PITCH: readonly [number, number] = [1, 0.8];

/** A voice's name without its locale suffix: "Samantha (English (US))" is "Samantha". */
function baseName(v: Voice): string {
  return v.name.replace(/\s*\(.*$/, "").trim();
}

function lang(v: Voice): string {
  return v.lang.toLowerCase().replace("_", "-");
}

/** A known voice's gender and its place in that gender's list, or null. */
function known(v: Voice): { gender: "male" | "female"; order: number } | null {
  const name = baseName(v);
  for (const gender of ["male", "female"] as const) {
    const order = GENDERED[gender].findIndex((n) => name === n || name.startsWith(`${n} `));
    if (order >= 0) return { gender, order };
  }
  return null;
}

/** Order two equal-length number lists, first difference deciding. */
function compareKeys(x: readonly number[], y: readonly number[]): number {
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return 0;
}

function builtIn(v: Voice): boolean {
  const name = baseName(v);
  return BUILT_IN.has(name) || name.startsWith("Google ") || name.startsWith("Microsoft ");
}

/**
 * The best English voice for one speaker.
 *
 * A gendered speaker takes only a voice known to be of that gender. Voices
 * that always speak come first, then the nearest accent (exact, then the
 * same family: British with Irish and Australian, American with Canadian),
 * then an Enhanced or Premium copy, then the gender list's order. With no
 * accent (a translated author) the system default's accent is wanted; with
 * no gender, the system default voice.
 *
 * :param want: The speaker's gender and accent.
 * :param english: The browser's English voices, novelty voices left out.
 * :param fallbackAccent: The accent wanted when `want` names none.
 * :param avoid: A voice already taken, avoided by base name.
 */
function pickVoice<V extends Voice>(want: VoiceWant, english: V[], fallbackAccent: string, avoid?: V): V | undefined {
  const free = english.filter((v) => !avoid || baseName(v) !== baseName(avoid));
  if (!want.gender) return englishVoice(free);
  const accent = (want.accent ?? fallbackAccent).toLowerCase();
  const family = ACCENT_FAMILY[accent] ?? [accent];
  const accentRank = (v: V) => (family.indexOf(lang(v)) + 1 || family.length + 1);
  const scored = free.flatMap((v) => {
    const k = known(v);
    if (k?.gender !== want.gender) return [];
    return [{ v, key: [builtIn(v) ? 0 : 1, accentRank(v), /\((Enhanced|Premium)\)/.test(v.name) ? 0 : 1, k.order] }];
  });
  scored.sort((x, y) => compareKeys(x.key, y.key));
  return scored[0]?.v;
}

/**
 * Voices for a moot's two speakers, each matching its author.
 *
 * macOS lists one voice under several locales ("Samantha (English (US))"
 * twice), so voices are compared by base name, and novelty voices are
 * skipped. A voice the listener chose in Settings wins for its speaker when
 * the browser has it. Otherwise each speaker gets `pickVoice` for its
 * author, the second avoiding the first's voice; when no other voice fits,
 * both share one, which `speak` tells apart by pitch.
 *
 * :param all: The browser's voices.
 * :param chosen: Each speaker's chosen voice name; "" for automatic.
 * :param wants: Each speaker's author gender and accent.
 */
export function voicePair<V extends Voice>(
  all: V[], chosen: readonly [string, string] = ["", ""], wants: readonly [VoiceWant, VoiceWant] = [ANY, ANY],
): [V | undefined, V | undefined] {
  const english = all.filter((v) => v.lang.toLowerCase().startsWith("en") && !NOVELTY.has(baseName(v)));
  const fallbackAccent = englishVoice(all)?.lang ?? "en-US";
  const named = (i: 0 | 1) => (chosen[i] ? all.find((v) => v.name === chosen[i]) : undefined);
  const first = named(0) ?? pickVoice(wants[0], english, fallbackAccent) ?? englishVoice(english) ?? englishVoice(all);
  const second = named(1)
    ?? pickVoice(wants[1], english, fallbackAccent, first)
    ?? pickVoice(wants[1], english, fallbackAccent)
    ?? first;
  return [first, second];
}

/**
 * The voice for reading a book aloud: the one chosen in Settings when this
 * browser has it, else `pickVoice` for the book's author, else the system's
 * English voice.
 *
 * Unlike a moot line, a book is read in long utterances, so the automatic
 * choice keeps to voices on the device where there are any: Chrome's Google
 * voices are fetched over the network, and those are known to go quiet
 * partway through a long utterance with no end event.
 *
 * :param all: The browser's voices.
 * :param chosen: The chosen voice name; "" for automatic.
 * :param want: The author's gender and accent; omitted, the system voice.
 */
export function readingVoice<V extends Voice>(all: V[], chosen = "", want: VoiceWant = ANY): V | undefined {
  const english = all.filter((v) => v.lang.toLowerCase().startsWith("en") && !NOVELTY.has(baseName(v)));
  const local = english.filter((v) => v.localService);
  return (chosen ? all.find((v) => v.name === chosen) : undefined)
    ?? (local.length ? pickVoice(want, local, englishVoice(all)?.lang ?? "en-US") : undefined)
    ?? pickVoice(want, english, englishVoice(all)?.lang ?? "en-US")
    ?? englishVoice(english)
    ?? englishVoice(all);
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

/** A moot line: who says it, in which voices, and what to do when it ends. */
export type MootLine = {
  /** 0 or 1, for one of `voicePair`'s voices. */
  speaker: 0 | 1;
  /** Called when the utterance ends or fails. */
  onEnd?: () => void;
  /** Each speaker's chosen voice name; "" for automatic. */
  chosen?: readonly [string, string];
  /** Each speaker's author gender and accent. */
  wants?: readonly [VoiceWant, VoiceWant];
};

/**
 * Speak `text`, cutting off anything still being said.
 *
 * A moot line needs its voices by name. Right after the browser starts its
 * voice list can still be empty, and speaking then falls back to the
 * default voice, so a moot line waits for the list (up to VOICE_WAIT_MS)
 * first.
 *
 * :param queue: Say it after whatever is being said instead of cutting it off.
 * :param line: For a moot line, spoken at `MOOT_RATE` in its speaker's voice;
 *     omitted, the usual voice at the narration rate.
 */
export function speak(text: string, queue = false, line?: MootLine): void {
  const s = synth();
  if (!s) return;
  // Overtake first: a cancel can end a reading's utterance at once, and it
  // must see that someone else is speaking.
  const turn = ++generation;
  if (!queue) s.cancel();
  const say = () => {
    waiting = false;
    if (turn !== generation) return;
    const u = new SpeechSynthesisUtterance(text);
    const pair = line ? voicePair(voices, line.chosen, line.wants) : null;
    const voice = pair && line ? pair[line.speaker] : englishVoice(voices);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "en-US";
    u.rate = pair ? MOOT_RATE : 0.95;
    // One voice for both speakers: tell them apart by pitch.
    if (pair && line && pair[0] === pair[1]) u.pitch = SHARED_PITCH[line.speaker];
    u.onend = u.onerror = () => {
      if (!s.speaking && !s.pending) active = false;
      line?.onEnd?.();
    };
    held = u;
    active = true;
    s.speak(u);
  };
  if (line && !loadVoices(s).length) {
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

// ---- Reading a chapter aloud -----------------------------------------------

/** idle: nothing to read. playing: a block is being said. paused: stopped at a block, to go on from. */
export type ReadingState = "idle" | "playing" | "paused";

/** A chapter to read aloud, one block per utterance. */
export type ReadingRequest = {
  /** Each block's spoken text; "" for a block that is not said (a note, a caption). */
  blocks: readonly string[];
  /** The block to start at. */
  from: number;
  /** The author's gender and accent, for the automatic voice. */
  want?: VoiceWant;
  /** The voice chosen in Settings; "" for automatic. */
  chosen?: string;
  rate?: number;
  /** Called whenever the state or the current block changes. */
  onChange?: (state: ReadingState, block: number) => void;
  /** Called once the last block has been said. */
  onDone?: () => void;
};

type Reading = ReadingRequest & {
  state: ReadingState;
  at: number;
  /** The utterance saying block `at`; ends of any other are stale. */
  utterance: SpeechSynthesisUtterance | null;
  /** Paused with `pause()`, so `resume()` goes on mid-sentence. */
  heldByEngine: boolean;
  /** When the engine last showed progress (start, word boundary). */
  progress: number;
  /** The block's voice is on the device; a network voice may send no word boundaries to watch. */
  local: boolean;
};

let current: Reading | null = null;

/**
 * How long after the page comes back the reading may show no progress
 * before its block is said again. iPadOS stops speech on lock and leaves
 * the engine stuck, with no end and no error, until it is cancelled; macOS
 * goes on speaking, and its word boundaries keep this from firing.
 */
const STUCK_MS = 1500;
let watchingVisibility = false;

function setState(r: Reading, state: ReadingState, at = r.at): void {
  r.state = state;
  r.at = at;
  r.onChange?.(state, at);
}

function readBlock(r: Reading, from: number): void {
  const s = synth();
  if (!s || current !== r) return;
  let i = from;
  while (i < r.blocks.length && !r.blocks[i]!.trim()) i++;
  if (i >= r.blocks.length) {
    current = null;
    r.utterance = null;
    setState(r, "idle", 0);
    r.onDone?.();
    return;
  }
  // Starting a block overtakes any narration line still waiting for voices.
  const turn = ++generation;
  waiting = false;
  const u = new SpeechSynthesisUtterance(r.blocks[i]!);
  const voice = readingVoice(loadVoices(s), r.chosen, r.want);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.rate = r.rate ?? 0.95;
  r.local = voice?.localService !== false;
  u.onstart = u.onboundary = () => { r.progress = Date.now(); };
  const ended = (failed: boolean) => {
    if (current !== r || r.utterance !== u) return; // a block said again, or a stopped reading
    r.utterance = null;
    // Someone else spoke (narration, a moot), or the block was cut off: a
    // cancel fires an error, though on iPadOS sometimes an end. Wait at this block.
    if (failed || turn !== generation) setState(r, "paused");
    else readBlock(r, i + 1);
  };
  u.onend = () => ended(false);
  u.onerror = () => ended(true);
  r.utterance = u;
  r.heldByEngine = false;
  r.progress = Date.now();
  held = u;
  setState(r, "playing", i);
  s.speak(u);
}

function watchVisibility(): void {
  if (watchingVisibility || typeof document === "undefined") return;
  watchingVisibility = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const r = current;
    // Paused across a lock: the held engine may be stuck too, so play says the block again.
    if (r?.state === "paused" && r.heldByEngine) {
      r.heldByEngine = false;
      r.utterance = null;
      synth()?.resume();
      synth()?.cancel();
      return;
    }
    if (!r || r.state !== "playing" || !r.local) return;
    const back = Date.now();
    window.setTimeout(() => {
      if (current !== r || r.state !== "playing" || r.progress > back) return;
      const at = r.at;
      r.utterance = null;
      synth()?.cancel();
      readBlock(r, at);
    }, STUCK_MS);
  });
}

/**
 * Read a chapter aloud from a block, one block per utterance, cutting off
 * any narration or moot. Call it from a tap the first time: iOS speaks only
 * after one.
 */
export function readAloud(request: ReadingRequest): void {
  const s = synth();
  if (!s) return;
  if (current) {
    current.utterance = null;
    if (current.heldByEngine) s.resume(); // or the paused engine holds the new utterance
  }
  s.cancel();
  watchVisibility();
  const r: Reading = { ...request, state: "idle", at: request.from, utterance: null, heldByEngine: false, progress: 0, local: true };
  current = r;
  readBlock(r, request.from);
}

/** Pause the reading where it is. */
export function pauseReading(): void {
  const r = current;
  const s = synth();
  if (!r || !s || r.state !== "playing") return;
  s.pause();
  r.heldByEngine = true;
  setState(r, "paused");
}

/**
 * Go on with a paused reading: mid-sentence after `pauseReading`, or from
 * the start of its block when another speaker had cut it off.
 */
export function resumeReading(): void {
  const r = current;
  const s = synth();
  if (!r || !s || r.state !== "paused") return;
  if (r.heldByEngine && r.utterance) {
    s.resume();
    r.heldByEngine = false;
    r.progress = Date.now();
    setState(r, "playing");
  } else {
    readBlock(r, r.at);
  }
}

/** Stop reading and forget the chapter. */
export function stopReading(): void {
  const r = current;
  if (!r) return;
  current = null;
  r.utterance = null;
  const s = synth();
  if (s) {
    // A paused engine would hold the next utterance, whoever speaks it.
    if (r.heldByEngine) s.resume();
    s.cancel();
  }
  setState(r, "idle", r.at);
}

/** The reading's state; "idle" when nothing is being read. */
export function readingState(): ReadingState {
  return current?.state ?? "idle";
}
