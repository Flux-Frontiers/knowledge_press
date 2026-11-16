import { useEffect, useState } from "react";
import { host } from "./host";
import { fetchPublishedVersion, isNewerVersion } from "./updateCheck";

/** At most one check per this many milliseconds, however often the tab is switched to. */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

/** A "new version, reload" banner, checked each time the tab comes back into view. */
export function UpdateBanner() {
  const [published, setPublished] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (host.available) return;
    let last = Date.now();
    async function check() {
      if (document.visibilityState !== "visible" || Date.now() - last < CHECK_INTERVAL_MS) return;
      last = Date.now();
      const version = await fetchPublishedVersion();
      if (version && isNewerVersion(version, __APP_VERSION__)) setPublished(version);
    }
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  if (!published || dismissed) return null;
  return (
    <div role="status" className="absolute top-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md border border-border bg-surface px-4 py-2 text-sm">
      <span>Version {published} of the forest is out.</span>
      <button type="button" className="rounded-md border border-border px-2 py-1" onClick={() => window.location.reload()}>
        Reload
      </button>
      <button type="button" aria-label="Dismiss" className="px-1 text-faint" onClick={() => setDismissed(true)}>
        ×
      </button>
    </div>
  );
}
