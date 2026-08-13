/*
 * Builds the shipped SRD data from the upstream dataset.
 *
 * Re-runnable rather than a one-off paste: `node scripts/build-srd.mjs`
 * refetches and rewrites public/srd/*.json, so a correction upstream is one
 * command away and nobody has to guess where the committed file came from.
 *
 * Source:  https://github.com/5e-bits/5e-database  (MIT)
 * Content: SRD 5.1 by Wizards of the Coast, CC BY 4.0 — see ATTRIBUTION.md
 *
 * The upstream records carry API cross-references (nested {index,name,url}
 * objects) that only make sense when talking to their server. Those are
 * flattened to names here, which is most of the size saving.
 */
import { writeFileSync, mkdirSync } from "node:fs";

const BASE =
  "https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en";
const OUT = "public/srd";

const nameOf = (v) => (v && typeof v === "object" && "name" in v ? v.name : v);

/** Keeps the fields a table actually reads; drops API plumbing. */
function slimMonster(m) {
  const ac = Array.isArray(m.armor_class) ? m.armor_class[0] : m.armor_class;
  const block = (list) =>
    (list ?? []).map((a) => {
      const out = { name: a.name, desc: a.desc };
      if (a.attack_bonus !== undefined) out.attackBonus = a.attack_bonus;
      if (a.damage?.length) {
        out.damage = a.damage
          .filter((d) => d.damage_dice)
          .map((d) => ({ dice: d.damage_dice, type: nameOf(d.damage_type) }));
      }
      if (a.usage) out.usage = a.usage.type;
      return out;
    });

  const saves = {};
  const skills = {};
  for (const p of m.proficiencies ?? []) {
    const label = nameOf(p.proficiency) ?? "";
    const [kind, ...rest] = label.split(": ");
    const key = rest.join(": ");
    if (kind === "Saving Throw") saves[key.toLowerCase()] = p.value;
    else if (kind === "Skill") skills[key.toLowerCase()] = p.value;
  }

  return {
    id: m.index,
    name: m.name,
    size: m.size,
    type: m.type,
    subtype: m.subtype ?? undefined,
    alignment: m.alignment,
    ac: typeof ac === "object" ? ac.value : ac,
    acNote: typeof ac === "object" ? (ac.type ?? undefined) : undefined,
    hp: m.hit_points,
    hitDice: m.hit_points_roll ?? m.hit_dice,
    speed: m.speed,
    cr: m.challenge_rating,
    xp: m.xp,
    abilities: {
      str: m.strength, dex: m.dexterity, con: m.constitution,
      int: m.intelligence, wis: m.wisdom, cha: m.charisma,
    },
    proficiencyBonus: m.proficiency_bonus,
    saves: Object.keys(saves).length ? saves : undefined,
    skills: Object.keys(skills).length ? skills : undefined,
    senses: m.senses,
    languages: m.languages || undefined,
    resistances: m.damage_resistances?.length ? m.damage_resistances : undefined,
    immunities: m.damage_immunities?.length ? m.damage_immunities : undefined,
    vulnerabilities: m.damage_vulnerabilities?.length ? m.damage_vulnerabilities : undefined,
    conditionImmunities: m.condition_immunities?.length
      ? m.condition_immunities.map(nameOf)
      : undefined,
    traits: block(m.special_abilities),
    actions: block(m.actions),
    reactions: block(m.reactions),
    legendary: block(m.legendary_actions),
  };
}

const strip = (o) => JSON.parse(JSON.stringify(o)); // drops undefined

async function get(file) {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json();
}

mkdirSync(OUT, { recursive: true });

const monsters = (await get("5e-SRD-Monsters.json"))
  .map(slimMonster)
  .map(strip)
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(`${OUT}/monsters.json`, JSON.stringify(monsters));
console.log(`monsters: ${monsters.length} → ${OUT}/monsters.json`);

/* ---- character creation: races, subraces, classes at level 1 ---- */

const rawRaces = await get("5e-SRD-Races.json");
const rawSubraces = await get("5e-SRD-Subraces.json");
const rawClasses = await get("5e-SRD-Classes.json");
const rawLevels = await get("5e-SRD-Levels.json");
const rawTraits = await get("5e-SRD-Traits.json");

const traitDesc = new Map(rawTraits.map((t) => [t.index, (t.desc ?? []).join(" ")]));

const bonuses = (list) =>
  Object.fromEntries((list ?? []).map((b) => [nameOf(b.ability_score).toLowerCase(), b.bonus]));

const subracesOf = (raceIndex) =>
  rawSubraces
    .filter((s) => s.race?.index === raceIndex)
    .map((s) => ({
      id: s.index,
      name: s.name,
      abilityBonuses: bonuses(s.ability_bonuses),
      desc: s.desc ?? undefined,
    }));

const races = rawRaces
  .map((r) => ({
    id: r.index,
    name: r.name,
    size: r.size,
    speed: r.speed,
    abilityBonuses: bonuses(r.ability_bonuses),
    languages: (r.languages ?? []).map(nameOf),
    traits: (r.traits ?? []).map((t) => ({
      name: nameOf(t),
      desc: traitDesc.get(t.index) ?? "",
    })),
    subraces: subracesOf(r.index),
  }))
  .map(strip)
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(`${OUT}/races.json`, JSON.stringify(races));
console.log(`races: ${races.length} (${races.filter((r) => r.subraces.length).length} with subraces) → ${OUT}/races.json`);

/** Level 1 only: what a character needs to exist, not the whole progression. */
const levelOne = new Map(
  rawLevels
    .filter((l) => l.level === 1 && l.class?.index && !l.subclass)
    .map((l) => [l.class.index, l]),
);

const SKILL_PREFIX = /^Skill:\s*/;

const castsAtOne = (lv1) => {
  const sc = lv1?.spellcasting;
  if (!sc) return false;
  return (sc.cantrips_known ?? 0) > 0 ||
    (sc.spells_known ?? 0) > 0 ||
    (sc.spell_slots_level_1 ?? 0) > 0;
};

const classes = rawClasses
  .map((c) => {
    const lv1 = levelOne.get(c.index);
    const skillChoice = (c.proficiency_choices ?? []).find((p) =>
      (p.from?.options ?? []).some((o) => SKILL_PREFIX.test(nameOf(o.item) ?? "")),
    );
    return {
      id: c.index,
      name: c.name,
      hitDie: c.hit_die,
      saves: (c.saving_throws ?? []).map((s) => nameOf(s).toLowerCase()),
      /** Skills the player picks at level 1, and how many. */
      skillChoices: skillChoice
        ? {
            choose: skillChoice.choose,
            from: (skillChoice.from.options ?? [])
              .map((o) => (nameOf(o.item) ?? "").replace(SKILL_PREFIX, ""))
              .filter(Boolean),
          }
        : undefined,
      /**
       * Armour and weapons, which are not chosen. Saving throws are listed
       * here too upstream and are dropped — they are already `saves`, and a
       * character sheet showing "Saving Throw: DEX" as a proficiency reads
       * like a second, different thing.
       */
      proficiencies: (c.proficiencies ?? [])
        .map(nameOf)
        .filter((n) => !SKILL_PREFIX.test(n) && !/^Saving Throw:/.test(n)),
      equipment: (c.starting_equipment ?? []).map(
        (e) => `${e.quantity > 1 ? `${e.quantity} ` : ""}${nameOf(e.equipment)}`,
      ),
      equipmentChoices: (c.starting_equipment_options ?? []).map((o) => o.desc),
      /*
       * Only if it grants something AT LEVEL 1. Ranger and Paladin have a
       * spellcasting block full of zeros here because they start casting at
       * level 2, and treating that as "casts at level 1" would put an empty
       * spell section on their sheet.
       */
      spellcasting: castsAtOne(lv1)
        ? {
            ability: c.spellcasting ? nameOf(c.spellcasting.spellcasting_ability).toLowerCase() : undefined,
            cantrips: lv1.spellcasting.cantrips_known ?? 0,
            known: lv1.spellcasting.spells_known ?? 0,
            slots: [
              lv1.spellcasting.spell_slots_level_1 ?? 0,
            ].filter((n) => n > 0),
          }
        : undefined,
      features: (lv1?.features ?? []).map(nameOf),
    };
  })
  .map(strip)
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(`${OUT}/classes.json`, JSON.stringify(classes));
console.log(`classes: ${classes.length} (${classes.filter((c) => c.spellcasting).length} casting at level 1) → ${OUT}/classes.json`);

const conditions = (await get("5e-SRD-Conditions.json")).map((c) => ({
  id: c.index,
  name: c.name,
  desc: c.desc,
}));
writeFileSync(`${OUT}/conditions.json`, JSON.stringify(conditions));
console.log(`conditions: ${conditions.length} → ${OUT}/conditions.json`);
