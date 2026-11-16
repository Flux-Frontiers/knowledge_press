/**
 * A shot a set piece asks the ground camera to take while the rider sits
 * still (LandingField.tsx sets it; Player.tsx blends it in). `weight` 0 leaves
 * the camera to the rider, 1 hands it over entirely. Any steering, throttle or
 * look resets `idle`, and the set piece lets go until the rider is still again.
 */
export const cinema = {
  weight: 0,
  cam: [0, 0, 0] as [number, number, number],
  look: [0, 0, 0] as [number, number, number],
  /** Seconds since the rider last touched a control. */
  idle: 0,
};

/**
 * `?ufocam` rides the visitor's craft (LandingField.tsx): the landing starts at once
 * wherever the rider is, loops, and the camera hangs under the craft's belly looking
 * ahead and down along its path, then turns to the art tree once it is down.
 */
export const UFO_CAM = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("ufocam");

/** `?flyin` flies the drone's fly-in to the corpus redwood (FlyIn.tsx, droneScript.ts). */
export const FLY_IN = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("flyin");

/** A shot that owns the camera outright, over any camera mode or flight (Player.tsx). */
export const OWNED_SHOT = UFO_CAM || FLY_IN;

/**
 * Reload into a shot, or out of one with null. The app's web view has no address bar, so
 * the menu does this. A shot keeps a set time of day as `&time=` and drops `?tree=`.
 *
 * :param shot: `flyin`, `ufocam`, or null for the ordinary forest.
 * :param time: The time of day now set; `live` and `day` add nothing.
 */
export function goToShot(shot: "flyin" | "ufocam" | null, time: string) {
  const p = new URLSearchParams(window.location.search);
  for (const k of ["flyin", "ufocam", "time", "tree"]) p.delete(k);
  if (shot) {
    p.set(shot, "");
    if (time !== "live" && time !== "day") p.set("time", time);
  }
  const q = p.toString().replace(/=(&|$)/g, "$1");
  window.location.search = q ? `?${q}` : "";
}
