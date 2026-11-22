import { AArrowDown, AArrowUp, ChevronLeft, ChevronRight, Pause, Play, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Book } from "./catalog";
import { useGame } from "./store";
import { getBook, type Chapter } from "./bookText";
import { blockLines, type Block, type Run } from "./chapterBlocks";
import { READING_SIZES, type ReadingSize } from "./preferences";
import { canSpeak, type ReadingState } from "./speech";
import { blocksOf, readBook, stopBook, toggleBook } from "./bookReading";

const SIZES = Object.keys(READING_SIZES) as ReadingSize[];

/** The chapter each book was left at, for this session. */
const lastChapter = new Map<string, number>();

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; value: T };

/** A book's text from its static books/<slug>.json: a chapter picker, the chapter, and previous / next. */
export function ReaderPanel({ book }: { book: Book }) {
  const close = () => useGame.getState().openReader(null);
  const [chapters, setChapters] = useState<Load<Chapter[]>>({ state: "loading" });
  const [index, setIndex] = useState(() => {
    const { bookReading, preferences } = useGame.getState();
    if (bookReading?.slug === book.slug) return bookReading.chapter;
    return lastChapter.get(book.slug) ?? preferences.readingAt[book.slug]?.[0] ?? 0;
  });
  const [attempt, setAttempt] = useState(0);
  const page = useRef<HTMLDivElement>(null);
  const size = useGame((s) => s.preferences.readingSize);
  const step = (by: number) => {
    const next = SIZES[SIZES.indexOf(size) + by];
    if (next) useGame.getState().setPreferences({ readingSize: next });
  };

  useEffect(() => {
    let live = true;
    setChapters({ state: "loading" });
    getBook(book.slug).then(
      (value) => {
        if (!live) return;
        setChapters({ state: "ready", value });
        // A chapter remembered from a longer listing (the text re-exported) would strand the pager.
        setIndex((i) => Math.max(0, Math.min(i, value.length - 1)));
      },
      (e: unknown) => { if (live) setChapters({ state: "error", message: String((e as Error).message ?? e) }); },
    );
    return () => { live = false; };
  }, [book.slug, attempt]);

  const list = chapters.state === "ready" ? chapters.value : [];
  const current = list[Math.min(index, list.length - 1)];
  const shown = Math.min(index, list.length - 1);
  const blocks = useMemo(() => blocksOf(list, shown), [list, shown]);

  /** Whether this opening of the book has been put back where it was left. */
  const restored = useRef(false);
  /** The place last written, as "chapter:block", so a scroll writes only when it moves on. */
  const savedAt = useRef("");
  const frame = useRef(0);

  useEffect(() => {
    if (!current) return;
    lastChapter.set(book.slug, index);
    const saved = useGame.getState().preferences.readingAt[book.slug];
    if (!restored.current) {
      restored.current = true;
      if (saved && saved[0] === shown && saved[1] > 0) {
        savedAt.current = `${saved[0]}:${saved[1]}`;
        page.current?.querySelector(`[data-block="${saved[1]}"]`)?.scrollIntoView({ block: "start" });
        return;
      }
    }
    page.current?.scrollTo({ top: 0 });
  }, [book.slug, current, index]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  /** Remember the block at the top of the page, so the book opens there next time. */
  const onScroll = () => {
    if (frame.current || !restored.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const pane = page.current;
      const { bookReading, preferences, setPreferences } = useGame.getState();
      // A reading keeps its own place, the spoken block, which the page trails.
      if (!pane || (bookReading?.slug === book.slug && bookReading.state === "playing")) return;
      const top = pane.getBoundingClientRect().top;
      let block = 0;
      for (const el of pane.querySelectorAll<HTMLElement>("[data-block]")) {
        if (el.getBoundingClientRect().bottom > top + 1) {
          block = Number(el.dataset.block);
          break;
        }
      }
      const at = `${shown}:${block}`;
      if (at === savedAt.current) return;
      savedAt.current = at;
      setPreferences({ readingAt: { ...preferences.readingAt, [book.slug]: [shown, block] } });
    });
  };

  const failure = chapters.state === "error" ? chapters.message : null;

  // ---- Reading aloud (bookReading.ts): chapter after chapter, going on after the book closes.
  const bookReading = useGame((s) => s.bookReading);
  const mine = bookReading?.slug === book.slug ? bookReading : null;
  const reading: { state: ReadingState; block: number } = mine && mine.chapter === shown
    ? { state: mine.state, block: mine.block } : { state: "idle", block: -1 };
  const voiced = canSpeak() && blocks.some((b) => b.spoken);

  const read = (from: number) => {
    const { preferences } = useGame.getState();
    readBook({
      slug: book.slug,
      title: book.title,
      chapters: list,
      chapter: shown,
      from,
      want: book.voice,
      chosen: preferences.readVoice,
      rate: preferences.readRate,
      onUpdate: (r) => useGame.getState().setBookReading(r),
    });
  };
  const toggleReading = () => {
    if (reading.state !== "idle") toggleBook();
    else {
      const saved = useGame.getState().preferences.readingAt[book.slug];
      read(saved && saved[0] === shown && saved[1] < blocks.length ? saved[1] : 0);
    }
  };
  /** Turn to a chapter by hand; a reading of this book elsewhere stops. */
  const turnTo = (i: number) => {
    if (mine && mine.chapter !== i) stopBook();
    setIndex(i);
  };

  // The reading moved on to its next chapter: show it.
  const readingChapter = mine?.chapter;
  useEffect(() => {
    if (readingChapter !== undefined) setIndex(readingChapter);
  }, [readingChapter]);

  useEffect(() => {
    if (reading.state !== "playing") return;
    page.current?.querySelector(`[data-block="${reading.block}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [reading.state, reading.block]);

  // Left and Right turn the chapter; Up and Down scroll the page. The close
  // button holds focus, so the page never gets the keys itself. A focused
  // chapter menu keeps them: Left and Right step its options natively.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (e.code === "Space" && voiced) {
        // Also on a focused button, which Space would otherwise press.
        if (!e.repeat) toggleReading();
        e.preventDefault();
      } else if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        if (e.repeat) return;
        const next = index + (e.code === "ArrowLeft" ? -1 : 1);
        if (next >= 0 && next < list.length) turnTo(next);
        e.preventDefault();
      } else if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        const pane = page.current;
        if (pane) pane.scrollBy({ top: (e.code === "ArrowUp" ? -1 : 1) * pane.clientHeight * 0.4, behavior: "smooth" });
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-bg/60 p-2 sm:p-6" onClick={close}>
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-title"
        className="flex h-[92dvh] w-full max-w-3xl flex-col rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-border p-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-wide text-muted uppercase">{book.genreLabel}</p>
            <h2 id="reader-title" className="font-display text-2xl leading-tight sm:text-3xl">{book.title}</h2>
            <p className="text-sm text-muted">{book.author}</p>
          </div>
          <div className="flex shrink-0 items-center">
            {voiced ? (
              <button type="button" onClick={toggleReading}
                className="grid size-11 place-items-center rounded-md text-primary"
                aria-label={reading.state === "playing" ? "Pause reading" : "Read aloud"}>
                {reading.state === "playing"
                  ? <Pause className="size-5" strokeWidth={1.75} />
                  : <Play className="size-5" strokeWidth={1.75} />}
              </button>
            ) : null}
            {mine ? (
              <button type="button" onClick={stopBook}
                className="grid size-11 place-items-center rounded-md text-primary" aria-label="Stop reading">
                <Square className="size-4" strokeWidth={1.75} />
              </button>
            ) : null}
            <button type="button" disabled={size === SIZES[0]} onClick={() => step(-1)}
              className="grid size-11 place-items-center rounded-md text-muted disabled:text-faint" aria-label="Smaller text">
              <AArrowDown className="size-5" strokeWidth={1.75} />
            </button>
            <button type="button" disabled={size === SIZES[SIZES.length - 1]} onClick={() => step(1)}
              className="grid size-11 place-items-center rounded-md text-muted disabled:text-faint" aria-label="Larger text">
              <AArrowUp className="size-5" strokeWidth={1.75} />
            </button>
          </div>
          <button type="button" autoFocus onClick={close}
            className="grid size-11 shrink-0 place-items-center rounded-md text-muted" aria-label="Close the book">
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </header>

        {list.length > 1 ? (
          <label className="flex items-center gap-3 border-b border-border px-4 py-2 text-sm text-muted sm:px-6">
            Chapter
            <select value={shown} onChange={(e) => turnTo(Number(e.target.value))}
              className="min-w-0 flex-1 truncate rounded-md border border-border bg-bg p-2 text-fg">
              {list.map((c, i) => <option key={i} value={i}>{c.title}</option>)}
            </select>
          </label>
        ) : null}

        <div ref={page} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-10">
          {failure ? (
            <div className="grid gap-3 text-sm leading-relaxed text-muted">
              <p className="text-fg">The book could not be fetched: {failure}.</p>
              <p>
                The forest reads each book from <code className="text-fg">books/{book.slug}.json</code>. Run{" "}
                <code className="text-fg">make web-books</code> to write them for a local checkout.
              </p>
              <p className="font-display text-lg text-fg/90">{book.excerpt}</p>
              <button type="button" onClick={() => setAttempt((n) => n + 1)}
                className="min-h-11 justify-self-start rounded-md bg-primary px-4 text-primary-fg">Try again</button>
            </div>
          ) : chapters.state === "ready" && list.length === 0 ? (
            <p className="text-sm text-muted">This book has no chapters.</p>
          ) : current ? (
            <div className={`mx-auto max-w-[65ch] font-display leading-relaxed text-fg/95 ${READING_SIZES[size]}`}>
              {list.length > 1 ? <h3 className="mb-4 text-[1.3em] leading-tight font-semibold">{current.title}</h3> : null}
              {blocks.map((block, i) => (
                <div key={i} data-block={i}
                  // While a reading is going, tap a paragraph to read from it.
                  onClick={reading.state !== "idle" && block.spoken ? () => read(i) : undefined}
                  className={reading.state !== "idle" && reading.block === i ? "-mx-2 rounded-md bg-primary/10 px-2" : undefined}>
                  <BlockView block={block} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Opening the book...</p>
          )}
        </div>

        {list.length > 1 ? (
          <footer className="flex items-center justify-between gap-2 border-t border-border p-3 sm:px-6">
            <button type="button" disabled={index <= 0} onClick={() => turnTo(shown - 1)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm text-fg disabled:text-faint">
              <ChevronLeft className="size-4" strokeWidth={1.75} /> Previous
            </button>
            <span className="text-xs text-muted tabular-nums">{shown + 1} of {list.length}</span>
            <button type="button" disabled={index >= list.length - 1} onClick={() => turnTo(shown + 1)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm text-fg disabled:text-faint">
              Next <ChevronRight className="size-4" strokeWidth={1.75} />
            </button>
          </footer>
        ) : null}
      </article>
    </div>
  );
}

/** One run of a block, set as the source marked it. */
function RunView({ run }: { run: Run }) {
  switch (run.style) {
    case "italic": return <em>{run.text}</em>;
    case "bold": return <strong className="font-semibold">{run.text}</strong>;
    case "mark": return <sup className="text-[0.6em] text-muted">{run.text}</sup>;
    case "aside": return <span className="text-[0.8em] text-muted">[{run.text}]</span>;
    default: return <>{run.text}</>;
  }
}

const runs = (list: Run[]) => list.map((run, i) => <RunView key={i} run={run} />);

/** One paragraph: prose, verse line by line with a hanging indent, a heading, a note or a caption. */
function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "verse":
      return (
        <p className="mb-4">
          {blockLines(block.runs).map((line, i) => <span key={i} className="block pl-[2em] -indent-[2em]">{runs(line)}</span>)}
        </p>
      );
    case "heading":
      return <p className="mt-6 mb-2 text-center text-[0.85em] font-semibold tracking-wide">{runs(block.runs)}</p>;
    case "note":
      return <p className="mb-3 font-sans text-[0.75em] leading-normal text-muted">{runs(block.runs)}</p>;
    case "caption":
      return <p className="my-4 text-center text-[0.85em] text-muted italic">{runs(block.runs)}</p>;
    default:
      return <p className="mb-4">{runs(block.runs)}</p>;
  }
}
