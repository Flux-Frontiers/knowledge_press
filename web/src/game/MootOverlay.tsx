import { ChevronRight, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BOOKS } from "./catalog";
import type { Forest } from "./forest";
import type { Book } from "./catalogTypes";
import { LIVE_TURNS, nextLiveTurn, startLiveMoot, stepAfter, stopLiveMoot, type LiveRequest, type WorkerSettings } from "./liveMoots";
import { getMoot, getMootIndex, markText, MOOT_COLORS, mootBooks, readingMs, spokenText, type Moot, type MootEntry, type MootTurn } from "./moots";
import { canSpeak, hush, speak, speaking, unlockSpeech } from "./speech";
import { useGame } from "./store";

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; value: T };

/** How long after a turn appears its speech starts; see the playback effect. */
const SPEAK_DELAY_MS = 120;
/** How long after the live player opens it asks the worker; see LiveMootPlayer. */
const START_DELAY_MS = 120;

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
        <HoldMoot />
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

const bookKey = (b: Book) => `${b.genre}/${b.book}`;
const bookLabel = (b: Book) => `${b.title} - ${b.author}`;

/** Start a live moot: two books, a topic and a length; a worker makes each turn. */
function HoldMoot() {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [topic, setTopic] = useState("");
  const [turns, setTurns] = useState(8);
  const worker = useGame((s) => s.preferences.mootWorker);
  const byLabel = useMemo(() => new Map(BOOKS.map((b) => [bookLabel(b), b])), []);
  const a = byLabel.get(first);
  const b = byLabel.get(second);
  const ready = Boolean(a && b && a !== b);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="mb-4 min-h-11 w-full rounded-lg border border-dashed border-border px-4 text-left text-sm text-fg hover:border-primary">
        Hold a new moot<span className="block text-xs text-muted">Pick two books and a topic; a GutenbergKG worker makes each turn as you watch.</span>
      </button>
    );
  }
  return (
    <form className="mb-5 grid gap-3 rounded-lg border border-border bg-bg/40 p-4 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!a || !b || a === b) return;
        // Speech is only allowed from a tap, and this is one; the turns speak as they arrive.
        unlockSpeech();
        useGame.getState().holdMoot({ books: [bookKey(a), bookKey(b)], topic: topic.trim(), turns });
      }}>
      <datalist id="moot-books">{BOOKS.map((bk) => <option key={bk.slug} value={bookLabel(bk)} />)}</datalist>
      <label className="grid gap-1">First book
        <input list="moot-books" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Type to search the books"
          className="rounded-md border border-border bg-bg p-2" style={{ borderColor: a ? MOOT_COLORS[0] : undefined }} />
      </label>
      <label className="grid gap-1">Second book
        <input list="moot-books" value={second} onChange={(e) => setSecond(e.target.value)} placeholder="Type to search the books"
          className="rounded-md border border-border bg-bg p-2" style={{ borderColor: b ? MOOT_COLORS[1] : undefined }} />
      </label>
      <label className="grid gap-1">Topic
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="virtue, jealousy, the sea..."
          className="rounded-md border border-border bg-bg p-2" />
      </label>
      <label className="flex items-center justify-between gap-4">Turns
        <select value={turns} onChange={(e) => setTurns(Number(e.target.value))} className="rounded-md border border-border bg-bg p-2">
          {LIVE_TURNS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      {a && b && a === b ? <p className="text-xs text-muted">Pick two different books.</p> : null}
      <p className="text-xs text-muted">Worker: <code className="text-fg">{worker}</code>. Change it in Settings, under Live moots.</p>
      <div className="flex gap-2">
        <button type="submit" disabled={!ready} className="min-h-11 rounded-md bg-primary px-4 text-primary-fg disabled:opacity-50">Start the moot</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-md px-4 text-muted">Cancel</button>
      </div>
    </form>
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

/** A live moot's progress, which MootPlayback waits on when it catches up. */
type LiveState = { total: number; done: boolean; error: string | null; retry: () => void };

/**
 * A moot a worker is holding: started on open, each turn asked for as soon as
 * the last arrives (so the worker makes the next while this one is spoken),
 * and stopped on the worker when the player closes early.
 */
export function LiveMootPlayer({ request, forest }: { request: LiveRequest; forest: Forest }) {
  const close = () => useGame.getState().playMoot(null);
  const url = useGame((s) => s.preferences.mootWorker);
  const token = useGame((s) => s.preferences.mootToken);
  // The worker this moot started on, kept for the stop on close.
  const worker = useRef<WorkerSettings>({ url, token });
  const mootId = useRef<string | null>(null);
  const [moot, setMoot] = useState<Moot | null>(null);
  const [total, setTotal] = useState(request.turns);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    // Start a moment later, and cancel on cleanup: React's dev StrictMode
    // mounts twice, and each start would hold a moot on the worker.
    const timer = window.setTimeout(async () => {
      try {
        let id = mootId.current;
        if (!id) {
          const started = await startLiveMoot(worker.current, request);
          if (!live) { void stopLiveMoot(worker.current, started.mootId); return; }
          mootId.current = id = started.mootId;
          setMoot(started.moot);
          setTotal(started.total);
        }
        for (;;) {
          const next = await nextLiveTurn(worker.current, id);
          if (!live) return;
          setMoot((m) => (m ? { ...m, turns: [...m.turns, next.turn] } : m));
          if (next.done) {
            mootId.current = null;
            setDone(true);
            return;
          }
        }
      } catch (e: unknown) {
        if (live) setError(String((e as Error).message ?? e));
      }
    }, START_DELAY_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [attempt, request]);

  // Closing before the end frees the moot on the worker.
  useEffect(() => () => {
    if (mootId.current) void stopLiveMoot(worker.current, mootId.current);
  }, []);

  const retry = () => { setError(null); setAttempt((n) => n + 1); };
  return (
    <Frame label="moot-title" onClose={close}>
      {moot ? <MootPlayback moot={moot} forest={forest} onClose={close} live={{ total, done, error, retry }} /> : (
        <>
          <header className="flex items-start gap-3 border-b border-border p-4 sm:px-6">
            <h2 id="moot-title" className="min-w-0 flex-1 font-display text-2xl leading-tight">A live moot</h2>
            <CloseButton onClose={close} label="Close the moot" />
          </header>
          <div className="grid gap-3 p-4 text-sm leading-relaxed text-muted sm:px-6">
            {error ? (<>
              <p className="text-fg">The moot could not start: {error}.</p>
              <p>
                It needs a GutenbergKG worker at <code className="text-fg">{worker.current.url}</code> that allows this
                page. Safari cannot reach a worker on this computer from the published forest; use the forest's dev
                server, or Chrome. The Moots guide has the setup.
              </p>
              <button type="button" onClick={retry}
                className="min-h-11 justify-self-start rounded-md bg-primary px-4 text-primary-fg">Try again</button>
            </>) : <p>Asking the worker to seat the two books...</p>}
          </div>
        </>
      )}
    </Frame>
  );
}

function MootPlayback({ moot, forest, onClose, live }: { moot: Moot; forest: Forest; onClose: () => void; live?: LiveState }) {
  const names = [moot.trees[0].title, moot.trees[1].title] as const;
  // The trees standing in this forest, by side; a tree the catalog lacks plays unringed.
  // Keyed on the trees, which stay the same object as a live moot's turns arrive.
  const trees = moot.trees;
  const slugs = useMemo(() => mootBooks({ ...moot, trees }, BOOKS).map((b) =>
    b && forest.trees.some((t) => t.book.slug === b.slug) ? b.slug : null), [trees, forest]);
  const voiced = canSpeak();
  // "Read moots aloud" in Settings; the speaker button here flips the same setting.
  const speakMoots = useGame((s) => s.preferences.speakMoots);
  const mootVoices = useGame((s) => s.preferences.mootVoices);
  const muted = !voiced || !speakMoots;
  const [shown, setShown] = useState(1);
  const [playing, setPlaying] = useState(true);
  const paused = useGame((s) => s.paused);
  const page = useRef<HTMLDivElement>(null);
  const arrived = moot.turns.length;
  const total = live ? live.total : arrived;
  const liveDone = live ? live.done : true;
  const current = moot.turns[shown - 1];
  // A live moot can catch up with its worker: the next turn is still being made.
  const waiting = !current && !liveDone && !live?.error;
  const waitingSide = (shown - 1) % 2 as 0 | 1;
  // Read by the playback effect when a turn ends, not watched by it: a live
  // moot's turns arriving must not restart the turn being played.
  const progress = useRef({ arrived, liveDone });
  progress.current = { arrived, liveDone };

  // Esc settings, or the window losing focus, pause the moot with the forest.
  useEffect(() => { if (paused) setPlaying(false); }, [paused]);

  // Speak the newest turn, or give it reading time when muted; then show the next.
  useEffect(() => {
    if (!current || !playing) return;
    let live = true;
    const advance = () => {
      if (!live) return;
      live = false;
      const next = stepAfter(shown, progress.current.arrived, progress.current.liveDone);
      if (next === null) setPlaying(false);
      else setShown(next);
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
        speaker: current.speaker, onEnd: advance, chosen: mootVoices, wants: [trees[0].voice, trees[1].voice],
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
  }, [current, shown, playing, muted, mootVoices, trees]);

  // Ring the speaking tree in the forest, or the one a live moot is waiting on.
  useEffect(() => {
    const side = current ? current.speaker : waiting ? waitingSide : null;
    const slug = side === null ? null : slugs[side];
    useGame.getState().setMootSpeaker(slug && side !== null ? { slug, color: MOOT_COLORS[side] } : null);
  }, [current, waiting, waitingSide, slugs]);
  useEffect(() => () => { hush(); useGame.getState().setMootSpeaker(null); }, []);

  useEffect(() => {
    page.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [shown]);

  const done = liveDone && shown >= arrived;
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
          <p className="text-sm text-muted">{moot.date}{moot.model ? ` · ${moot.model}` : ""}{live ? " · live" : ""}</p>
        </div>
        <CloseButton onClose={onClose} label="Close the moot" />
      </header>

      <div ref={page} className="grid min-h-0 flex-1 content-start gap-4 overflow-auto px-4 py-5 sm:px-6">
        {moot.turns.slice(0, shown).map((t) => <Bubble key={t.turn} turn={t} names={names} speaking={playing && t === current} />)}
        {waiting ? (
          <p className={"px-2 text-sm italic " + (waitingSide === 0 ? "justify-self-start" : "justify-self-end")}
            style={{ color: MOOT_COLORS[waitingSide] }} aria-live="polite">
            {names[waitingSide]} is thinking...
          </p>
        ) : null}
        {live?.error ? (
          <div className="grid gap-2 text-sm text-muted" role="alert">
            <p className="text-fg">The next turn did not come: {live.error}.</p>
            <button type="button" onClick={live.retry}
              className="min-h-11 justify-self-start rounded-md bg-primary px-4 text-primary-fg">Try again</button>
          </div>
        ) : null}
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
        <span className="text-xs text-muted tabular-nums">Turn {Math.min(shown, total)} of {total}</span>
        <button type="button" disabled={shown >= arrived} onClick={() => setShown(shown + 1)}
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
