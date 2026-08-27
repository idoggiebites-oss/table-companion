import { describe, expect, it } from "vitest";
import {
  armourClass, attackFromWeapon, attacksFromEquipment, parseDamage, proficientWith,
} from "../equipment.js";
import { addItem, countOf, equippedItems, indexItems, removeItem, type Item } from "../items.js";
import { canAfford, formatCoins, formatPrice, parseCoins, splitCoins, toCopper } from "../money.js";
import { resolveAttack } from "../attack.js";

const item = (o: Partial<Item> & { id: string; name: string }): Item =>
  ({ category: "weapon", cost: 0, ...o });

const longsword = item({
  id: "longsword", name: "Longsword", damage: "1d8", damageType: "slashing",
  twoHanded: "1d10", properties: ["versatile"], weaponRange: "Melee", weaponCategory: "Martial",
});
const rapier = item({
  id: "rapier", name: "Rapier", damage: "1d8", damageType: "piercing",
  properties: ["finesse"], weaponRange: "Melee", weaponCategory: "Martial",
});
const longbow = item({
  id: "longbow", name: "Longbow", damage: "1d8", damageType: "piercing",
  properties: ["ammunition", "heavy", "two-handed"], weaponRange: "Ranged",
  weaponCategory: "Martial", range: { normal: 150, long: 600 },
});
const leather = item({
  id: "leather", name: "Leather Armor", category: "armor",
  armorCategory: "Light", baseAc: 11, dexBonus: true,
});
const halfPlate = item({
  id: "half-plate", name: "Half Plate", category: "armor", armorCategory: "Medium",
  baseAc: 15, dexBonus: true, maxDex: 2, stealthDisadvantage: true,
});
const chain = item({
  id: "chain", name: "Chain Mail", category: "armor", armorCategory: "Heavy",
  baseAc: 16, dexBonus: false, strMinimum: 13, stealthDisadvantage: true,
});
const shield = item({
  id: "shield", name: "Shield", category: "armor", armorCategory: "Shield", baseAc: 2,
});

describe("money is integer copper", () => {
  it("converts on the way in", () => {
    expect(toCopper(15, "gp")).toBe(1500);
    expect(toCopper(5, "sp")).toBe(50);
    expect(toCopper(1, "pp")).toBe(1000);
  });

  it("gives exact change — the reason it is not a decimal", () => {
    // A 5 sp item paid for with a gold piece.
    const purse = toCopper(1, "gp") - toCopper(5, "sp");
    expect(purse).toBe(50);
    expect(formatCoins(purse)).toBe("5 sp");
  });

  it("survives a hundred small purchases without drifting", () => {
    let purse = toCopper(10, "gp");
    for (let i = 0; i < 100; i++) purse -= toCopper(1, "cp");
    expect(purse).toBe(900);
    expect(formatCoins(purse)).toBe("9 gp");
  });

  it("shows a purse in coins, largest first", () => {
    expect(formatCoins(1234)).toBe("12 gp 3 sp 4 cp");
    expect(formatCoins(0)).toBe("0 cp");
    expect(formatCoins(-5)).toBe("0 cp");
  });

  it("does not pad a purse with units it does not have", () => {
    expect(formatCoins(300)).toBe("3 gp");
    expect(splitCoins(300)).toEqual({ gp: 3 });
  });

  it("converts electrum and platinum in, but never shows either", () => {
    expect(toCopper(2, "ep")).toBe(100);
    expect(formatCoins(toCopper(2, "ep"))).toBe("1 gp");
    // 10 gp handed over must read back as 10 gp, not as "1 pp".
    expect(formatCoins(toCopper(10, "gp"))).toBe("10 gp");
    expect(formatCoins(toCopper(2, "pp"))).toBe("20 gp");
  });

  it("prices in a single unit", () => {
    expect(formatPrice(1500)).toBe("15 gp");
    expect(formatPrice(50)).toBe("5 sp");
    expect(formatPrice(5)).toBe("5 cp");
    expect(formatPrice(1550)).toBe("15.5 gp");
    expect(formatPrice(0)).toBe("—");
  });

  it("reads a bare number as gold, because that is what people mean", () => {
    expect(parseCoins("15")).toBe(1500);
    expect(parseCoins("15gp")).toBe(1500);
    expect(parseCoins(" 5 sp ")).toBe(50);
    expect(parseCoins("2 PP")).toBe(2000);
    expect(parseCoins("nonsense")).toBe(null);
  });

  it("knows what is affordable", () => {
    expect(canAfford(1500, 1500)).toBe(true);
    expect(canAfford(1499, 1500)).toBe(false);
  });
});

describe("carrying things", () => {
  it("stacks the same item", () => {
    const inv = addItem(addItem([], { itemId: "torch", name: "Torch", qty: 5 }),
      { itemId: "torch", name: "Torch", qty: 3 });
    expect(inv).toEqual([{ itemId: "torch", name: "Torch", qty: 8 }]);
  });

  it("keeps a noted one separate — a +1 sword is not just another sword", () => {
    const inv = addItem(addItem([], { itemId: "longsword", name: "Longsword", qty: 1 }),
      { itemId: "longsword", name: "Longsword", qty: 1, note: "+1" });
    expect(inv).toHaveLength(2);
    expect(countOf(inv, "longsword")).toBe(2);
  });

  it("empties rather than going negative", () => {
    const inv = addItem([], { itemId: "torch", name: "Torch", qty: 2 });
    expect(removeItem(inv, "torch", 5)).toEqual([]);
  });

  it("ignores removing what is not there", () => {
    expect(removeItem([], "torch", 1)).toEqual([]);
  });

  it("drops equipment you no longer carry", () => {
    // Selling your armour has to take the AC with it.
    const cat = indexItems([leather, shield]);
    const inv = addItem([], { itemId: "shield", name: "Shield", qty: 1 });
    expect(equippedItems(inv, ["leather", "shield"], cat)).toEqual([shield]);
  });
});

describe("armour class", () => {
  it("takes the armour's formula when body armour is worn", () => {
    expect(armourClass([leather], 3, 10, 10).value).toBe(14);
  });

  it("caps dexterity in medium armour", () => {
    expect(armourClass([halfPlate], 4, 10, 10).value).toBe(17);
    expect(armourClass([halfPlate], 1, 10, 10).value).toBe(16);
  });

  it("says so, because that is where hand arithmetic disagrees", () => {
    expect(armourClass([halfPlate], 4, 10, 10).from).toContain("capped at +2");
  });

  it("ignores dexterity in heavy armour", () => {
    expect(armourClass([chain], 3, 10, 10).value).toBe(16);
  });

  it("adds a shield", () => {
    expect(armourClass([chain, shield], 3, 10, 10).value).toBe(18);
  });

  it("leaves an unarmoured character's stored AC alone", () => {
    // A monk with unarmoured defence 16. Recomputing would give 10 + dex.
    expect(armourClass([], 3, 16, 10).value).toBe(16);
  });

  it("and adds a shield ON TOP of it rather than recomputing", () => {
    expect(armourClass([shield], 3, 16, 10).value).toBe(18);
  });

  it("flags heavy armour worn without the Strength for it", () => {
    expect(armourClass([chain], 0, 10, 12).speedPenalty).toBe(10);
    expect(armourClass([chain], 0, 10, 13).speedPenalty).toBe(0);
  });

  it("reports stealth disadvantage", () => {
    expect(armourClass([chain], 0, 10, 15).stealthDisadvantage).toBe(true);
    expect(armourClass([leather], 0, 10, 15).stealthDisadvantage).toBe(false);
  });
});

describe("attacks derived from weapons", () => {
  const mods = { str: 3, dex: 1, con: 2, int: 0, wis: 1, cha: 0 };

  it("uses Strength for a plain melee weapon", () => {
    const a = attackFromWeapon(longsword);
    expect(a.ability).toBe("str");
    expect(resolveAttack(a, mods, 3).toHit).toBe(6);
    expect(resolveAttack(a, mods, 3).damageFormula).toBe("1d8+3");
  });

  it("defers to the better ability for finesse", () => {
    const a = attackFromWeapon(rapier);
    expect(a.ability).toBe("finesse");
    expect(resolveAttack(a, mods, 3).usedAbility).toBe("str");
    expect(resolveAttack(a, { ...mods, dex: 5 }, 3).usedAbility).toBe("dex");
  });

  it("uses Dexterity for a bow whatever your arms look like", () => {
    expect(attackFromWeapon(longbow).ability).toBe("dex");
  });

  /* This used to assert the opposite — the versatile die was carried as a
     NOTE and then never rolled, so the sheet said "1d10 in two hands" and
     handed you 1d8. Both grips are attacks now. */
  it("rolls the versatile die when the weapon is held in two hands", () => {
    expect(resolveAttack(attackFromWeapon(longsword), mods, 3).damageFormula)
      .toContain("1d8");
    expect(
      resolveAttack(attackFromWeapon(longsword, undefined, { twoHands: true }), mods, 3)
        .damageFormula,
    ).toContain("1d10");
  });

  it("and names the grip, so two rows are not the same row twice", () => {
    expect(attackFromWeapon(longsword, undefined, { twoHands: true }).name)
      .toBe("Longsword, two-handed");
  });

  /* A shield is a hand. Offering the second grip beside one would be the app
     handing out a swing nobody can take — and it already handed out the
     armour class to go with it. */
  it("offers both grips, but not while a shield is held", () => {
    const free = attacksFromEquipment([longsword]).map((a) => a.name);
    expect(free).toEqual(["Longsword", "Longsword, two-handed"]);
    const shielded = attacksFromEquipment([longsword, shield]).map((a) => a.name);
    expect(shielded).toEqual(["Longsword"]);
  });

  it("says when a weapon needs ammunition, and its range", () => {
    const n = attackFromWeapon(longbow).notes ?? "";
    expect(n).toContain("150/600 ft");
    expect(n).toContain("needs ammunition");
  });

  it("adds no ability modifier to off-hand damage", () => {
    const a = attackFromWeapon(rapier, undefined, { offHand: true });
    expect(resolveAttack(a, mods, 3).damageFormula).toBe("1d8");
    expect(a.notes).toContain("off hand");
  });

  it("adds a magic bonus to both halves", () => {
    const a = attackFromWeapon(longsword, undefined, { bonus: 1 });
    const r = resolveAttack(a, mods, 3);
    expect(r.toHit).toBe(7);
    expect(r.damageFormula).toBe("1d8+4");
  });

  it("only derives from what is actually equipped", () => {
    expect(attacksFromEquipment([longsword, leather, shield]).map((a) => a.name))
      .toEqual(["Longsword"]);
  });

  it("parses a damage die, and falls back rather than throwing", () => {
    expect(parseDamage("2d6")).toEqual({ count: 2, die: 6 });
    expect(parseDamage(undefined)).toEqual({ count: 1, die: 4 });
    expect(parseDamage("nonsense")).toEqual({ count: 1, die: 4 });
  });
});

describe("weapon proficiency", () => {
  it("comes from the class's categories", () => {
    expect(proficientWith(longsword, ["Simple Weapons", "Martial Weapons"])).toBe(true);
    expect(proficientWith(longsword, ["Simple Weapons"])).toBe(false);
    expect(proficientWith(rapier, ["Simple Weapons", "Rapiers"])).toBe(true);
  });

  it("treats an unknown list as proficient, not as none", () => {
    // An imported sheet rarely records these. Assuming unproficient would drop
    // every attack by the proficiency bonus without saying so.
    expect(proficientWith(longsword, undefined)).toBe(true);
    expect(proficientWith(longsword, [])).toBe(true);
  });
});
