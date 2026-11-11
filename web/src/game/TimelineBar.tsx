import { Pause, Play, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { Forest } from "./forest";
import { useGame } from "./store";
import { timelineStops, yearLabel } from "./timeline";

/** How long the timeline rests on each year while it plays, ms. */
const STEP_MS = 280;

/** Steps the playing timeline forward a year at a time. In the HUD, which stays mounted when the bar is hidden. */
export function useTimelinePlayback(forest: Forest) {
  const playing = useGame((s) => s.timelinePlaying);
  const stops = useMemo(() => timelineStops(forest.trees.map((t) => t.book)), [forest]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const s = useGame.getState();
      const now = s.timelineYear ?? -Infinity;
      const next = stops.find((p) => p.year > now);
      if (next) s.setTimeline(next.year, true);
      else s.setTimeline(now, false);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, stops]);
}

/** Hands focus back to the forest, so Space and the arrows drive rather than press or scrub. */
const release = () => (document.activeElement as HTMLElement | null)?.blur();

/**
 * The literary timeline's bar: a slider over every year a work appeared, play and
 * pause, and the forest's totals at that year. It sits where the search does.
 */
export function TimelineBar({ forest }: { forest: Forest }) {
  const year = useGame((s) => s.timelineYear);
  const playing = useGame((s) => s.timelinePlaying);
  const setTimeline = useGame((s) => s.setTimeline);
  const stops = useMemo(() => timelineStops(forest.trees.map((t) => t.book)), [forest]);
  const groveTotal = forest.groves.length;
  let at = 0;
  while (at + 1 < stops.length && stops[at + 1]!.year <= (year ?? Infinity)) at++;
  const stop = stops[at];
  if (!stop) return null;
  const atEnd = at === stops.length - 1;
  return (
    <div className="rounded-md border border-border bg-surface/90 px-3 py-2">
      <div className="flex items-center gap-2">
        <button type="button"
          onClick={() => { release(); if (playing) setTimeline(stop.year, false); else setTimeline(atEnd ? stops[0]!.year : stop.year, true); }}
          className="-my-1 -ml-1 grid size-9 shrink-0 place-items-center rounded-md text-fg"
          aria-label={playing ? "Pause the timeline" : atEnd ? "Play the timeline from the start" : "Play the timeline"}>
          {playing ? <Pause className="size-4" strokeWidth={1.75} /> : <Play className="size-4" strokeWidth={1.75} />}
        </button>
        <p className="font-display text-xl leading-none tabular-nums">{yearLabel(stop.year)}</p>
        <p className="ml-auto text-xs text-muted tabular-nums">+{stop.added} {stop.added === 1 ? "work" : "works"}</p>
        <button type="button" onClick={() => { release(); setTimeline(null); }}
          className="-my-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-md text-muted"
          aria-label="Close the timeline: every tree stands again">
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>
      <input type="range" min={0} max={stops.length - 1} step={1} value={at}
        onChange={(e) => setTimeline(stops[Number(e.target.value)]!.year)}
        onPointerUp={release}
        aria-label="Year" aria-valuetext={yearLabel(stop.year)}
        className="mt-1 w-full" />
      <p className="text-xs text-muted tabular-nums">
        {stop.books} of {forest.trees.length} works · {stop.groves} of {groveTotal} groves · {stop.chunks.toLocaleString("en-US")} chunks
      </p>
    </div>
  );
}
