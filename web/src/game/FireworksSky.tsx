import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial, Vector3 } from "three";
import { sparkAt, SPARKS, SHELLS, VOLLEY_SECONDS, volley, type Spark } from "./fireworks";
import { useGame } from "./store";

const N = SPARKS * SHELLS;
const ahead = new Vector3();

/**
 * A volley of fireworks each time a quest is done (store `fireworks`).
 *
 * Held while the settings are open, where the season that finishes Bare wood
 * is picked, so it goes up when the forest is in view again. One point cloud,
 * drawn only during a volley.
 */
export function FireworksSky() {
  const seen = useRef(useGame.getState().fireworks);
  const live = useRef<{ sparks: Spark[]; t: number } | null>(null);
  const points = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(N * 3), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(N * 3), 3));
    const material = new PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true, blending: AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false });
    const p = new Points(geometry, material);
    p.frustumCulled = false;
    p.visible = false;
    return p;
  }, []);

  // Size is in device pixels: 4 CSS pixels on any screen.
  const pixelRatio = useThree((s) => s.gl.getPixelRatio());
  (points.material as PointsMaterial).size = 4 * pixelRatio;

  useFrame(({ camera }, delta) => {
    const game = useGame.getState();
    if (game.fireworks !== seen.current && !game.paused && !live.current) {
      seen.current = game.fireworks;
      camera.getWorldDirection(ahead);
      const eye = camera.position;
      live.current = { sparks: volley(Math.random, [eye.x, eye.y, eye.z], [ahead.x, ahead.y, ahead.z]), t: 0 };
    }
    const v = live.current;
    if (!v) return;
    v.t += Math.min(delta, 0.1);
    if (v.t > VOLLEY_SECONDS) {
      live.current = null;
      points.visible = false;
      return;
    }
    const pos = points.geometry.attributes.position as BufferAttribute;
    const col = points.geometry.attributes.color as BufferAttribute;
    v.sparks.forEach((s, i) => {
      const [x, y, z, b] = sparkAt(s, v.t);
      pos.setXYZ(i, x, y, z);
      // Additive: a darker color is a fainter spark.
      col.setXYZ(i, s.r * b, s.g * b, s.b * b);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
    points.visible = true;
  });

  return <primitive object={points} />;
}
