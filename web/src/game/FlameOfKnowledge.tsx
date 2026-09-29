import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, EquirectangularReflectionMapping, Mesh, MeshStandardMaterial, SRGBColorSpace, type Material, type Object3D, type Texture } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Exhibit } from "./exhibits";
import { ExhibitPlaque } from "./Signposts";
import { useGame } from "./store";
import { UplightFixtures, useUplitMaterials } from "./Uplights";

/**
 * The Flame of Knowledge: a sculpture by George B. Suchanek, about 1964,
 * scanned from his plaster model. The mesh is
 * public/models/flame_of_knowledge.glb, exported from
 * assets/meshy_dad_sculpture_12feet.blend as geometry only (decimated to ~31k
 * triangles; no materials or UVs, as it is drawn in silver here),
 * 3.66 m tall with its base at y = 0 and its front toward +z. Here it stands
 * at FLAME_HEIGHT, as tall as the wind sculptures, in polished silver.
 */

const MODEL_URL = "models/flame_of_knowledge.glb";
/** The scan's own height, and the height it stands here. */
const MODEL_HEIGHT = 3.658;
const FLAME_HEIGHT = 8.5;
/** Stepped plinth, as under the wind sculptures. */
const PLINTH_TOP = 1.0;

const FLAME_BODY =
  "George B. Suchanek modeled this piece in plaster around 1964. There is no straight line " +
  "in it. Two forms rise from a narrow base, part around an open heart, and meet again at the " +
  "tip, as a flame parts and closes. They are also a figure: a pair of legs, stylized, " +
  "graceful and feminine. A flame is the old sign for knowledge, a light that can be handed " +
  "on without being spent. His family has carried the model through a lifetime. Here it " +
  "stands among the books.";

/** Loads the scan once, in silver; null until it arrives, so the plinth and plaque show at once. */
function useFlameModel(silver: MeshStandardMaterial): Object3D | null {
  const [scene, setScene] = useState<Object3D | null>(null);
  useEffect(() => {
    let live = true;
    new GLTFLoader().load(MODEL_URL, (gltf) => {
      gltf.scene.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.castShadow = true;
        o.receiveShadow = true;
        // The scan's baked gray is replaced by the silver the piece is; drop the baked maps.
        const old = o.material as Material & { map?: Texture | null; metalnessMap?: Texture | null };
        old.map?.dispose();
        old.metalnessMap?.dispose();
        old.dispose();
        o.material = silver;
      });
      if (live) setScene(gltf.scene);
    });
    return () => {
      live = false;
    };
  }, [silver]);
  useEffect(() => () => {
    scene?.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
  }, [scene]);
  return scene;
}

/**
 * What the silver reflects: a painted sky over a bright horizon over grass.
 * The scene has no environment map, and polished metal with nothing to
 * reflect renders dark; this one is for the flame alone.
 */
function reflectionMap(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#7fa6d6");
  g.addColorStop(0.46, "#dfe8ef");
  g.addColorStop(0.5, "#f4f6f4");
  g.addColorStop(0.54, "#7d8a64");
  g.addColorStop(1, "#3e4436");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  const tex = new CanvasTexture(c);
  tex.mapping = EquirectangularReflectionMapping;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export function FlameOfKnowledge({ exhibit }: { exhibit: Exhibit }) {
  const m = useMemo(() => {
    const env = reflectionMap();
    return {
      env,
      stone: new MeshStandardMaterial({ color: "#7d776c", roughness: 0.88 }),
      silver: new MeshStandardMaterial({ color: "#c9ced3", metalness: 0.92, roughness: 0.2, envMap: env }),
    };
  }, []);
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  const scene = useFlameModel(m.silver);
  // The painted sky fades with the real one; at night the floodlights carry it.
  const daylight = useGame((s) => s.sky.daylight);
  m.silver.envMapIntensity = 0.03 + 0.97 * daylight;
  // Floodlit from the plinth at night, far less than the rotors: a broad sheet of silver throws
  // back nearly all of it, and at full strength it outshone the forest. The light dies out up
  // the flame, so the tip stays dim.
  useUplitMaterials(useMemo(() => [m.silver], [m]), "#fff0dc", 0.3, 5);
  const r = exhibit.obstacle;
  // The front faces the spur, as the plaque does.
  const face = Math.atan2(exhibit.roadX - exhibit.x, exhibit.roadZ - exhibit.z);
  return (
    <group position={[exhibit.x, 0, exhibit.z]}>
      {/* To one side, so the whole flame shows from the spur. */}
      <ExhibitPlaque exhibit={exhibit} title="The Flame of Knowledge" byline="George B. Suchanek · about 1964" body={FLAME_BODY} aside={0.9} />
      <UplightFixtures radius={r + 0.35} count={3} pool={2.2} />
      {/* The cart collides with the lowest step (exhibit.obstacle). */}
      <mesh position={[0, 0.25, 0]} material={m.stone} castShadow receiveShadow>
        <cylinderGeometry args={[r - 0.2, r, 0.5, 8]} />
      </mesh>
      <mesh position={[0, 0.75, 0]} material={m.stone} castShadow receiveShadow>
        <cylinderGeometry args={[r * 0.62, r * 0.7, 0.5, 8]} />
      </mesh>
      {scene ? (
        <primitive object={scene} position={[0, PLINTH_TOP, 0]} rotation={[0, face, 0]} scale={FLAME_HEIGHT / MODEL_HEIGHT} />
      ) : null}
    </group>
  );
}
