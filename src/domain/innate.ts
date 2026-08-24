/**
 * Spells a race hands you.
 *
 * 158 of the 605 races grant one. A drow knows Dancing Lights and gains
 * Faerie Fire at 3rd; a tiefling knows Thaumaturgy and gains Hellish Rebuke.
 * The trait was shown as prose and the spell never reached the spell list, so
 * a tiefling arrived at the table unable to cast the one thing their race is
 * known for — and nothing on any screen said why.
 *
 * Three shapes, all near-boilerplate, which is what makes reading them safe:
 *
 *   "You know the dancing lights cantrip."
 *   "When you reach 3rd level, you can cast the faerie fire spell once per day"
 *   "You know one cantrip of your choice from the wizard spell list."
 *
 * The third is a choice rather than a grant, and is reported as one — the app
 * should ask, not pick.
 */

export interface InnateSpell {
  /** As written in the trait: "faerie fire". Matched by name, not by id. */
  readonly name: string;
  /** The character level it arrives at. 1 for something known from the start. */
  readonly level: number;
  /** Which trait said so, for the sheet to credit. */
  readonly from: string;
}

export interface InnateCasting {
  readonly spells: readonly InnateSpell[];
  /** "You know one cantrip of your choice from the wizard spell list." */
  readonly choices: readonly { readonly count: number; readonly list: string; readonly from: string }[];
}

export const NO_INNATE: InnateCasting = { spells: [], choices: [] };

const ORDINAL: Record<string, number> = {
  "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5,
  "6th": 6, "7th": 7, "8th": 8, "9th": 9, "10th": 10,
  "11th": 11, "13th": 13, "15th": 15, "17th": 17,
};

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3 };

export interface TraitLike {
  readonly name: string;
  readonly desc?: string;
  readonly text?: string;
}

/**
 * Read off the trait text, because no compendium marks any of this
 * structurally.
 *
 * Names are kept exactly as the trait wrote them and matched against the
 * spellbook later — the trait says "faerie fire" and the file says "Faerie
 * Fire", and only the spellbook can settle that. A spell this app cannot find
 * is simply not added, rather than invented.
 */
export function innateFrom(traits: readonly TraitLike[] | undefined): InnateCasting {
  const spells: InnateSpell[] = [];
  const choices: { count: number; list: string; from: string }[] = [];

  for (const t of traits ?? []) {
    const text = t.desc ?? t.text ?? "";
    const from = t.name ?? "";
    if (!text) continue;

    // "You know one cantrip of your choice from the wizard spell list."
    const choice = /you know (one|two|three) cantrips? of your choice(?: from the (\w+) spell list)?/i
      .exec(text);
    if (choice) {
      choices.push({
        count: WORDS[choice[1]!.toLowerCase()] ?? 1,
        list: (choice[2] ?? "any").toLowerCase(),
        from,
      });
    }

    // "You know the dancing lights cantrip." — known from level one.
    for (const m of text.matchAll(/you know the ([a-z][a-z' /-]{2,40}?) cantrip/gi)) {
      spells.push({ name: m[1]!.trim(), level: 1, from });
    }

    /*
     * "When you reach 3rd level, you can cast the faerie fire spell…"
     *
     * The level clause comes BEFORE the spell, and a single trait usually
     * lists two of them in one paragraph — so the whole sentence is matched
     * rather than searching for the spell and looking backwards.
     */
    for (const m of text.matchAll(
      /(?:when|once) you reach (\d+(?:st|nd|rd|th)) level[^.]{0,40}?cast the ([a-z][a-z' /-]{2,40}?) spell/gi,
    )) {
      spells.push({ name: m[2]!.trim(), level: ORDINAL[m[1]!.toLowerCase()] ?? 1, from });
    }
  }

  return { spells, choices };
}

/** What they have at this level — the rest arrives as they climb. */
export function innateAt(casting: InnateCasting, level: number): InnateSpell[] {
  return casting.spells.filter((s) => s.level <= level);
}

export function hasInnate(casting: InnateCasting): boolean {
  return casting.spells.length > 0 || casting.choices.length > 0;
}
