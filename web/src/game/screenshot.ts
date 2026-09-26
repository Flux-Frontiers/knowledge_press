/**
 * Screenshots of the 3-D view, without the HUD. The canvas registers a
 * capture function; the HUD's camera button calls saveScreenshot.
 */

/** Renders a fresh frame and returns it as a PNG data URL. */
let capture: (() => string) | null = null;

export function setScreenshotCapture(fn: (() => string) | null) {
  capture = fn;
}

function pngFile(dataUrl: string, name: string): File {
  const bytes = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new File([buf], name, { type: "image/png" });
}

/**
 * Save the current view as a PNG. Touch devices get the share sheet (Save
 * Image puts it in Photos); everything else downloads it.
 *
 * Runs synchronously up to the share call: iOS only opens the share sheet
 * from inside the tap that asked for it.
 *
 * :param share: offer the share sheet instead of a download, where the browser can share files.
 */
export function saveScreenshot(share: boolean) {
  if (!capture) return;
  const stamp = new Date().toISOString().slice(0, 19).replace("T", "-").replace(/:/g, "");
  const name = `knowledge-press-${stamp}.png`;
  const dataUrl = capture();
  if (share && typeof navigator.canShare === "function") {
    const file = pngFile(dataUrl, name);
    if (navigator.canShare({ files: [file] })) {
      // Cancelling the sheet rejects; nothing to do then.
      navigator.share({ files: [file] }).catch(() => {});
      return;
    }
  }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = name;
  a.click();
}
