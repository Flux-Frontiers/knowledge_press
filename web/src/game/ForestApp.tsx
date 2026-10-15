import { useEffect, useMemo, useRef, useState } from "react";
import { About } from "./About";
import { ForestCanvas } from "./ForestCanvas";
import { HUD } from "./HUD";
import { PauseOverlay } from "./PauseOverlay";
import { StartScreen } from "./StartScreen";
import { TouchControls } from "./TouchControls";
import { installControlsTest } from "./controlsTest";
import { treeFromSearch } from "./deepLink";
import { commonFrame, portraitPose, shotSlug, treeExtent, type Extent, type Frame } from "./portrait";
import { getForest, treeApproach, type Forest } from "./forest";
import { GROW_VERSION } from "./growTree";
import { bindInput, isInputTarget } from "./input";
import { requestPlace } from "./location";
import { LEAF_SCALE } from "./preferences";
import { resetSim } from "./sim";
import { unlockSpeechOnGesture } from "./speech";
import { useGame } from "./store";

export function ForestApp() {
  const [mounted, setMounted] = useState(false);
  const [forest, setForest] = useState<Forest | null>(null);
  const playing = useGame((s) => s.playing);
  const play = useGame((s) => s.play);
  const setToast = useGame((s) => s.setToast);
  const toast = useGame((s) => s.toast);
  const nightStill = useGame((s) => s.sky.daylight < 0.5);

  // The sky follows the clock: sun and moon move a few hundredths of a degree between ticks.
  useEffect(() => {
    const id = window.setInterval(() => useGame.getState().tickSky(), 5000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    // For true sunrise and sunset (location.ts).
    if (playing) requestPlace(useGame.getState().place, useGame.getState().setPlace);
  }, [playing]);

  useEffect(() => {
    setMounted(true);
    const unbind = bindInput();
    installControlsTest();
    const unlockSpeech = unlockSpeechOnGesture();
    return () => { unbind?.(); unlockSpeech(); };
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

  // `?tree=<slug>` opens the drive beside that book's tree instead of at home.
  const linked = useMemo(() => (forest ? treeFromSearch(window.location.search, forest.trees) : undefined), [forest]);

  // `?shot=<slug>`: the tree alone, at midday in summer, for the book gallery (portrait.ts).
  // `window.__shot(slug)` aims at another tree without regrowing the forest.
  const shot = useGame((s) => s.portrait);
  useEffect(() => {
    const first = shotSlug(window.location.search);
    if (!forest || !first) return;
    const extentOf = (slug: string) => {
      const t = forest.trees.find((tr) => tr.book.slug === slug);
      return t ? treeExtent(forest.chunks[t.chunk]!.bark.pos, t.woodStart, t.woodCount, t.x, t.z) : null;
    };
    const aim = (slug: string, frame?: Frame): boolean => {
      const tree = forest.trees.findIndex((t) => t.book.slug === slug);
      if (tree < 0) return false;
      window.__shotReady = false;
      const t = forest.trees[tree]!;
      useGame.getState().setPortrait({ ...portraitPose(t, extentOf(slug)!, Math.PI / 2, frame), tree });
      return true;
    };
    const st = useGame.getState();
    // Every leaf drawn: changing the level regrows the forest and runs this again,
    // so the shot API is installed only on the forest that will be photographed.
    if (st.preferences.leaves !== "ultra") {
      st.setPreferences({ leaves: "ultra" });
      return;
    }
    st.setPreferences({ camera: "follow", fog: "light", weather: false, motion: false });
    st.setSeason("summer");
    const time = new URLSearchParams(window.location.search).get("time");
    st.setTimeMode(time === "dawn" || time === "dusk" ? time : "day");
    resetSim(forest);
    aim(first);
    play();
    window.__shot = aim;
    window.__shotExtent = extentOf;
    window.__shotFrame = (slugs) => commonFrame(slugs.map(extentOf).filter((e): e is Extent => e !== null));
    return () => { window.__shot = undefined; window.__shotExtent = undefined; window.__shotFrame = undefined; };
  }, [forest, play]);

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
      // About: ? anywhere, the start screen too. Its dialog handles Escape itself.
      if (e.key === "?" && !st.paused && !st.readingSlug && !isInputTarget(e.target)) { st.toggleHelp(); return; }
      if (!st.playing) return;
      if (e.code === "Escape") {
        if (st.paused || st.helpOpen) return; // The settings and About dialogs handle Escape themselves.
        if (st.readingSlug) st.openReader(null);
        else if (st.plaque) st.openPlaque(null);
        else if (st.catalogOpen) st.setCatalogOpen(false);
        else if (st.atlasOpen) st.setAtlasOpen(false);
        else if (st.libraryOpen) st.toggleLibrary();
        else st.pause(true);
        return;
      }
      // The reader and the settings take the keyboard; only Escape reaches past them.
      if (st.paused || st.readingSlug || isInputTarget(e.target)) return;
      if (e.code === "KeyL") st.toggleLibrary();
      if (e.code === "KeyG") st.toggleAtlas();
      if (e.code === "KeyB") st.toggleCatalog();
      if (e.code === "KeyQ") st.toggleCircuit();
      if (e.code === "KeyC") {
        const next = { follow: "high", high: "cart", cart: "god", god: "follow" } as const;
        st.setPreferences({ camera: next[st.preferences.camera] });
      }
      if (e.code === "KeyH" && forest) {
        st.selectGrove(null);
        st.requestJump(forest.home, "Home · the corpus redwood");
      }
    }
    window.addEventListener("keydown", onKey);
    function onBlur() {
      // Not over About: its location button's permission prompt takes the focus.
      if (useGame.getState().playing && !useGame.getState().helpOpen) useGame.getState().pause(true);
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
      {/* While the forest grows, a still of the start screen's circle, by day or by night as the sky is now
          (public/start, rendered from the forest itself); the live forest then fades in over it. */}
      <div className="absolute inset-0 start-wash" />
      {shot ? null : <img src={nightStill ? "start/night.webp" : "start/day.webp"} alt="" className="absolute inset-0 size-full object-cover" />}
      {mounted && forest ? (
        <div className="forest-fade-in absolute inset-0">
          <ForestCanvas forest={forest} />
        </div>
      ) : null}
      {playing && forest && !shot ? (
        <>
          <HUD forest={forest} />
          <TouchControls />
          <PauseOverlay />
        </>
      ) : shot ? null : (
        <StartScreen
          ready={Boolean(forest)}
          growing={!forest}
          opensAt={linked?.book.title}
          onEnter={(tour) => {
            if (forest) {
              resetSim(forest);
              play();
              // The tour sets off from home; a `?tree=` link is for driving there.
              if (tour) useGame.getState().toggleCircuit();
              else if (linked) {
                const st = useGame.getState();
                st.pickSearch(linked.book.slug);
                st.pinTree(linked.book.slug);
                st.requestJump(treeApproach(linked, forest.home.x, forest.home.z), linked.book.title);
              }
            }
          }}
        />
      )}
      {shot ? null : <About />}
    </main>
  );
}
