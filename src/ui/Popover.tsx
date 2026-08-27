/**
 * A sheet under the thumb.
 *
 * The pattern the conditions picker arrived at, finally written down. Opening
 * a chooser INSIDE the page pushes everything below it down half a screen —
 * mid-session, while somebody is reading it — and then you scroll back to
 * find where you were. Over the page instead: the thing you were looking at
 * stays where it was, and closing puts you back with nothing moved.
 *
 * At the bottom because that is where thumbs are, and on a wide screen it
 * stops short of full width so it does not read as a page change.
 *
 * The scrim is a real button rather than a div with a click handler: tapping
 * outside to close is the most-used control on a sheet like this, and it
 * should be reachable from a keyboard like any other.
 */

import { useEffect, type ReactNode } from "react";

export function Popover({
  open, title, onClose, children, done = "Done",
}: {
  readonly open: boolean;
  /** Named, because a sheet that appears with no heading is a surprise. */
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** The closing word, when "Done" is not what this one means. */
  readonly done?: string;
}) {
  /*
   * Escape closes it. A sheet that can only be dismissed by finding the right
   * pixel is a trap on a keyboard, and this app is used on laptops now.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <button className="pop-back" aria-label={`Close ${title}`} onClick={onClose} />
      <div className="pop-pane" role="dialog" aria-label={title}>
        <span className="label">{title}</span>
        <div className="pop-body">{children}</div>
        <button onClick={onClose}>{done}</button>
      </div>
    </>
  );
}
