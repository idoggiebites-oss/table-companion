/**
 * The canonical character — the model every import adapter, the builder, and
 * every screen reads.
 *
 * The rule that matters: an imported build is NEVER edited. A character is a
 * base plus an ordered list of appended deltas, and the effective build is
 * their replay. Phase 1 has no level-ups and every deltas array is empty, but
 * the shape exists now because adding it later would touch every read of a
 * character.
 */

import { hitDicePool, isMulticlass, multiclassSlots, pactMagic } from "./multiclass.js";
import { NO_SENSES, type Senses } from "./senses.js";
import {
  ABILITIES,
  abilityModifier,
  proficiencyBonus,
  SKILLS,
  type Ability,
  type AbilityScores,
  type SkillId,
} from "./abilities.js";
import { resolveAttack, type Attack, type ResolvedAttack } from "./attack.js";
import type { Edition } from "./edition.js";
import {
  HIT_DICE_RECHARGE,
  resolveMax,
  resourcesFor,
  specAt,
  type ClassId,
  type DieSize,
  type Recharge,
} from "./resources.js";

export type CharacterId = string;

export interface ClassEntry {
  readonly classId: ClassId;
  readonly level: number;
  readonly subclass?: string;
}

/** Where a base came from, so the UI can say what a re-import will replace. */
export type BuildSource = "manual" | "fightclub" | "pdf" | "beyond" | "builder";

/** None of it is required, and any of it can arrive at the table instead. */
export interface Identity {
  readonly alignment?: string;
  readonly personality?: string;
  readonly ideals?: string;
  readonly bonds?: string;
  readonly flaws?: string;
}

export interface BuildBase {
  readonly id: CharacterId;
  readonly name: string;
  readonly edition: Edition;
  readonly source: BuildSource;
  readonly classes: readonly ClassEntry[];
  readonly race: string;
  readonly abilities: AbilityScores;
  readonly maxHp: number;
  readonly hitDie: DieSize;
  /**
   * Hit dice for classes taken after the first. The base's own `hitDie` is
   * the first class's; a dip into something else brings its die with it.
   */
  readonly classDice?: Readonly<Record<string, DieSize>>;
  readonly armourClass: number;
  readonly speed: number;
  /** Taken at an improvement level. Shown on the sheet, never applied. */
  readonly feats?: readonly { readonly id: string; readonly name: string }[];
  /**
   * What the class asked and what was answered — a domain, a patron, a
   * fighting style. Recorded, never mechanised: the app cannot know what
   * eighty-five domains do.
   */
  readonly choices?: readonly { readonly of: string; readonly name: string }[];
  readonly saveProficiencies: readonly Ability[];
  readonly skillProficiencies: readonly SkillId[];
  /**
   * What they speak and what they can use. Free text on purpose: a compendium
   * ships languages the rulebook never named and tools nobody indexed, and a
   * closed list would quietly drop a table's own content.
   */
  readonly languages?: readonly string[];
  readonly toolProficiencies?: readonly string[];
  /**
   * Who they are, as opposed to what they can do. Mechanically inert and the
   * reason a build is somebody's character rather than a stat block — the
   * builder asked for every number and never once asked this.
   */
  readonly identity?: Identity;
  /**
   * What they can see. Carried on the build rather than re-read from the race
   * every time — an imported sheet has no race entry to read, and a table
   * that hand-edits one should be able to say "this one has darkvision".
   */
  readonly senses?: Senses;
  /** Max slots by spell level; index 0 is 1st level. Empty for non-casters. */
  readonly spellSlots: readonly number[];
  /** Warlock pact slots, which recharge on a short rest. */
  readonly pactSlots?: { readonly count: number; readonly level: number };
  readonly attacks: readonly Attack[];
}

/**
 * One appended level-up. Phase 4 writes these; phase 1 only has to carry them
 * without losing them.
 */
export interface BuildDelta {
  readonly kind: "levelGained";
  readonly classId: ClassId;
  /** Total character level AFTER this delta, so replay order is checkable. */
  readonly toTotalLevel: number;
  readonly hpGain: number;
  /**
   * An ability score improvement, as points per ability: +2 to one or +1 to
   * two. Applied here rather than stored as a new total, so the base a
   * re-import brings stays authoritative and the improvement replays on top.
   */
  readonly abilities?: Partial<Record<Ability, number>>;
  /** A feat taken instead of the improvement. Named, never mechanised. */
  readonly feat?: { readonly id: string; readonly name: string };
  /** Except this: Resilient hands over a saving throw, and only Resilient. */
  readonly save?: Ability;
  /**
   * What the level asked and what was answered — a subclass at 3, a patron,
   * a fighting style. On the delta rather than in its own event so that
   * undoing the level takes back everything the level gave.
   */
  readonly picks?: readonly { readonly of: string; readonly name: string }[];
  /**
   * The hit die of the class this level was taken in. Only meaningful for a
   * class the character did not already have — a dip brings its own die, and
   * nothing else in the log knows what it is.
   */
  readonly hitDie?: DieSize;
  readonly at: string;
}

export interface Character {
  readonly base: BuildBase;
  readonly deltas: readonly BuildDelta[];
}

/** A pool the app tracks: current out of max, with how it comes back. */
export interface ResolvedResource {
  readonly id: string;
  readonly name: string;
  readonly max: number;
  readonly recharge: Recharge;
  readonly die?: DieSize;
}

export interface EffectiveBuild {
  readonly id: CharacterId;
  readonly name: string;
  readonly edition: Edition;
  /** Carried through because feat prerequisites ask, and half of them ask. */
  readonly race: string;
  readonly classes: readonly ClassEntry[];
  readonly totalLevel: number;
  readonly proficiencyBonus: number;
  readonly abilities: AbilityScores;
  readonly abilityMods: Record<Ability, number>;
  readonly maxHp: number;
  readonly hitDie: DieSize;
  /**
   * Hit dice for classes taken after the first. The base's own `hitDie` is
   * the first class's; a dip into something else brings its die with it.
   */
  readonly classDice?: Readonly<Record<string, DieSize>>;
  readonly armourClass: number;
  readonly speed: number;
  readonly saveMods: Record<Ability, number>;
  readonly skillMods: Record<SkillId, number>;
  readonly passivePerception: number;
  /**
   * Hit dice per die size. A Fighter 5 / Warlock 3 has five d10 and three d8
   * and spends whichever they choose; one `hitDie` could only ever be a lie
   * about one of them. Single-class characters get a pool of one entry.
   */
  readonly hitDicePool: readonly { readonly die: DieSize; readonly count: number }[];
  /** True once more than one class has levels in it. */
  readonly multiclass: boolean;
  readonly languages: readonly string[];
  readonly toolProficiencies: readonly string[];
  readonly identity: Identity;
  readonly senses: Senses;
  readonly spellSlots: readonly number[];
  readonly resources: readonly ResolvedResource[];
  readonly attacks: readonly ResolvedAttack[];
  readonly feats: readonly { readonly id: string; readonly name: string }[];
  readonly choices: readonly { readonly of: string; readonly name: string }[];
}

/**
 * The hit die a class uses. The base carries one — its first class's — and
 * anything taken since names its own on the delta, because a level gained in
 * a new class is the only place that knows.
 */
function dieOfClass(b: BuildBase, classId: string): DieSize | undefined {
  if (b.classes[0]?.classId === classId) return b.hitDie;
  return b.classDice?.[classId] ?? b.hitDie;
}

function totalLevelOf(classes: readonly ClassEntry[]): number {
  return classes.reduce((n, c) => n + c.level, 0);
}

/** Replays deltas onto the base. Deltas never mutate — they produce a new base. */
function applyDeltas(base: BuildBase, deltas: readonly BuildDelta[]): BuildBase {
  let out = base;
  for (const d of deltas) {
    const classes = out.classes.some((c) => c.classId === d.classId)
      ? out.classes.map((c) =>
          c.classId === d.classId ? { ...c, level: c.level + 1 } : c,
        )
      : [...out.classes, { classId: d.classId, level: 1 }];
    // An improvement raises the score, and 20 is the ceiling for everything
    // this app models — a delta that would exceed it is capped rather than
    // dropped, so the log still shows what was taken.
    const abilities = d.abilities
      ? (Object.fromEntries(
          ABILITIES.map((a) => [a, Math.min(20, out.abilities[a] + (d.abilities?.[a] ?? 0))]),
        ) as AbilityScores)
      : out.abilities;
    const feats = d.feat ? [...(out.feats ?? []), d.feat] : out.feats;
    // Resilient, taken at a level, hands over a saving throw the class never
    // had. It is the only feat in the game that does.
    const saves = d.save && !out.saveProficiencies.includes(d.save)
      ? [...out.saveProficiencies, d.save]
      : out.saveProficiencies;
    const picked = d.picks?.length
      ? [
          ...(out.choices ?? []),
          ...d.picks.filter((p) => !(out.choices ?? []).some((c) => c.of === p.of)),
        ]
      : out.choices;
    // A dip carries its own hit die; the first class's stays on the base.
    const classDice = d.hitDie && out.classes[0]?.classId !== d.classId
      ? { ...(out.classDice ?? {}), [d.classId]: d.hitDie }
      : out.classDice;
    out = {
      ...out,
      classes,
      ...(classDice ? { classDice } : {}),
      maxHp: out.maxHp + d.hpGain,
      abilities,
      saveProficiencies: saves,
      ...(picked ? { choices: picked } : {}),
      ...(feats ? { feats } : {}),
    };
  }
  return out;
}

export function effectiveBuild(character: Character): EffectiveBuild {
  const b = applyDeltas(character.base, character.deltas);
  const totalLevel = totalLevelOf(b.classes);
  const pb = proficiencyBonus(totalLevel);

  /*
   * Multiclass slots do not come from adding two class tables together. One
   * effective caster level is worked out and the full-caster table read at
   * it — which is why a Cleric 3 / Wizard 3 casts with a 6th-level caster's
   * slots while knowing only 2nd-level spells.
   *
   * A single-class character keeps their own table, because the multiclass
   * one is wrong for them: a lone paladin at 5 has 4/2, not the 3 the shared
   * table would hand them.
   */
  const multi = isMulticlass(b.classes);
  const slots = multi ? multiclassSlots(b.classes) : b.spellSlots;
  const pact = multi ? (pactMagic(b.classes) ?? b.pactSlots) : b.pactSlots;
  const pool = hitDicePool(b.classes, (id) => dieOfClass(b, id));

  const abilityMods = Object.fromEntries(
    ABILITIES.map((a) => [a, abilityModifier(b.abilities[a])]),
  ) as Record<Ability, number>;

  const modOf = (a: Ability) => abilityMods[a];

  const saveMods = Object.fromEntries(
    ABILITIES.map((a) => [
      a,
      abilityMods[a] + (b.saveProficiencies.includes(a) ? pb : 0),
    ]),
  ) as Record<Ability, number>;

  const skillMods = Object.fromEntries(
    (Object.keys(SKILLS) as SkillId[]).map((s) => [
      s,
      abilityMods[SKILLS[s]] + (b.skillProficiencies.includes(s) ? pb : 0),
    ]),
  ) as Record<SkillId, number>;

  const resources: ResolvedResource[] = [];

  /*
   * Hit dice first: the one pool whose recharge is partial.
   *
   * A multiclass character has more than one size of them. The pool below
   * carries the split; this resource keeps the total, because the number that
   * matters on a short rest is how many are left.
   */
  resources.push({
    id: "hitDice",
    name: "Hit dice",
    max: totalLevel,
    recharge: HIT_DICE_RECHARGE,
    die: b.hitDie,
  });

  for (const entry of b.classes) {
    for (const spec of resourcesFor(entry.classId)) {
      const variant = specAt(spec, entry.level);
      if (!variant) continue; // not unlocked at this level
      const max = resolveMax(variant.max, entry.level, modOf);
      if (max <= 0) continue;
      resources.push(
        spec.die === undefined
          ? { id: spec.id, name: spec.name, max, recharge: variant.recharge }
          : { id: spec.id, name: spec.name, max, recharge: variant.recharge, die: spec.die },
      );
    }
  }

  // Spell slots are resources too — pact slots prove they aren't all long-rest.
  slots.forEach((count, i) => {
    if (count > 0) {
      resources.push({
        id: `slot${i + 1}`,
        name: `Level ${i + 1} slots`,
        max: count,
        recharge: { on: "long" },
      });
    }
  });
  if (pact && pact.count > 0) {
    resources.push({
      id: "pactSlots",
      name: `Pact slots (level ${pact.level})`,
      max: pact.count,
      recharge: { on: "short" },
    });
  }

  return {
    id: b.id,
    name: b.name,
    edition: b.edition,
    race: b.race,
    classes: b.classes,
    totalLevel,
    proficiencyBonus: pb,
    abilities: b.abilities,
    abilityMods,
    maxHp: b.maxHp,
    hitDie: b.hitDie,
    armourClass: b.armourClass,
    feats: b.feats ?? [],
    choices: b.choices ?? [],
    speed: b.speed,
    saveMods,
    skillMods,
    passivePerception: 10 + skillMods.perception,
    hitDicePool: pool,
    multiclass: isMulticlass(b.classes),
    languages: b.languages ?? [],
    toolProficiencies: b.toolProficiencies ?? [],
    identity: b.identity ?? {},
    senses: b.senses ?? NO_SENSES,
    spellSlots: slots,
    resources,
    attacks: b.attacks.map((a) => resolveAttack(a, abilityMods, pb)),
  };
}

/**
 * Reconciles a re-import against level-ups already appended in the app.
 *
 * This is the case the build plan called phase 4's riskiest: somebody levels
 * in their builder AND in the app, then re-imports. The new base already
 * contains that level, so replaying the delta on top would apply it twice —
 * a character silently two levels and sixteen hit points ahead.
 *
 * A delta records the total level it produced, so anything the incoming base
 * already reaches has been superseded and is dropped. Deltas beyond it are
 * levels the builder does not know about yet and are kept.
 */
export function reconcileImport(
  incoming: BuildBase,
  deltas: readonly BuildDelta[],
): Character {
  const baseLevel = totalLevelOf(incoming.classes);
  return {
    base: incoming,
    deltas: deltas.filter((d) => d.toTotalLevel > baseLevel),
  };
}

/** Appends a level-up, numbering it from where the character actually is. */
export function appendLevel(
  character: Character,
  classId: ClassId,
  hpGain: number,
  at: string,
  choice?: {
    readonly abilities?: Partial<Record<Ability, number>>;
    readonly feat?: { readonly id: string; readonly name: string };
    readonly save?: Ability;
    readonly picks?: readonly { readonly of: string; readonly name: string }[];
    readonly hitDie?: DieSize;
  },
): Character {
  const current = effectiveBuild(character).totalLevel;
  return {
    ...character,
    deltas: [
      ...character.deltas,
      {
        kind: "levelGained",
        classId,
        toTotalLevel: current + 1,
        hpGain,
        at,
        ...(choice?.abilities ? { abilities: choice.abilities } : {}),
        ...(choice?.feat ? { feat: choice.feat } : {}),
        ...(choice?.save ? { save: choice.save } : {}),
        ...(choice?.picks?.length ? { picks: choice.picks } : {}),
        ...(choice?.hitDie ? { hitDie: choice.hitDie } : {}),
      },
    ],
  };
}
