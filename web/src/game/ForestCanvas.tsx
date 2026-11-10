import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import { ACESFilmicToneMapping, PerspectiveCamera, Raycaster, Vector2 } from "three";
import { COARSE_POINTER, EXPOSURE, PHONE } from "./Environment";
import { pickTree, type Forest, type TreeSite } from "./forest";
import { forestGodLimits, godPose, panGodView, zoomGodView } from "./godEye";
import { GroveLabels } from "./GroveLabels";
import { Player } from "./Player";
import { setScreenshotCapture } from "./screenshot";
import { Trees } from "./Trees";
import { World } from "./World";
import { useGame } from "./store";

export function ForestCanvas({ forest, onDrawn }: {
  forest: Forest;
  /** Called once the forest has drawn its first frame, geometry uploaded and shaders compiled. */
  onDrawn?: () => void;
}) {
  const season = useGame((s) => s.season);
  const query = useGame((s) => s.query);
  const playing = useGame((s) => s.playing);
  const shadows = useGame((s) => s.preferences.shadows);
  const picker = useRef<((e: MouseEvent) => TreeSite | null) | null>(null);

  return (
    <Canvas
      // "percentage" is PCFShadowMap, which three r186 makes soft itself; "soft" asks for the removed PCFSoftShadowMap.
      shadows={shadows ? "percentage" : false}
      camera={{ position: [forest.spawn.x, 6.2, forest.spawn.z + 10], fov: 58, near: 0.12, far: 560 }}
      dpr={[1, PHONE ? 1 : COARSE_POINTER ? 1.25 : 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#16213e");
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = EXPOSURE;
      }}
      onPointerDown={() => (document.activeElement as HTMLElement | null)?.blur()}
      onPointerMissed={(e) => {
        const s = useGame.getState();
        if (s.catalogOpen) s.setCatalogOpen(false);
        else if (s.libraryOpen) s.toggleLibrary();
        else if (s.atlasOpen) s.toggleAtlas();
        else {
          // Clicking a tree pins its card, silent mode or not; clicking open ground clears it.
          const tree = picker.current?.(e);
          if (tree) s.pinTree(tree.book.slug);
          else s.dismissNearby();
        }
      }}
    >
      <World forest={forest} season={season} />
      <Trees forest={forest} season={season} query={query} />
      <StatsSampler />
      {onDrawn ? <FirstFrame forest={forest} onDrawn={onDrawn} /> : null}
      <ScreenshotCapture />
      <TreePicker forest={forest} picker={picker} />
      <GodEyeControls forest={forest} />
      <GroveLabels forest={forest} />
      <Player forest={forest} playing={playing} />
    </Canvas>
  );
}

/**
 * Reports the forest's first drawn frame. useFrame runs before its frame renders,
 * so the second call means the first frame, which uploads the geometry and
 * compiles the shaders, is on screen; a regrown forest starts the count again.
 */
function FirstFrame({ forest, onDrawn }: { forest: Forest; onDrawn: () => void }) {
  const frames = useRef(0);
  useEffect(() => { frames.current = 0; }, [forest]);
  useFrame(() => {
    if (frames.current < 2 && ++frames.current === 2) onDrawn();
  });
  return null;
}

/** Twice a second, copy the renderer's last-frame counts into the store for the HUD readout. */
function StatsSampler() {
  const acc = useRef({ t: 0, frames: 0 });
  useFrame(({ gl }, delta) => {
    const s = useGame.getState();
    if (!s.preferences.stats) {
      if (s.stats) s.setStats(null);
      return;
    }
    acc.current.t += delta;
    acc.current.frames++;
    if (acc.current.t < 0.5) return;
    // Counts cover the whole previous frame, shadow pass included.
    s.setStats({ tris: gl.info.render.triangles, calls: gl.info.render.calls, fps: acc.current.frames / acc.current.t });
    acc.current = { t: 0, frames: 0 };
  });
  return null;
}

const raycaster = new Raycaster();
const ndc = new Vector2();

/** Trees have no pointer handlers (raycasting their meshes is costly), so a click that hits nothing is tested against their outlines. */
function TreePicker({ forest, picker }: { forest: Forest; picker: RefObject<((e: MouseEvent) => TreeSite | null) | null> }) {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    picker.current = (e) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      // No farther than the fog lets you see (Trees.tsx hides groves past the same cutoff).
      const density = scene.fog && "density" in scene.fog ? (scene.fog.density as number) : 0;
      const maxDist = density > 0 ? 2.6 / density : 200;
      return pickTree(forest, raycaster.ray.origin, raycaster.ray.direction, maxDist);
    };
    return () => { picker.current = null; };
  }, [forest, picker, camera, gl, scene]);
  return null;
}

const godCam = new PerspectiveCamera();
const zoomRay = new Raycaster();
/** Pixels a press may wander and still be a click on a tree, not a pan. */
const PAN_CLICK = 6;

/**
 * In god's eye, the view handles like a map. The wheel and a two-finger pinch
 * zoom toward the ground point under the cursor or between the fingers; a
 * drag with the mouse or one finger grabs the ground and pans; two fingers
 * pan as they pinch (godEye.ts). Ground points are found from the pose the
 * camera is easing to, not the one it shows, so a quick run of wheel clicks
 * or a fast drag stays anchored. A click that ends a pan is not a click on a
 * tree.
 */
function GodEyeControls({ forest }: { forest: Forest }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const godEye = () => {
      const s = useGame.getState();
      return s.preferences.camera === "god" && !s.flight && s.playing && !s.paused;
    };
    /** The ground point under a screen point, or the view's centre above the horizon. */
    const groundAt = (clientX: number, clientY: number): [number, number] => {
      const rect = el.getBoundingClientRect();
      const pose = godPose();
      godCam.copy(camera as PerspectiveCamera);
      godCam.position.set(pose.cam.x, pose.cam.y, pose.cam.z);
      godCam.lookAt(pose.look.x, pose.look.y, pose.look.z);
      godCam.updateMatrixWorld();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      zoomRay.setFromCamera(ndc, godCam);
      const { origin, direction } = zoomRay.ray;
      const t = direction.y < -1e-3 ? -origin.y / direction.y : 0;
      return t > 0 ? [origin.x + direction.x * t, origin.z + direction.z * t] : [pose.look.x, pose.look.z];
    };
    const zoomAt = (clientX: number, clientY: number, factor: number) => {
      const [ax, az] = groundAt(clientX, clientY);
      zoomGodView(ax, az, factor, forestGodLimits(forest), forest.worldRadius);
    };
    /** Pan so the ground under (fromX, fromY) moves to (toX, toY). */
    const panBetween = (fromX: number, fromY: number, toX: number, toY: number) => {
      const [ax, az] = groundAt(fromX, fromY);
      const [bx, bz] = groundAt(toX, toY);
      panGodView(ax - bx, az - bz, forestGodLimits(forest), forest.worldRadius);
    };
    const onWheel = (e: WheelEvent) => {
      if (!godEye()) return;
      e.preventDefault();
      // Lines and pages scroll farther than pixels; a mouse notch is about 100 px.
      const px = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 600 : 1);
      zoomAt(e.clientX, e.clientY, Math.exp(px * 0.0015));
    };
    const pointers = new Map<number, { x: number; y: number }>();
    let spread = 0;
    let moved = 0;
    /** When the last pan ended, ms; the click that follows it is not a click. */
    let pannedAt = -Infinity;
    const onDown = (e: PointerEvent) => {
      if (!godEye() || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (pointers.size === 0) moved = 0;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      spread = 0;
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      if (!godEye()) {
        pointers.clear();
        return;
      }
      if (pointers.size === 1) {
        // Held at the press point until the pointer has wandered past a click, then the whole way is panned at once.
        moved = Math.max(moved, Math.hypot(e.clientX - prev.x, e.clientY - prev.y));
        if (moved <= PAN_CLICK) return;
        panBetween(prev.x, prev.y, e.clientX, e.clientY);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        return;
      }
      if (pointers.size !== 2) return;
      const [a0, b0] = [...pointers.values()];
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.values()];
      moved = Infinity;
      // The midpoint drags the ground with it, then the spread zooms about where it now is.
      panBetween((a0.x + b0.x) / 2, (a0.y + b0.y) / 2, (a.x + b.x) / 2, (a.y + b.y) / 2);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (spread > 0 && d > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, spread / d);
      spread = d;
    };
    const onUp = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      spread = 0;
      if (pointers.size === 0 && moved > PAN_CLICK) pannedAt = performance.now();
    };
    // A pan that ends over a tree or a signpost is not a click on it.
    const onClick = (e: MouseEvent) => {
      if (performance.now() - pannedAt > 300 || !(e.target instanceof Node) || !el.contains(e.target)) return;
      pannedAt = -Infinity;
      e.stopPropagation();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("lostpointercapture", onUp);
    window.addEventListener("click", onClick, true);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("lostpointercapture", onUp);
      window.removeEventListener("click", onClick, true);
    };
  }, [forest, camera, gl]);
  return null;
}

/** Lets the HUD's camera button read the view: render a frame and read it back in the same task, before the buffer clears. */
function ScreenshotCapture() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    setScreenshotCapture(() => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    });
    return () => setScreenshotCapture(null);
  }, [gl, scene, camera]);
  return null;
}
