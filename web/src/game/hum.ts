/**
 * The visiting craft's sound, made with WebAudio, no files: a low detuned
 * drone with a slow tremolo, and a breath of filtered noise when the iris
 * opens. WebKit only lets audio start inside a user gesture, so the context is
 * created and resumed on the first press or key in the forest.
 */

type Hum = { ctx: AudioContext; out: GainNode };
let hum: Hum | null = null;
let ctx: AudioContext | null = null;

if (typeof window !== "undefined") {
  const unlock = () => {
    try {
      ctx ??= new AudioContext();
      void ctx.resume();
    } catch { /* no WebAudio: the landing plays silent */ }
  };
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

function start(): Hum | null {
  if (hum) return hum;
  if (!ctx || ctx.state !== "running") return null;
  const out = ctx.createGain();
  out.gain.value = 0;
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 380;
  // Two saws a few cents apart beat slowly; a sine an octave up sweetens them.
  for (const [type, f, g] of [["sawtooth", 55, 0.35], ["sawtooth", 55.4, 0.35], ["sine", 110.6, 0.5]] as const) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const gain = ctx.createGain();
    gain.gain.value = g;
    o.connect(gain).connect(low);
    o.start();
  }
  // Tremolo.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const depth = ctx.createGain();
  depth.gain.value = 0.25;
  const trem = ctx.createGain();
  trem.gain.value = 0.75;
  lfo.connect(depth).connect(trem.gain);
  lfo.start();
  low.connect(trem).connect(out).connect(ctx.destination);
  hum = { ctx, out };
  return hum;
}

/** Set the drone's loudness, 0 to 1, eased; a silent forest keeps it at 0. */
export function setHum(level: number) {
  const h = level > 0.001 ? start() : hum;
  if (!h) return;
  h.out.gain.setTargetAtTime(0.18 * Math.min(1, Math.max(0, level)), h.ctx.currentTime, 0.25);
}

/** A soft rush of air, as the iris opens. */
export function sigh() {
  const h = start();
  if (!h) return;
  const { ctx } = h;
  const n = Math.floor(ctx.sampleRate * 1.4);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 1.2;
  band.frequency.setValueAtTime(1800, ctx.currentTime);
  band.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 1.4);
  const g = ctx.createGain();
  g.gain.value = 0.12;
  src.connect(band).connect(g).connect(ctx.destination);
  src.start();
}
