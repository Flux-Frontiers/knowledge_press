import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { cinema, FLY_IN } from "./cinema";
import { droneFlight, droneSite } from "./droneScript";
import type { Forest } from "./forest";
import { useGame } from "./store";

/**
 * `?flyin`: the drone's fly-in to the corpus redwood (droneScript.ts). Held at the
 * start until the rider presses Start (the splash draws the scene too), then flown in
 * real time, holding a few seconds on the redwood before going round again. Daylight
 * unless `&time=dawn|dusk|night`.
 */
export function FlyIn({ forest }: { forest: Forest }) {
  const flight = useMemo(() => droneFlight(droneSite(forest)), [forest]);
  const clock = useRef(0);
  useEffect(() => {
    if (!FLY_IN) return;
    const time = new URLSearchParams(window.location.search).get("time");
    useGame.getState().setTimeMode(time === "dawn" || time === "dusk" || time === "night" ? time : "day");
  }, []);
  useFrame((_, delta) => {
    if (!FLY_IN) return;
    const s = useGame.getState();
    const dt = Math.min(delta, 0.1);
    clock.current = !s.playing || clock.current > flight.duration + 5 ? 0 : s.paused ? clock.current : clock.current + dt;
    const { cam, look } = flight.pose(clock.current);
    cinema.cam[0] = cam[0]; cinema.cam[1] = cam[1]; cinema.cam[2] = cam[2];
    cinema.look[0] = look[0]; cinema.look[1] = look[1]; cinema.look[2] = look[2];
    cinema.weight = 1;
    if (s.playing && !s.cleanView) useGame.setState({ cleanView: true });
  });
  return null;
}
