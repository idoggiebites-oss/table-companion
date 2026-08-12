import { describe, expect, it } from "vitest";
import { abilityFor, damageFormula, describeAttack, resolveAttack, type Attack } from "../attack.js";
import { effectiveBuild } from "../build.js";
import { kira, kiraBase } from "./fixtures.js";

const mods = { str: 0, dex: 4, con: 2, int: 0, wis: 3, cha: 1 };

const longbow: Attack = {
  name: "Longbow",
  ability: "dex",
  proficient: true,
  bonus: 0,
  damage: { count: 1, die: 8, addAbility: true },
  damageType: "piercing",
};

describe("the bonus is derived, never stored", () => {
  it("is ability plus proficiency when proficient", () => {
    expect(resolveAttack(longbow, mods, 3).toHit).toBe(7);
  });

  it("drops proficiency when you are not proficient", () => {
    expect(resolveAttack({ ...longbow, proficient: false }, mods, 3).toHit).toBe(4);
  });

  it("adds a magic bonus to both the attack and the damage", () => {
    const magic = resolveAttack({ ...longbow, bonus: 1 }, mods, 3);
    expect(magic.toHit).toBe(8);
    expect(magic.damageFormula).toBe("1d8+5");
  });

  it("moves with proficiency when the character levels", () => {
    const at8 = effectiveBuild(kira);
    const at9 = effectiveBuild({
      base: kiraBase,
      deltas: [{ kind: "levelGained", classId: "ranger", toTotalLevel: 9, hpGain: 8, at: "x" }],
    });
    expect(at8.attacks[0]!.toHit).toBe(7);
    // +3 -> +4 rewrites every attack without anything being re-entered.
    expect(at9.attacks[0]!.toHit).toBe(8);
  });
});

describe("finesse takes the better of the two", () => {
  const dagger: Attack = { ...longbow, name: "Dagger", ability: "finesse" };

  it("uses dexterity when it is higher", () => {
    expect(abilityFor(dagger, mods)).toBe("dex");
    expect(resolveAttack(dagger, mods, 3).toHit).toBe(7);
  });

  it("uses strength when it is higher", () => {
    const strong = { ...mods, str: 5, dex: 1 };
    expect(abilityFor(dagger, strong)).toBe("str");
    expect(resolveAttack(dagger, strong, 3).toHit).toBe(8);
  });

  it("breaks a tie towards dexterity, which never changes the number", () => {
    const tied = { ...mods, str: 3, dex: 3 };
    expect(abilityFor(dagger, tied)).toBe("dex");
    expect(resolveAttack(dagger, tied, 3).toHit).toBe(6);
  });
});

describe("off-hand damage adds no ability modifier", () => {
  it("leaves the die alone", () => {
    const offhand: Attack = {
      ...longbow,
      name: "Shortsword, off-hand",
      damage: { count: 1, die: 6, addAbility: false },
    };
    const r = resolveAttack(offhand, mods, 3);
    expect(r.damageFormula).toBe("1d6");
    // The attack roll still gets the modifier — only the damage does not.
    expect(r.toHit).toBe(7);
  });
});

describe("the damage line", () => {
  it("omits a flat zero rather than printing +0", () => {
    expect(damageFormula(2, 6, 0)).toBe("2d6");
  });

  it("shows a negative flat modifier", () => {
    expect(damageFormula(1, 4, -1)).toBe("1d4−1");
  });

  it("reads the way a sheet prints it", () => {
    const r = resolveAttack({ ...longbow, notes: "150/600 ft" }, mods, 3);
    expect(describeAttack(r)).toBe("1d8+4 piercing · 150/600 ft");
  });

  it("drops the separator when there are no notes", () => {
    expect(describeAttack(resolveAttack(longbow, mods, 3))).toBe("1d8+4 piercing");
  });
});

describe("the sample character", () => {
  const b = effectiveBuild(kira);

  it("resolves all three attacks", () => {
    expect(b.attacks.map((a) => `${a.name} ${a.toHit} ${a.damageFormula}`)).toEqual([
      "Longbow 7 1d8+4",
      "Shortsword 7 1d6+4",
      "Shortsword, off-hand 7 1d6",
    ]);
  });

  it("settles finesse to dexterity for a Ranger with 18 dex", () => {
    expect(b.attacks[1]!.usedAbility).toBe("dex");
  });
});
