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

/** What an option actually grants, for showing beside it. */
export function featuresOf(
  features: readonly ClassFeature[],
  option: string,
  level: number,
): ClassFeature[] {
  return features.filter((f) => grantedBy(f.name) === option && f.level <= level);
}
