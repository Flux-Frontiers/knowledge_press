import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { cinema, FLY_IN } from "./cinema";
import { droneFlight, droneSite } from "./droneScript";
import type { Forest } from "./forest";
import { useGame } from "./store";

/** Seconds the fly-in circles on as the start screen does before going round again. */
const CIRCLE_ON = 12;

/**
 * `?flyin`: the drone's fly-in to the corpus redwood (droneScript.ts). Held at the
 * start until the rider presses Start (the splash draws the scene too), then flown in
 * real time onto the start screen's own slow circle, which it follows for a while
 * before going round again. Daylight unless `&time=dawn|dusk|twilight|night`; every leaf,
 * shadows and the undergrowth on.
 */
export function FlyIn({ forest }: { forest: Forest }) {
  const flight = useMemo(() => droneFlight(droneSite(forest)), [forest]);
  const clock = useRef(0);
  useEffect(() => {
    if (!FLY_IN) return;
    const time = new URLSearchParams(window.location.search).get("time");
    const g = useGame.getState();
    g.setTimeMode(time === "dawn" || time === "dusk" || time === "twilight" || time === "night" ? time : "day");
    // The forest at its best for the shot: every leaf, shadows, the undergrowth. Saved, as any setting is.
    g.setPreferences({ leaves: "ultra", shadows: true, undergrowth: true });
  }, []);
  useFrame((_, delta) => {
    if (!FLY_IN) return;
    const s = useGame.getState();
    const dt = Math.min(delta, 0.1);
    clock.current = !s.playing || clock.current > flight.duration + CIRCLE_ON ? 0 : s.paused ? clock.current : clock.current + dt;
    const { cam, look } = flight.pose(clock.current);
    cinema.cam[0] = cam[0]; cinema.cam[1] = cam[1]; cinema.cam[2] = cam[2];
    cinema.look[0] = look[0]; cinema.look[1] = look[1]; cinema.look[2] = look[2];
    cinema.weight = 1;
    if (s.playing && !s.cleanView) useGame.setState({ cleanView: true });
  });
  return null;
}
