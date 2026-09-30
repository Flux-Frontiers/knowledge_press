import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Book } from "./catalog";
import { useGame } from "./store";
import { getBook, type Chapter } from "./bookText";

/** The chapter each book was left at, for this session. */
const lastChapter = new Map<string, number>();

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; value: T };

/** A book's text from its static books/<slug>.json: a chapter picker, the chapter, and previous / next. */
export function ReaderPanel({ book }: { book: Book }) {
  const close = () => useGame.getState().openReader(null);
  const [chapters, setChapters] = useState<Load<Chapter[]>>({ state: "loading" });
  const [index, setIndex] = useState(() => lastChapter.get(book.slug) ?? 0);
  const [attempt, setAttempt] = useState(0);
  const page = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!current) return;
    lastChapter.set(book.slug, index);
    page.current?.scrollTo({ top: 0 });
  }, [book.slug, current, index]);

  const failure = chapters.state === "error" ? chapters.message : null;

  // Left and Right turn the chapter; Up and Down scroll the page. The close
  // button holds focus, so the page never gets the keys itself. A focused
  // chapter menu keeps them: Left and Right step its options natively.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        if (e.repeat) return;
        const next = index + (e.code === "ArrowLeft" ? -1 : 1);
        if (next >= 0 && next < list.length) setIndex(next);
        e.preventDefault();
      } else if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        const pane = page.current;
        if (pane) pane.scrollBy({ top: (e.code === "ArrowUp" ? -1 : 1) * pane.clientHeight * 0.4, behavior: "smooth" });
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, list.length]);

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
          <button type="button" autoFocus onClick={close}
            className="grid size-11 shrink-0 place-items-center rounded-md text-muted" aria-label="Close the book">
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </header>

        {list.length > 1 ? (
          <label className="flex items-center gap-3 border-b border-border px-4 py-2 text-sm text-muted sm:px-6">
            Chapter
            <select value={Math.min(index, list.length - 1)} onChange={(e) => setIndex(Number(e.target.value))}
              className="min-w-0 flex-1 truncate rounded-md border border-border bg-bg p-2 text-fg">
              {list.map((c, i) => <option key={i} value={i}>{c.title}</option>)}
            </select>
          </label>
        ) : null}

        <div ref={page} className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-10">
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
            <div className="mx-auto max-w-[65ch] font-display text-lg leading-relaxed text-fg/95 sm:text-xl">
              {list.length > 1 ? <h3 className="mb-4 text-2xl font-semibold">{current.title}</h3> : null}
              {current.text.split(/\n\s*\n/).map((para, i) => (
                <p key={i} className="mb-4 whitespace-pre-line">{para.trim()}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Opening the book...</p>
          )}
        </div>

        {list.length > 1 ? (
          <footer className="flex items-center justify-between gap-2 border-t border-border p-3 sm:px-6">
            <button type="button" disabled={index <= 0} onClick={() => setIndex(index - 1)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm text-fg disabled:text-faint">
              <ChevronLeft className="size-4" strokeWidth={1.75} /> Previous
            </button>
            <span className="text-xs text-muted tabular-nums">{Math.min(index, list.length - 1) + 1} of {list.length}</span>
            <button type="button" disabled={index >= list.length - 1} onClick={() => setIndex(index + 1)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-sm text-fg disabled:text-faint">
              Next <ChevronRight className="size-4" strokeWidth={1.75} />
            </button>
          </footer>
        ) : null}
      </article>
    </div>
  );
}
