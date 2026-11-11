/**
 * In-app events: set pieces staged on the landing field (exhibits.ts) for a
 * dated window, to match an App Store in-app event. Outside every window the
 * field stands empty. `?event=<id>` stages one now, for testing and for
 * recording the App Store event media.
 */

export type EventId = "visitor";

export type ForestEvent = {
  id: EventId;
  /** First and last day, local time, inclusive: "YYYY-MM-DD". */
  start: string;
  end: string;
};

/** What a playing set piece asks of the sky: the meteor swarm's strength, 0 to 1 (MeteorSky.tsx). */
export const stage = { swarm: 0 };

/** Booked windows. Add one when its App Store event is scheduled (at most 31 days). */
export const EVENTS: ForestEvent[] = [];

const IDS: EventId[] = ["visitor"];

function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The event on today, or null: the `?event=` override first, then the booked windows. */
export function activeEvent(now: Date, search: string, events: ForestEvent[] = EVENTS): EventId | null {
  const forced = new URLSearchParams(search).get("event")?.trim().toLowerCase();
  if (forced) return (IDS as string[]).includes(forced) ? (forced as EventId) : null;
  const day = localDay(now);
  return events.find((e) => e.start <= day && day <= e.end)?.id ?? null;
}
