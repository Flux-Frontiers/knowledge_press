import { useEffect, useRef, useState } from "react";
import { ForestCanvas } from "./ForestCanvas";
import { HUD } from "./HUD";
import { PauseOverlay } from "./PauseOverlay";
import { StartScreen } from "./StartScreen";
import { TouchControls } from "./TouchControls";
import { installControlsTest } from "./controlsTest";
import { getForest, type Forest } from "./forest";
import { GROW_VERSION } from "./growTree";
import { bindInput, isInputTarget } from "./input";
import { LEAF_SCALE } from "./preferences";
import { resetSim } from "./sim";
import { useGame } from "./store";

/**
 * The browser's location, for true sunrise and sunset, rounded to 0.1 degree
 * and kept only in this browser's save. Asked for when play starts; with a place
 * already saved it is refreshed only if permission is already granted, so the
 * prompt does not come back every visit. Browsers allow it only on a secure
 * origin, so over plain http on the LAN the sky keeps to the time zone.
 */
function requestPlace() {
  if (typeof navigator === "undefined" || !navigator.geolocation || !window.isSecureContext) return;
  const ask = () => navigator.geolocation.getCurrentPosition(
    ({ coords }) => useGame.getState().setPlace({ lat: Math.round(coords.latitude * 10) / 10, lon: Math.round(coords.longitude * 10) / 10 }),
    () => {},
    { enableHighAccuracy: false, maximumAge: 6 * 3600000, timeout: 20000 },
  );
  if (!useGame.getState().place) {
    ask();
    return;
  }
  navigator.permissions?.query({ name: "geolocation" }).then((p) => { if (p.state === "granted") ask(); }).catch(() => {});
}

export function ForestApp() {
  const [mounted, setMounted] = useState(false);
  const [forest, setForest] = useState<Forest | null>(null);
  const playing = useGame((s) => s.playing);
  const play = useGame((s) => s.play);
  const setToast = useGame((s) => s.setToast);
  const toast = useGame((s) => s.toast);

  // The sky follows the clock: sun and moon move a few hundredths of a degree between ticks.
  useEffect(() => {
    const id = window.setInterval(() => useGame.getState().tickSky(), 5000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (playing) requestPlace();
  }, [playing]);

  useEffect(() => {
    setMounted(true);
    const unbind = bindInput();
    installControlsTest();
    return () => unbind?.();
  }, []);

  // Grow in a worker, regrowing when leaf complexity changes; only the first
  // forest places the cart. Without Worker support, grow on the main thread.
  const leafScale = useGame((s) => LEAF_SCALE[s.preferences.leaves]);
  const placed = useRef(false);
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  useEffect(() => {
    try {
      worker.current = new Worker(new URL("./forestWorker.ts", import.meta.url), { type: "module" });
    } catch {
      worker.current = null;
    }
    return () => worker.current?.terminate();
  }, []);
  useEffect(() => {
    const apply = (f: Forest) => {
      if (!placed.current) resetSim(f);
      else useGame.getState().setToast(null);
      placed.current = true;
      setForest(f);
      window.__gameReady = true;
    };
    const id = ++request.current;
    if (placed.current) useGame.getState().setToast("Growing the forest…");
    const w = worker.current;
    if (w) {
      // Only the latest request wins if the level changes again mid-growth.
      w.onmessage = (e: MessageEvent<{ id: number; forest: Forest }>) => {
        if (e.data.id === request.current) apply(e.data.forest);
      };
      w.postMessage({ id, leafScale });
      return;
    }
    const t = window.setTimeout(() => apply(getForest(leafScale)), 0);
    return () => window.clearTimeout(t);
  }, [leafScale, GROW_VERSION]);

  useEffect(() => {
    if (!forest) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("qa") === "1") play();
  }, [forest, play]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast, setToast]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const st = useGame.getState();
      if (!st.playing) return;
      if (e.code === "Escape") {
        if (st.paused) return; // The settings dialog handles Escape itself.
        if (st.plaque) st.openPlaque(null);
        else if (st.catalogOpen) st.setCatalogOpen(false);
        else if (st.atlasOpen) st.setAtlasOpen(false);
        else if (st.libraryOpen) st.toggleLibrary();
        else st.pause(true);
        return;
      }
      if (st.paused || isInputTarget(e.target)) return;
      if (e.code === "KeyL") st.toggleLibrary();
      if (e.code === "KeyG") st.toggleAtlas();
      if (e.code === "KeyB") st.toggleCatalog();
      if (e.code === "KeyQ") st.toggleCircuit();
      if (e.code === "KeyC") {
        const next = { follow: "high", high: "cart", cart: "follow" } as const;
        st.setPreferences({ camera: next[st.preferences.camera] });
      }
      if (e.code === "KeyH" && forest) {
        st.selectGrove(null);
        st.requestJump(forest.home, "Home · the corpus redwood");
      }
    }
    window.addEventListener("keydown", onKey);
    function onBlur() {
      if (useGame.getState().playing) useGame.getState().pause(true);
    }
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [forest]);

  return (
    <main onPointerUp={(e) => {
      const button = (e.target as HTMLElement).closest("button");
      if (button && !button.closest("dialog")) button.blur();
    }} className="relative h-dvh w-full overflow-hidden bg-bg text-fg" style={{ touchAction: "none" }}>
      {mounted && forest && playing ? (
        <div className="absolute inset-0">
          <ForestCanvas forest={forest} />
        </div>
      ) : (
        <div className="absolute inset-0 start-wash" />
      )}
      {playing && forest ? (
        <>
          <HUD forest={forest} />
          <TouchControls />
          <PauseOverlay />
        </>
      ) : (
        <StartScreen
          ready={Boolean(forest)}
          growing={!forest}
          onEnter={() => {
            if (forest) {
              resetSim(forest);
              play();
            }
          }}
        />
      )}
    </main>
  );
}
