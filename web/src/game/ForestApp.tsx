import { useEffect, useMemo, useRef, useState } from "react";
import { About } from "./About";
import { ForestCanvas } from "./ForestCanvas";
import { HUD } from "./HUD";
import { PauseOverlay } from "./PauseOverlay";
import { StartScreen } from "./StartScreen";
import { TouchControls } from "./TouchControls";
import { installControlsTest } from "./controlsTest";
import { searchWithTree, treeBySlug, treeFromSearch } from "./deepLink";
import { host } from "./host";
import { commonFrame, portraitPose, shotSlug, treeExtent, type Extent, type Frame } from "./portrait";
import { getForest, treeApproach, type Forest, type TreeSite } from "./forest";
import { GROW_VERSION } from "./growTree";
import { bindInput, isInputTarget } from "./input";
import { requestPlace } from "./location";
import { leafScaleFor, nextCamera } from "./preferences";
import { DOUBLE_LEAVES } from "./Environment";
import { resetSim, teleportSim } from "./sim";
import { clearResume, readResume, saveResume } from "./resume";
import { OWNED_SHOT } from "./cinema";
import { hush, unlockSpeechOnGesture } from "./speech";
import { stopBook } from "./bookReading";
import { stepAmbience } from "./ambience";
import { readerTarget, useGame } from "./store";
import { UpdateBanner } from "./UpdateBanner";

export function ForestApp() {
  const [mounted, setMounted] = useState(false);
  const [forest, setForest] = useState<Forest | null>(null);
  // The start buttons wait for the forest's first frame, not just its data: the first
  // frame uploads the geometry and compiles the shaders, and that is the stall.
  const [drawn, setDrawn] = useState(false);
  /** The forest has drawn a frame at least once; unlike `drawn`, a regrow (leaf level) does not reset it. */
  const [firstDrawn, setFirstDrawn] = useState(false);
  useEffect(() => setDrawn(false), [forest]);
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
  // The forest's sounds follow the sky and season; quieter under a voice, off while hidden,
  // before Enter, and in silent mode, as the visitor's hum is.
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const s = useGame.getState();
      const on = s.playing && !s.preferences.silent && document.visibilityState === "visible";
      const duck = typeof speechSynthesis !== "undefined" && speechSynthesis.speaking;
      stepAmbience(on ? s.preferences.sounds : 0, s.sky.daylight, s.sky.morning, s.season, duck, (now - last) / 1000);
      last = now;
    }, 1000);
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
  const leafScale = useGame((s) => leafScaleFor(s.preferences.leaves, DOUBLE_LEAVES));
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
  // An app host's `goto` / `home` (host.ts) re-aims it without reloading: `aim` is
  // the slug it last sent, null for home, undefined while it has sent none.
  const [aim, setAim] = useState<string | null | undefined>(undefined);
  const linked = useMemo(() => {
    if (!forest) return undefined;
    if (aim === undefined) return treeFromSearch(window.location.search, forest.trees);
    return aim ? treeBySlug(aim, forest.trees) : undefined;
  }, [forest, aim]);

  // Beside a tree with its card up: what Enter does for a `?tree=` link, and `goto` mid-drive.
  const landAt = (f: Forest, tree: TreeSite) => {
    const st = useGame.getState();
    st.pickSearch(tree.book.slug);
    st.pinTree(tree.book.slug);
    st.requestJump(treeApproach(tree, f.home.x, f.home.z), tree.book.title);
  };

  // Commands from an app host. Without one nothing is ever dispatched.
  const announced = useRef(false);
  useEffect(() => {
    if (!forest) return;
    const off = host.on((command) => {
      const st = useGame.getState();
      if (command.kind === "worker") { st.setHostWorker(command.url); return; }
      if (command.kind === "quiet") { stopBook(); hush(); return; }
      const slug = command.kind === "goto" ? command.slug : null;
      const tree = slug ? treeBySlug(slug, forest.trees) : undefined;
      if (slug && !tree) return;
      setAim(tree ? tree.book.slug : null);
      try {
        history.replaceState(history.state, "", searchWithTree(window.location.search, tree ? tree.book.slug : null) || window.location.pathname);
      } catch { /* an address the page cannot rewrite: only a reload would miss it */ }
      // On the start screen the new aim is what Enter does; mid-drive, go now.
      if (!st.playing) return;
      if (st.readingSlug) st.openReader(null);
      if (st.mootId) st.playMoot(null);
      if (st.mootsOpen) st.openMoots(false);
      if (st.plaque) st.openPlaque(null);
      if (st.paused) st.pause(false);
      if (tree) landAt(forest, tree);
      else {
        st.selectGrove(null);
        st.pinTree(null);
        st.requestJump(forest.home, "Home · the corpus redwood");
      }
    });
    // Once, when the first forest has grown: the host holds commands until it hears this.
    if (!announced.current) {
      announced.current = true;
      host.post({ kind: "ready" });
    }
    return off;
  }, [forest]);

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
    st.setTimeMode(time === "dawn" || time === "dusk" || time === "twilight" || time === "night" ? time : "day");
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

  // Back where the rider was after a reload: on a phone the system kills the page for memory
  // and the app reloads it (resume.ts). A shot, a QA run or a `?tree=` link opens as asked.
  const resume = useRef(
    OWNED_SHOT || shotSlug(window.location.search) || /[?&](qa|tree)=/.test(window.location.search) ? null : readResume(),
  );
  useEffect(() => {
    let last = 0;
    return useGame.subscribe((s, prev) => {
      if (prev.playing && !s.playing) { clearResume(); return; }
      if (!s.playing) return;
      const now = Date.now();
      if (now - last < 2000 && s.travelMode === prev.travelMode) return;
      last = now;
      saveResume({ x: s.x, z: s.z, yaw: s.yaw, circuit: s.travelMode === "circuit" }, now);
    });
  }, []);
  useEffect(() => {
    const r = resume.current;
    if (!forest || !drawn || !r) return;
    resume.current = null;
    resetSim(forest);
    teleportSim(r.x, r.z, r.yaw);
    const st = useGame.getState();
    // The store's pose too, or the first save after this records the spawn point.
    st.setPose(r.x, r.z, r.yaw, 0);
    play();
    if (r.circuit) st.toggleCircuit();
    st.setToast(r.circuit ? "Back on the ring" : "Back where you were");
  }, [forest, drawn, play]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast, setToast]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const st = useGame.getState();
      // About, opened at its key list: ? anywhere, the start screen too. Its dialog handles Escape itself.
      if (e.key === "?" && !st.paused && !st.readingSlug && !st.mootsOpen && !st.mootId && !isInputTarget(e.target)) { st.toggleHelp("keys"); return; }
      if (!st.playing) return;
      if (e.code === "Escape") {
        if (st.paused || st.helpOpen) return; // The settings and About dialogs handle Escape themselves.
        if (st.mootId) st.playMoot(null);
        else if (st.mootsOpen) st.openMoots(false);
        else if (st.readingSlug) st.openReader(null);
        else if (st.plaque) st.openPlaque(null);
        else if (st.catalogOpen) st.setCatalogOpen(false);
        else if (st.atlasOpen) st.setAtlasOpen(false);
        else if (st.libraryOpen) st.toggleLibrary();
        else st.pause(true);
        return;
      }
      // The reader, the moots and the settings take the keyboard; only Escape reaches past them.
      if (st.paused || st.readingSlug || st.mootsOpen || st.mootId || isInputTarget(e.target)) return;
      if (e.code === "KeyL") st.toggleLibrary();
      if (e.code === "KeyG") st.toggleAtlas();
      if (e.code === "KeyB") st.toggleCatalog();
      if (e.code === "KeyQ") st.toggleCircuit();
      if (e.code === "KeyC") st.setPreferences({ camera: nextCamera(st.preferences.camera) });
      // Not with a modifier: Cmd+R and Ctrl+R reload the page.
      if (e.code === "KeyR" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const slug = readerTarget(st);
        if (slug) st.openReader(slug);
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
        // Hidden until its first frame is drawn, then faded in: Safari on an iPad can show a WebGL canvas
        // that has not drawn yet as a white sheet, a flash between the still and the forest.
        <div className={"absolute inset-0 " + (firstDrawn ? "forest-fade-in" : "opacity-0")}>
          <ForestCanvas forest={forest} onDrawn={() => { setDrawn(true); setFirstDrawn(true); }} />
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
          ready={Boolean(forest) && drawn}
          growing={!forest || !drawn}
          opensAt={linked?.book.title}
          onEnter={(tour) => {
            if (forest) {
              resetSim(forest);
              play();
              // The tour sets off from home; a `?tree=` link is for driving there.
              if (tour) useGame.getState().toggleCircuit();
              else if (linked) landAt(forest, linked);
            }
          }}
        />
      )}
      {shot ? null : <About />}
      {shot ? null : <UpdateBanner />}
    </main>
  );
}
