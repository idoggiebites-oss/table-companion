/**
 * What kind of thing a creature is, and how hard.
 *
 * A complete compendium ships 6,633 monsters under 416 distinct type strings
 * — "humanoid (any race)", "fiend (demon)", "humanoid (elf)" — because the
 * files carry the subtype inside the type. That is 416 piles, which is not a
 * filter, it is a second search.
 *
 * The rulebook has fourteen. Normalising to them turns a list nobody can scan
 * into one a DM can, which is the same move the spell roles make: say which
 * pile a thing is in before anybody reads it.
 */

export const CREATURE_KINDS = [
  "aberration", "beast", "celestial", "construct", "dragon", "elemental",
  "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead",
] as const;

export type CreatureKind = (typeof CREATURE_KINDS)[number];

/**
 * The kind, with the subtype dropped. Anything unrecognised returns null
 * rather than being forced into a pile it does not belong in — a homebrew
 * "swarm of tiny horrors" is not a beast just because the app has nowhere
 * else to put it.
 */
export function creatureKind(type: string | undefined): CreatureKind | null {
  const head = (type ?? "").split("(")[0]!.trim().toLowerCase();
  return (CREATURE_KINDS as readonly string[]).includes(head)
    ? (head as CreatureKind)
    : null;
}

/**
 * Challenge rating, as the band a DM actually thinks in.
 *
 * "Is this a fair fight for a level 5 party" is the question; "CR 3.5" is not
 * an answer anybody reasons with. Four bands, named for what they are for.
 */
export type CrBand = "fodder" | "standard" | "deadly" | "legendary";

export const CR_BANDS: readonly CrBand[] = ["fodder", "standard", "deadly", "legendary"];

export const CR_LABEL: Readonly<Record<CrBand, string>> = {
  fodder: "CR 0–2",
  standard: "CR 3–8",
  deadly: "CR 9–16",
  legendary: "CR 17+",
};

export function crBand(cr: number): CrBand {
  if (cr <= 2) return "fodder";
  if (cr <= 8) return "standard";
  if (cr <= 16) return "deadly";
  return "legendary";
}
