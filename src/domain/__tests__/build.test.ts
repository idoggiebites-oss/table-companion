import { describe, expect, it } from "vitest";
import { proficiencyBonus } from "../abilities.js";
import { effectiveBuild } from "../build.js";
import { characterOf, kira, kiraBase } from "./fixtures.js";

describe("proficiency bonus", () => {
  it("steps every four levels", () => {
    expect([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(proficiencyBonus)).toEqual([
      2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    ]);
  });

  it("rejects levels off the table", () => {
    expect(() => proficiencyBonus(0)).toThrow();
    expect(() => proficiencyBonus(21)).toThrow();
  });
});

describe("effective build", () => {
  const b = effectiveBuild(kira);

  it("derives modifiers from scores", () => {
    expect(b.abilityMods).toEqual({ str: 0, dex: 4, con: 2, int: 0, wis: 3, cha: 1 });
  });

  it("adds proficiency to proficient saves only", () => {
    expect(b.saveMods.dex).toBe(7); // +4 and proficient
    expect(b.saveMods.wis).toBe(3); // +3, not proficient
  });

  it("adds proficiency to proficient skills only", () => {
    expect(b.skillMods.stealth).toBe(7);
    expect(b.skillMods.perception).toBe(6);
    expect(b.skillMods.acrobatics).toBe(4); // dex, not proficient
    expect(b.passivePerception).toBe(16);
  });

  it("gives every character hit dice equal to total level", () => {
    const hd = b.resources.find((r) => r.id === "hitDice")!;
    expect(hd.max).toBe(8);
    expect(hd.die).toBe(10);
    expect(hd.recharge).toEqual({ on: "long", amount: "half" });
  });

  it("turns spell slots into resources that recharge on a long rest", () => {
    expect(b.resources.find((r) => r.id === "slot1")?.max).toBe(4);
    expect(b.resources.find((r) => r.id === "slot2")?.max).toBe(3);
    expect(b.resources.find((r) => r.id === "slot1")?.recharge.on).toBe("long");
  });

  it("gives a ranger no class pools, which is not a modelling failure", () => {
    const classPools = b.resources.filter(
      (r) => r.id !== "hitDice" && !r.id.startsWith("slot"),
    );
    expect(classPools).toHaveLength(0);
  });
});

describe("warlock pact slots", () => {
  it("recharge on a short rest, unlike every other slot", () => {
    const warlock = characterOf("warlock", 5, {
      pactSlots: { count: 2, level: 3 },
      spellSlots: [],
    });
    const pact = effectiveBuild(warlock).resources.find((r) => r.id === "pactSlots")!;
    expect(pact.max).toBe(2);
    expect(pact.recharge.on).toBe("short");
  });
});

describe("build = base + deltas", () => {
  it("replays a level-up without editing the base", () => {
    const levelled = {
      base: kiraBase,
      deltas: [
        {
          kind: "levelGained" as const,
          classId: "ranger" as const,
          toTotalLevel: 9,
          hpGain: 8,
          at: "2026-08-11",
        },
      ],
    };
    const b = effectiveBuild(levelled);

    expect(b.totalLevel).toBe(9);
    expect(b.maxHp).toBe(60);
    // The cascade: +3 → +4 rewrites every proficient number on the sheet.
    expect(b.proficiencyBonus).toBe(4);
    expect(b.skillMods.stealth).toBe(8);
    expect(b.saveMods.dex).toBe(8);
    expect(b.resources.find((r) => r.id === "hitDice")!.max).toBe(9);

    // The base is untouched, which is what makes re-import safe.
    expect(kiraBase.maxHp).toBe(52);
    expect(kiraBase.classes[0]!.level).toBe(8);
  });

  it("is identical to the base when there are no deltas", () => {
    expect(effectiveBuild(kira).maxHp).toBe(52);
    expect(effectiveBuild(kira).proficiencyBonus).toBe(3);
  });
});
