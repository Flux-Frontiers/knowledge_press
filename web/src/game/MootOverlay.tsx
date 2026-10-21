import { ChevronRight, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BOOKS } from "./catalog";
import type { Forest } from "./forest";
import { getMoot, getMootIndex, markText, MOOT_COLORS, mootBooks, readingMs, spokenText, type Moot, type MootEntry, type MootTurn } from "./moots";
import { canSpeak, hush, speak, speaking, unlockSpeech } from "./speech";
import { useGame } from "./store";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; value: T };

/** How long after a turn appears its speech starts; see the playback effect. */
const SPEAK_DELAY_MS = 120;

function useLoad<T>(load: () => Promise<T>, deps: unknown[]): [Load<T>, () => void] {
  const [value, setValue] = useState<Load<T>>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setValue({ state: "loading" });
    load().then(
      (v) => { if (live) setValue({ state: "ready", value: v }); },
      (e: unknown) => { if (live) setValue({ state: "error", message: String((e as Error).message ?? e) }); },
    );
    return () => { live = false; };
  }, [...deps, attempt]);
  return [value, () => setAttempt((n) => n + 1)];
}

/** The Reader's frame: a dimmed backdrop that closes on a click, and a card. */
function Frame({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-bg/60 p-2 sm:p-6" onClick={onClose}>
      <article role="dialog" aria-modal="true" aria-labelledby={label}
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        {children}
      </article>
    </div>
  );
}

function CloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button type="button" autoFocus onClick={onClose}
      className="grid size-11 shrink-0 place-items-center rounded-md text-muted" aria-label={label}>
      <X className="size-5" strokeWidth={1.75} />
    </button>
  );
}

/** The saved moots from moots/index.json: title, date and turns; picking one plays it. */
export function MootList() {
  const close = () => useGame.getState().openMoots(false);
  const [index, retry] = useLoad(getMootIndex, []);
  return (
    <Frame label="moots-title" onClose={close}>
      <header className="flex items-start gap-3 border-b border-border p-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-wide text-muted uppercase">Books that talk to each other</p>
          <h2 id="moots-title" className="font-display text-2xl leading-tight sm:text-3xl">Moots</h2>
        </div>
        <CloseButton onClose={close} label="Close the moots" />
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:px-6">
        {index.state === "error" ? (
          <div className="grid gap-3 text-sm leading-relaxed text-muted">
            <p className="text-fg">The moots could not be fetched: {index.message}.</p>
            <p>
              The forest reads them from <code className="text-fg">moots/index.json</code>, which{" "}
              <code className="text-fg">gutenkg export-web-moots</code> writes.
            </p>
            <button type="button" onClick={retry}
              className="min-h-11 justify-self-start rounded-md bg-primary px-4 text-primary-fg">Try again</button>
          </div>
        ) : index.state === "loading" ? (
          <p className="text-sm text-muted">Gathering the moots...</p>
        ) : index.value.length === 0 ? (
          <p className="text-sm text-muted">No moots have been saved yet.</p>
        ) : (
          <ul className="grid gap-2">
            {index.value.map((m) => <MootRow key={m.id} moot={m} />)}
          </ul>
        )}
      </div>
    </Frame>
  );
}

function MootRow({ moot }: { moot: MootEntry }) {
  return (
    <li>
      <button type="button"
        onClick={() => {
          // Speech is only allowed from a tap, and this is one; the moot speaks once it has loaded.
          unlockSpeech();
          useGame.getState().playMoot(moot.id);
        }}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-border bg-bg/40 px-4 py-3 text-left hover:border-primary">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg leading-snug">{moot.title}</span>
          <span className="text-xs text-muted tabular-nums">{moot.date} · {moot.turns} turns</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
      </button>
    </li>
  );
}

/** A saved moot, played turn by turn: one speech bubble per turn, each spoken in its tree's voice. */
export function MootPlayer({ id, forest }: { id: string; forest: Forest }) {
  const close = () => useGame.getState().playMoot(null);
  const [moot, retry] = useLoad(() => getMoot(id), [id]);
  return (
    <Frame label="moot-title" onClose={close}>
      {moot.state === "ready" ? <MootPlayback moot={moot.value} forest={forest} onClose={close} /> : (
        <>
          <header className="flex items-start gap-3 border-b border-border p-4 sm:px-6">
            <h2 id="moot-title" className="min-w-0 flex-1 font-display text-2xl leading-tight">Moot</h2>
            <CloseButton onClose={close} label="Close the moot" />
          </header>
          <div className="grid gap-3 p-4 text-sm text-muted sm:px-6">
            {moot.state === "error" ? (<>
              <p className="text-fg">The moot could not be fetched: {moot.message}.</p>
              <button type="button" onClick={retry}
                className="min-h-11 justify-self-start rounded-md bg-primary px-4 text-primary-fg">Try again</button>
            </>) : <p>Opening the moot...</p>}
          </div>
        </>
      )}
    </Frame>
  );
}

function MootPlayback({ moot, forest, onClose }: { moot: Moot; forest: Forest; onClose: () => void }) {
  const names = [moot.trees[0].title, moot.trees[1].title] as const;
  // The trees standing in this forest, by side; a tree the catalog lacks plays unringed.
  const slugs = useMemo(() => mootBooks(moot, BOOKS).map((b) =>
    b && forest.trees.some((t) => t.book.slug === b.slug) ? b.slug : null), [moot, forest]);
  const voiced = canSpeak();
  // "Read moots aloud" in Settings; the speaker button here flips the same setting.
  const speakMoots = useGame((s) => s.preferences.speakMoots);
  const mootVoices = useGame((s) => s.preferences.mootVoices);
  const muted = !voiced || !speakMoots;
  const [shown, setShown] = useState(1);
  const [playing, setPlaying] = useState(true);
  const paused = useGame((s) => s.paused);
  const page = useRef<HTMLDivElement>(null);
  const total = moot.turns.length;
  const current = moot.turns[shown - 1];

  // Esc settings, or the window losing focus, pause the moot with the forest.
  useEffect(() => { if (paused) setPlaying(false); }, [paused]);

  // Speak the newest turn, or give it reading time when muted; then show the next.
  useEffect(() => {
    if (!current || !playing) return;
    let live = true;
    const advance = () => {
      if (!live) return;
      live = false;
      if (shown < total) setShown(shown + 1);
      else setPlaying(false);
    };
    if (muted) {
      const timer = window.setTimeout(advance, readingMs(current.text));
      return () => {
        live = false;
        window.clearTimeout(timer);
      };
    }
    // Start a moment later, and cancel the start on cleanup: React's dev
    // StrictMode mounts, cleans up and mounts again, and a turn started on the
    // first mount would be spoken twice (Safari does not reliably cancel an
    // utterance it has only just queued). The gap also keeps a new utterance
    // from following hush() in the same instant.
    let poll = 0;
    const start = window.setTimeout(() => {
      speak(spokenText(current.text), false, {
        speaker: current.speaker, onEnd: advance, chosen: mootVoices, wants: [moot.trees[0].voice, moot.trees[1].voice],
      });
      // Safari can drop the end event; trust the engine as well.
      poll = window.setInterval(() => { if (!speaking()) advance(); }, 500);
    }, SPEAK_DELAY_MS);
    return () => {
      live = false;
      window.clearTimeout(start);
      window.clearInterval(poll);
      hush();
    };
  }, [current, shown, total, playing, muted, mootVoices, moot]);

  // Ring the speaking tree in the forest.
  useEffect(() => {
    const slug = current ? slugs[current.speaker] : null;
    useGame.getState().setMootSpeaker(slug && current ? { slug, color: MOOT_COLORS[current.speaker] } : null);
  }, [current, slugs]);
  useEffect(() => () => { hush(); useGame.getState().setMootSpeaker(null); }, []);

  useEffect(() => {
    page.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [shown]);

  const done = shown >= total;
  function toggleVoice() {
    if (!speakMoots) unlockSpeech(true);
    useGame.getState().setPreferences({ speakMoots: !speakMoots });
  }
  function togglePlay() {
    unlockSpeech();
    if (playing) setPlaying(false);
    else {
      if (done && !speaking()) setShown(1);
      setPlaying(true);
    }
  }

  return (
    <>
      <header className="flex items-start gap-3 border-b border-border p-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs tracking-wide text-muted uppercase">A moot{moot.topic ? ` on ${moot.topic}` : ""}</p>
          <h2 id="moot-title" className="font-display text-2xl leading-tight sm:text-3xl">
            <em style={{ color: MOOT_COLORS[0] }}>{names[0]}</em> and <em style={{ color: MOOT_COLORS[1] }}>{names[1]}</em>
          </h2>
          <p className="text-sm text-muted">{moot.date}{moot.model ? ` · ${moot.model}` : ""}</p>
        </div>
        <CloseButton onClose={onClose} label="Close the moot" />
      </header>

      <div ref={page} className="grid min-h-0 flex-1 content-start gap-4 overflow-auto px-4 py-5 sm:px-6">
        {moot.turns.slice(0, shown).map((t) => <Bubble key={t.turn} turn={t} names={names} speaking={playing && t === current} />)}
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-border p-3 sm:px-6">
        <div className="flex items-center gap-1">
          <button type="button" onClick={togglePlay}
            className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm text-fg">
            {playing ? <><Pause className="size-4" strokeWidth={1.75} /> Pause</> : <><Play className="size-4" strokeWidth={1.75} /> {done ? "Play again" : "Play"}</>}
          </button>
          {voiced ? (
            <button type="button" onClick={toggleVoice} aria-pressed={speakMoots}
              className="grid size-11 place-items-center rounded-md text-muted"
              aria-label={speakMoots ? "Stop reading moots aloud" : "Read moots aloud"}
              title={speakMoots ? "Narration on" : "Narration off"}>
              {speakMoots ? <Volume2 className="size-4" strokeWidth={1.75} /> : <VolumeX className="size-4" strokeWidth={1.75} />}
            </button>
          ) : <span className="px-3 text-xs text-muted">No speech in this browser</span>}
        </div>
        <span className="text-xs text-muted tabular-nums">Turn {shown} of {total}</span>
        <button type="button" disabled={done} onClick={() => setShown(shown + 1)}
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm text-fg disabled:text-faint">
          Next <ChevronRight className="size-4" strokeWidth={1.75} />
        </button>
      </footer>
    </>
  );
}

/** One turn: the first tree's on the left, the second's on the right, each in its own color. */
function Bubble({ turn, names, speaking }: { turn: MootTurn; names: readonly [string, string]; speaking: boolean }) {
  const color = MOOT_COLORS[turn.speaker];
  const left = turn.speaker === 0;
  const spans = useMemo(() => markText(turn.text, names), [turn.text, names]);
  return (
    <section className={"w-[88%] " + (left ? "justify-self-start" : "justify-self-end")}>
      <div className="rounded-xl border-2 bg-bg/50 px-4 py-3" style={{ borderColor: color, boxShadow: speaking ? `0 0 18px ${color}55` : undefined }}>
        <p className={"mb-1 font-display text-lg font-semibold italic " + (left ? "" : "text-right")} style={{ color }}>
          [{turn.turn}] {names[turn.speaker]}
        </p>
        <p className="font-display text-lg leading-relaxed text-fg/95">
          {spans.map((s, i) =>
            s.kind === "name" ? <strong key={i} className="italic" style={{ color: MOOT_COLORS[s.side!] }}>{s.text}</strong>
            : s.kind === "quote" ? <strong key={i} className="text-fg">{s.text}</strong>
            : s.kind === "tag" ? <span key={i} className="text-sm text-faint">{s.text}</span>
            : s.text)}
        </p>
      </div>
      {turn.cites.length ? (
        <p className={"mt-1 px-2 text-xs text-faint " + (left ? "" : "text-right")}>
          cites {turn.cites.map((c) => `${c.tag} ${c.label || c.node_id}`).join(", ")}
        </p>
      ) : null}
    </section>
  );
}
