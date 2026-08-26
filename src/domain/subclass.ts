/**
 * The choices a class makes about itself.
 *
 * A cleric without a domain is not a cleric, and the builder was making them.
 * Compendiums do not mark subclasses structurally — they hide them in the
 * feature list, where "Divine Domain" is the question and "Divine Domain:
 * Knowledge Domain" is one answer, with the features it grants suffixed
 * "(Knowledge Domain)".
 *
 * That shape turns out to cover more than subclasses. A fighter's Fighting
 * Style and a sorcerer's Metamagic are written the same way, so one reading
 * answers all three rather than three special cases.
 *
 * A head only counts as a CHOICE when the class also has a plain feature of
 * exactly that name — the question itself — and at least two answers. Without
 * that test, "Channel Divinity: Turn Undead" looks like a decision when it is
 * the only thing on offer.
 */

export interface ClassFeature {
  readonly level: number;
  readonly name: string;
  readonly text?: string;
}

export interface ChoiceOption {
  readonly name: string;
  readonly level: number;
  readonly text?: string;
}

export interface ChoicePoint {
  /** "Divine Domain", "Fighting Style". */
  readonly of: string;
  /** The level at which the class asks. */
  readonly level: number;
  readonly options: readonly ChoiceOption[];
}

const SPLIT = /^(.{3,40}?):\s+(.+)$/;

/** "Blessings of Knowledge (Knowledge Domain)" → belongs to that option. */
export function grantedBy(featureName: string): string | null {
  const m = /\(([^()]+)\)\s*$/.exec(featureName.trim());
  return m ? m[1]!.trim() : null;
}

export function findChoices(features: readonly ClassFeature[]): ChoicePoint[] {
  const plain = new Map<string, number>();
  for (const f of features) {
    if (!SPLIT.test(f.name)) plain.set(f.name.trim(), f.level);
  }

  const grouped = new Map<string, ChoiceOption[]>();
  for (const f of features) {
    const m = SPLIT.exec(f.name.trim());
    if (!m) continue;
    const head = m[1]!.trim();
    if (!plain.has(head)) continue;
    // "Divine Domain: Knowledge Domain (Knowledge Domain)" would double up.
    const option = m[2]!.replace(/\s*\([^()]*\)\s*$/, "").trim();
    if (!option) continue;
    const at = grouped.get(head) ?? [];
    if (!at.some((o) => o.name === option)) {
      at.push({ name: option, level: f.level, ...(f.text ? { text: f.text } : {}) });
    }
    grouped.set(head, at);
  }

  return [...grouped.entries()]
    .filter(([, options]) => options.length >= 2)
    .map(([of, options]) => ({
      of,
      level: plain.get(of) ?? Math.min(...options.map((o) => o.level)),
      options: [...options].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.level - b.level || a.of.localeCompare(b.of));
}

/** The ones a character at this level has been asked. */
export function choicesBy(points: readonly ChoicePoint[], level: number): ChoicePoint[] {
  return points.filter((p) => p.level <= level);
}

/**
 * The OUTERMOST trailing parenthetical, which is not the innermost.
 *
 * A compendium class table names subclass features as "Rallying Cry (Purple
 * Dragon Knight (Banneret))". Reading the last group gives "Banneret", which
 * matches no option and made the feature look class-wide — so a fighter
 * reaching 3 was told they gained a hundred and fifty features belonging to
 * subclasses they had not taken.
 */
export function outerParen(name: string): string | null {
  const t = (name ?? "").trim();
  if (!t.endsWith(")")) return null;
  let depth = 0;
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] === ")") depth++;
    else if (t[i] === "(") {
      depth--;
      if (depth === 0) return t.slice(i + 1, -1).trim();
    }
  }
  return null;
}

/**
 * Whose feature this is, given the options that actually exist.
 *
 * A trailing parenthetical is only an owner if it names one: "Action Surge
 * (one use)" is a plain class feature, and a rule that read every
 * parenthetical as a subclass would drop it from what you just gained.
 */
export function ownerOf(name: string, options: ReadonlySet<string>): string | null {
  const inner = outerParen(name);
  if (inner === null) return null;
  for (const o of options) {
    if (inner === o || inner.startsWith(`${o} (`) || inner.startsWith(`${o}(`)) return o;
  }
  return null;
}

/**
 * Whether a recorded answer names this option.
 *
 * The answer is written down in more than one place and more than one way: a
 * character built here stores "Life Domain", one typed in by hand stores
 * "life", and an imported one stores whatever its file said. Comparing them
 * exactly loses a cleric their own domain features, which is worse than
 * showing a few extra — so the match is loose in two named places and
 * nowhere else.
 *
 * A trailing label: "life" answers "Life Domain".
 *
 * And a leading one, but only across "of": "Evocation" answers "School of
 * Evocation" and "Moon" answers "Circle of the Moon". Matching any shared
 * last word instead would hand a Hunter every feature of the Trophy Hunter
 * and the Bounty Hunter, which is the noise this exists to remove.
 */
export function answers(answer: string, option: string): boolean {
  const a = answer.trim().toLowerCase();
  const o = option.trim().toLowerCase();
  if (a === "" || o === "") return false;
  if (a === o) return true;
  if (o.startsWith(`${a} `) || a.startsWith(`${o} `)) return true;
  const across = (whole: string, tail: string) =>
    new RegExp(`\\bof (the )?${tail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`).test(whole);
  return across(o, a) || across(a, o);
}

/**
 * Rows a compendium writes that are not features: the class's own preamble,
 * and what it hands somebody arriving by multiclass.
 */
const STRUCTURE = /^(starting|multiclass)\b/i;

/**
 * What THIS character has, out of everything the class can be.
 *
 * A complete compendium's ranger table carries every archetype ever written
 * for it — 372 feature names by level 8, of which 22 belong to the character
 * holding the sheet. The level-up screen has filtered this since the day a
 * fighter reaching 3 was told they gained a hundred and fifty features; the
 * sheet, which shows the same list forever afterwards, never did.
 *
 * Same rule as the level-up: a name in parentheses belongs to an option, and
 * it is yours only if you took that option. What it adds is the answers that
 * are not recorded as choices — a subclass set when the character was made,
 * or imported, or typed in by hand.
 */
export function ownFeatures(
  rows: readonly { readonly level: number; readonly features: readonly string[] }[],
  { level, answered }: { level: number; answered: readonly string[] },
): { level: number; names: string[] }[] {
  const all: ClassFeature[] = rows.flatMap((r) =>
    r.features.map((name) => ({ level: r.level, name })),
  );
  const options = new Set(findChoices(all).flatMap((p) => p.options.map((o) => o.name)));
  const mine = answered.filter((a) => a.trim() !== "");

  const out: { level: number; names: string[] }[] = [];
  for (const row of rows.filter((r) => r.level <= level)) {
    const names: string[] = [];
    /*
     * The SRD table and the compendium say the same thing twice and spell it
     * differently: "Favored Enemy (1 type)" beside "Favored Enemy", "Ranger
     * Archetype feature" beside "Ranger Archetype Feature". The first wins,
     * because the SRD's is merged in first and carries the detail.
     */
    const said = new Set<string>();
    for (const name of row.features) {
      if (STRUCTURE.test(name)) continue;
      // "Divine Domain: Life Domain" is the question being answered, not a
      // feature. The answer itself shows up as the features it granted.
      if (/^.{3,40}?:\s/.test(name)) continue;
      const owner = ownerOf(name, options);
      if (owner !== null && !mine.some((a) => answers(a, owner))) continue;
      const key = name.replace(/\s*\([^()]*\)\s*$/, "").trim().toLowerCase();
      if (said.has(key)) continue;
      said.add(key);
      names.push(name);
    }
    if (names.length > 0) out.push({ level: row.level, names });
  }
  return out;
}

/** What an option actually grants, for showing beside it. */
export function featuresOf(
  features: readonly ClassFeature[],
  option: string,
  level: number,
): ClassFeature[] {
  return features.filter((f) => grantedBy(f.name) === option && f.level <= level);
}
