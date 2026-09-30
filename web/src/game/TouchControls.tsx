import { bookBySlug } from "./catalog";
import { useEffect, useRef, useState } from "react";
import { setTouchAxes, setTouchLook, stickAxes } from "./input";
import { useGame } from "./store";

export function TouchControls() {
  const collect = useGame((s) => s.collect);
  const nearbySlug = useGame((s) => s.nearbySlug);
  const pressed = useGame((s) => (s.nearbySlug ? s.library.includes(s.nearbySlug) : false));
  const nearbyDist = useGame((s) => s.nearbyDist);
  const blocked = useGame((s) => s.paused || s.libraryOpen || s.atlasOpen);
  const toggleCircuit = useGame((s) => s.toggleCircuit);
  const travelMode = useGame((s) => s.travelMode);

  useEffect(() => {
    setTouchAxes(0, 0);
    setTouchLook(0, 0);
    return () => { setTouchAxes(0, 0); setTouchLook(0, 0); };
  }, [blocked]);

  if (blocked) return null;
  return (
    <div className="touch-controls pointer-events-none absolute inset-x-0 bottom-0 z-20 items-end justify-between p-3">
      <Stick label="Drag to drive: up forward, down reverse, left or right to steer"
        onMove={(x, y) => { const a = stickAxes(x, y); setTouchAxes(a.throttle, a.steer); }}
        onRelease={() => setTouchAxes(0, 0)} />
      <div className="pointer-events-auto flex items-end gap-2">
        <div className="flex flex-col items-end gap-2">
          <button type="button" className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm" onClick={toggleCircuit}>
            {travelMode === "circuit" ? "End tour" : "Guided tour"}
          </button>
          <button type="button" disabled={!nearbySlug || nearbyDist >= 6.8}
            className="min-h-14 min-w-14 rounded-full border border-border bg-primary px-4 text-sm font-medium text-primary-fg disabled:opacity-40"
            onClick={() => { if (nearbySlug && nearbyDist < 6.8) collect(nearbySlug, bookBySlug(nearbySlug)?.title ?? "Book"); }}>
            {pressed ? "In press" : "Read"}
          </button>
        </div>
        {/* Look stick: up and down tilt and hold; left and right pan and ease back on release, like the arrow keys. */}
        <Stick label="Drag to look: up or down to tilt, left or right to look around"
          onMove={(x, y) => setTouchLook(-y, -x)}
          onRelease={() => setTouchLook(0, 0)} />
      </div>
    </div>
  );
}

/**
 * A round thumb stick. `onMove` gets the thumb's position, x right and y down,
 * each -1..1 inside the ring with a small dead zone at the centre.
 */
function Stick({ label, onMove, onRelease }: {
  label: string;
  onMove: (x: number, y: number) => void;
  onRelease: () => void;
}) {
  const pid = useRef<number | null>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });

  function fromEvent(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width * 0.5);
    const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height * 0.5);
    const mag = Math.hypot(dx, dy);
    const scale = mag > 1 ? 1 / mag : 1;
    const x = dx * scale, y = dy * scale;
    setThumb({ x: x * 32, y: y * 32 });
    onMove(Math.abs(x) < 0.12 ? 0 : x, Math.abs(y) < 0.12 ? 0 : y);
  }

  function clear(e: React.PointerEvent<HTMLDivElement>) {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    onRelease();
    setThumb({ x: 0, y: 0 });
  }

  return (
    <div role="group" aria-label={label}
      className="pointer-events-auto relative size-28 rounded-full border border-border bg-surface/80"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        if (pid.current !== null) return;
        pid.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        fromEvent(e);
      }}
      onPointerMove={(e) => { if (pid.current === e.pointerId) fromEvent(e); }}
      onPointerUp={clear} onPointerCancel={clear} onLostPointerCapture={clear}>
      <span className="absolute inset-0 m-auto size-10 rounded-full border border-primary bg-primary/50"
        style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }} />
    </div>
  );
}
