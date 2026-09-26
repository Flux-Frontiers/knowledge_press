import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { ACESFilmicToneMapping } from "three";
import { COARSE_POINTER, PHONE } from "./Environment";
import type { Forest } from "./forest";
import { Player } from "./Player";
import { setScreenshotCapture } from "./screenshot";
import { Trees } from "./Trees";
import { World } from "./World";
import { useGame } from "./store";

export function ForestCanvas({ forest }: { forest: Forest }) {
  const season = useGame((s) => s.season);
  const query = useGame((s) => s.query);
  const playing = useGame((s) => s.playing);
  const detail = useGame((s) => s.preferences.detail);

  return (
    <Canvas
      shadows={detail ? "soft" : false}
      camera={{ position: [forest.spawn.x, 6.2, forest.spawn.z + 10], fov: 58, near: 0.12, far: 560 }}
      dpr={[1, PHONE ? 1 : COARSE_POINTER ? 1.25 : 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#16213e");
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
      onPointerDown={() => (document.activeElement as HTMLElement | null)?.blur()}
      onPointerMissed={() => {
        const s = useGame.getState();
        if (s.catalogOpen) s.setCatalogOpen(false);
        else if (s.libraryOpen) s.toggleLibrary();
        else if (s.atlasOpen) s.toggleAtlas();
        else s.dismissNearby();
      }}
    >
      <World forest={forest} season={season} />
      <Trees forest={forest} season={season} query={query} />
      <StatsSampler />
      <ScreenshotCapture />
      <Player forest={forest} playing={playing} />
    </Canvas>
  );
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
