/**
 * Languages and tools.
 *
 * The last outright hole in a character sheet: the builder asked for skills,
 * saves and everything else, then produced a character who spoke nothing and
 * could use no tools. The data was there the whole time — 603 of the 605
 * races carry a Languages trait, every class states its tool proficiencies,
 * and a background is defined as two of either — and it was read past.
 *
 * Both are read out of prose, because that is the shape the compendium has.
 * The phrasing is near-boilerplate, which is what makes it safe; anything
 * unrecognised falls through to "stated but not counted", so the sheet shows
 * the sentence and the table decides. The app never invents a proficiency
 * nobody was given.
 */

/**
 * The languages of the game, for the picker. Names only — what any of them
 * sounds like is the compendium's business, and the race trait already says.
 */
export const STANDARD_LANGUAGES = [
  "Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc",
] as const;

export const EXOTIC_LANGUAGES = [
  "Abyssal", "Celestial", "Deep Speech", "Draconic", "Infernal", "Primordial",
  "Sylvan", "Undercommon",
] as const;

export const ALL_LANGUAGES: readonly string[] = [
  ...STANDARD_LANGUAGES, ...EXOTIC_LANGUAGES,
];

export interface Granted {
  /** Held outright, no choice involved. */
  readonly known: readonly string[];
  /** How many more they pick. */
  readonly choose: number;
  /**
   * What the source said, when it could not be turned into a list. Shown on
   * the sheet verbatim rather than dropped or guessed at.
   */
  readonly stated?: string;
  /**
   * The part of the line that is the choice, so a picker can be narrowed to
   * what was actually asked for. An artificer's line names three tools and
   * only one of them is a decision.
   */
  readonly choiceOf?: string;
}

const NONE: Granted = { known: [], choose: 0 };

/**
 * "You can speak, read, and write Common and Elvish." — 603 races, one shape.
 *
 * Also handles the two that matter beyond it: a Human's "one extra language
 * of your choice" and a Half-Elf's, which are the reason a language picker
 * has to exist at all rather than the race just deciding.
 */
export function languagesFromTrait(text: string): Granted {
  const t = (text ?? "").trim();
  if (t === "") return NONE;

  // "one extra language of your choice", "two additional languages"
  const extra = /\b(one|two|three|a|an)\b[^.]{0,40}?\b(extra|additional|more)\b|\bof your choice\b/i
    .exec(t);
  const count = extra
    ? { a: 1, an: 1, one: 1, two: 2, three: 3 }[
        (/\b(one|two|three|a|an)\b/i.exec(t)?.[1] ?? "one").toLowerCase()
      ] ?? 1
    : 0;

  // Everything between "write" and the end of that sentence is the list.
  const said = /\b(?:speak,?\s*read,?\s*and\s*write|understand,?\s*read,?\s*and\s*write|read\s+and\s+write|speak|know)\b\s+([^.]+)/i.exec(t);
  if (!said) return count > 0 ? { known: [], choose: count } : { known: [], choose: 0, stated: t };

  /*
   * Cut at the first clause boundary before splitting. A Kenku's trait reads
   * "...Common and Auran, but you can only speak using your Mimicry" — read
   * whole, the second half becomes a language called "but you can only speak".
   */
  const list = said[1]!.split(/,\s*(?:but|though|although)\b|;/i)[0] ?? "";

  const named = list
    .replace(/\band\b/gi, ",")
    .split(",")
    .map((x) => x.trim().replace(/\.$/, ""))
    /*
     * Any proper noun in the list position, not only the sixteen in the
     * rulebook. A complete compendium ships Auran, Bullywug and Troglodyte,
     * and a table running that content means them.
     */
    .filter((x) => /^[A-Z][A-Za-z'-]{2,19}( [A-Z][A-Za-z'-]{2,19})?$/.test(x))
    .map((x) => ALL_LANGUAGES.find((l) => l.toLowerCase() === x.toLowerCase()) ?? x);

  if (named.length === 0) {
    return count > 0 ? { known: [], choose: count } : { known: [], choose: 0, stated: t };
  }
  return { known: named, choose: count };
}

const WORD_COUNT: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, any: 1,
};

/**
 * A class's tool line: "Thieves' Tools", "None", "Three Musical Instrument of
 * your choice", "Any one type of Artisan's Tools or any one Musical
 * Instrument of your choice".
 *
 * A named tool is granted. A counted phrase is a choice. Anything else is
 * stated — a class that says something the app cannot parse should show the
 * sentence, not silently give nothing and not silently give everything.
 */
export function toolsFromClass(text: string): Granted {
  const t = (text ?? "").trim();
  if (t === "" || /^none$/i.test(t)) return NONE;

  /*
   * A line can do both at once, and reading it as one thing threw half of it
   * away: an artificer gets thieves' tools and tinker's tools OUTRIGHT and
   * then picks a set of artisan's tools. The whole line matched "one", so
   * all three became a single choice and two granted proficiencies vanished.
   *
   * Unless the line is an "or". "Thieves' tools, tinker's tools, or one type
   * of gaming set" is one pick among three, and reading its parts as granted
   * hands out all three — the same mistake in the generous direction.
   */
  const alternatives = /\bor\b/i.test(t);
  const parts = alternatives
    ? [t]
    : t.split(",").map((x) => x.trim()).filter(Boolean);

  const known: string[] = [];
  const asked: string[] = [];
  let choose = 0;
  for (const part of parts) {
    const counted = /\b(one|two|three|four|any)\b/i.exec(part);
    // An "or" is a choice whether or not it counts itself: an apothecary's
    // "poisoner's kit, herbalism kit, or alchemist's supplies" names no
    // number and is still one pick, not three grants.
    if (alternatives || counted || /\byour choice\b|\bchoose\b/i.test(part)) {
      choose += WORD_COUNT[(counted?.[1] ?? "one").toLowerCase()] ?? 1;
      asked.push(part);
      continue;
    }
    known.push(part);
  }

  if (known.length === 0 && choose === 0) return { known: [], choose: 0, stated: t };
  return {
    known,
    choose,
    ...(choose > 0 ? { stated: t, choiceOf: asked.join(", ") } : {}),
  };
}

/**
 * The families a tool can belong to, which is what a line means when it says
 * "one type of" something. The compendium states it in `detail`.
 */
export type ToolKind = "artisan tools" | "gaming set" | "instrument" | "tools";

export function toolKind(detail: string | undefined): ToolKind | null {
  const d = (detail ?? "").trim().toLowerCase();
  if (d === "artisan tools") return "artisan tools";
  if (d === "gaming set") return "gaming set";
  if (d === "instrument") return "instrument";
  if (d === "tools" || d === "tool") return "tools";
  return null;
}

/**
 * Which families a phrase names — "one type of musical instrument" is ten
 * things to choose between, not fifty-four.
 *
 * Naming none of them is the answer for "one type of tool of your choice",
 * and reads as no narrowing rather than as an empty list: a picker with
 * nothing in it is worse than a long one.
 */
export function kindsNamed(said: string): ToolKind[] {
  const t = (said ?? "").toLowerCase();
  const out: ToolKind[] = [];
  if (/\bartisan/.test(t)) out.push("artisan tools");
  if (/\bgaming set/.test(t)) out.push("gaming set");
  if (/\binstrument/.test(t)) out.push("instrument");
  return out;
}

/**
 * A tool named in prose, matched to the thing it is.
 *
 * Backgrounds say "Disguise kits" where the item is a "Disguise Kit", and a
 * sheet carrying the sentence's spelling does not line up with the equipment
 * list. Normalisation is applied to both sides, so it need only be
 * consistent, not linguistically right — "thieves' tools" and "thieve tool"
 * meet in the middle.
 *
 * Anything with no match is kept as written. "Vehicles (land)" is a real
 * proficiency and not an item, and dropping it would be worse than spelling
 * it the way the book did.
 */
export function resolveTool(name: string, options: readonly string[]): string {
  const norm = (x: string) =>
    x.toLowerCase().replace(/[^a-z\s]/g, "").replace(/s\b/g, "")
      .replace(/\s+/g, " ").trim();
  const want = norm(name);
  if (want === "") return name.trim();
  return options.find((o) => norm(o) === want) ?? name.trim();
}

/**
 * Whether an item is a tool somebody can be proficient WITH, as opposed to a
 * magical one they would carry. The compendium says so in `detail`, and
 * anything carrying a rarity or an attunement clause is treasure.
 */
export function isMundaneTool(detail: string | undefined): boolean {
  const d = (detail ?? "").trim().toLowerCase();
  return d === "tools" || d === "tool" || d === "artisan tools"
    || d === "instrument" || d === "gaming set";
}

/** Merge everything a character was given, without repeating any of it. */
export function gather(...lists: readonly (readonly string[] | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) {
    for (const x of list ?? []) {
      const key = x.trim().toLowerCase();
      if (key !== "" && !seen.has(key)) seen.set(key, x.trim());
    }
  }
  return [...seen.values()];
}
