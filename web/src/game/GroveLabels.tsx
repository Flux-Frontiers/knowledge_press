import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { Forest } from "./forest";
import { useGame } from "./store";

/** Label canvas height, px; the width follows the text. */
const LABEL_PX = 96;
/** On screen, a label is this fraction of the view's height tall. */
const LABEL_SCREEN = 0.032;
/** Above the grove's centre, m, so a label clears the canopy it names. */
const LABEL_Y = 30;

/**
 * Grove names over each grove, in god's eye only: from that height the groves
 * run together, and a name says which is which without zooming. Sprites keep
 * one size on screen at every zoom and draw over the trees.
 */
export function GroveLabels({ forest }: { forest: Forest }) {
  const show = useGame((s) => s.preferences.camera === "god" && !s.flight);
  const labels = useMemo(
    () =>
      forest.groves.map((g) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const font = `600 ${LABEL_PX * 0.56}px "Source Sans 3", ui-sans-serif, system-ui, sans-serif`;
        let width = LABEL_PX * 4;
        if (ctx) {
          ctx.font = font;
          width = Math.ceil(ctx.measureText(g.label).width + LABEL_PX * 0.7);
        }
        canvas.width = width;
        canvas.height = LABEL_PX;
        if (ctx) {
          ctx.font = font;
          ctx.fillStyle = "rgba(22, 33, 62, 0.78)";
          ctx.beginPath();
          ctx.roundRect(0, 0, width, LABEL_PX, LABEL_PX / 2);
          ctx.fill();
          ctx.fillStyle = g.color;
          ctx.fillRect(LABEL_PX * 0.3, LABEL_PX * 0.78, width - LABEL_PX * 0.6, LABEL_PX * 0.05);
          ctx.fillStyle = "#f3e6c2";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(g.label, width / 2, LABEL_PX * 0.46);
        }
        const texture = new CanvasTexture(canvas);
        texture.colorSpace = SRGBColorSpace;
        return { grove: g, texture, aspect: width / LABEL_PX };
      }),
    [forest],
  );
  useEffect(() => () => labels.forEach((l) => l.texture.dispose()), [labels]);
  if (!show) return null;
  return (
    <group>
      {labels.map(({ grove, texture, aspect }) => (
        <sprite key={grove.genre} position={[grove.x, LABEL_Y, grove.z]} scale={[LABEL_SCREEN * aspect, LABEL_SCREEN, 1]} renderOrder={10}>
          <spriteMaterial map={texture} sizeAttenuation={false} depthTest={false} depthWrite={false} transparent fog={false} />
        </sprite>
      ))}
    </group>
  );
}
