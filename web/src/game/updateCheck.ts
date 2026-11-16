/**
 * Whether a newer build of the forest has been published since this page loaded.
 *
 * The build writes `version.json` beside index.html (vite.config.ts). A page left
 * open in a tab for days keeps running the build it loaded; when the tab comes back
 * into view the page fetches that file again and, if the published version is newer,
 * offers a reload. Inside the app (host.ts) the App Store does the updating, so the
 * banner never shows there.
 */

/** True when `remote` is a strictly higher dotted version than `local`. */
export function isNewerVersion(remote: string, local: string): boolean {
  const a = remote.split(".").map(Number);
  const b = local.split(".").map(Number);
  if (a.some(Number.isNaN) || b.some(Number.isNaN)) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** The version a `version.json` body declares, or null when it declares none. */
export function parseVersionFile(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const version = (body as { version?: unknown }).version;
  return typeof version === "string" && version.length > 0 ? version : null;
}

/** The published version, or null when it cannot be read (offline, dev server, no file). */
export async function fetchPublishedVersion(url = "version.json"): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return parseVersionFile(await response.json());
  } catch {
    return null;
  }
}
