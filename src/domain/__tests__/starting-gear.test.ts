import { describe, expect, it } from "vitest";
import { indexItems, type Item } from "../items.js";
import { assemble } from "../creation.js";
import { formatCoins } from "../money.js";
import { averageWealth, describeWealth, rollWealth } from "../non-srd.js";
import { findItem, parseChoice, parseFixed, resolvePhrase, toStack } from "../starting-gear.js";

const item = (id: string, name: string, extra: Partial<Item> = {}): Item =>
  ({ id, name, category: "adventuring-gear", cost: 0, ...extra });

const catalogue = indexItems([
  item("chain-mail", "Chain Mail", { category: "armor", armorCategory: "Heavy" }),
  item("barding-chain-mail", "Barding: Chain Mail", { category: "armor" }),
  item("leather-armor", "Leather Armor", { category: "armor", armorCategory: "Light" }),
  item("studded-leather-armor", "Studded Leather Armor", { category: "armor" }),
  item("longbow", "Longbow", { category: "weapon", weaponCategory: "Martial", weaponRange: "Ranged" }),
  item("arrow", "Arrow"),
  item("shield", "Shield", { category: "armor", armorCategory: "Shield" }),
  item("dagger", "Dagger", { category: "weapon", weaponCategory: "Simple" }),
  item("thieves-tools", "Thieves' Tools", { category: "tools" }),
  item("dungeoneers-pack", "Dungeoneer's Pack"),
  item("explorers-pack", "Explorer's Pack"),
  item("burglars-pack", "Burglar's Pack"),
  item("handaxe", "Handaxe", { category: "weapon", weaponCategory: "Simple" }),
]);

describe("finding what the sentence names", () => {
  it("prefers an exact name over a longer one containing it", () => {
    // "chain mail" also appears inside "Barding: Chain Mail", and picking that
    // would armour the fighter's horse instead of the fighter.
    expect(findItem("chain mail", catalogue)?.id).toBe("chain-mail");
    expect(findItem("leather armor", catalogue)?.id).toBe("leather-armor");
  });

  it("handles a plural", () => {
    expect(findItem("arrows", catalogue)?.id).toBe("arrow");
    expect(findItem("two handaxes", catalogue)).toBeUndefined(); // quantity is stripped earlier
  });

  it("copes with the curly apostrophe the SRD text uses", () => {
    expect(findItem("thieves’ tools", catalogue)?.id).toBe("thieves-tools");
  });
});

describe("a phrase", () => {
  it("takes a numeric quantity", () => {
    const p = resolvePhrase("20 arrows", catalogue);
    expect(p).toMatchObject({ kind: "item", qty: 20 });
  });

  it("takes a written one", () => {
    expect(resolvePhrase("two handaxes", catalogue)).toMatchObject({ kind: "item", qty: 2 });
  });

  it("treats an article as one", () => {
    expect(resolvePhrase("a shield", catalogue)).toMatchObject({ kind: "item", qty: 1 });
    expect(resolvePhrase("an explorer's pack", catalogue)).toMatchObject({ kind: "item", qty: 1 });
  });

  it("recognises a category as a question rather than a thing", () => {
    const p = resolvePhrase("a martial weapon", catalogue);
    expect(p).toMatchObject({ kind: "category", weaponCategory: "Martial" });
    expect(toStack(p)).toBe(null);
  });

  it("narrows a category by range when the book does", () => {
    expect(resolvePhrase("any simple melee weapon", catalogue)).toMatchObject({
      kind: "category", weaponCategory: "Simple", weaponRange: "Melee",
    });
  });

  it("keeps what it cannot resolve rather than dropping it", () => {
    // A wizard left without an arcane focus because a parser shrugged is worse
    // off than one holding something labelled in plain words.
    const p = resolvePhrase("an arcane focus", catalogue);
    expect(p).toMatchObject({ kind: "unknown", label: "arcane focus" });
    expect(toStack(p)).toMatchObject({ name: "Arcane focus", qty: 1 });
  });
});

describe("the choices as the book writes them", () => {
  it("splits a two-way choice", () => {
    const opts = parseChoice("(a) chain mail or (b) leather armor, longbow, and 20 arrows", catalogue);
    expect(opts.map((o) => o.letter)).toEqual(["a", "b"]);
    expect(opts[0]!.phrases).toHaveLength(1);
    expect(opts[0]!.phrases[0]).toMatchObject({ kind: "item", qty: 1 });
  });

  it("keeps commas INSIDE an option as separate items", () => {
    const opts = parseChoice("(a) chain mail or (b) leather armor, longbow, and 20 arrows", catalogue);
    expect(opts[1]!.phrases.map((p) => (p.kind === "item" ? p.item.id : p.kind)))
      .toEqual(["leather-armor", "longbow", "arrow"]);
    expect(opts[1]!.phrases[2]).toMatchObject({ qty: 20 });
  });

  it("splits a three-way choice whose options are comma-separated", () => {
    // The same comma means different things in these two lines, which is why
    // the lettered markers have to be split on first.
    const opts = parseChoice(
      "(a) a burglar’s pack, (b) a dungeoneer’s pack, or (c) an explorer’s pack",
      catalogue,
    );
    expect(opts.map((o) => o.letter)).toEqual(["a", "b", "c"]);
    expect(opts.every((o) => o.phrases.length === 1)).toBe(true);
    expect(opts[2]!.phrases[0]).toMatchObject({ kind: "item" });
  });

  it("carries a category through a choice", () => {
    const opts = parseChoice("(a) a martial weapon and a shield or (b) two martial weapons", catalogue);
    expect(opts[0]!.phrases.map((p) => p.kind)).toEqual(["category", "item"]);
    expect(opts[1]!.phrases[0]).toMatchObject({ kind: "category", qty: 2 });
  });

  it("handles a line with no lettering at all", () => {
    const opts = parseChoice("a shield", catalogue);
    expect(opts).toHaveLength(1);
    expect(opts[0]!.phrases[0]).toMatchObject({ kind: "item" });
  });
});

describe("the fixed half", () => {
  it("reads quantities the class data writes as a prefix", () => {
    const fixed = parseFixed(["Leather Armor", "2 Dagger", "Thieves' Tools"], catalogue);
    expect(fixed.map((p) => (p.kind === "item" ? [p.item.id, p.qty] : p.kind)))
      .toEqual([["leather-armor", 1], ["dagger", 2], ["thieves-tools", 1]]);
  });
});

describe("starting wealth, for the buy-your-own route", () => {
  it("averages the dice, in copper, without losing the half", () => {
    // 5d4 averages 12.5, so 125 gp — not 120.
    expect(formatCoins(averageWealth("fighter"))).toBe("125 gp");
    expect(formatCoins(averageWealth("rogue"))).toBe("100 gp");
  });

  it("does not multiply the monk's, which is what catches people out", () => {
    expect(formatCoins(averageWealth("monk"))).toBe("12 gp 5 sp");
    expect(describeWealth("monk")).toBe("5d4 gp");
    expect(describeWealth("fighter")).toBe("5d4 × 10 gp");
  });

  it("rolls within the possible range", () => {
    expect(formatCoins(rollWealth("fighter", () => 1))).toBe("50 gp");
    expect(formatCoins(rollWealth("fighter", () => 4))).toBe("200 gp");
  });

  it("gives nothing for a class it does not know", () => {
    expect(averageWealth("bard-of-the-void")).toBe(0);
  });
});

describe("improvements earned before the first session", () => {
  const base = {
    name: "Bel",
    race: { id: "human", name: "Human", speed: 30, abilityBonuses: {} },
    klass: { id: "fighter" as const, name: "Fighter", hitDie: 10 as const, saves: [], spellSlots: [] },
    background: { name: "Soldier", skills: [], tools: [] },
    baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    classSkills: [],
  };

  it("applies what a character made above level 1 has already earned", () => {
    // A fighter built at 8 has passed 4, 6 and 8 — the builder was stating
    // the points owed and giving nowhere to spend them.
    const b = assemble({ ...base, level: 8, improvements: [{ abilities: { str: 2 } }] });
    expect(b.abilities.str).toBe(17);
  });

  it("stacks several", () => {
    const b = assemble({
      ...base, level: 8,
      improvements: [{ abilities: { str: 2 } }, { abilities: { con: 1, dex: 1 } }],
    });
    expect([b.abilities.str, b.abilities.con, b.abilities.dex]).toEqual([17, 14, 15]);
  });

  it("stops at 20", () => {
    const b = assemble({
      ...base, level: 12, baseScores: { ...base.baseScores, str: 19 },
      improvements: [{ abilities: { str: 2 } }, { abilities: { str: 2 } }],
    });
    expect(b.abilities.str).toBe(20);
  });

  it("records a feat taken instead", () => {
    const b = assemble({
      ...base, level: 8,
      improvements: [{ feat: { id: "alert", name: "Alert" } }],
    });
    expect(b.feats).toEqual([{ id: "alert", name: "Alert" }]);
    expect(b.abilities.str).toBe(15);
  });

  it("adds nothing when the character starts at 1", () => {
    const b = assemble({ ...base, level: 1 });
    expect(b.abilities.str).toBe(15);
    expect(b.feats).toBeUndefined();
  });
});
