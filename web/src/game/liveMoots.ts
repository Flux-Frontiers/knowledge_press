/**
 * Live moots: a GutenbergKG worker holds the moot and makes each turn; the
 * forest starts it, asks for one turn at a time, and plays each as it lands.
 * The worker's ops are moot_start, moot_turn and moot_stop (gutenberg_kg
 * serve/moot_ops.py), posted to its /runsync like every worker request.
 *
 * The worker must allow this page's origin (GUTENKG_CORS_ORIGINS). Safari
 * will not let the published https forest reach http://localhost; the dev
 * server works in every browser.
 */

import { decodeMoot, MOOT_VERSION, MootError, type Moot, type MootTurn } from "./moots";

/** Where the worker is, and the token it may want; both from settings. */
export type WorkerSettings = { url: string; token: string };

/** What the reader asked for: two catalog keys, "<genre>/<book>", a topic and a length. */
export type LiveRequest = { books: [string, string]; topic: string; turns: number };

/** The lengths offered; the worker accepts 2-40. */
export const LIVE_TURNS = [4, 6, 8, 10, 12] as const;

type Fetch = typeof fetch;

/**
 * Where the player goes when a turn ends: the next turn, or, in a live moot
 * that has caught up with its worker, one past the last arrived turn, where
 * it waits for the next; `null` stops it at the end.
 *
 * :param shown: The turns shown, the last of them current.
 * :param arrived: The turns the moot has so far.
 * :param done: Whether no more turns will arrive; always true for a saved moot.
 */
export function stepAfter(shown: number, arrived: number, done: boolean): number | null {
  return shown < arrived || !done ? shown + 1 : null;
}

/**
 * Post one request to the worker and return its output.
 *
 * RunPod's local server answers {status: "COMPLETED", output} on success and
 * {status: "FAILED", error} when the handler returned an error.
 *
 * :param worker: The worker's URL and token.
 * :param input: The request's input; the token is added when set.
 * :param fetchImpl: A seam for tests.
 */
export async function callWorker(worker: WorkerSettings, input: Record<string, unknown>, fetchImpl: Fetch = fetch): Promise<Record<string, unknown>> {
  const url = `${worker.url.trim().replace(/\/+$/, "")}/runsync`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: worker.token ? { ...input, token: worker.token } : input }),
    });
  } catch {
    throw new MootError(`cannot reach the worker at ${worker.url}`);
  }
  if (!res.ok) throw new MootError(`the worker answered HTTP ${res.status}`);
  const data = (await res.json().catch(() => null)) as { status?: unknown; error?: unknown; output?: unknown } | null;
  if (!data) throw new MootError("the worker's answer was not JSON");
  const output = data.output as Record<string, unknown> | undefined;
  const error = data.error ?? output?.error;
  if (error !== undefined && error !== null) throw new MootError(String(error));
  if (!output || typeof output !== "object") throw new MootError("the worker's answer had no output");
  return output;
}

/**
 * Start a live moot.
 *
 * :returns: The worker's id for it, its length, and the moot with no turns yet.
 */
export async function startLiveMoot(worker: WorkerSettings, request: LiveRequest, fetchImpl: Fetch = fetch): Promise<{ mootId: string; total: number; moot: Moot }> {
  const out = await callWorker(worker, {
    op: "moot_start", books: request.books, topic: request.topic, turns: request.turns,
  }, fetchImpl);
  if (typeof out.moot_id !== "string" || typeof out.turns !== "number") throw new MootError("the worker did not start the moot");
  const moot = decodeMoot({
    version: MOOT_VERSION, id: out.id, topic: out.topic ?? null, date: out.date ?? "",
    model: out.model ?? "", backend: out.backend ?? "", trees: out.trees, turns: [],
  });
  return { mootId: out.moot_id, total: out.turns, moot };
}

/**
 * Ask for the next turn.
 *
 * :returns: The turn, and whether it was the last.
 */
export async function nextLiveTurn(worker: WorkerSettings, mootId: string, fetchImpl: Fetch = fetch): Promise<{ turn: MootTurn; done: boolean }> {
  const out = await callWorker(worker, { op: "moot_turn", moot_id: mootId }, fetchImpl);
  const t = out.turn as Partial<MootTurn> | undefined;
  if (typeof t?.turn !== "number" || (t.speaker !== 0 && t.speaker !== 1) || typeof t.text !== "string" || !Array.isArray(t.cites)) {
    throw new MootError("the worker sent a malformed turn");
  }
  return { turn: t as MootTurn, done: out.done === true };
}

/** End a live moot on the worker; nothing to report if it is already gone. */
export async function stopLiveMoot(worker: WorkerSettings, mootId: string, fetchImpl: Fetch = fetch): Promise<void> {
  await callWorker(worker, { op: "moot_stop", moot_id: mootId }, fetchImpl).catch(() => undefined);
}
