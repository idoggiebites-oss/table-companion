/**
 * One race, one entry, whatever the source called it.
 *
 * The SRD models a halfling as a race with two subraces and gives the builder
 * a second dropdown. A compendium models the same thing as two top-level
 * entries — "Halfling, Lightfoot" and "Halfling, Stout" — so merging the two
 * lists naively produced Halfling AND both of its subraces side by side, three
 * ways to pick the same person.
 *
 * The convention is reliable: exactly one comma, base before it, variant
 * after. So the flat entries are folded back into the shape the builder
 * already knows how to show.
 *
 * ARITHMETIC. A compendium variant carries the TOTAL — "Halfling, Lightfoot"
 * is dex +2, cha +1, where the +2 is every halfling and the +1 is lightfoot.
 * The base keeps whatever every variant agrees on and each subrace keeps the
 * remainder, so base plus subrace still comes to the same total the file
 * stated. Nothing is invented and nothing is lost.
 */

export interface RaceLike {
  readonly id: string;
  readonly name: string;
  readonly size: string;
  readonly speed: number;
  readonly abilityBonuses: Readonly<Record<string, number>>;
  readonly traits?: readonly { readonly name: string; readonly desc: string }[];
  readonly subraces?: readonly {
    readonly id: string;
    readonly name: string;
    readonly abilityBonuses: Readonly<Record<string, number>>;
  }[];
  /** Set on anything that did not ship with the app. */
  readonly extra?: true;
}

const slug = (s: string): string =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** "Halfling, Lightfoot" → base "Halfling", variant "Lightfoot". */
export function splitName(name: string): { base: string; variant: string | null } {
  const at = name.indexOf(",");
  if (at === -1) return { base: name.trim(), variant: null };
  return { base: name.slice(0, at).trim(), variant: name.slice(at + 1).trim() };
}

/** Abilities every member agrees on, at the same value. */
function common(all: readonly Readonly<Record<string, number>>[]): Record<string, number> {
  const first = all[0];
  if (!first || all.length === 0) return {};
  const out: Record<string, number> = {};
  for (const [ability, value] of Object.entries(first)) {
    if (all.every((b) => b[ability] === value)) out[ability] = value;
  }
  return out;
}

function minus(
  total: Readonly<Record<string, number>>,
  base: Readonly<Record<string, number>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ability of new Set([...Object.keys(total), ...Object.keys(base)])) {
    const delta = (total[ability] ?? 0) - (base[ability] ?? 0);
    if (delta !== 0) out[ability] = delta;
  }
  return out;
}

/**
 * The label for the bare entry once its own group has variants. "Human" and
 * "Human, Variant" both exist, and the plain one has to stay reachable.
 */
export const STANDARD = "Standard";

/**
 * Folds a flat list into bases with subraces, then merges anything already
 * shaped that way. Existing subraces win on a name clash, because the shipped
 * data is the one with traits and languages written out.
 */
export function consolidateRaces(
  shaped: readonly RaceLike[],
  flat: readonly RaceLike[],
): RaceLike[] {
  const groups = new Map<string, { base: RaceLike | null; variants: { race: RaceLike; label: string }[] }>();

  for (const race of flat) {
    const { base, variant } = splitName(race.name);
    const key = slug(base);
    const group = groups.get(key) ?? { base: null, variants: [] };
    if (variant === null) group.base = race;
    else group.variants.push({ race, label: variant });
    groups.set(key, group);
  }

  const folded: RaceLike[] = [];
  for (const [key, group] of groups) {
    // A lone entry with no variants is simply a race.
    if (group.variants.length === 0) {
      if (group.base) folded.push({ ...group.base, subraces: group.base.subraces ?? [] });
      continue;
    }

    const totals = group.variants.map((v) => v.race.abilityBonuses);
    const baseBonuses = group.base ? group.base.abilityBonuses : common(totals);
    const source = group.base ?? group.variants[0]!.race;

    const subraces = [
      // The plain version stays selectable when the file listed one.
      ...(group.base
        ? [{ id: `${key}-standard`, name: STANDARD, abilityBonuses: {} as Record<string, number> }]
        : []),
      ...group.variants.map((v) => ({
        id: slug(`${key}-${v.label}`),
        name: v.label,
        abilityBonuses: minus(v.race.abilityBonuses, baseBonuses),
      })),
    ];

    folded.push({
      id: key,
      name: group.base ? group.base.name : splitName(group.variants[0]!.race.name).base,
      size: source.size,
      speed: source.speed,
      abilityBonuses: baseBonuses,
      ...(source.traits ? { traits: source.traits } : {}),
      subraces,
    });
  }

  /**
   * "Lightfoot Halfling" beside "Stout" reads as two different kinds of
   * thing. The dropdown is already headed by the race, so the race's name is
   * noise inside it.
   */
  const trim = (label: string, race: string): string => {
    const cut = label.replace(new RegExp(`\\s*${race}\\s*$`, "i"), "").trim();
    return cut.length > 0 ? cut : label;
  };

  // Merge with what was already shaped, by base id. Anything only the
  // compendium knows is marked, so the builder can lead with the familiar
  // nine instead of burying Human under six hundred alternatives.
  const out = new Map<string, RaceLike>();
  for (const race of folded) out.set(race.id, { ...race, extra: true });
  for (const race of shaped) {
    const existing = out.get(race.id);
    if (!existing) {
      out.set(race.id, race);
      continue;
    }
    const shapedSubs = (race.subraces ?? []).map((s) => ({ ...s, name: trim(s.name, race.name) }));
    const seen = new Set(shapedSubs.map((s) => slug(s.name)));
    out.set(race.id, {
      ...race,
      subraces: [
        ...shapedSubs,
        ...(existing.subraces ?? [])
          .map((s) => ({ ...s, name: trim(s.name, race.name) }))
          .filter((s) => !seen.has(slug(s.name))),
      ],
    });
  }
  // Shipped first, each half alphabetical within itself.
  const byName = (a: RaceLike, b: RaceLike) => a.name.localeCompare(b.name);
  const all = [...out.values()];
  return [
    ...all.filter((r) => !r.extra).sort(byName),
    ...all.filter((r) => r.extra).sort(byName),
  ];
}
