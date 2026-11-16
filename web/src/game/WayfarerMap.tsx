import { useMemo } from "react";
import type { Forest } from "./forest";
import { useGame } from "./store";
import { wayfarerMap } from "./wheelMap";

const INK = "#2a2a2a";
const BRASS = "#8a6a22";
const UNSEEN = "#d8cfbd";

/**
 * The Wayfarer's Wheel flat on its plaque: the roads, a numbered stud per
 * grove in its color once the ride has stopped there, and a key to the numbers
 * in the ride's order. It follows the ride as the table does.
 */
export function WayfarerMap({ forest }: { forest: Forest }) {
  const stops = useGame((s) => s.ring.stops);
  const map = useMemo(() => wayfarerMap(forest, stops), [forest, stops]);
  return (
    <figure className="mt-6">
      <svg viewBox="-104 -104 208 208" className="mx-auto block w-full max-w-sm" role="img"
        aria-label={`Map of the ring: ${map.studs.filter((s) => s.seen).length} of ${map.studs.length} groves seen this ride`}>
        {map.rings.map((r) => <circle key={r} r={r} fill="none" stroke={BRASS} strokeWidth={1.6} />)}
        {map.spokes.map(([ax, ay, bx, by]) => <line key={`${ax},${ay}`} x1={ax} y1={ay} x2={bx} y2={by} stroke={BRASS} strokeWidth={1.2} />)}
        <circle r={4} fill="#6b3a24" stroke={INK} strokeWidth={0.6} />
        <text x={0} y={-97} textAnchor="middle" fontSize={8} fontWeight={700} fill="#8a1f14">N</text>
        {map.studs.map((s) => (
          <g key={s.genre} transform={`translate(${s.x} ${s.y})`}>
            <circle r={5.2} fill={s.seen ? s.color : UNSEEN} stroke={INK} strokeWidth={0.6} />
            <text y={2} textAnchor="middle" fontSize={5.4} fontWeight={700} fill={s.seen ? "#ffffff" : INK}>{s.n}</text>
          </g>
        ))}
      </svg>
      <figcaption>
        <ol className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-[#2a2a2a] sm:grid-cols-2">
          {map.studs.map((s) => (
            <li key={s.genre} className={`flex items-center gap-2 ${s.seen ? "" : "opacity-55"}`}>
              <span className="inline-block size-3 shrink-0 rounded-full border border-[#2a2a2a]" style={{ background: s.seen ? s.color : UNSEEN }} />
              <span className="tabular-nums">{s.n}.</span>
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
