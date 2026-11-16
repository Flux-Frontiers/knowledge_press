/**
 * Where the rider was, kept in sessionStorage so a reload puts them back.
 * On a phone the system kills a heavy web page for memory and the app reloads
 * it (ForestView.swift webViewWebContentProcessDidTerminate); without this the
 * reload lands on the start screen, which reads as the forest quitting mid-ride.
 * sessionStorage outlives the reload but not the app or the tab, so a fresh
 * launch still opens on the start screen. Exit clears it.
 */

const KEY = "forest.resume";
/** Older than this, the start screen is the better welcome. */
export const RESUME_MAX_AGE_MS = 15 * 60 * 1000;

export type ResumePose = { x: number; z: number; yaw: number; circuit: boolean; at: number };

/** A saved pose if it is whole and recent enough, else null. */
export function parseResume(raw: string | null, now: number): ResumePose | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<ResumePose>;
    const nums = [p.x, p.z, p.yaw, p.at];
    if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    const age = now - p.at!;
    if (age < 0 || age > RESUME_MAX_AGE_MS) return null;
    return { x: p.x!, z: p.z!, yaw: p.yaw!, circuit: p.circuit === true, at: p.at! };
  } catch {
    return null;
  }
}

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readResume(now = Date.now()): ResumePose | null {
  try {
    return parseResume(store()?.getItem(KEY) ?? null, now);
  } catch {
    return null;
  }
}

export function saveResume(pose: Omit<ResumePose, "at">, now = Date.now()): void {
  try {
    store()?.setItem(KEY, JSON.stringify({ ...pose, at: now }));
  } catch { /* storage full or blocked: a reload starts over */ }
}

export function clearResume(): void {
  try {
    store()?.removeItem(KEY);
  } catch { /* nothing to clear */ }
}
