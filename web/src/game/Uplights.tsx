import { useEffect, useMemo } from "react";
import { AdditiveBlending, CanvasTexture, Color, type MeshStandardMaterial } from "three";
import { useGame } from "./store";

/**
 * Night floodlighting for the redwood and the exhibits, faked. Each lit
 * material glows in its own colour, strongest at the ground and fading with
 * height, as lamps at the foot would light it; small fixtures and a pool of
 * light on the paving show where the lamps are. No real lights are added:
 * three.js shades every light on every fragment of the whole forest, and a ring
 * of spotlights would cost the frame everywhere, not just here.
 */

/** How far the lamps are up: off by day, fading in through dusk, full once the sky is dark. */
export function useNightLamps(): number {
  const daylight = useGame((s) => s.sky.daylight);
  return Math.min(1, Math.max(0, (0.6 - daylight) / 0.45));
}

/**
 * Uplight these materials: their glow is their own colour times `color`, at
 * `strength` on the ground, falling to 1/e every `falloff` metres up.
 */
export function useUplitMaterials(materials: MeshStandardMaterial[], color: string, strength: number, falloff: number) {
  const night = useNightLamps();
  const lamp = useMemo(() => ({ value: 0 }), []);
  useEffect(() => {
    const tint = { value: new Color(color) };
    const reach = { value: falloff };
    for (const m of materials) {
      m.onBeforeCompile = (shader) => {
        // Uniform objects are handed over by reference, so changing `lamp.value` later reaches the shader.
        shader.uniforms.uplight = lamp;
        shader.uniforms.uplightColor = tint;
        shader.uniforms.uplightFalloff = reach;
        shader.vertexShader = "varying float vUplightY;\n" + shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n  vUplightY = (modelMatrix * vec4(transformed, 1.0)).y;",
        );
        shader.fragmentShader = "uniform float uplight; uniform vec3 uplightColor; uniform float uplightFalloff; varying float vUplightY;\n" +
          shader.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n  totalEmissiveRadiance += uplightColor * uplight * exp(-max(vUplightY, 0.0) / uplightFalloff) * diffuseColor.rgb;",
          );
      };
      m.customProgramCacheKey = () => "uplight-v1";
      m.needsUpdate = true;
    }
  }, [materials, color, falloff, lamp]);
  lamp.value = night * strength;
}

function usePoolTexture() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.55, "#bbb");
    g.addColorStop(1, "#000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/** `count` ground lamps in a ring of `radius`, and the pool of light they throw, `pool` metres past the ring. */
export function UplightFixtures({ radius, count, pool }: { radius: number; count: number; pool: number }) {
  const night = useNightLamps();
  const tex = usePoolTexture();
  const lens = useMemo(() => new Color("#3a2c1c").lerp(new Color("#ffdca6"), night), [night]);
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + 0.3;
        return (
          <group key={i} position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]}>
            <mesh position={[0, 0.09, 0]}>
              <cylinderGeometry args={[0.16, 0.2, 0.18, 10]} />
              <meshStandardMaterial color="#2b2d30" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.185, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.12, 12]} />
              <meshBasicMaterial color={lens} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      {night > 0.01 ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
          <circleGeometry args={[radius + pool, 40]} />
          <meshBasicMaterial map={tex} color="#ffc98a" transparent opacity={0.3 * night} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}
