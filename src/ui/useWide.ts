/**
 * Whether there is room for two things at once.
 *
 * The app was drawn for a phone held in one hand under a table, which is the
 * right shape for a player and the wrong one for a DM with an iPad propped up
 * in front of them. On a wide screen the fight can simply stay on screen
 * while you do something else, and that is the whole difference — the tabs
 * exist because a phone cannot show two things, not because two things should
 * not be shown.
 *
 * A media query rather than a width guess: this has to survive an iPad being
 * turned sideways mid-session, which is a thing that happens constantly.
 */

import { useEffect, useState } from "react";

/** Landscape tablet and up. Portrait tablets are big phones and stay one. */
export const WIDE = "(min-width: 1024px)";

export function useWide(query: string = WIDE): boolean {
  const [wide, setWide] = useState(
    () => typeof matchMedia === "function" && matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia(query);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    setWide(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return wide;
}
