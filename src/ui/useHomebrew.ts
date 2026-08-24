/**
 * Whether to show other people's material.
 *
 * A complete compendium is mostly not the game: 81% of the races carry a
 * provenance marker, 89% of the feats, 65% of the spells. Somebody building
 * their first character does not want to scroll past three hundred homebrew
 * races to reach Elf, and somebody running a homebrew campaign needs every
 * one of them. Both are right, so it is a switch.
 *
 * Off by default. A person who imported a compendium can turn it on in one
 * tap; a person who did not never sees the switch do anything, because the
 * shipped lists have nothing marked in them.
 *
 * Device-local, like the content it governs — it is not a fact about the
 * campaign, and syncing it would mean one player's preference reordering
 * somebody else's screen.
 */

import { useCallback, useEffect, useState } from "react";
import { readMeta, writeMeta } from "../store/log.js";

const KEY = "prefs:homebrew";

export function useHomebrew(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);

  useEffect(() => {
    void readMeta<boolean>(KEY).then((v) => {
      if (v === true) setOn(true);
    });
  }, []);

  const set = useCallback((next: boolean) => {
    setOn(next);
    void writeMeta(KEY, next);
  }, []);

  return [on, set];
}
