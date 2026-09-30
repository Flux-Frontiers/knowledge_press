import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, MathUtils, PerspectiveCamera, Vector3 } from "three";
import { treesNear, type Forest } from "./forest";
import { resetInput, sampleActions } from "./input";
import { clamp } from "./math";
import { forwardOf, sim, stepVehicle, teleportSim } from "./sim";
import { hush, speak, speaking } from "./speech";
import { markTourHeard, TOUR_FAREWELL, TOUR_LAP_DONE, tourHeard, tourIntro } from "./tourScript";
import { planTour, steerTour, tourState, tourStop } from "./tour";
import { useGame } from "./store";

const camPos = new Vector3();
/** Within this of a picked tree, the cart has arrived (reading range plus a margin). */
const TRAIL_ARRIVED = 9;
const lookAt = new Vector3();
/** The behind-the-cart camera: metres back and up from the cart. */
const FOLLOW_BACK = 6.5;
const FOLLOW_UP = 2.5;
/** The god's-eye camera: this much margin around the world, and pulled south by this fraction of its height so the view is not straight down. */
const GOD_MARGIN = 1.08;
const GOD_TILT = 0.35;
/** The camera's clip planes at ground level (ForestCanvas), and the god's-eye near plane. */
const GROUND_NEAR = 0.12;
const GROUND_FAR = 560;
const GOD_NEAR = 2;

export function Player({ forest, playing }: { forest: Forest; playing: boolean }) {
  const group = useRef<Group>(null);
  const wheelL = useRef<Group>(null);
  const wheelR = useRef<Group>(null);
  const poseAcc = useRef(0);
  const wasBlocked = useRef(false);
  // Camera tilt in radians, held between drives; Up/Down or the right stick.
  const pitch = useRef(0);
  /** Pan off the cart's heading, radians, left positive. */
  const look = useRef(0);
  const lastMarked = useRef<string | null>(null);
  /** The ring's end has been announced on this tour. */
  const lapSaid = useRef(false);

  const paused = useGame((s) => s.paused);
  const collect = useGame((s) => s.collect);
  const markGrove = useGame((s) => s.markGrove);
  const setNearby = useGame((s) => s.setNearby);
  const setPose = useGame((s) => s.setPose);

  const lanternColor = useMemo(() => "#f3e6c2", []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const game = useGame.getState();
    const { preferences, jump } = game;
    const blocked = !playing || paused || game.libraryOpen || game.atlasOpen || game.catalogOpen || Boolean(game.plaque) || Boolean(game.readingSlug) || Boolean(document.activeElement?.matches("input, textarea, select, [contenteditable=true]"));
    if (blocked) {
      sim.speed = sim.lat = sim.steering = 0;
      if (!wasBlocked.current) resetInput();
    }
    wasBlocked.current = blocked;
    if (jump) {
      teleportSim(jump.x, jump.z, jump.yaw);
      look.current = 0;
      useGame.getState().clearJump();
      const f = forwardOf(sim.yaw);
      state.camera.position.set(sim.x - f.x * FOLLOW_BACK, sim.y + FOLLOW_UP, sim.z - f.z * FOLLOW_BACK);
      lookAt.set(sim.x + f.x * 10, sim.y + FOLLOW_UP, sim.z + f.z * 10);
      state.camera.lookAt(lookAt);
    }

    if (blocked) {
      // Still keep camera on the cart while paused; a pause or a panel ends the narration.
      if (speaking()) hush();
    } else {
      const a = sampleActions();
      let throttle = a.throttle;
      let steer = a.steer;
      let tourBrake = false;
      const mode = useGame.getState().travelMode;
      /** Show a tour caption for a while, and drop it once it has had its time (unless replaced). */
      const note = (text: string) => {
        game.setTourNote(text);
        const ms = Math.max(8000, text.split(/\s+/).length * 400);
        window.setTimeout(() => { if (useGame.getState().tourNote === text) useGame.getState().setTourNote(null); }, ms);
      };
      /** Show several lines in turn, each for about as long as it takes to say, while this tour lasts. */
      const noteLines = (lines: string[]) => {
        const tour = tourState.tour;
        let at = 0;
        for (const line of lines) {
          window.setTimeout(() => {
            if (tourState.tour === tour && !useGame.getState().tourStop) useGame.getState().setTourNote(line);
          }, at);
          at += Math.max(3000, line.split(/\s+/).length * 400);
        }
        window.setTimeout(() => { if (lines.includes(useGame.getState().tourNote ?? "")) useGame.getState().setTourNote(null); }, at);
      };
      const endTour = () => {
        const wasTouring = Boolean(tourState.tour);
        tourState.tour = null;
        game.setTourNote(null);
        if (game.tourStop) {
          game.setTourStop(null);
          hush();
        }
        // Taking the wheel is not a jump elsewhere: say goodbye.
        if (wasTouring && !useGame.getState().jump && preferences.narrate && !preferences.silent) {
          speak(TOUR_FAREWELL);
        }
      };
      if (mode !== "circuit") endTour();
      else if (forest.ringPath.length > 1) {
        if (Math.abs(a.steer) > 0.38 || a.brake || a.throttle < 0) {
          endTour();
          useGame.getState().setTravelMode("free");
          useGame.getState().setToast("Free drive");
        } else {
          if (!tourState.tour) {
            tourState.tour = planTour(forest, sim.x, sim.z, sim.yaw);
            lapSaid.current = false;
            // Set off with the welcome: the whole background the first time, a line after that.
            if (!preferences.silent) {
              const lines = tourIntro({ books: forest.trees.length, groves: forest.groves.length }, tourHeard());
              markTourHeard();
              noteLines(lines);
              if (preferences.narrate) lines.forEach((line, i) => speak(line, i > 0));
            }
          }
          const c = steerTour(tourState.tour, sim.x, sim.z, sim.yaw, sim.speed, dt, speaking());
          steer = c.steer;
          if (throttle === 0) throttle = c.throttle;
          tourBrake = c.brake;
          // Pulled up at a grove: show its summary, and read it aloud if asked to.
          const stop = tourStop(tourState.tour);
          if (stop !== game.tourStop) {
            game.setTourStop(stop);
            if (stop) game.setTourNote(null);
            const said = stop ? forest.groves.find((g) => g.genre === stop)?.narration : undefined;
            // Queued, so a stop reached during the welcome waits for it.
            if (said && preferences.narrate && !preferences.silent) speak(said, true);
          }
          // Every grove visited and the ring starting over: say so once.
          if (tourState.tour.laps > 0 && !lapSaid.current) {
            lapSaid.current = true;
            if (!preferences.silent) {
              note(TOUR_LAP_DONE);
              if (preferences.narrate) speak(TOUR_LAP_DONE, true);
            }
          }
          useGame.getState().selectGrove(c.genre);
        }
      }
      stepVehicle(forest, throttle, steer, a.boost, dt, { ...preferences, brake: a.brake || tourBrake });
      pitch.current = clamp(pitch.current + a.pitch * 1.1 * dt, -0.45, 0.75);
      // Held arrows pan up to ~110° either way; released, the view eases back ahead.
      look.current = a.look ? clamp(look.current + a.look * 1.6 * dt, -1.9, 1.9) : look.current * Math.exp(-3 * dt);

      if (a.interact) {
        const near = treesNear(forest, sim.x, sim.z, 6.8);
        let best = near[0];
        let bestD = Infinity;
        for (const t of near) {
          const d = Math.hypot(t.x - sim.x, t.z - sim.z);
          if (d < bestD) {
            bestD = d;
            best = t;
          }
        }
        if (best && bestD < 6.8) collect(best.book.slug, best.book.title);
      }
    }

    const f = forwardOf(sim.yaw);
    // The camera faces the cart's heading turned by the look pan; the cart itself keeps f.
    const v = forwardOf(sim.yaw + look.current);
    const inCart = preferences.camera === "cart";
    const godEye = preferences.camera === "god";
    const cam = state.camera as PerspectiveCamera;
    if (godEye) {
      // High over the hub, the whole world radius in the vertical field of view.
      const height = (forest.worldRadius * GOD_MARGIN) / Math.tan(MathUtils.degToRad(cam.fov / 2));
      camPos.set(0, height, height * GOD_TILT);
      state.camera.position.lerp(camPos, 1 - Math.exp(-2.2 * dt));
      lookAt.set(0, 0, 0);
      // Push both clip planes out: at ground level's 0.12 m near plane the depth
      // buffer cannot tell the roads from the ground a kilometre away.
      cam.far = state.camera.position.length() + forest.worldRadius * 2;
      cam.near = GOD_NEAR;
    } else if (inCart) {
      // A standing adult's eye level (1.65 m), gazing level over the lantern, so the
      // horizon, plaques and plinths sit where they would on foot; tilt to look up.
      // Rigid, no chase lag.
      camPos.set(sim.x - v.x * 0.45, sim.y + 1.65, sim.z - v.z * 0.45);
      state.camera.position.copy(camPos);
      lookAt.set(sim.x + v.x * 10, sim.y + 1.65, sim.z + v.z * 10);
    } else {
      const follow = preferences.camera === "high" ? 12 : FOLLOW_BACK;
      const height = preferences.camera === "high" ? 10 : FOLLOW_UP;
      camPos.set(sim.x - v.x * follow, sim.y + height, sim.z - v.z * follow);
      state.camera.position.lerp(camPos, 1 - Math.exp(-3.4 * dt));
      // Behind the cart, look level down the road; the high view looks down at the cart.
      const ahead = preferences.camera === "high" ? 2.6 : 10;
      lookAt.set(sim.x + v.x * ahead, sim.y + (preferences.camera === "high" ? 1.4 : FOLLOW_UP), sim.z + v.z * ahead);
    }
    // Tilt by raising or lowering the look point over its horizontal distance.
    if (!godEye) {
      lookAt.y += Math.hypot(lookAt.x - state.camera.position.x, lookAt.z - state.camera.position.z) * Math.tan(pitch.current);
      cam.far = GROUND_FAR;
      cam.near = GROUND_NEAR;
    }
    state.camera.lookAt(lookAt);
    const fovTarget = inCart ? 60 : 58;
    cam.fov = MathUtils.lerp(cam.fov, fovTarget, 1 - Math.exp(-4 * dt));
    cam.updateProjectionMatrix();

    const g = group.current;
    if (g) {
      g.position.set(sim.x, sim.y, sim.z);
      g.lookAt(sim.x + f.x, sim.y, sim.z + f.z);
      if (preferences.motion) g.rotateZ(-sim.steering * Math.min(Math.abs(sim.speed), 12) * 0.003);
    }
    const spin = (sim.speed * dt) / 0.42;
    if (wheelL.current) wheelL.current.rotation.x += spin;
    if (wheelR.current) wheelR.current.rotation.x += spin;

    const near = treesNear(forest, sim.x, sim.z, 16);
    let bestSlug: string | null = null;
    let bestD = 16;
    for (const t of near) {
      const d = Math.hypot(t.x - sim.x, t.z - sim.z);
      if (d < bestD) {
        bestD = d;
        bestSlug = t.book.slug;
      }
    }

    for (const grove of forest.groves) {
      if (Math.hypot(grove.x - sim.x, grove.z - sim.z) < grove.radius) {
        if (lastMarked.current !== grove.genre) {
          lastMarked.current = grove.genre;
          markGrove(grove.genre);
        }
        // Arrived at the grove the trail was leading to: put the lantern trail away.
        if (game.travelMode === "free" && game.selectedGrove === grove.genre) game.selectGrove(null);
      }
    }

    // Arrived at the tree the trail was leading to: put the trail and the query away.
    if (game.searchPick) {
      const t = forest.trees.find((tr) => tr.book.slug === game.searchPick);
      if (!t || Math.hypot(t.x - sim.x, t.z - sim.z) < TRAIL_ARRIVED) game.setQuery("");
    }

    poseAcc.current += dt;
    if (poseAcc.current > 0.08) {
      poseAcc.current = 0;
      setNearby(bestSlug, bestD, sim.speed);
      setPose(sim.x, sim.z, sim.yaw, sim.speed);
    }
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0.38, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.32, 1.85]} />
        <meshStandardMaterial color="#5a3d28" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.62, -0.15]}>
        <boxGeometry args={[1.02, 0.22, 1.1]} />
        <meshStandardMaterial color="#4a3322" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.78, -0.35]}>
        <boxGeometry args={[0.42, 0.16, 0.32]} />
        <meshStandardMaterial color="#7a2e2e" roughness={0.7} />
      </mesh>
      <mesh position={[0.22, 0.78, -0.12]}>
        <boxGeometry args={[0.34, 0.14, 0.26]} />
        <meshStandardMaterial color="#2e3a5a" roughness={0.7} />
      </mesh>
      <mesh position={[-0.2, 0.78, -0.08]}>
        <boxGeometry args={[0.3, 0.12, 0.22]} />
        <meshStandardMaterial color="#3d4a32" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.55, 0.95]}>
        <boxGeometry args={[0.08, 0.7, 0.08]} />
        <meshStandardMaterial color="#3a322c" />
      </mesh>
      <mesh position={[0, 1.02, 0.95]}>
        <boxGeometry args={[0.18, 0.22, 0.18]} />
        <meshStandardMaterial color={lanternColor} emissive={lanternColor} emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0, 1.05, 0.95]} color="#f6e7c2" intensity={6.5} distance={18} decay={2} />
      <group ref={wheelL} position={[-0.68, 0.32, 0.45]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.14, 10]} />
          <meshStandardMaterial color="#2a2420" roughness={0.95} />
        </mesh>
      </group>
      <group ref={wheelR} position={[0.68, 0.32, 0.45]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.14, 10]} />
          <meshStandardMaterial color="#2a2420" roughness={0.95} />
        </mesh>
      </group>
      <group position={[-0.68, 0.32, -0.55]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.28, 0.28, 0.12, 10]} />
          <meshStandardMaterial color="#2a2420" />
        </mesh>
      </group>
      <group position={[0.68, 0.32, -0.55]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.28, 0.28, 0.12, 10]} />
          <meshStandardMaterial color="#2a2420" />
        </mesh>
      </group>
    </group>
  );
}
