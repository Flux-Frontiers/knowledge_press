import { forwardRef, useMemo } from "react";
import type { Group } from "three";

/**
 * The lantern cart: a small oak book wagon, the reader's own vehicle, and the
 * figure that stands beside each tree in the book gallery for scale.
 *
 * Forward is +z. It is 1.9 m long, 1.2 m wide over the wheels and 1.5 m to
 * the top of the lantern hook; CART_SIZE states it for the gallery page.
 */
export const CART_SIZE = { length: 1.9, width: 1.2, height: 1.5 };

/** The rear wheels' radius, m: the spin rate in Player.tsx divides by it. */
export const WHEEL_R = 0.42;

const OAK = "#8a5a36";
const OAK_DARK = "#5e3b22";
const IRON = "#2b2d30";
const BRASS = "#b08a3e";
const SPINES = ["#7a2e2e", "#2e3a5a", "#3d4a32", "#6b4a1e", "#4a2e4a", "#8a6a2a", "#2e4a4a"];

/** A spoked wheel in the yz plane, turning about x: iron tire, oak spokes, a hub. */
const Wheel = forwardRef<Group, { r: number; spokes: number; position: [number, number, number] }>(
  function Wheel({ r, spokes, position }, ref) {
    return (
      <group ref={ref} position={position}>
        <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[r - 0.03, 0.035, 6, 24]} />
          <meshStandardMaterial color={IRON} metalness={0.6} roughness={0.45} />
        </mesh>
        {Array.from({ length: spokes }, (_, k) => (
          <mesh key={k} rotation={[(Math.PI * k) / spokes, 0, 0]}>
            <boxGeometry args={[0.04, 2 * r - 0.08, 0.035]} />
            <meshStandardMaterial color={OAK_DARK} roughness={0.8} />
          </mesh>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 12]} />
          <meshStandardMaterial color={IRON} metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
    );
  },
);

type CartProps = {
  /** The lantern's glass. Lit brighter at night by the caller. */
  lanternColor?: string;
  /** Cast light from the lantern; the gallery's parked cart does without. */
  light?: boolean;
  wheelLeft?: React.Ref<Group>;
  wheelRight?: React.Ref<Group>;
};

export function Cart({ lanternColor = "#f3e6c2", light = true, wheelLeft, wheelRight }: CartProps) {
  // A row of books standing in the bed, heights and widths varied by position.
  const books = useMemo(() => Array.from({ length: 9 }, (_, k) => ({
    x: -0.42 + k * 0.105,
    w: 0.07 + ((k * 37) % 5) * 0.008,
    h: 0.24 + ((k * 53) % 7) * 0.018,
    color: SPINES[(k * 3) % SPINES.length]!,
  })), []);

  return (
    <group>
      {/* Bed: planks over two iron-shod runners. */}
      {[-0.44, -0.22, 0, 0.22, 0.44].map((x) => (
        <mesh key={x} position={[x, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.06, 1.8]} />
          <meshStandardMaterial color={OAK} roughness={0.85} />
        </mesh>
      ))}
      {[-0.34, 0.34].map((x) => (
        <mesh key={x} position={[x, 0.43, 0]} castShadow>
          <boxGeometry args={[0.08, 0.08, 1.7]} />
          <meshStandardMaterial color={OAK_DARK} roughness={0.85} />
        </mesh>
      ))}

      {/* Sides: a rail on turned posts, open so the books show. */}
      {[-0.55, 0.55].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.82, 0]} castShadow>
            <boxGeometry args={[0.06, 0.07, 1.84]} />
            <meshStandardMaterial color={OAK_DARK} roughness={0.8} />
          </mesh>
          {[-0.86, -0.43, 0, 0.43, 0.86].map((z) => (
            <mesh key={z} position={[x, 0.66, z]} castShadow>
              <cylinderGeometry args={[0.025, 0.03, 0.3, 8]} />
              <meshStandardMaterial color={OAK_DARK} roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Tailboard and a low front board. */}
      <mesh position={[0, 0.66, -0.9]} castShadow>
        <boxGeometry args={[1.12, 0.26, 0.05]} />
        <meshStandardMaterial color={OAK_DARK} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.6, 0.9]} castShadow>
        <boxGeometry args={[1.12, 0.14, 0.05]} />
        <meshStandardMaterial color={OAK_DARK} roughness={0.8} />
      </mesh>

      {/* The press's cargo: a row of books standing, and a stack lying flat. */}
      {books.map((b) => (
        <mesh key={b.x} position={[b.x, 0.53 + b.h / 2, -0.55]} castShadow>
          <boxGeometry args={[b.w, b.h, 0.2]} />
          <meshStandardMaterial color={b.color} roughness={0.7} />
        </mesh>
      ))}
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[0.18, 0.56 + k * 0.06, 0.05]} rotation={[0, 0.12 * (k - 1), 0]} castShadow>
          <boxGeometry args={[0.36 - k * 0.03, 0.055, 0.26 - k * 0.02]} />
          <meshStandardMaterial color={SPINES[(k * 2 + 1) % SPINES.length]} roughness={0.7} />
        </mesh>
      ))}

      {/* The lantern: an iron shepherd's hook at the front, a brass-capped lamp hanging from it. */}
      <mesh position={[-0.46, 0.98, 0.84]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 1.0, 8]} />
        <meshStandardMaterial color={IRON} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[-0.33, 1.46, 0.84]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.28, 6]} />
        <meshStandardMaterial color={IRON} metalness={0.5} roughness={0.5} />
      </mesh>
      <group position={[-0.2, 1.24, 0.84]}>
        <mesh position={[0, 0.16, 0]}>
          <coneGeometry args={[0.11, 0.1, 8]} />
          <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
          <meshStandardMaterial color={lanternColor} emissive={lanternColor} emissiveIntensity={1.4} />
        </mesh>
        <mesh position={[0, -0.11, 0]}>
          <cylinderGeometry args={[0.1, 0.09, 0.04, 8]} />
          <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.35} />
        </mesh>
        {light ? <pointLight color="#f6e7c2" intensity={6.5} distance={18} decay={2} /> : null}
      </group>

      {/* Two tall spoked wheels carry it; two small ones steer at the front. */}
      <Wheel ref={wheelLeft} r={WHEEL_R} spokes={6} position={[-0.63, WHEEL_R, -0.3]} />
      <Wheel ref={wheelRight} r={WHEEL_R} spokes={6} position={[0.63, WHEEL_R, -0.3]} />
      <Wheel r={0.24} spokes={4} position={[-0.6, 0.24, 0.62]} />
      <Wheel r={0.24} spokes={4} position={[0.6, 0.24, 0.62]} />
    </group>
  );
}
