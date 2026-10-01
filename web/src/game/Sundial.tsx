import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, CanvasTexture, DoubleSide, type Mesh, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace } from "three";
import { textureAnisotropy } from "./Environment";
import type { Exhibit } from "./exhibits";
import { ExhibitPlaque } from "./Signposts";
import { useGame } from "./store";
import { UplightFixtures } from "./Uplights";
import { overcast, weather } from "./weather";
import {
  FIRST_HOUR, LAST_HOUR, RING_R, RING_TILT, RING_W, STYLE_HALF, STYLE_R, SUNDIAL_LAT,
  hourLabel, ringAngleOfHour, ringShadow,
} from "./sundialGeometry";

/**
 * An armillary sundial for 39 degrees north: an equatorial ring dial. The
 * style (a rod) points at the celestial pole and the engraved ring stands
 * square to it, so the hours are 15 degrees apart. A flat horizon ring is
 * marked with the compass points and a meridian ring in the north-south plane
 * carries the whole frame, as on a brass armillary. The geometry is in
 * sundialGeometry.ts. An exhibit in a roadside glade (exhibits.ts).
 *
 * The style's shadow on the ring is computed, not left to the sun's shadow
 * map: a shadow texel in the map is 4 cm, the same as the rod, and would
 * swim as the cart moves. The ring itself neither casts nor receives it.
 */

/** Height of the armillary's centre, and the radius of its horizon and meridian rings. */
const CENTRE_Y = 3.4;
const FRAME_R = STYLE_HALF;
const HORIZON_IN = 1.62, HORIZON_OUT = 1.98;
const PLINTH_TOP = 1.0;
const RING_PX = 4096;
const BAND_PX = Math.round((RING_PX * RING_W) / (2 * Math.PI * RING_R));
/** The shadow's width on the ring: the style's diameter, m. */
const STRIPE_W = STYLE_R * 2;

const BODY =
  "An armillary sundial built for 39 degrees north. The rod through the middle points at the " +
  "celestial pole: true north, tilted up from the horizon by the latitude. The ring around it " +
  "stands square to the rod, so the hours come out equal, and its shadow moves round the " +
  "ring 15 degrees an hour in every season. Noon is at the bottom of the ring, on the north " +
  "side; the morning hours are on the west. It tells local solar time, which runs up to a " +
  "quarter hour ahead of or behind a clock through the year. For a few days at each equinox " +
  "the sun lies in the ring's own plane and the edge of the ring shades the shadow away. The flat ring at " +
  "the horizon is marked N, E, S and W.";

const BRASS = "#d9bd70";
const INK = "#2a1c06";

/** The engraved ring, painted for its inside face: u runs round the ring as three.js lays a cylinder's uv. */
function drawRing(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BRASS;
  ctx.fillRect(0, 0, RING_PX, BAND_PX);
  // Angle about the ring to canvas x: three.js puts a cylinder's theta at u * 2 pi.
  const xOf = (psi: number) => ((((Math.PI / 2 - psi) / (2 * Math.PI)) % 1) + 1) % 1 * RING_PX;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  const tick = (x: number, len: number, w: number) => {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, len);
    ctx.moveTo(x, BAND_PX); ctx.lineTo(x, BAND_PX - len);
    ctx.stroke();
  };
  for (let q = FIRST_HOUR * 4; q <= LAST_HOUR * 4; q++) {
    const x = xOf(ringAngleOfHour(q / 4));
    if (q % 4 === 0) tick(x, 26, 5);
    else tick(x, q % 2 === 0 ? 16 : 9, 2.5);
  }
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 2); ctx.lineTo(RING_PX, 2);
  ctx.moveTo(0, BAND_PX - 2); ctx.lineTo(RING_PX, BAND_PX - 2);
  ctx.stroke();
  // Seen from inside the ring the canvas is mirrored, so each glyph is drawn reversed.
  const reversed = (text: string, x: number, size: number) => {
    ctx.save();
    ctx.translate(x, BAND_PX / 2);
    ctx.scale(-1, 1);
    ctx.font = `bold ${size}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) reversed(hourLabel(h), xOf(ringAngleOfHour(h)), h === 12 ? 60 : 54);
  // The seam sits over the top of the ring, clear of the hours: the latitude is cut there, in two halves.
  const legend = `LAT. ${SUNDIAL_LAT}° N`;
  reversed(legend, 0, 34);
  reversed(legend, RING_PX, 34);
}

/** The horizon ring, an annulus whose canvas is its disc: north at the top. */
function drawHorizon(ctx: CanvasRenderingContext2D, size: number) {
  const c = size / 2;
  const scale = c / HORIZON_OUT;
  const rIn = HORIZON_IN * scale, rOut = c - 2;
  ctx.fillStyle = BRASS;
  ctx.beginPath();
  ctx.arc(c, c, rOut, 0, 2 * Math.PI);
  ctx.arc(c, c, rIn, 0, 2 * Math.PI, true);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  for (let d = 0; d < 360; d += 5) {
    const a = (d * Math.PI) / 180;
    const len = d % 90 === 0 ? 46 : d % 45 === 0 ? 34 : d % 10 === 0 ? 24 : 14;
    ctx.lineWidth = d % 10 === 0 ? 4 : 2.5;
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(a) * (rIn + 2), c - Math.cos(a) * (rIn + 2));
    ctx.lineTo(c + Math.sin(a) * (rIn + 2 + len), c - Math.cos(a) * (rIn + 2 + len));
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  for (const r of [rIn, rOut - 3]) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, 2 * Math.PI);
    ctx.stroke();
  }
  // The letters stand with their tops outward, N the way it is on the map.
  const letterR = (rIn + 52 + rOut) / 2;
  ["N", "E", "S", "W"].forEach((letter, i) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((i * Math.PI) / 2);
    ctx.translate(0, -letterR);
    ctx.fillStyle = letter === "N" ? "#8a1f14" : INK;
    ctx.font = `bold ${letter === "N" ? 92 : 78}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, 0, 0);
    ctx.restore();
  });
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = textureAnisotropy(8);
  return texture;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function Sundial({ exhibit }: { exhibit: Exhibit }) {
  const R = exhibit.obstacle;
  const day = useGame((s) => s.timeOfDay === "day");
  const m = useMemo(() => {
    const ring = canvasTexture(RING_PX, BAND_PX, drawRing);
    const horizon = canvasTexture(2048, 2048, (ctx) => drawHorizon(ctx, 2048));
    return {
      ringTexture: ring,
      horizonTexture: horizon,
      brass: new MeshStandardMaterial({ color: "#c9a24a", metalness: 0.55, roughness: 0.34 }),
      engraved: new MeshStandardMaterial({ map: ring, side: BackSide, metalness: 0.2, roughness: 0.5 }),
      horizon: new MeshStandardMaterial({ map: horizon, side: DoubleSide, metalness: 0.2, roughness: 0.5 }),
      stone: new MeshStandardMaterial({ color: "#7d776c", roughness: 0.88 }),
      shadow: new MeshBasicMaterial({ color: "#150f05", transparent: true, opacity: 0, side: BackSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
  }, []);
  useEffect(() => () => {
    m.ringTexture.dispose();
    m.horizonTexture.dispose();
    m.brass.dispose();
    m.engraved.dispose();
    m.horizon.dispose();
    m.stone.dispose();
    m.shadow.dispose();
  }, [m]);
  useEffect(() => {
    // Brass glows faintly at night so the dial still reads from the groves.
    m.brass.emissive.set(day ? "#000000" : "#6b4a12");
    m.brass.emissiveIntensity = day ? 0 : 0.35;
  }, [day, m]);

  const stripe = useRef<Mesh>(null);
  useFrame(() => {
    const mesh = stripe.current;
    if (!mesh) return;
    const sun = useGame.getState().sky.sunDir;
    const s = ringShadow(sun);
    // Fog and cloud soften the sun's shadow away, and a sun on the horizon throws none.
    const strength = s ? 0.8 * smooth(0.05, 0.14, sun[1]) * (1 - overcast(weather)) : 0;
    m.shadow.opacity = strength;
    mesh.visible = strength > 0.01;
    if (!s || !mesh.visible) return;
    mesh.rotation.y = Math.PI / 2 - s.angle;
    mesh.position.y = (s.from + s.to) / 2;
    mesh.scale.y = s.to - s.from;
  });

  return (
    <group position={[exhibit.x, 0, exhibit.z]}>
      <ExhibitPlaque exhibit={exhibit} title="Armillary Sundial" byline={`Equatorial ring dial · ${SUNDIAL_LAT}° N`} body={BODY} />
      <UplightFixtures radius={R + 0.35} count={3} pool={2.2} />
      {/* Stepped plinth; the cart collides with its lowest step (exhibit.obstacle). */}
      <mesh position={[0, 0.25, 0]} material={m.stone} castShadow receiveShadow>
        <cylinderGeometry args={[R - 0.2, R, 0.5, 8]} />
      </mesh>
      <mesh position={[0, 0.75, 0]} material={m.stone} castShadow receiveShadow>
        <cylinderGeometry args={[R * 0.62, R * 0.7, 0.5, 8]} />
      </mesh>
      {/* The baluster that holds the frame by the foot of the meridian ring. */}
      <mesh position={[0, (PLINTH_TOP + CENTRE_Y - FRAME_R) / 2, 0]} material={m.stone} castShadow>
        <cylinderGeometry args={[0.24, 0.4, CENTRE_Y - FRAME_R - PLINTH_TOP + 0.06, 10]} />
      </mesh>
      {/* Two brass posts carry the horizon ring east and west; north and south it rides the meridian ring. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (HORIZON_IN + HORIZON_OUT) / 2, (PLINTH_TOP + CENTRE_Y) / 2, 0]} material={m.brass} castShadow>
          <cylinderGeometry args={[0.035, 0.035, CENTRE_Y - PLINTH_TOP, 8]} />
        </mesh>
      ))}

      <group position={[0, CENTRE_Y, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={m.horizon} castShadow receiveShadow>
          <ringGeometry args={[HORIZON_IN, HORIZON_OUT, 96]} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]} material={m.brass} castShadow>
          <torusGeometry args={[FRAME_R, 0.04, 8, 96]} />
        </mesh>

        {/* The dial proper, turned so its local y is the style, pointing at the pole. */}
        <group rotation={[RING_TILT, 0, 0]}>
          <mesh material={m.brass} castShadow>
            <cylinderGeometry args={[STYLE_R, STYLE_R, STYLE_HALF * 2, 10]} />
          </mesh>
          {[-1, 1].map((end) => (
            <mesh key={end} position={[0, end * STYLE_HALF, 0]} material={m.brass}>
              <sphereGeometry args={[0.065, 12, 8]} />
            </mesh>
          ))}
          <mesh position={[0, STYLE_HALF + 0.18, 0]} material={m.brass}>
            <coneGeometry args={[0.055, 0.26, 10]} />
          </mesh>
          <mesh material={m.brass}>
            <sphereGeometry args={[0.09, 14, 10]} />
          </mesh>
          {/* The ring: engraved inside, plain brass outside, with a bead round each edge. */}
          <mesh material={m.engraved}>
            <cylinderGeometry args={[RING_R, RING_R, RING_W, 192, 1, true]} />
          </mesh>
          <mesh material={m.brass} castShadow>
            <cylinderGeometry args={[RING_R + 0.006, RING_R + 0.006, RING_W, 192, 1, true]} />
          </mesh>
          {[-1, 1].map((edge) => (
            <mesh key={edge} position={[0, edge * RING_W / 2, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.brass} castShadow>
              <torusGeometry args={[RING_R + 0.003, 0.016, 6, 192]} />
            </mesh>
          ))}
          {/* Spokes from the style to the ring. */}
          <mesh rotation={[0, 0, Math.PI / 2]} material={m.brass}>
            <cylinderGeometry args={[0.016, 0.016, RING_R * 2, 6]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={m.brass}>
            <cylinderGeometry args={[0.016, 0.016, RING_R * 2, 6]} />
          </mesh>
          {/* The style's shadow on the ring's inside face (placed each frame). */}
          <mesh ref={stripe} material={m.shadow} visible={false} renderOrder={2}>
            <cylinderGeometry args={[RING_R - 0.01, RING_R - 0.01, 1, 4, 1, true, -STRIPE_W / (RING_R - 0.01) / 2, STRIPE_W / (RING_R - 0.01)]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
