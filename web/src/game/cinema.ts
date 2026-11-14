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
