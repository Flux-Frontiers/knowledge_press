/**
 * The page's host, when the forest runs inside an app.
 *
 * The Knowledge Press app serves this build in a web view and listens on a
 * WebKit message handler named `forest`. On the web there is no such handler,
 * so `post` does nothing, `available` is false, and anything that only makes
 * sense inside the app (the card's Ask button) is not drawn. The host sends
 * commands back through `window.__forestHost.dispatch(json)`.
 */

/** What the forest tells its host. */
export type HostEvent =
  | { kind: "ready" } // the forest has grown and commands are heard
  | { kind: "tree"; slug: string } // a tree's card opened
  | { kind: "pressed"; slug: string } // a book read into the press (E at a tree)
  | { kind: "ask"; slug: string }; // the card's Ask about this book

/** What the host asks of the forest. */
export type HostCommand =
  | { kind: "goto"; slug: string } // fly to this tree and open its card
  | { kind: "home" }; // back to the corpus redwood

type MessageHandler = { postMessage(body: unknown): void };
type HostWindow = { webkit?: { messageHandlers?: { forest?: MessageHandler } }; __forestHost?: { dispatch(json: unknown): void } };

const listeners = new Set<(c: HostCommand) => void>();

function hostWindow(): HostWindow | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as HostWindow);
}

function handler(): MessageHandler | undefined {
  return hostWindow()?.webkit?.messageHandlers?.forest;
}

/** A command from JSON text or an already-parsed object, or null when it is not one. */
export function parseCommand(json: unknown): HostCommand | null {
  let c: unknown = json;
  if (typeof json === "string") {
    try { c = JSON.parse(json); } catch { return null; }
  }
  if (!c || typeof c !== "object") return null;
  const { kind, slug } = c as { kind?: unknown; slug?: unknown };
  if (kind === "home") return { kind };
  if (kind === "goto" && typeof slug === "string" && slug) return { kind, slug };
  return null;
}

/** Hand a command to every listener. Unknown or malformed commands are dropped. */
export function dispatch(json: unknown): void {
  const command = parseCommand(json);
  if (!command) return;
  for (const listener of [...listeners]) listener(command);
}

export const host = {
  /** Whether an app is listening. Read each time: the handler is injected before the page runs. */
  get available(): boolean {
    return handler() !== undefined;
  },
  /** Tell the host something happened. Silently nothing on the web. */
  post(event: HostEvent): void {
    try { handler()?.postMessage(event); } catch { /* the host went away; the forest carries on */ }
  },
  /** Register for host commands. Returns the unsubscribe. */
  on(listener: (c: HostCommand) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

// The entry point the app calls through evaluateJavaScript. Harmless on the web.
const w = hostWindow();
if (w) w.__forestHost = { dispatch };
