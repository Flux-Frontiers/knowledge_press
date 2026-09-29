import { useEffect, useMemo } from "react";
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, LinearFilter, SRGBColorSpace } from "three";
import type { Exhibit } from "./exhibits";
import { groveByGenre, type Forest, type Grove } from "./forest";
import { SPECIES, speciesFor } from "./species";
import { useGame } from "./store";
import { useNightLamps } from "./Uplights";

/**
 * Signs are lit at night, faked like the floodlights (Uplights.tsx): a
 * gooseneck lamp hangs over each board, and the board glows through an
 * emissive copy of its own face, washed brightest under the lamps. No real
 * lights are added.
 */
const LAMP_GLOW = "#ffe8c0";

function canvasTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * The board's face as the lamps light it: the face multiplied by a pool of
 * light under each lamp, spreading down the board and fading at its foot.
 *
 * :param lamps: Each lamp's position across the board, 0 at the left edge to 1 at the right.
 */
function lampWash(face: HTMLCanvasElement, lamps: number[]): CanvasTexture {
  const { width: w, height: h } = face;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvasTexture(canvas);
  ctx.fillStyle = "#202020";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  for (const f of lamps) {
    const r = Math.max(h * 1.3, w / lamps.length);
    const g = ctx.createRadialGradient(f * w, -h * 0.15, 0, f * w, -h * 0.15, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.5, "#9a9a9a");
    g.addColorStop(1, "#000000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(face, 0, 0);
  return canvasTexture(canvas);
}

/** A board's face and its lamp-lit glow, disposed together. */
function useLitFace(draw: () => HTMLCanvasElement, lamps: number[], deps: unknown[]) {
  const faces = useMemo(() => {
    const face = draw();
    return { map: canvasTexture(face), glow: lampWash(face, lamps) };
  }, deps);
  useEffect(() => () => { faces.map.dispose(); faces.glow.dispose(); }, [faces]);
  return faces;
}

/**
 * A gooseneck sign lamp: a bracket at (0, 0, 0) on the board's top edge, an
 * arm reaching `reach` metres out over the face, and a shade that glows at night.
 */
function SignLamp({ position, reach = 0.42 }: { position: [number, number, number]; reach?: number }) {
  const night = useNightLamps();
  const lens = useMemo(() => new Color("#3a2c1c").lerp(new Color("#fff1d6"), night), [night]);
  return (
    <group position={position}>
      <mesh position={[0, 0.1, reach / 2]} rotation={[Math.PI / 2 - 0.35, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, reach + 0.12, 6]} />
        <meshStandardMaterial color="#2b2d30" metalness={0.5} roughness={0.5} />
      </mesh>
      <group position={[0, 0.18, reach]} rotation={[-0.5, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.05, 0.13, 0.14, 12, 1, true]} />
          <meshStandardMaterial color="#2b2d30" metalness={0.5} roughness={0.5} side={DoubleSide} />
        </mesh>
        <mesh position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.12, 14]} />
          <meshBasicMaterial color={lens} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Light spilling past the board onto the ground in front of it. */
function LampSpill({ z, width }: { z: number; width: number }) {
  const night = useNightLamps();
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "#fff");
    g.addColorStop(1, "#000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new CanvasTexture(c);
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  if (night < 0.01) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, z]} scale={[width, 1.6, 1]}>
      <circleGeometry args={[1, 24]} />
      <meshBasicMaterial map={tex} color="#ffd9a0" transparent opacity={0.22 * night} blending={AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function drawSign(label: string, meta: string, accent: string): HTMLCanvasElement {
  const w = 1024;
  const h = 360;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#cfc6b4";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#efe8dc";
  ctx.fillRect(22, 22, w - 44, h - 44);
  ctx.fillStyle = accent;
  ctx.fillRect(22, 22, 28, h - 44);
  ctx.strokeStyle = "#3a322c";
  ctx.lineWidth = 5;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  ctx.fillStyle = "#1a2030";
  // Large enough to read from the road: the label shrinks only if two lines will not fit.
  ctx.textBaseline = "top";
  let size = 104;
  let lines: string[] = [];
  for (; size >= 72; size -= 8) {
    ctx.font = `600 ${size}px "Cormorant Garamond", Georgia, "Times New Roman", serif`;
    lines = wrapLines(ctx, label, w - 120);
    if (lines.length === 1 || size * 2.1 < h - 110) break;
  }
  const startY = lines.length === 1 ? 70 : 34;
  lines.forEach((line, i) => {
    ctx.fillText(line, 68, startY + i * size * 1.02);
  });

  ctx.fillStyle = "#5a5348";
  ctx.font = '600 46px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText(meta, 68, h - 82);
  return canvas;
}

/** The grove's tree, on a small plate under the sign: common name, then the scientific name in italics. */
function drawSpeciesPlate(common: string, latin: string): HTMLCanvasElement {
  const w = 1024;
  const h = 164;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#3a322c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#efe8dc";
  ctx.fillRect(12, 12, w - 24, h - 24);
  ctx.textBaseline = "middle";
  const sep = "  ·  ";
  let size = 66;
  const fonts = () => [`600 ${size}px "Source Sans 3", system-ui, sans-serif`, `italic 500 ${size}px "Cormorant Garamond", Georgia, serif`];
  const widths = () => {
    const [a, b] = fonts();
    ctx.font = a!;
    const wa = ctx.measureText(common + sep).width;
    ctx.font = b!;
    return [wa, ctx.measureText(latin).width] as const;
  };
  let [wa, wb] = widths();
  while (wa + wb > w - 90 && size > 36) {
    size -= 4;
    [wa, wb] = widths();
  }
  const [fa, fb] = fonts();
  const x0 = (w - wa - wb) / 2;
  ctx.fillStyle = "#3a4a2c";
  ctx.font = fa!;
  ctx.fillText(common + sep, x0, h / 2 + 2);
  ctx.fillStyle = "#1a2030";
  ctx.font = fb!;
  ctx.fillText(latin, x0 + wa, h / 2 + 2);
  return canvas;
}

function Signpost({
  sign,
  grove,
  selected,
}: {
  sign: Forest["signs"][number];
  grove: Grove;
  selected: boolean;
}) {
  const night = useNightLamps();
  const face = useLitFace(() => drawSign(grove.label, `${grove.bookCount} trees`, grove.color), [0.27, 0.73],
    [grove.label, grove.bookCount, grove.color]);
  const species = SPECIES[speciesFor(grove.genre)]!;
  const plate = useLitFace(() => drawSpeciesPlate(species.common, species.latin), [0.5], [species.common, species.latin]);
  const glow = night * 0.95 + (selected ? 0.25 : 0);

  const { x, z, yaw } = sign;

  // Tapping the sign lists the grove's books.
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}
      onClick={(e) => { e.stopPropagation(); useGame.getState().openCatalog(grove.genre); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}>
      {[-1.6, 1.6].map((px) => (
        // A post at each end, clear of the board: one centre post came out
        // through the back face, over the text as read from behind.
        <mesh key={px} position={[px, 1.48, 0.07]}>
          <cylinderGeometry args={[0.08, 0.11, 2.96, 6]} />
          <meshStandardMaterial color="#4a3a2a" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 2.35, 0.07]}>
        <boxGeometry args={[3.0, 1.05, 0.08]} />
        <meshStandardMaterial
          map={face.map}
          roughness={0.72}
          metalness={0}
          emissive={LAMP_GLOW}
          emissiveMap={face.glow}
          emissiveIntensity={glow}
          side={DoubleSide}
        />
      </mesh>
      {/* The species plate hangs from the board on two short rods. */}
      {[-0.8, 0.8].map((px) => (
        <mesh key={px} position={[px, 1.745, 0.07]}>
          <cylinderGeometry args={[0.012, 0.012, 0.15, 4]} />
          <meshStandardMaterial color="#2b2d30" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 1.5, 0.07]}>
        <boxGeometry args={[2.2, 0.352, 0.04]} />
        <meshStandardMaterial
          map={plate.map}
          roughness={0.72}
          emissive={LAMP_GLOW}
          emissiveMap={plate.glow}
          emissiveIntensity={glow * 0.6}
          side={DoubleSide}
        />
      </mesh>
      {[-0.8, 0.8].map((px) => <SignLamp key={px} position={[px, 2.96, 0.11]} />)}
      <LampSpill z={1.1} width={1.9} />
      <mesh position={[0, 2.92, 0.07]}>
        <boxGeometry args={[3.4, 0.08, 0.16]} />
        <meshStandardMaterial color="#3a322c" roughness={0.85} />
      </mesh>
      <mesh position={[0, 3.05, 0.0]}>
        <octahedronGeometry args={[0.12]} />
        <meshStandardMaterial
          color={grove.color}
          emissive={grove.color}
          emissiveIntensity={selected ? 0.7 : 0.22}
        />
      </mesh>
    </group>
  );
}

/** A reading plaque: title, byline and a wrapped paragraph. */
function drawPlaque(title: string, byline: string, body: string): HTMLCanvasElement {
  const w = 1536;
  const h = 768;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#3a322c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#efe8dc";
  ctx.fillRect(18, 18, w - 36, h - 36);
  ctx.strokeStyle = "#c9a24a";
  ctx.lineWidth = 6;
  ctx.strokeRect(38, 38, w - 76, h - 76);
  ctx.textBaseline = "top";
  ctx.fillStyle = "#1a2030";
  ctx.font = 'italic 600 96px "Cormorant Garamond", Georgia, "Times New Roman", serif';
  ctx.fillText(title, 84, 70);
  ctx.fillStyle = "#8a6a22";
  ctx.font = '600 44px "Source Sans 3", system-ui, sans-serif';
  ctx.fillText(byline, 86, 180);
  ctx.fillStyle = "#2a2a2a";
  ctx.font = '400 42px "Source Sans 3", system-ui, sans-serif';
  const words = body.split(" ");
  let line = "";
  let y = 262;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > w - 172 && line) {
      ctx.fillText(line, 86, y);
      y += 56;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, 86, y);
  return canvas;
}

/**
 * A lectern plaque: two short posts and a board tilted back so it reads from
 * the cart, with a sign lamp over it at night. Faces +z.
 */
export function Lectern({ title, byline, body }: { title: string; byline: string; body: string }) {
  const night = useNightLamps();
  const face = useLitFace(() => drawPlaque(title, byline, body), [0.5], [title, byline, body]);
  return (
    <>
      {[-1.25, 1.25].map((px) => (
        // 1.3 m, not the board's 1.55 m centre: the board tilts back, and a taller
        // post came out through its face at either end, over the text.
        <mesh key={px} position={[px, 0.65, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 1.3, 6]} />
          <meshStandardMaterial color="#4a3a2a" roughness={0.9} />
        </mesh>
      ))}
      {/* Tilted back like a lectern so it reads from the cart. */}
      <mesh position={[0, 1.55, 0.05]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[3.0, 1.5, 0.06]} />
        <meshStandardMaterial map={face.map} roughness={0.7} emissive={LAMP_GLOW} emissiveMap={face.glow} emissiveIntensity={night * 0.95} />
      </mesh>
      {/* A stem up behind the board's top edge, and the lamp reaching over the face. */}
      <mesh position={[0, 2.37, -0.21]}>
        <cylinderGeometry args={[0.02, 0.02, 0.28, 6]} />
        <meshStandardMaterial color="#2b2d30" metalness={0.5} roughness={0.5} />
      </mesh>
      <SignLamp position={[0, 2.42, -0.21]} reach={0.55} />
      <LampSpill z={1.2} width={1.8} />
    </>
  );
}

/**
 * An exhibit's plaque: between the piece and the road, facing the road, so it
 * reads with the piece behind it. `aside` swings it round the plinth by that
 * many radians, still facing the end of the spur, to leave the view up the
 * spur clear for a piece the plaque would hide.
 */
export function ExhibitPlaque({ exhibit: e, title, byline, body, aside = 0 }: {
  exhibit: Exhibit; title: string; byline: string; body: string; aside?: number;
}) {
  const a = Math.atan2(e.roadZ - e.z, e.roadX - e.x) + aside;
  const x = Math.cos(a) * (e.obstacle + 1.9), z = Math.sin(a) * (e.obstacle + 1.9);
  // Tapping the plaque opens its text full size (HUD PlaquePanel).
  return (
    <group position={[x, 0, z]} rotation={[0, Math.atan2(e.roadX - e.x - x, e.roadZ - e.z - z), 0]}
      onClick={(ev) => { ev.stopPropagation(); useGame.getState().openPlaque({ title, byline, body }); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}>
      <Lectern title={title} byline={byline} body={body} />
    </group>
  );
}

export function Signposts({ forest }: { forest: Forest }) {
  const selectedGrove = useGame((s) => s.selectedGrove);
  return (
    <group>
      {forest.signs.map((sign) => {
        const grove = groveByGenre(forest, sign.genre);
        if (!grove) return null;
        return (
          <Signpost
            key={sign.genre}
            sign={sign}
            grove={grove}
            selected={selectedGrove === sign.genre}
          />
        );
      })}
    </group>
  );
}
