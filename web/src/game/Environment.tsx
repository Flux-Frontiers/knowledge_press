import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { BackSide, BufferGeometry, CanvasTexture, Color, DirectionalLight, DoubleSide, Float32BufferAttribute, IcosahedronGeometry, InstancedMesh, MeshStandardMaterial, Object3D, RepeatWrapping, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector3 } from "three";
import type { Forest } from "./forest";
import type { SkyState } from "./sky";
import { mulberry32 } from "./math";
import type { SeasonName } from "./seasons";
import { sim } from "./sim";
import { useGame } from "./store";

/**
 * A camera-centred sky: no distant sphere edge when exploring the outer groves.
 * The sun and moon stand where sky.ts puts them for the clock. The moon is drawn
 * as a sphere lit from the sun's direction, so its phase, and which way its
 * lit side faces, come from where the two actually are. Both discs are drawn
 * about eight times their true size so they read from the cart.
 */
export function Sky({ sky, season }: { sky: SkyState; season: SeasonName }) {
  const dome = useRef<Object3D>(null);
  const material = useRef<ShaderMaterial>(null);
  // NASA SVS's LRO colour map (public/textures/moon/CREDITS.md): the moon's surface, lit by the shader.
  const moonMap = useMemo(() => {
    const tex = new TextureLoader().load("textures/moon/moon_color.jpg", () => {
      const u = material.current?.uniforms;
      if (u?.moonReady) u.moonReady.value = 1;
    });
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);
  useEffect(() => () => moonMap.dispose(), [moonMap]);
  const uniforms = useMemo(() => ({
    zenith: { value: new Color() },
    horizon: { value: new Color() },
    daylight: { value: 0 },
    warmth: { value: 0 },
    sunDir: { value: new Vector3(0, 1, 0) },
    moonDir: { value: new Vector3(0, -1, 0) },
    moonFraction: { value: 0 },
    moonMap: { value: moonMap },
    moonReady: { value: 0 },
  }), [moonMap]);
  // Written through the material, not `uniforms`: the material holds its own
  // copy, sharing the Color and Vector3 objects but not plain numbers, so a
  // number set on `uniforms` after the first render would never reach the shader.
  useEffect(() => {
    const u = (material.current?.uniforms ?? uniforms) as typeof uniforms;
    const t = sky.daylight;
    u.zenith.value.set("#071224").lerp(new Color(season === "winter" ? "#7496af" : "#427fae"), t);
    u.horizon.value.set("#263c51").lerp(new Color(season === "autumn" ? "#e8c8a1" : "#d1e0d6"), t);
    u.daylight.value = t;
    u.warmth.value = sky.warmth;
    u.sunDir.value.set(...sky.sunDir);
    u.moonDir.value.set(...sky.moonDir);
    u.moonFraction.value = sky.moonFraction;
    // In case the map finished loading before the material existed to hear it.
    if (moonMap.image) u.moonReady.value = 1;
  }, [sky, season, uniforms, moonMap]);
  const stars = useMemo(() => {
    const random = mulberry32(917);
    const positions = new Float32Array(750 * 3);
    for (let i = 0; i < 750; i++) {
      const y = 0.12 + random() * 0.88;
      const angle = random() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      positions.set([Math.cos(angle) * r * 240, y * 240, Math.sin(angle) * r * 240], i * 3);
    }
    return positions;
  }, []);
  // Stars come out as the sky darkens, not at a switch.
  const starOpacity = 0.8 * (1 - sky.daylight) ** 2;
  useFrame(({ camera }) => dome.current?.position.copy(camera.position));
  return (
    <group ref={dome}>
      <mesh renderOrder={-10}>
        <sphereGeometry args={[280, 32, 16]} />
        <shaderMaterial ref={material} side={BackSide} depthWrite={false} uniforms={uniforms}
          vertexShader={`varying vec3 direction;
            void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
          fragmentShader={`varying vec3 direction;
            uniform vec3 zenith; uniform vec3 horizon; uniform float daylight; uniform float warmth;
            uniform vec3 sunDir; uniform vec3 moonDir; uniform float moonFraction;
            uniform sampler2D moonMap; uniform float moonReady;
            void main() {
              vec3 d = normalize(direction);
              vec3 col = mix(horizon, zenith, pow(max(d.y, 0.0), 0.55));
              // Sunrise and sunset: the low sky warms, most toward the sun.
              vec2 dh = normalize(d.xz + vec2(1e-5));
              vec2 sh = normalize(sunDir.xz + vec2(1e-5));
              float toward = 0.35 + 0.65 * pow(max(dot(dh, sh), 0.0), 3.0);
              col = mix(col, vec3(.98, .55, .30), warmth * toward * pow(1.0 - max(d.y, 0.0), 3.0) * 0.75);
              float sun = max(dot(d, sunDir), 0.0);
              float sunUp = smoothstep(-0.05, 0.02, sunDir.y);
              col += vec3(1., .55, .28) * pow(sun, 6.) * .3 * warmth * sunUp;
              col += vec3(1., .8, .5) * pow(sun, 32.) * .28 * daylight * sunUp;
              // Mixed in, not added, so a low sun stays orange instead of clipping to white.
              col = mix(col, mix(vec3(1., .97, .88), vec3(1., .42, .16), warmth) * 1.15, smoothstep(.9992, .9997, sun) * sunUp);
              // The moon: 0.0374 is the sine of the disc's radius (acos 0.9993, about 2.1 degrees).
              // Disc coordinates and the map lookup run for every pixel, outside the branch,
              // so the texture's mipmap derivatives stay defined.
              float md = dot(d, moonDir);
              float moonUp = smoothstep(-0.03, 0.03, moonDir.y);
              vec3 right = normalize(cross(moonDir, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));
              vec3 up = cross(right, moonDir);
              vec2 p = vec2(dot(d, right), dot(d, up)) / 0.0374;
              float r2 = dot(p, p);
              float z = sqrt(max(1.0 - r2, 0.0));
              // The near side faces us: longitude runs toward the viewer's right (Mare Crisium
              // is at +59), latitude up. The map is equirectangular, centred on longitude 0.
              vec2 muv = vec2(0.5 + atan(p.x, max(z, 1e-4)) / 6.2831853, 0.5 + asin(clamp(p.y, -1.0, 1.0)) / 3.1415927);
              vec3 albedo = mix(vec3(.82), texture2D(moonMap, muv).rgb, moonReady);
              // The mosaic is normalised flat and a little blue: half its colour, and more contrast for the maria.
              albedo = mix(vec3(dot(albedo, vec3(.2126, .7152, .0722))), albedo, 0.5);
              albedo = pow(albedo, vec3(1.8)) * 1.45;
              if (md > 0.9993 && moonUp > 0.0 && r2 < 1.0) {
                // The visible hemisphere's normal faces back toward the viewer.
                vec3 n = p.x * right + p.y * up - z * moonDir;
                float lit = smoothstep(-0.04, 0.08, dot(n, sunDir));
                float edge = smoothstep(1.0, 0.85, r2) * moonUp;
                // Earthshine: the unlit side is faintly there at night.
                col = mix(col, albedo * .1, (1.0 - lit) * edge * (1.0 - daylight) * 0.75);
                col = mix(col, albedo * 1.05, lit * edge * mix(1.0, 0.55, daylight));
              }
              col += vec3(.45, .5, .62) * pow(max(md, 0.0), 900.0) * .35 * moonFraction * (1.0 - daylight) * moonUp;
              gl_FragColor = vec4(col, 1.);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`} />
      </mesh>
      <points visible={starOpacity > 0.01}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[stars, 3]} /></bufferGeometry>
        <pointsMaterial color="#e4edff" size={0.65} sizeAttenuation transparent opacity={starOpacity} depthWrite={false} fog={false} />
      </points>
    </group>
  );
}

/** Tablets and phones: fewer pixels and a smaller shadow map keep the frame rate up. */
export const COARSE_POINTER = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
/** Phones: a touch screen under 640px on its short side. */
export const PHONE = COARSE_POINTER && Math.min(screen.width, screen.height) < 640;

/**
 * WebKit (Safari, and every browser on iOS) renders a texture black when
 * anisotropic filtering is on: roads, plazas and bark all went black in Safari
 * while rocks, which never set it, were fine. Chrome's "Chrome/" token keeps it
 * out; iOS Chrome ("CriOS") runs WebKit and stays in.
 */
const WEBKIT = typeof navigator !== "undefined" && /AppleWebKit/.test(navigator.userAgent) && !/Chrome\//.test(navigator.userAgent);

/** Anisotropy to set on a texture: `n` where it works, off (1) in WebKit. */
export function textureAnisotropy(n: number): number {
  return WEBKIT ? 1 : n;
}

/**
 * The one shadow-casting light, from the sun, the moon or the stars (sky.ts),
 * kept on a modest shadow map around the cart instead of covering the forest.
 */
export function Sunlight({ light: l, detail }: { light: SkyState["light"]; detail: boolean }) {
  const light = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  // Never from below the ground: a sun on the horizon still lights from just above it.
  const dir = useMemo(() => new Vector3(l.dir[0], Math.max(l.dir[1], 0.05), l.dir[2]).normalize(), [l.dir]);
  useFrame(() => {
    if (!light.current) return;
    target.position.set(sim.x, 0, sim.z);
    light.current.position.set(sim.x + dir.x * 80, dir.y * 80, sim.z + dir.z * 80);
    target.updateMatrixWorld();
  });
  return <>
    <primitive object={target} />
    {/* With no shadow to cast (night, twilight, a low sun) the shadow pass is skipped entirely. */}
    <directionalLight ref={light} target={target} color={l.color}
      intensity={l.intensity} castShadow={detail && l.shadow > 0.01} shadow-intensity={l.shadow}
      shadow-mapSize={COARSE_POINTER ? [1024, 1024] : [2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40}
      shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-near={1} shadow-camera-far={160}
      shadow-bias={-0.0002} shadow-normalBias={0.08} />
  </>;
}

export function useGroundTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const random = mulberry32(372);
    ctx.fillStyle = "#b2b6a1";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8000; i++) {
      const value = 80 + Math.floor(random() * 130);
      ctx.fillStyle = `rgba(${value},${value},${value * 0.85},0.25)`;
      ctx.fillRect(random() * 256, random() * 256, 1 + random() * 4, 1 + random() * 3);
    }
    const result = new CanvasTexture(canvas);
    result.wrapS = result.wrapT = RepeatWrapping;
    result.repeat.set(70, 70);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

/** A lumpy, faceted rock: an icosahedron whose vertices are pushed in and out by a hash of their direction. */
function rockGeometry(seed: number) {
  const g = new IcosahedronGeometry(1, 1);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // Same direction, same push: shared corners of adjacent faces stay welded.
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
    const k = 0.78 + 0.36 * (h - Math.floor(h));
    p.setXYZ(i, x * k, y * k * 0.72, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A grass tuft: nine slender blades fanning out from one root, each a curved
 * three-segment strip that tapers to a point and bends outward as it rises.
 * Vertex colour runs dark at the base to light at the tip, so a tuft reads as
 * grass rather than as a solid shape.
 */
function tuftGeometry() {
  const pos: number[] = [];
  const col: number[] = [];
  const index: number[] = [];
  const rng = mulberry32(911);
  const blades = 9;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + rng() * 0.5;
    const ox = Math.cos(a), oz = Math.sin(a);
    // Perpendicular for blade width.
    const px = -oz, pz = ox;
    const h = 0.6 + rng() * 0.4;
    const bend = 0.25 + rng() * 0.35;
    const w = 0.03 + rng() * 0.015;
    const first = pos.length / 3;
    const segs = 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const out = bend * t * t + 0.04; // curves outward more near the tip
      const cx = ox * out, cz = oz * out, cy = h * t;
      const half = w * (1 - t) + 0.002;
      pos.push(cx - px * half, cy, cz - pz * half, cx + px * half, cy, cz + pz * half);
      const shade = 0.45 + 0.65 * t;
      col.push(shade, shade, shade, shade, shade, shade);
    }
    for (let s = 0; s < segs; s++) {
      const i = first + s * 2;
      index.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** CC0 ambientCG Rock028 (see public/textures/rock/CREDITS.md), tinted per rock by instance colour. */
function rockMaterial() {
  const loader = new TextureLoader();
  const load = (map: string, srgb = false) => {
    const tex = loader.load(`textures/rock/rock_${map}.jpg`);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    if (srgb) tex.colorSpace = SRGBColorSpace;
    return tex;
  };
  return new MeshStandardMaterial({ map: load("color", true), normalMap: load("normal"), roughness: 0.95 });
}

export function ForestFloor({ forest, season }: { forest: Forest; season: SeasonName }) {
  const grass = useRef<InstancedMesh>(null);
  const rocks = useRef<InstancedMesh>(null);
  const rockGeo = useMemo(() => rockGeometry(3.7), []);
  const tuftGeo = useMemo(() => tuftGeometry(), []);
  const rockMat = useMemo(() => rockMaterial(), []);
  const sway = useMemo(() => ({ value: 0 }), []);
  const grassMat = useMemo(() => {
    const m = new MeshStandardMaterial({ side: DoubleSide, roughness: 1, vertexColors: true });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.swayTime = sway;
      shader.vertexShader = "uniform float swayTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `
        #include <begin_vertex>
        float ph = instanceMatrix[3].x * .21 + instanceMatrix[3].z * .17;
        transformed.x += sin(swayTime * 2.1 + ph) * .12 * position.y * position.y;
        transformed.z += cos(swayTime * 1.7 + ph) * .07 * position.y * position.y;
      `);
    };
    m.customProgramCacheKey = () => "forest-grass-sway-v2";
    return m;
  }, [sway]);
  useEffect(() => () => {
    rockGeo.dispose(); tuftGeo.dispose(); grassMat.dispose();
    rockMat.map?.dispose(); rockMat.normalMap?.dispose(); rockMat.dispose();
  }, [rockGeo, tuftGeo, grassMat, rockMat]);
  useFrame((_, delta) => {
    const s = useGame.getState();
    if (s.preferences.motion && !s.paused) sway.value += Math.min(delta, 0.1);
  });
  useLayoutEffect(() => {
    if (!grass.current || !rocks.current) return;
    const random = mulberry32(247);
    const dummy = new Object3D();
    const color = new Color();
    let blades = 0;
    let stones = 0;
    const placeRock = (x: number, z: number, size: number) => {
      dummy.position.set(x, size * 0.18, z); // half-sunk
      dummy.rotation.set(random() * 0.6, random() * Math.PI * 2, random() * 0.6);
      dummy.scale.set(size * (0.8 + random() * 0.5), size * (0.6 + random() * 0.5), size * (0.8 + random() * 0.5));
      dummy.updateMatrix();
      rocks.current!.setMatrixAt(stones, dummy.matrix);
      color.set(season === "winter" ? "#eef2f2" : "#d9d8cf").offsetHSL(0, 0, (random() - 0.5) * 0.14);
      rocks.current!.setColorAt(stones++, color);
    };
    for (const tree of forest.trees) {
      for (let i = 0; i < 24; i++) {
        const angle = random() * Math.PI * 2;
        const radius = tree.trunkRadius + 1.3 + random() * 6;
        const x = tree.x + Math.cos(angle) * radius;
        const z = tree.z + Math.sin(angle) * radius;
        // Leave the carriage paths and plazas clear.
        if (forest.plazas.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
        if (forest.roads.some((r) => {
          const dx = r.bx - r.ax, dz = r.bz - r.az;
          const t = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz)));
          return Math.hypot(x - r.ax - dx * t, z - r.az - dz * t) < 2;
        })) continue;
        // A quarter of the floor litter is stone, the rest grass.
        if (random() < 0.25) {
          placeRock(x, z, 0.18 + random() * 0.32);
          continue;
        }
        const height = 0.3 + random() * 0.4;
        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, random() * Math.PI * 2, 0);
        const spread = 0.7 + random() * 0.5;
        dummy.scale.set(spread, height, spread);
        dummy.updateMatrix();
        grass.current.setMatrixAt(blades, dummy.matrix);
        color.set(season === "winter" ? "#c1bca1" : season === "autumn" ? "#9a793e" : "#637747");
        color.offsetHSL(0, 0, (random() - 0.5) * 0.16);
        grass.current.setColorAt(blades++, color);
      }
    }
    grass.current.count = blades;
    rocks.current.count = stones;
    for (const mesh of [grass.current, rocks.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [forest, season]);
  return <>
    <instancedMesh ref={grass} args={[tuftGeo, grassMat, forest.trees.length * 24]} receiveShadow />
    <instancedMesh ref={rocks} args={[rockGeo, rockMat, forest.trees.length * 24]} receiveShadow castShadow />
  </>;
}
