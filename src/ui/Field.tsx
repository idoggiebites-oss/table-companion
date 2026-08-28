/**
 * A box that says what it is.
 *
 * Placeholders were doing this job, and a placeholder disappears the moment
 * somebody types — so every form in this app read clearly while empty and
 * became a column of anonymous boxes the second it was filled in. "Ghoul",
 * "10", "d20" is legible; "Ghoul", "10", "16" is three numbers and a guess.
 *
 * It is a wrapper rather than an input of its own because the inputs here are
 * all sorts — plain, Num, number, textarea, select — and swapping them for
 * one component would be a much bigger change than the problem deserves. The
 * caller passes a matching `id`, which is explicit and hard to get wrong in a
 * way that goes unnoticed: a label pointing at nothing is visible.
 */

import type { ReactNode } from "react";

export function Field({
  label, htmlFor, width, hint, inline = false, children,
}: {
  readonly label: string;
  /** Must match the id on the input inside. */
  readonly htmlFor: string;
  /** A fixed basis, for the narrow ones sitting in a row. */
  readonly width?: number | undefined;
  /** A word about what goes in it, where the name is not enough. */
  readonly hint?: string | undefined;
  /*
   * Beside the box rather than above it.
   *
   * A stacked label costs about twenty pixels, which is nothing on a form and
   * too much on a panel that is already fighting to stay under a screen — the
   * sheet went back over the height verify-panel guards twice because of it.
   */
  readonly inline?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div
      className={`fld${inline ? " inline" : ""}`}
      style={width ? { flex: `0 0 ${width}px` } : undefined}
    >
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="fld-hint">{hint}</span>}
    </div>
  );
}
