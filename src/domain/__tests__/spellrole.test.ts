/*
 * What a spell is for, in one word — read from the file rather than authored.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { primaryRole, rolesOf } from "../spellrole.js";

const spell = (name: string, text: string, rolls: { description: string; dice: string }[] = []) =>
  ({ name, text, rolls });

describe("reading the dice the file already carries", () => {
  it("calls a damage roll damage", () => {
    expect(rolesOf(spell("Fireball", "a bright streak flashes…", [
      { description: "Fire Damage", dice: "8d6" },
    ]))).toEqual(["damage"]);
  });

  it("and a heal a heal", () => {
    expect(rolesOf(spell("Cure Wounds", "A creature you touch regains hit points.", [
      { description: "Heal", dice: "1d8" },
    ]))).toContain("healing");
  });
});

describe("reading the text where there are no dice", () => {
  it("finds control in the condition it imposes", () => {
    expect(rolesOf(spell(
      "Hold Person",
      "The target must succeed on a Wisdom saving throw or be paralyzed for the duration.",
    ))).toEqual(["control"]);
  });

  it("counts taking somebody's turn away even when no condition is named", () => {
    expect(rolesOf(spell("Slow", "Its speed becomes 0 until the spell ends."))).toEqual(["control"]);
  });

  it("and leaves the rest as the useful remainder", () => {
    // Not a gap in the rules — most of the game is this.
    expect(rolesOf(spell("Guidance", "The target can roll a d4 and add it to one ability check.")))
      .toEqual(["utility"]);
  });
});

describe("a spell that is more than one thing", () => {
  it("says so, most consequential first", () => {
    const sg = spell(
      "Spirit Guardians",
      "The creature must make a Wisdom saving throw. Its speed is halved and it is frightened.",
      [{ description: "Radiant Damage", dice: "3d8" }],
    );
    expect(rolesOf(sg)).toEqual(["damage", "control"]);
    // So filtering on Damage finds it, which is the point of the filter.
    expect(primaryRole(sg)).toBe("damage");
  });
});

describe("against the whole shipped spellbook", () => {
  const SHIPPED = "public/content/spell.json";
  const has = fs.existsSync(SHIPPED);
  const load = () => JSON.parse(fs.readFileSync(SHIPPED, "utf8")) as never[];

  it.skipIf(!has)("labels every one of them without throwing", () => {
    const all = load();
    for (const s of all) expect(rolesOf(s).length).toBeGreaterThan(0);
  });

  it.skipIf(!has)("and lands the ones a player would check by hand", () => {
    const byName = new Map(load().map((s) => [(s as { name: string }).name, s]));
    const check = (name: string, want: string) => {
      const s = byName.get(name);
      if (!s) return; // a deployment without this content
      expect(rolesOf(s), name).toContain(want);
    };
    check("Fire Bolt", "damage");
    check("Magic Missile", "damage");
    check("Cure Wounds", "healing");
    check("Healing Word", "healing");
    check("Hold Person", "control");
    check("Web", "control");
    check("Mage Hand", "utility");
    check("Prestidigitation", "utility");
  });

  it.skipIf(!has)("without calling everything utility, which would be useless", () => {
    const all = load();
    const utility = all.filter((s) => rolesOf(s)[0] === "utility").length;
    expect(utility / all.length).toBeLessThan(0.6);
    expect(utility / all.length).toBeGreaterThan(0.1);
  });
});

describe("a curse that names the cure", () => {
  it("is not healing", () => {
    /*
     * Chill Touch: necrotic damage, and the target cannot be healed while it
     * lasts. It was filed under healing — a green label in a list of cures —
     * because the rule read the words and not the "can't" in front of them.
     */
    const chill = rolesOf({
      name: "Chill Touch",
      text:
        "You create a ghostly, skeletal hand. Make a ranged spell attack. On a hit, "
        + "the target takes 1d8 necrotic damage, and it can't regain hit points until "
        + "the start of your next turn.",
      rolls: [{ description: "necrotic damage", dice: "1d8" }],
    });
    expect(chill).toContain("damage");
    expect(chill).not.toContain("healing");
  });

  it("while an actual cure still is", () => {
    // The control: the same reader, on the spell it was written for.
    expect(rolesOf({
      name: "Cure Wounds",
      text: "A creature you touch regains a number of hit points equal to 1d8 + your modifier.",
      rolls: [{ description: "healing", dice: "1d8" }],
    })).toContain("healing");
  });
});
