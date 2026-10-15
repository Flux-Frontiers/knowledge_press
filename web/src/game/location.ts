import type { Place } from "./sky";

/**
 * The browser's location, for true sunrise and sunset, rounded to 0.1 degree
 * and kept only in this browser's save. Browsers allow it only on a secure
 * origin, so over plain http on the LAN it is never asked and the sky keeps to
 * the time zone (sky.ts, timeZonePlace).
 */

/** Whether this page may ask for a location at all. */
export function canLocate(): boolean {
  return typeof navigator !== "undefined" && !!navigator.geolocation && typeof window !== "undefined" && window.isSecureContext;
}

/** Ask the browser for the viewer's place (it may prompt), rounded to 0.1 degree. */
export function locate(onPlace: (p: Place) => void) {
  if (!canLocate()) return;
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => onPlace({ lat: Math.round(coords.latitude * 10) / 10, lon: Math.round(coords.longitude * 10) / 10 }),
    () => { /* declined or unavailable: the time zone stands in */ },
    { enableHighAccuracy: false, maximumAge: 6 * 3600000, timeout: 20000 },
  );
}

/**
 * When play starts: ask once if no place is saved; with one saved, refresh it
 * only if permission is already granted, so the prompt does not come back every
 * visit.
 */
export function requestPlace(saved: Place | null, onPlace: (p: Place) => void) {
  if (!canLocate()) return;
  if (!saved) { locate(onPlace); return; }
  navigator.permissions?.query({ name: "geolocation" }).then((p) => { if (p.state === "granted") locate(onPlace); }).catch(() => {});
}
