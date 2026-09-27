/**
 * Reads books from the GutenbergKG worker, through the dev server's /worker
 * proxy (vite.config.ts). The worker's contract, as the app's WorkerClient.swift
 * uses it: POST /runsync with {"input": {...}}, the payload in {"output": {...}}.
 */

export type Chapter = { id: string; title: string; index: number };
export type ChapterText = { title: string; text: string };

export class WorkerError extends Error {}

/**
 * Unwrap the worker's envelope: {"output": {...}} or a bare payload, with
 * {"error": ...} at either level thrown as a WorkerError.
 *
 * :param data: The parsed response body.
 */
export function decodeWorker<T>(data: unknown): T {
  if (!data || typeof data !== "object") throw new WorkerError("worker reply is not an object");
  const top = data as Record<string, unknown>;
  if (typeof top.error === "string") throw new WorkerError(top.error);
  const out = (top.output ?? top) as Record<string, unknown> | null;
  if (!out || typeof out !== "object") throw new WorkerError("worker output is not an object");
  if (typeof out.error === "string") throw new WorkerError(out.error);
  return out as T;
}

async function runWorker<T>(input: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const res = await fetch("worker/runsync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
    signal,
  });
  if (!res.ok) throw new WorkerError(`worker answered HTTP ${res.status}`);
  return decodeWorker<T>(await res.json());
}

/** A book's chapters, in reading order. `book` is the catalog's worker key, not its title. */
export async function getChapters(genre: string, book: string, signal?: AbortSignal): Promise<Chapter[]> {
  const r = await runWorker<{ chapters: Chapter[] }>({ op: "get_chapters", genre, book }, signal);
  return r.chapters;
}

/** One chapter's text. */
export function getChapter(genre: string, book: string, sectionId: string, signal?: AbortSignal): Promise<ChapterText> {
  return runWorker<ChapterText>({ op: "get_chapter", genre, book, section_id: sectionId }, signal);
}
