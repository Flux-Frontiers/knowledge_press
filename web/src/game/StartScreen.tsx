import { BookOpen, Info, Route } from "lucide-react";
import { BOOKS } from "./catalog";
import { COARSE_POINTER } from "./Environment";
import { SEASONS, type SeasonName } from "./seasons";
import { USER_GUIDE_URL } from "./links";
import { useGame } from "./store";

/** The keys worth knowing before the first drive; About and the guide have the rest. */
const KEYS: [string[], string][] = [
  [["W", "S"], "drive"],
  [["A", "D"], "steer"],
  [["Drag"], "look"],
  [["E"], "read"],
  [["Q"], "tour"],
  [["B"], "books"],
  [["C"], "camera"],
  [["?"], "about"],
  [["Esc"], "settings"],
];

/**
 * The title over the live forest, which circles the redwood behind it in
 * today's season and sky (Player.tsx); after the Art Techno plaza's start.
 */
export function StartScreen({
  ready,
  growing,
  opensAt,
  onEnter,
}: {
  ready: boolean;
  growing: boolean;
  /** The title of the tree a `?tree=` link opens beside, if any. */
  opensAt?: string;
  /** Start driving, or with `tour` start on the guided tour. */
  onEnter: (tour: boolean) => void;
}) {
  const season = useGame((s) => s.season);
  const library = useGame((s) => s.library);
  const toggleHelp = useGame((s) => s.toggleHelp);

  return (
    <div className="start-screen absolute inset-0 z-20 flex flex-col overflow-y-auto overscroll-contain text-fg" style={{ touchAction: "pan-y" }}>
      <div className="mt-auto w-full max-w-2xl px-5 pt-24 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-10 sm:pb-12">
        <p className="text-xs font-semibold tracking-[0.22em] text-fg/90 uppercase">GutenbergKG · Flux Frontiers</p>
        <h1 className="font-display mt-3 text-5xl leading-none text-fg sm:text-7xl">The Knowledge Press</h1>
        <p className="font-display mt-1 text-2xl italic text-primary sm:text-3xl">Forest</p>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-fg/85">
          {BOOKS.length} public-domain books, grown as trees. The trunk is the work, the limbs are its
          sections, the leaves are its passages, and each genre grows as a real species.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => onEnter(false)} disabled={!ready}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium text-primary-fg disabled:opacity-50">
            <BookOpen className="size-4" strokeWidth={1.75} />
            {growing ? "Growing the forest" : "Start driving"}
          </button>
          <button type="button" onClick={() => onEnter(true)} disabled={!ready}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface/80 px-4 py-3 text-base text-fg disabled:opacity-50">
            <Route className="size-4" strokeWidth={1.75} />
            Guided tour
          </button>
          <button type="button" onClick={toggleHelp}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface/80 px-4 py-3 text-base text-fg">
            <Info className="size-4" strokeWidth={1.75} />
            About
          </button>
        </div>

        {COARSE_POINTER ? (
          <p className="mt-5 text-sm text-muted">The stick at bottom left drives; drag anywhere else to look around.</p>
        ) : (
          <p className="start-keys mt-5 flex max-w-xl flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
            {KEYS.map(([keys, what]) => (
              <span key={what} className="whitespace-nowrap">{keys.map((k) => <kbd key={k}>{k}</kbd>)} {what}</span>
            ))}
          </p>
        )}

        {/* Season and clock are set from the date and place each visit (store.ts). */}
        <p className="mt-4 text-sm text-muted">
          {SEASONS[season].label} by the calendar, under your sky right now.
          {opensAt ? <> Opens beside <span className="text-fg">{opensAt}</span>.</> : null}
          {library.length > 0 ? <> {library.length} book{library.length === 1 ? "" : "s"} already in the press.</> : null}
          {" "}<a href={USER_GUIDE_URL} target="_blank" rel="noopener" className="text-primary underline">User guide</a>
        </p>
      </div>
    </div>
  );
}

export function seasonLabel(s: SeasonName): string {
  return SEASONS[s].label;
}
