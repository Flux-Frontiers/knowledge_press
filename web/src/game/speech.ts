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
  active = true;
  s.speak(u);
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
