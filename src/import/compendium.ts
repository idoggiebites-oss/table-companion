/**
 * Fight Club 5e COMPENDIUM XML → the shapes this app already uses.
 *
 * A compendium is not a character. The character adapter next door reads one
 * person's export; this reads the content file that feeds Fight Club's own
 * builder — races, classes, backgrounds, feats, spells, items and monsters.
 *
 * SCHEMA PROVENANCE. Read off a real Lion's Den SRD compendium (version="5"):
 *
 *   compendium/race/{name,size,speed,ability,trait}
 *   compendium/class/{name,hd,numSkills,armor,weapons,tools,wealth,
 *                     spellAbility,proficiency,autolevel[level]/{slots,feature}}
 *   compendium/background/{name,proficiency,trait}
 *   compendium/feat/{name,prerequisite,text}
 *   compendium/spell/{name,level,school,time,range,components,duration,
 *                     classes,text}
 *   compendium/item/{name,type,detail,magic,weight,ac,text}
 *   compendium/monster/{name,size,type,ac,hp,speed,str…cha,save,skill,
 *                       immune,senses,languages,cr,trait,action,legendary}
 *
 * The point of mapping into OUR types rather than keeping a parallel world is
 * that everything downstream — the equipment picker, the trader's shelf, the
 * monster reference — then works on imported content without knowing it was
 * imported. A magic item is an Item; the only difference is where it came
 * from, which is recorded and shown, never inferred.
 *
 * Nothing here throws on bad input. A compendium is somebody's file, possibly
 * hand-edited, possibly truncated; a parse error should cost you that one
 * entry rather than the import.
 */

import type { Item } from "../domain/items.js";
import type { Statblock, StatblockAction } from "../domain/statblock.js";

export interface CompendiumSpell {
  readonly id: string;
  readonly name: string;
  /** 0 is a cantrip. */
  readonly level: number;
  readonly school: string;
  readonly time: string;
  readonly range: string;
  readonly components: string;
  readonly duration: string;
  /** Lowercased class ids that can cast it. */
  readonly classes: readonly string[];
  readonly text: string;
  readonly ritual: boolean;
  readonly concentration: boolean;
}

export interface CompendiumRace {
  readonly id: string;
  readonly name: string;
  readonly size: string;
  readonly speed: number;
  readonly abilityBonuses: Readonly<Record<string, number>>;
  readonly traits: readonly { name: string; text: string }[];
}

export interface CompendiumBackground {
  readonly id: string;
  readonly name: string;
  readonly skills: readonly string[];
  readonly traits: readonly { name: string; text: string }[];
}

export interface CompendiumFeat {
  readonly id: string;
  readonly name: string;
  readonly prerequisite: string;
  readonly text: string;
}

export interface CompendiumClass {
  readonly id: string;
  readonly name: string;
  readonly hitDie: number;
  readonly numSkills: number;
  readonly armor: string;
  readonly weapons: string;
  readonly tools: string;
  /** "4d4x10" — what the book gives you instead of a kit. */
  readonly wealth: string;
  readonly spellAbility: string;
  /**
   * As the file writes it: saving throws first, then the skills you choose
   * from. "Strength, Constitution, Acrobatics, Athletics, …"
   */
  readonly proficiency: string;
  /** Spell slots by character level; index 0 is level 1. */
  readonly slots: readonly (readonly number[])[];
  readonly features: readonly { level: number; name: string; text: string }[];
}

export interface Compendium {
  readonly name: string;
  readonly importedAt: number;
  readonly races: readonly CompendiumRace[];
  readonly classes: readonly CompendiumClass[];
  readonly backgrounds: readonly CompendiumBackground[];
  readonly feats: readonly CompendiumFeat[];
  readonly spells: readonly CompendiumSpell[];
  readonly items: readonly Item[];
  readonly monsters: readonly Statblock[];
}

const SCHOOLS: Record<string, string> = {
  A: "abjuration", C: "conjuration", D: "divination", EN: "enchantment",
  EV: "evocation", I: "illusion", N: "necromancy", T: "transmutation",
};

/**
 * Fight Club's single-letter item types. The armour ones matter because they
 * decide whether dexterity applies; the rest are labels.
 */
const PROPERTY: Record<string, string> = {
  F: "finesse", V: "versatile", T: "thrown", A: "ammunition", H: "heavy",
  L: "light", LD: "loading", R: "reach", S: "special", "2H": "two-handed",
};
/** Not a property — it is the weapon's category, riding in the same list. */
const MARTIAL = "M";

const DAMAGE_TYPE: Record<string, string> = {
  B: "bludgeoning", P: "piercing", S: "slashing",
};

const ITEM_TYPES: Record<string, { category: string; armorCategory?: Item["armorCategory"] }> = {
  LA: { category: "armor", armorCategory: "Light" },
  MA: { category: "armor", armorCategory: "Medium" },
  HA: { category: "armor", armorCategory: "Heavy" },
  S: { category: "armor", armorCategory: "Shield" },
  M: { category: "weapon" },
  R: { category: "weapon" },
  A: { category: "adventuring-gear" },   // ammunition
  G: { category: "adventuring-gear" },
  P: { category: "adventuring-gear" },   // potion
  SC: { category: "adventuring-gear" },  // scroll
  W: { category: "adventuring-gear" },   // wondrous
  RD: { category: "adventuring-gear" },  // rod
  RG: { category: "adventuring-gear" },  // ring
  ST: { category: "adventuring-gear" },  // staff
  WD: { category: "adventuring-gear" },  // wand
  $: { category: "adventuring-gear" },   // treasure
  T: { category: "tools" },
  AT: { category: "tools" },
  GS: { category: "tools" },
  INS: { category: "tools" },
  MNT: { category: "mounts-and-vehicles" },
  VEH: { category: "mounts-and-vehicles" },
  SHP: { category: "mounts-and-vehicles" },
};

export const slug = (s: string): string =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const text = (el: Element | null | undefined, tag: string): string =>
  el?.querySelector(`:scope > ${tag}`)?.textContent?.trim() ?? "";

const all = (el: Element, tag: string): Element[] =>
  [...el.querySelectorAll(`:scope > ${tag}`)];

const joined = (el: Element, tag: string): string =>
  all(el, tag).map((x) => x.textContent?.trim() ?? "").filter(Boolean).join("\n\n");

const num = (s: string, fallback = 0): number => {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
};

/** "Dex 2, Wis 1" → {dex: 2, wis: 1} */
function abilityBonuses(s: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of s.split(",")) {
    const m = /([a-z]+)\s*([+-]?\d+)/i.exec(part.trim());
    if (m) out[m[1]!.slice(0, 3).toLowerCase()] = Number(m[2]);
  }
  return out;
}

function traits(el: Element): { name: string; text: string }[] {
  return all(el, "trait").map((t) => ({
    name: text(t, "name"),
    text: joined(t, "text"),
  }));
}

function actions(el: Element, tag: string): StatblockAction[] {
  return all(el, tag).map((a) => ({ name: text(a, "name"), desc: joined(a, "text") }));
}

/** "Prof Bonus +2, Insight +5" style lists → {insight: 5} */
function signedList(s: string): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const part of s.split(",")) {
    const m = /([a-z ]+?)\s*([+-]\d+)/i.exec(part.trim());
    if (m) out[m[1]!.trim().toLowerCase()] = Number(m[2]);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseCr(s: string): number {
  const t = s.trim();
  if (t.includes("/")) {
    const [a, b] = t.split("/");
    return num(a ?? "0") / num(b ?? "1", 1);
  }
  return num(t);
}

/** "150/600" or "20" → what the attack line prints. */
function parseRange(raw: string): { range?: { normal: number; long?: number } } {
  const m = /^(\d+)\s*(?:\/\s*(\d+))?/.exec(raw.trim());
  if (!m) return {};
  const normal = Number(m[1]);
  if (!Number.isFinite(normal) || normal <= 0) return {};
  const long = m[2] ? Number(m[2]) : undefined;
  return { range: { normal, ...(long ? { long } : {}) } };
}

function parseItem(el: Element): Item {
  const name = text(el, "name");
  const type = text(el, "type");
  const shape = ITEM_TYPES[type] ?? { category: "adventuring-gear" };
  const magic = text(el, "magic") === "YES" || text(el, "magic") === "1";
  const ac = text(el, "ac");
  const weight = num(text(el, "weight"), 0);

  const codes = text(el, "property").split(",").map((x) => x.trim()).filter(Boolean);
  const properties = codes.map((c) => PROPERTY[c]).filter((x): x is string => x !== undefined);
  const isWeapon = shape.category === "weapon";

  return {
    id: slug(name),
    name,
    category: shape.category,
    // <value> is in GOLD; everything here is copper. A club at 0.1 gp has to
    // come back as exactly 1 sp, which is the whole reason money is integer.
    cost: Math.round(num(text(el, "value"), 0) * 100),
    ...(weight > 0 ? { weight } : {}),

    ...(isWeapon
      ? {
          weaponRange: (type === "R" ? "Ranged" : "Melee") as "Melee" | "Ranged",
          // "M" in the property list means MARTIAL — the weapon's category
          // rather than a property. Its absence is what makes it simple.
          weaponCategory: (codes.includes(MARTIAL) ? "Martial" : "Simple") as "Simple" | "Martial",
          ...(properties.length > 0 ? { properties } : {}),
          ...(text(el, "dmg1") ? { damage: text(el, "dmg1") } : {}),
          ...(text(el, "dmg2") ? { twoHanded: text(el, "dmg2") } : {}),
          ...(text(el, "dmgType")
            ? { damageType: DAMAGE_TYPE[text(el, "dmgType")] ?? text(el, "dmgType").toLowerCase() }
            : {}),
          ...parseRange(text(el, "range")),
        }
      : {}),

    ...(shape.armorCategory ? { armorCategory: shape.armorCategory } : {}),
    ...(ac
      ? {
          baseAc: num(ac),
          dexBonus: shape.armorCategory === "Light" || shape.armorCategory === "Medium",
          ...(shape.armorCategory === "Medium" ? { maxDex: 2 } : {}),
        }
      : {}),
    ...(num(text(el, "strength"), 0) > 0 ? { strMinimum: num(text(el, "strength")) } : {}),
    ...(text(el, "stealth") === "YES" ? { stealthDisadvantage: true } : {}),
    ...(magic ? { magic: true } : {}),
    ...(text(el, "detail") ? { detail: text(el, "detail") } : {}),
  } as Item;
}

function parseMonster(el: Element): Statblock {
  const name = text(el, "name");
  const hp = text(el, "hp"); // "45 (7d8 + 14)"
  const hpMatch = /^(\d+)\s*(?:\(([^)]+)\))?/.exec(hp);
  const acRaw = text(el, "ac"); // "17 (natural armor)"
  const acMatch = /^(\d+)\s*(?:\(([^)]+)\))?/.exec(acRaw);
  const senses = text(el, "senses");
  const saves = signedList(text(el, "save"));
  const skills = signedList(text(el, "skill"));

  return {
    id: `fc-${slug(name)}`,
    name,
    size: text(el, "size"),
    type: text(el, "type").split(",")[0]?.trim() ?? "creature",
    alignment: text(el, "alignment") || "unaligned",
    ac: num(acMatch?.[1] ?? "10", 10),
    ...(acMatch?.[2] ? { acNote: acMatch[2] } : {}),
    hp: num(hpMatch?.[1] ?? "1", 1),
    hitDice: hpMatch?.[2] ?? "",
    speed: { walk: text(el, "speed") },
    cr: parseCr(text(el, "cr")),
    xp: 0, // suggested from CR elsewhere; the format does not carry it
    abilities: {
      str: num(text(el, "str"), 10), dex: num(text(el, "dex"), 10),
      con: num(text(el, "con"), 10), int: num(text(el, "int"), 10),
      wis: num(text(el, "wis"), 10), cha: num(text(el, "cha"), 10),
    },
    ...(saves ? { saves } : {}),
    ...(skills ? { skills } : {}),
    ...(text(el, "immune") ? { immunities: text(el, "immune").split(",").map((x) => x.trim()) } : {}),
    ...(senses ? { senses: { notes: senses } as Record<string, string> } : {}),
    ...(text(el, "languages") ? { languages: text(el, "languages") } : {}),
    traits: actions(el, "trait"),
    actions: actions(el, "action"),
    reactions: actions(el, "reaction"),
    legendary: actions(el, "legendary"),
  };
}

function parseClass(el: Element): CompendiumClass {
  const name = text(el, "name");
  const slots: number[][] = [];
  const features: { level: number; name: string; text: string }[] = [];

  for (const lv of all(el, "autolevel")) {
    const level = num(lv.getAttribute("level") ?? "0");
    const raw = text(lv, "slots");
    if (raw) {
      const parts = raw.split(",").map((x) => num(x)).filter((_, i) => i < 10);
      // Index 0 is cantrips known in this format; spell slots start at 1.
      while (slots.length < level) slots.push([]);
      slots[level - 1] = parts.slice(1).filter((_, i) => i < 9);
    }
    for (const f of all(lv, "feature")) {
      features.push({ level, name: text(f, "name"), text: joined(f, "text") });
    }
  }

  return {
    id: slug(name),
    name,
    hitDie: num(text(el, "hd"), 8),
    numSkills: num(text(el, "numSkills"), 2),
    armor: text(el, "armor"),
    weapons: text(el, "weapons"),
    tools: text(el, "tools"),
    wealth: text(el, "wealth"),
    spellAbility: text(el, "spellAbility"),
    proficiency: text(el, "proficiency"),
    slots,
    features,
  };
}

function parseSpell(el: Element): CompendiumSpell {
  const name = text(el, "name");
  const duration = text(el, "duration");
  const time = text(el, "time");
  return {
    id: slug(name),
    name,
    level: num(text(el, "level"), 0),
    school: SCHOOLS[text(el, "school").toUpperCase()] ?? text(el, "school"),
    time,
    range: text(el, "range"),
    components: text(el, "components"),
    duration,
    classes: text(el, "classes").split(",").map((c) => c.trim().toLowerCase()).filter(Boolean),
    text: joined(el, "text"),
    ritual: text(el, "ritual") === "YES" || /ritual/i.test(time),
    concentration: /concentration/i.test(duration),
  };
}

export type CompendiumKind =
  | "race" | "class" | "background" | "feat" | "spell" | "item" | "monster";

export const KINDS: readonly CompendiumKind[] = [
  "race", "class", "background", "feat", "spell", "item", "monster",
];

export interface CompendiumResult {
  readonly compendium: Compendium | null;
  readonly error?: string;
}

/**
 * Finds one kind's entries WITHOUT building a document.
 *
 * A complete compendium is 54MB of XML, and handing that to DOMParser builds
 * a tree several times its size — which is a crash on a phone rather than a
 * slow import. Scanning for the entry boundaries and parsing one entry at a
 * time keeps peak memory at the size of a single monster.
 *
 * The scan is deliberately dumb: these tags never nest inside themselves, so
 * a plain search for the next closing tag is correct and cannot be confused
 * by an inner <text> that happens to mention them.
 */
export function* scanEntries(xml: string, kind: CompendiumKind): Generator<string> {
  const open = new RegExp(`<${kind}(\\s[^>]*)?>`, "g");
  const close = `</${kind}>`;
  let m: RegExpExecArray | null;
  while ((m = open.exec(xml)) !== null) {
    const end = xml.indexOf(close, m.index);
    if (end === -1) return;
    yield xml.slice(m.index, end + close.length);
    open.lastIndex = end + close.length;
  }
}

export function countEntries(xml: string, kind: CompendiumKind): number {
  let n = 0;
  for (const _ of scanEntries(xml, kind)) n++;
  return n;
}

/**
 * Tolerant by design: one malformed entry costs that entry, not the import.
 * These files are large, sometimes hand-edited, and a person who has waited
 * for a 1MB parse deserves the 316 spells that were fine.
 */
const PARSERS = {
  race: (e: Element) => ({
    id: slug(text(e, "name")),
    name: text(e, "name"),
    size: text(e, "size"),
    speed: num(text(e, "speed"), 30),
    abilityBonuses: abilityBonuses(text(e, "ability")),
    traits: traits(e),
  }),
  class: parseClass,
  background: (e: Element) => ({
    id: slug(text(e, "name")),
    name: text(e, "name"),
    skills: text(e, "proficiency").split(",").map((x) => x.trim()).filter(Boolean),
    traits: traits(e),
  }),
  feat: (e: Element) => ({
    id: slug(text(e, "name")),
    name: text(e, "name"),
    prerequisite: text(e, "prerequisite"),
    text: joined(e, "text"),
  }),
  spell: parseSpell,
  item: parseItem,
  monster: parseMonster,
} as const;

/**
 * Parses ONE kind, entry by entry. Returns whatever survived: a compendium is
 * somebody's file, possibly hand-edited, and a person who has waited through a
 * 54MB parse deserves the 3,442 spells that were fine.
 */
export function parseKind<K extends CompendiumKind>(
  xml: string,
  kind: K,
): ReturnType<(typeof PARSERS)[K]>[] {
  const parser = new DOMParser();
  const fn = PARSERS[kind] as (e: Element) => ReturnType<(typeof PARSERS)[K]>;
  const out: ReturnType<(typeof PARSERS)[K]>[] = [];
  for (const chunk of scanEntries(xml, kind)) {
    try {
      const doc = parser.parseFromString(chunk, "application/xml");
      const el = doc.documentElement;
      if (!el || doc.querySelector("parsererror")) continue;
      out.push(fn(el));
    } catch {
      // One bad entry is not a failed import.
    }
  }
  return out;
}

/** What a file holds, without parsing any of it. */
export function survey(xml: string): Record<CompendiumKind, number> {
  return Object.fromEntries(KINDS.map((k) => [k, countEntries(xml, k)])) as Record<
    CompendiumKind,
    number
  >;
}

export function looksLikeCompendium(xml: string): string | null {
  const head = xml.slice(0, 4000);
  if (/<character[\s>]/.test(head) && !/<compendium[\s>]/.test(head)) {
    return "That is a character export, not a compendium — import it above.";
  }
  if (!/<compendium[\s>]/.test(head)) return "No <compendium> in that file.";
  return null;
}

export function parseCompendiumXml(
  xml: string,
  name = "Compendium",
  kinds: readonly CompendiumKind[] = KINDS,
): CompendiumResult {
  const bad = looksLikeCompendium(xml);
  if (bad) return { compendium: null, error: bad };
  const want = (k: CompendiumKind) => (kinds.includes(k) ? k : null);
  return {
    compendium: {
      name,
      importedAt: Date.now(),
      races: want("race") ? parseKind(xml, "race") : [],
      classes: want("class") ? parseKind(xml, "class") : [],
      backgrounds: want("background") ? parseKind(xml, "background") : [],
      feats: want("feat") ? parseKind(xml, "feat") : [],
      spells: want("spell") ? parseKind(xml, "spell") : [],
      items: want("item") ? parseKind(xml, "item") : [],
      monsters: want("monster") ? parseKind(xml, "monster") : [],
    },
  };
}

export function compendiumCounts(c: Compendium): { label: string; n: number }[] {
  return [
    { label: "races", n: c.races.length },
    { label: "classes", n: c.classes.length },
    { label: "backgrounds", n: c.backgrounds.length },
    { label: "feats", n: c.feats.length },
    { label: "spells", n: c.spells.length },
    { label: "items", n: c.items.length },
    { label: "creatures", n: c.monsters.length },
  ].filter((x) => x.n > 0);
}
