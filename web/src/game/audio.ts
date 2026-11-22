/**
 * The forest's one WebAudio context, shared by the visitor's hum (hum.ts) and
 * the outdoor sounds (ambience.ts). WebKit only lets audio start inside a user
 * gesture, so the context is created and resumed on the first press or key.
 */

let ctx: AudioContext | null = null;

if (typeof window !== "undefined") {
  const unlock = () => {
    try {
      ctx ??= new AudioContext();
      void ctx.resume();
    } catch { /* no WebAudio: the forest plays silent */ }
  };
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

/** The context once a gesture has started it, else null. */
export function audioContext(): AudioContext | null {
  return ctx && ctx.state === "running" ? ctx : null;
}
