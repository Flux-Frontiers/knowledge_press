import { Award, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { gained, TIER_COLOR, TIER_NAME, tracks, type Tier, type Track } from "./achievements";
import type { Forest } from "./forest";
import { speak } from "./speech";
import { useGame } from "./store";

/** How long the award card stays up on its own, ms. */
const AWARD_MS = 9000;

/** What a level is for, said and shown on the card. */
function awardLine(t: Track, tier: Tier): string {
  if (t.id === "ring" && tier === 1) return "You rode the whole ring, every grove, home to the redwood. Every stud and the gold pin are lit on the Wayfarer's Wheel, by the redwood.";
  return `${t.steps[tier - 1]}: done.`;
}

/** Every track's level from the saved progress; the Wayfarer is first. */
export function useTracks(forest: Forest): Track[] {
  const library = useGame((s) => s.library);
  const grovesVisited = useGame((s) => s.grovesVisited);
  const plaques = useGame((s) => s.plaques);
  const ring = useGame((s) => s.ring);
  const nightBooks = useGame((s) => s.nightBooks);
  const moots = useGame((s) => s.moots);
  const speciesAll = useMemo(() => new Set(forest.trees.map((t) => t.species)).size, [forest]);
  const speciesPressed = useMemo(() => {
    const pressed = new Set(library);
    return new Set(forest.trees.filter((t) => pressed.has(t.book.slug)).map((t) => t.species)).size;
  }, [library, forest]);
  return useMemo(() => tracks({ library, grovesVisited, plaques, ring, nightBooks, moots, speciesPressed },
    { books: forest.trees.length, groves: forest.groves.length, exhibits: forest.exhibits.length, species: speciesAll }),
  [library, grovesVisited, plaques, ring, nightBooks, moots, speciesPressed, speciesAll, forest]);
}

/** Watches progress and raises the award card when a level is reached; not for levels already held on arrival. */
export function useAwards(forest: Forest) {
  const now = useTracks(forest);
  const before = useRef<Track[] | null>(null);
  useEffect(() => {
    const prev = before.current;
    before.current = now;
    if (!prev) return;
    const up = gained(prev, now);
    if (!up.length) return;
    // The ring's award first: it is the one the ride was for.
    const best = up.find((u) => u.title === "Wayfarer") ?? up[0]!;
    const track = now.find((t) => t.title === best.title)!;
    const line = awardLine(track, best.tier);
    useGame.getState().setAward({ title: best.title, tier: best.tier, line });
    const st = useGame.getState();
    if (st.preferences.narrate && !st.preferences.silent && !st.bookReading) speak(`${best.title}, ${TIER_NAME[best.tier]}. ${line}`, true);
  }, [now]);
}

export function AwardCard() {
  const award = useGame((s) => s.award);
  useEffect(() => {
    if (!award) return;
    const t = window.setTimeout(() => { if (useGame.getState().award === award) useGame.getState().setAward(null); }, AWARD_MS);
    return () => window.clearTimeout(t);
  }, [award]);
  if (!award) return null;
  return (
    <div role="status" className="pointer-events-auto absolute top-24 left-1/2 z-20 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-border bg-surface p-4 sm:top-28">
      <button type="button" onClick={() => useGame.getState().setAward(null)} aria-label="Close"
        className="absolute top-2 right-2 grid size-10 place-items-center rounded-md text-muted">
        <X className="size-4" strokeWidth={1.75} />
      </button>
      <div className="flex items-center gap-3 pr-8">
        <Medal tier={award.tier} big />
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Achievement</p>
          <p className="font-display text-xl leading-tight">{award.title} · {TIER_NAME[award.tier]}</p>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-fg/90">{award.line}</p>
    </div>
  );
}

function Medal({ tier, big }: { tier: Tier; big?: boolean }) {
  return (
    <span className={"grid shrink-0 place-items-center rounded-full border-2 " + (big ? "size-11" : "size-8")}
      style={{ borderColor: TIER_COLOR[tier], background: tier ? `${TIER_COLOR[tier]}33` : "transparent" }}
      aria-label={tier ? TIER_NAME[tier] : "Not yet"}>
      <Award className={big ? "size-5" : "size-4"} strokeWidth={1.75} style={{ color: TIER_COLOR[tier] }} />
    </span>
  );
}

/** Every track, its level and what the next one asks: at the top of the Press tab. */
export function AchievementsList({ forest }: { forest: Forest }) {
  const list = useTracks(forest);
  return (
    <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Achievements">
      {list.map((t) => (
        <li key={t.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
          <Medal tier={t.tier} />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug">{t.title}{t.tier ? ` · ${TIER_NAME[t.tier]}` : ""}</p>
            <p className="truncate text-xs text-muted">{t.tier >= 3 ? "Every level reached" : `${t.steps[t.tier as 0 | 1 | 2]} · ${t.next}`}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
