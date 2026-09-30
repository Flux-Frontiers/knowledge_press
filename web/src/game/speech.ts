/**
 * The grove narration, spoken with the browser's own speech synthesis (the
 * Web Speech API). On Apple devices that is the system's voices, the same ones
 * AVSpeechSynthesizer uses; nothing is downloaded. Where there is no speech
 * synthesis (Node, some embedded browsers) every call does nothing.
 */

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** An English voice, the system default if it is English, else the first local one. */
function englishVoice(s: SpeechSynthesis): SpeechSynthesisVoice | undefined {
  const voices = s.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  return voices.find((v) => v.default) ?? voices.find((v) => v.localService) ?? voices[0];
}

let active = false;
/** The utterance in flight: Safari can drop an utterance nothing refers to, and its end event with it. */
let held: SpeechSynthesisUtterance | null = null;

/**
 * Speak `text`, cutting off anything still being said.
 *
 * :param queue: Say it after whatever is being said instead of cutting it off.
 */
export function speak(text: string, queue = false): void {
  const s = synth();
  if (!s) return;
  if (!queue) s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = englishVoice(s);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? "en-US";
  u.rate = 0.95;
  u.onend = u.onerror = () => { if (!s.speaking && !s.pending) active = false; };
  held = u;
  active = true;
  s.speak(u);
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

/** Stop speaking at once. */
export function hush(): void {
  active = false;
  synth()?.cancel();
}

/** True while an utterance started by `speak` is still being said. */
export function speaking(): boolean {
  const s = synth();
  if (!s) return false;
  // The end event can be lost (tab hidden, voice change); trust the engine too.
  if (active && !s.speaking && !s.pending) active = false;
  return active;
}
