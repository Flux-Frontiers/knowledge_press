import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, type BufferAttribute, type Group, type ShaderMaterial } from "three";
import { meteorAt, meteorGlow, meteorOverride, meteorSources, spawnMeteor, TRAIL, type Meteor } from "./meteors";
import type { SkyState } from "./sky";
import { overcast, weather } from "./weather";

/** At most this many meteors in the sky at once. */
const MAX_METEORS = 16;
/** Points drawn along each trail, tail to head. */
const TRAIL_POINTS = 64;
const N = MAX_METEORS * TRAIL_POINTS;

/**
 * Meteors, falling at tonight's real rates (meteors.ts): the sporadic
 * background, and each shower in season from its radiant among the stars.
 * They show as the stars do, through darkness and clear air, so a meteor at
 * dusk is lost in the twilight as a real one is. `?meteors=perseids` pins a
 * shower to its peak, and `?meteors=perseids:20` shows twenty times its rate.
 */
export function MeteorSky({ sky }: { sky: SkyState }) {
  const group = useRef<Group>(null);
  const material = useRef<ShaderMaterial>(null);
  const gl = useThree((s) => s.gl);
  const live = useRef<Meteor[]>([]);
  const pin = useMemo(() => meteorOverride(window.location.search), []);
  const sources = useMemo(
    () => meteorSources(pin ? pin.shower.peak : sky.solarLon, sky.starMatrix),
    [pin, sky.solarLon, sky.starMatrix],
  );
  const buffers = useMemo(() => ({ dir: new Float32Array(N * 3), level: new Float32Array(N), size: new Float32Array(N), tint: new Float32Array(N * 3) }), []);
  const uniforms = useMemo(() => ({ opacity: { value: 0 }, pixelRatio: { value: 1 } }), []);

  useFrame(({ camera }, delta) => {
    group.current?.position.copy(camera.position);
    const dt = Math.min(delta, 0.1);
    const opacity = (1 - sky.daylight) ** 2 * (1 - overcast(weather)) ** 2;
    const u = (material.current?.uniforms ?? uniforms) as typeof uniforms;
    u.opacity.value = opacity;
    u.pixelRatio.value = gl.getPixelRatio();

    const meteors = live.current;
    for (const m of meteors) m.age += dt;
    live.current = meteors.filter((m) => m.age < m.life);
    // Nothing to see in daylight: spend nothing on it.
    if (opacity > 0.01) {
      const boost = pin?.boost ?? 1;
      for (const src of sources) {
        if (live.current.length >= MAX_METEORS) break;
        if (Math.random() < (src.perHour * boost * dt) / 3600) {
          const m = spawnMeteor(src, Math.random);
          if (m) live.current.push(m);
        }
      }
    }

    const { dir, level, size, tint } = buffers;
    level.fill(0);
    live.current.forEach((m, k) => {
      const head = m.age / m.life;
      const tail = Math.max(0, head - TRAIL);
      const glow = meteorGlow(m);
      // Brighter meteors are bigger and stronger, on the stars' own scale.
      const bright = Math.min(9, Math.max(0, 6 - m.mag));
      for (let i = 0; i < TRAIL_POINTS; i++) {
        const f = i / (TRAIL_POINTS - 1);
        const p = meteorAt(m, tail + (head - tail) * f);
        const j = k * TRAIL_POINTS + i;
        dir.set(p, j * 3);
        tint.set(m.color, j * 3);
        level[j] = glow * f * f * Math.min(1, 0.3 + 0.12 * bright);
        size[j] = (1.8 + 0.7 * bright) * (0.5 + 0.5 * f);
      }
    });
    const geom = group.current?.children[0] as { geometry?: { attributes: Record<string, BufferAttribute> } } | undefined;
    const attrs = geom?.geometry?.attributes;
    if (attrs) for (const name of ["position", "level", "size", "tint"]) attrs[name]!.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[buffers.dir, 3]} />
          <bufferAttribute attach="attributes-level" args={[buffers.level, 1]} />
          <bufferAttribute attach="attributes-size" args={[buffers.size, 1]} />
          <bufferAttribute attach="attributes-tint" args={[buffers.tint, 3]} />
        </bufferGeometry>
        <shaderMaterial ref={material} transparent depthWrite={false} blending={AdditiveBlending} uniforms={uniforms}
          vertexShader={`uniform float pixelRatio;
            attribute float level; attribute float size; attribute vec3 tint;
            varying vec3 vTint; varying float vLevel;
            void main() {
              // Already a world direction; dimmed by the air near the horizon like the stars.
              vLevel = level * smoothstep(0.0, 0.12, position.y);
              vTint = tint;
              gl_PointSize = level > 0.0 ? size * pixelRatio : 0.0;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 235.0, 1.0);
            }`}
          fragmentShader={`uniform float opacity;
            varying vec3 vTint; varying float vLevel;
            void main() {
              float r = length(gl_PointCoord - 0.5) * 2.0;
              float a = smoothstep(1.0, 0.0, r);
              gl_FragColor = vec4(vTint * a * a * vLevel * opacity, 1.0);
              #include <colorspace_fragment>
            }`} />
      </points>
    </group>
  );
}
