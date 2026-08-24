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

/** What an option actually grants, for showing beside it. */
export function featuresOf(
  features: readonly ClassFeature[],
  option: string,
  level: number,
): ClassFeature[] {
  return features.filter((f) => grantedBy(f.name) === option && f.level <= level);
}
