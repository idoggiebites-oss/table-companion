/**
 * Press and hold to find out what something is.
 *
 * A spell row says "Fireball · 3rd · 150 ft" and a table needs the paragraph
 * about half a dozen times an evening — but the paragraph is four hundred
 * words and putting it on every row turns a list into a book. Tapping opens
 * it, which is wrong too: on the spell list a tap means "cast this", and a
 * row that both casts and explains is a row nobody trusts.
 *
 * So the description lives under a hold. It is the phone gesture for "what
 * is this", it costs nothing when unused, and it cannot be hit by accident
 * mid-turn.
 *
 * 450ms: long enough that a tap is never a hold, short enough that nobody
 * decides it is broken. Cancelled by movement, because a hold that survives
 * a scroll fires while you are reading something else — the most annoying
 * possible failure and the reason `touchmove` is listened for at all.
 *
 * Right-click does it on a desktop, where there is no thumb to hold.
 */

import { useCallback, useRef } from "react";

const HOLD_MS = 450;
/** How far a finger may drift before it counts as a scroll rather than a hold. */
const SLOP = 10;

export function useHold(onHold: (() => void) | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  /*
   * A hold that fired must not also click. Touch devices synthesise a click
   * after the finger lifts, so without this the description opens and the
   * spell is cast — which is the worst of both.
   */
  const fired = useRef(false);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  }, []);

  const start = useCallback(
    (x: number, y: number) => {
      if (!onHold) return;
      fired.current = false;
      from.current = { x, y };
      timer.current = setTimeout(() => {
        fired.current = true;
        onHold();
      }, HOLD_MS);
    },
    [onHold],
  );

  const moved = useCallback(
    (x: number, y: number) => {
      const at = from.current;
      if (!at) return;
      if (Math.abs(x - at.x) > SLOP || Math.abs(y - at.y) > SLOP) stop();
    },
    [stop],
  );

  if (!onHold) return {};
  return {
    onPointerDown: (e: React.PointerEvent) => start(e.clientX, e.clientY),
    onPointerMove: (e: React.PointerEvent) => moved(e.clientX, e.clientY),
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => {
      // The desktop gesture for the same question.
      e.preventDefault();
      onHold();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!fired.current) return;
      // The hold already answered. Do not also do the thing the tap does.
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
    },
  };
}
