import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { textureAnisotropy } from "./Environment";
import { groveByGenre, type Forest } from "./forest";
import { drawGenreMark, MARK_BAND_R } from "./genreMarks";

/** The mark's band radius on the ground, m; the stop plaza is 4 m, so 1.5 m of brick shows around it. */
const MARK_R = 2.5;
/** Just above the plaza (0.055) and the grove rings (0.06). */
const MARK_Y = 0.07;
const TEXTURE_PX = 512;

/**
 * A genre mark painted on the stop plaza ahead of each grove, its top toward
 * the grove, so it reads the right way up to a cart pulling in to face the
 * signpost. One canvas texture per stop, like the signposts.
 */
export function GroveMarks({ forest }: { forest: Forest }) {
  const marks = useMemo(() => forest.circuit.map((wp) => {
    const grove = groveByGenre(forest, wp.genre);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = TEXTURE_PX;
    const ctx = canvas.getContext("2d");
    if (ctx) drawGenreMark(ctx, TEXTURE_PX, grove?.color ?? "#888888", wp.genre);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = textureAnisotropy(8);
    // The mesh is laid flat by a rotation about x, after a turn about its own
    // z that points the canvas's top along the bearing to the grove.
    const toward = grove ? Math.atan2(grove.z - wp.z, grove.x - wp.x) : 0;
    const turn = Math.atan2(-Math.cos(toward), -Math.sin(toward));
    return { wp, texture, turn };
  }), [forest]);
  useEffect(() => () => marks.forEach((m) => m.texture.dispose()), [marks]);

  // The band fills 347 of the canvas's 512-unit half-width; the rest is clear.
  const radius = MARK_R * (TEXTURE_PX / 2) / (MARK_BAND_R * TEXTURE_PX / 1024);
  return (
    <group>
      {marks.map(({ wp, texture, turn }) => (
        <mesh key={wp.genre} rotation={[-Math.PI / 2, 0, turn]} position={[wp.x, MARK_Y, wp.z]} receiveShadow>
          <circleGeometry args={[radius, 48]} />
          <meshStandardMaterial map={texture} transparent roughness={0.85} metalness={0} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      ))}
    </group>
  );
}
