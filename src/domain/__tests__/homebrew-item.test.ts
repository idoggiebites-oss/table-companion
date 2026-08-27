import { describe, expect, it } from "vitest";
import { toDraft, toItem, type HomebrewItemDraft } from "../homebrew-item.js";
import { attackFromWeapon, attacksFromEquipment, armourClass } from "../equipment.js";
import { isArmour, isShield, isWeapon } from "../items.js";

const sword = (over: Partial<HomebrewItemDraft> = {}): HomebrewItemDraft => ({
  name: "Ashbrand", kind: "weapon", cost: 5000,
  damage: "1d8", damageType: "fire", martial: true, ...over,
});

/* The whole point is that nothing downstream knows. So the tests are the
   downstream functions, not the builder. */
describe("a thing the DM made up is a thing", () => {
  it("is a weapon to the rules, not just to the form", () => {
    expect(isWeapon(toItem(sword()))).toBe(true);
  });

  it("swings with the damage that was written up", () => {
    const a = attackFromWeapon(toItem(sword()));
    expect(a.damage.die).toBe(8);
    expect(a.damageType).toBe("fire");
  });

  /* Finesse picks the ability, which is a rule reading a property off a
     record the DM typed — the thing that could not happen before. */
  it("and finesse decides which ability swings it", () => {
    expect(attackFromWeapon(toItem(sword({ properties: ["finesse"] }))).ability)
      .toBe("finesse");
  });

  it("versatile brings both grips, and only when asked for", () => {
    const both = attacksFromEquipment([
      toItem(sword({ properties: ["versatile"], twoHanded: "1d10" })),
    ]);
    expect(both).toHaveLength(2);
    expect(both[1]?.damage.die).toBe(10);
    // A two-handed die without the property would put a grip on the sheet
    // that the item does not have.
    expect(attacksFromEquipment([toItem(sword({ twoHanded: "1d10" }))])).toHaveLength(1);
  });

  it("armour is armour, and medium armour caps dexterity", () => {
    const mail = toItem({
      name: "Cinder Mail", kind: "armour", cost: 0,
      armourWeight: "Medium", baseAc: 15,
    });
    expect(isArmour(mail)).toBe(true);
    // dex +4 capped to +2 by the category, not by the form. The stored AC
    // and Strength are what a character brings; neither should matter here.
    expect(armourClass([mail], 4, 10, 10).value).toBe(17);
  });

  it("heavy armour ignores dexterity entirely", () => {
    const plate = toItem({ name: "Slag Plate", kind: "armour", cost: 0, armourWeight: "Heavy", baseAc: 18 });
    expect(armourClass([plate], 4, 10, 10).value).toBe(18);
  });

  it("a shield is a shield, which is what makes it go in a hand", () => {
    expect(isShield(toItem({ name: "Bulwark", kind: "shield", cost: 0 }))).toBe(true);
  });
});

describe("provenance and editing", () => {
  it("marks the name once, however many times it is saved", () => {
    const once = toItem(sword());
    expect(once.name).toBe("Ashbrand (HB)");
    // Re-saving an edited item must not produce "Ashbrand (HB) (HB)".
    expect(toItem({ ...sword(), name: once.name }).name).toBe("Ashbrand (HB)");
  });

  it("hands the name back without the bookkeeping, so it can be edited", () => {
    expect(toDraft(toItem(sword())).name).toBe("Ashbrand");
  });

  it("round-trips the fields that carry rules", () => {
    const original = sword({ properties: ["versatile", "finesse"], twoHanded: "1d10" });
    const back = toDraft(toItem(original));
    expect(back.kind).toBe("weapon");
    expect(back.damage).toBe("1d8");
    expect(back.twoHanded).toBe("1d10");
    expect(back.properties).toEqual(["versatile", "finesse"]);
    expect(back.martial).toBe(true);
  });

  it("keeps the same id, so editing replaces rather than duplicates", () => {
    const first = toItem(sword());
    expect(toItem(toDraft(first)).id).toBe(first.id);
  });
});
