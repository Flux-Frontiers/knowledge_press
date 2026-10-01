import { setInjectedKeys, setInjectedSteer } from "./input";
import { sim } from "./sim";

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  setSteer?: (v: number) => void;
  setKeys?: (codes: string[]) => void;
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
    __gameReady?: boolean;
    /** Set once a `?shot=` portrait has rendered enough frames to photograph. */
    __shotReady?: boolean;
    /** Aim the `?shot=` portrait at another book's tree; false for an unknown slug. */
    __shot?: (slug: string, frame?: import("./portrait").Frame) => boolean;
    /** The reach of a book's tree, for choosing a shared frame (portrait.ts commonFrame). */
    __shotExtent?: (slug: string) => import("./portrait").Extent | null;
    /** One frame for a set of books, so they are all shot at the same scale. */
    __shotFrame?: (slugs: string[]) => import("./portrait").Frame;
  }
}

export function installControlsTest() {
  if (typeof window === "undefined") return;
  window.__controlsTest = {
    getYaw: () => sim.yaw,
    getSpeed: () => sim.speed,
    setSteer: (v) => setInjectedSteer(v),
    setKeys: (codes) => {
      setInjectedSteer(null);
      setInjectedKeys(codes);
    },
  };
}
