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

const conditions = (await get("5e-SRD-Conditions.json")).map((c) => ({
  id: c.index,
  name: c.name,
  desc: c.desc,
}));
writeFileSync(`${OUT}/conditions.json`, JSON.stringify(conditions));
console.log(`conditions: ${conditions.length} → ${OUT}/conditions.json`);
