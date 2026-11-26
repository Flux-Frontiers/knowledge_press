import { useEffect, useMemo, useState } from "react";
import { Mesh, MeshStandardMaterial, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { Exhibit } from "./exhibits";
import { reflectionMap } from "./FlameOfKnowledge";
import { ExhibitPlaque } from "./Signposts";
import { useGame } from "./store";
import { UplightFixtures, useUplitMaterials } from "./Uplights";

/**
 * The Spirit of Gutenberg: an Art Techno statue, rendered in Grok from
 * kgrag_priv/docs/art_techno/prompts/gutenberg-v1.txt and modeled in Meshy.
 * The mesh is public/models/spirit_of_gutenberg.glb, decimated in Blender
 * from 103k to 40k triangles, its color map cut from 8K to 1536 px and its
 * other maps to 1K, as WebP, with the geometry meshopt-compressed by
 * gltfpack (864 KB). It keeps its own textured materials and its own
 * three-tier plinth. The model is
 * 1.903 m tall with its base at y = 0 and its face toward +z. Here it stands
 * STATUE_HEIGHT tall, as tall as the Flame, on one low stone step.
 */

const MODEL_URL = "models/spirit_of_gutenberg.glb";
/** The model's own height, and the height it stands here. */
const MODEL_HEIGHT = 1.903;
const STATUE_HEIGHT = 8.5;
const STEP_TOP = 0.5;

const GUTENBERG_BODY =
  "Johannes Gutenberg of Mainz printed with movable metal type from about 1450, and his Bible, " +
  "finished about 1455, was the first major book printed in Europe. No portrait made in his " +
  "lifetime survives. Here he is an Art Techno figure, Art Deco for the computer age: he lifts one " +
  "piece of type like a rising sun, its face a grid of square pixels, so the first type is also the " +
  "first bitmap. The line of type in his other hand runs down through him as gold traces into the " +
  "ground. Every book in this forest comes down from his press.";

/** Loads the statue once, in its own materials; null until it arrives, so the step and plaque show at once. */
function useSpiritModel(): { scene: Object3D; materials: MeshStandardMaterial[] } | null {
  const [model, setModel] = useState<{ scene: Object3D; materials: MeshStandardMaterial[] } | null>(null);
  useEffect(() => {
    let live = true;
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(MODEL_URL, (gltf) => {
      const materials: MeshStandardMaterial[] = [];
      gltf.scene.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material instanceof MeshStandardMaterial) materials.push(o.material);
      });
      if (live) setModel({ scene: gltf.scene, materials });
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => () => {
    model?.scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.geometry.dispose();
      const m = o.material as MeshStandardMaterial;
      for (const t of [m.map, m.normalMap, m.metalnessMap, m.roughnessMap]) t?.dispose();
      m.dispose();
    });
  }, [model]);
  return model;
}

export function SpiritOfGutenberg({ exhibit }: { exhibit: Exhibit }) {
  const m = useMemo(() => {
    const env = reflectionMap();
    return { env, stone: new MeshStandardMaterial({ color: "#7d776c", roughness: 0.88 }) };
  }, []);
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  const model = useSpiritModel();
  const materials = useMemo(() => model?.materials ?? [], [model]);
  // The gilt reflects the painted sky, which fades with the real one; at night the floodlights carry it.
  const daylight = useGame((s) => s.sky.daylight);
  for (const mat of materials) {
    mat.envMap = m.env;
    mat.envMapIntensity = 0.03 + 0.97 * daylight;
  }
  // Lit all the way up, so the type he holds overhead still reads at night.
  useUplitMaterials(materials, "#fff0dc", 0.6, 8);
  const r = exhibit.obstacle;
  // The front faces the spur, as the plaque does.
  const face = Math.atan2(exhibit.roadX - exhibit.x, exhibit.roadZ - exhibit.z);
  return (
    <group position={[exhibit.x, 0, exhibit.z]}>
      <ExhibitPlaque exhibit={exhibit} title="Spirit of Gutenberg" byline="Art Techno · 2026" body={GUTENBERG_BODY} aside={0.9} />
      <UplightFixtures radius={r + 0.35} count={3} pool={2.2} />
      {/* The cart collides with the step (exhibit.obstacle). */}
      <mesh position={[0, STEP_TOP / 2, 0]} material={m.stone} castShadow receiveShadow>
        <cylinderGeometry args={[r - 0.2, r, STEP_TOP, 8]} />
      </mesh>
      {model ? (
        <primitive object={model.scene} position={[0, STEP_TOP, 0]} rotation={[0, face, 0]} scale={STATUE_HEIGHT / MODEL_HEIGHT} />
      ) : null}
    </group>
  );
}
