import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { drawCompassRose, ROSE_R, ROSE_TILT } from "./compassRoseArt";
import { textureAnisotropy } from "./Environment";
import type { Forest } from "./forest";

const TEXTURE_PX = 2048;
/** Just above the plaza (0.055). */
const ROSE_Y = 0.062;

/** Clear paving between the root flare and the winds' feet, m. */
const FLARE_MARGIN = 0.4;

/**
 * A compass rose inlaid in the hub plaza round the corpus redwood, where the
 * cart starts and the tour leaves from: the trunk is its hub. North is the
 * forest's north (-z), so it can be steered by.
 */
export function CompassRose({ forest }: { forest: Forest }) {
  const hole = (forest.corpusTree.baseRadius + FLARE_MARGIN) / ROSE_R;
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = TEXTURE_PX;
    const ctx = canvas.getContext("2d");
    if (ctx) drawCompassRose(ctx, TEXTURE_PX, hole);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = textureAnisotropy(8);
    return t;
  }, [hole]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation={[ROSE_TILT, 0, 0]} position={[0, ROSE_Y, 0]} receiveShadow>
      <circleGeometry args={[ROSE_R, 64]} />
      <meshStandardMaterial map={texture} transparent roughness={0.85} metalness={0} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  );
}
