/**
 * Dev-only page (species-preview.html): the same books grown as every species,
 * side by side, for comparing crown habits. Not part of the game build.
 *
 * Query: ?chunks=250,1000,2500 (one row per size) &view=side|top
 */
import {
  AmbientLight, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, HemisphereLight,
  InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, OrthographicCamera, PlaneGeometry, Quaternion,
  RepeatWrapping, Scene, Shape, ShapeGeometry, SRGBColorSpace, TextureLoader, Vector2, Vector3, WebGLRenderer,
} from "three";
import { emitBark, emitLeaves, growTree, type BarkBuffers } from "../game/growTree";
import { leafOutline, SPECIES } from "../game/species";

const REP_GENRE: Record<string, string> = {
  oak: "philosophy", chestnut: "english-literature", fir: "science-fiction", plane: "letters", blackthorn: "horror",
};
const FOLIAGE = ["#4f7a2e", "#5b8a34", "#46702a", "#6a9a3c", "#557f30", "#3f6526", "#62903a", "#4b762c"];

const params = new URLSearchParams(location.search);
const sizes = (params.get("chunks") ?? "250,1000,2500").split(",").map(Number);
const top = params.get("view") === "top";

const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new Scene();
scene.background = new Color("#cfe3f0");
scene.add(new HemisphereLight("#eaf4ff", "#6b5a40", 1.4), new AmbientLight("#ffffff", 0.3));
const sun = new DirectionalLight("#fff6e0", 2.2);
sun.position.set(30, 60, 40);
scene.add(sun);

const loader = new TextureLoader();
const COL = 26, ROW = 30;
const labels = document.getElementById("labels")!;
let maxH = 0;

SPECIES.forEach((sp, si) => {
  const tex = loader.load(`textures/bark/${sp.name}_color.jpg`);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  const barkMat = new MeshStandardMaterial({ map: tex, roughness: 0.95 });
  const leafGeo = new ShapeGeometry(new Shape(leafOutline(sp.leaf).map(([x, y]) => new Vector2(x, y))));
  const leafMat = new MeshStandardMaterial({ side: DoubleSide, roughness: 0.8 });
  const [dh, ds, dl] = sp.foliageShift;
  const foliage = FOLIAGE.map((h) => new Color(h).offsetHSL(dh, ds, dl));
  sizes.forEach((nChunks, ri) => {
    const x = (si - (SPECIES.length - 1) / 2) * COL;
    const z = top ? (ri - (sizes.length - 1) / 2) * ROW : 0;
    const y0 = top ? 0 : -ri * ROW;
    const g = growTree({ slug: `preview-${nChunks}`, genre: REP_GENRE[sp.name]!, nChunks, species: si });
    maxH = Math.max(maxH, g.trunkHeight);
    const bark: BarkBuffers = { pos: [], normal: [], uv: [], index: [] };
    emitBark(g, x, z, bark, sp.barkAspect);
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(bark.pos), 3));
    geo.setAttribute("normal", new BufferAttribute(new Float32Array(bark.normal), 3));
    geo.setAttribute("uv", new BufferAttribute(new Float32Array(bark.uv), 2));
    geo.setIndex(bark.index);
    const trunk = new Mesh(geo, barkMat);
    trunk.position.y = y0;
    scene.add(trunk);
    const pos: number[] = [], scale: number[] = [], tint: number[] = [], quat: number[] = [];
    const count = emitLeaves(g, x, z, pos, scale, tint, quat, 0.22);
    const leaves = new InstancedMesh(leafGeo, leafMat, count);
    const m = new Matrix4();
    for (let i = 0; i < count; i++) {
      m.compose(
        new Vector3(pos[i * 3]!, pos[i * 3 + 1]! + y0, pos[i * 3 + 2]!),
        new Quaternion(quat[i * 4]!, quat[i * 4 + 1]!, quat[i * 4 + 2]!, quat[i * 4 + 3]!),
        new Vector3(scale[i * 3]!, scale[i * 3 + 1]!, scale[i * 3 + 2]!),
      );
      leaves.setMatrixAt(i, m);
      leaves.setColorAt(i, foliage[tint[i]! % foliage.length]!);
    }
    scene.add(leaves);
    if (!top) {
      const ground = new Mesh(new PlaneGeometry(COL - 2, 8), new MeshStandardMaterial({ color: "#7d8f55" }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(x, y0 - 0.02, 0);
      scene.add(ground);
    }
    if (ri === 0) {
      const d = document.createElement("div");
      d.textContent = sp.name;
      d.dataset.x = String(x);
      labels.appendChild(d);
    }
  });
});

const aspect = innerWidth / innerHeight;
const width = SPECIES.length * COL + 4;
const height = top ? sizes.length * ROW + 4 : (sizes.length - 1) * ROW + maxH + 6;
const halfW = Math.max(width, height * aspect) / 2, halfH = halfW / aspect;
const cam = new OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 500);
if (top) {
  cam.position.set(0, 200, 0.01);
  cam.lookAt(0, 0, 0);
} else {
  const cy = (maxH + 2 - (sizes.length - 1) * ROW) / 2;
  cam.position.set(0, cy + 8, 120);
  cam.lookAt(0, cy, 0);
}
cam.updateMatrixWorld();
for (const d of labels.children as HTMLCollectionOf<HTMLDivElement>) {
  const p = new Vector3(Number(d.dataset.x), 0, 0).project(cam);
  d.style.left = `${((p.x + 1) / 2) * innerWidth}px`;
  d.style.top = "8px";
}
let frames = 0;
renderer.setAnimationLoop(() => {
  renderer.render(scene, cam);
  if (++frames === 30) document.body.dataset.ready = "1";
});
