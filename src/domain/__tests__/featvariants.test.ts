/*
 * The compendium ships the choice already made, six times over.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  baseName, effectsOf, featMark, groupVariants, hasChoice, variantAbility,
} from "../featvariants.js";

const SHIPPED = "public/content/feat.json";
const feat = (name: string, text = "") =>
  ({ id: name.toLowerCase(), name, prerequisite: "", text });

describe("an axis is not a source", () => {
  it("reads an ability in parentheses as a choice, not as homebrew", () => {
    // The bug this file exists for: five of the most-taken feats in the game
    // were invisible in the picker because "(Constitution)" looked like "(HB)".
    expect(featMark("Resilient (Constitution)")).toBe(null);
    expect(featMark("Elemental Adept (Fire)")).toBe(null);
    expect(featMark("Observant (Wisdom)")).toBe(null);
  });

  it("and still calls provenance provenance", () => {
    expect(featMark("Aberrant Dragonmark (HB)")).toBe("HB");
    expect(featMark("Gunner (UA)")).toBe("UA");
  });

  it("strips the axis to find what the feat is called", () => {
    expect(baseName("Resilient (Constitution)")).toBe("Resilient");
    expect(baseName("Alert")).toBe("Alert");
    // A provenance marker is part of the name, not an axis to strip.
    expect(baseName("Aberrant Dragonmark (HB)")).toBe("Aberrant Dragonmark (HB)");
  });
});

describe("grouping", () => {
  it("collapses the variants of one feat into one row", () => {
    const rows = groupVariants([
      feat("Resilient (Strength)"), feat("Alert"), feat("Resilient (Constitution)"),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Resilient", "Alert"]);
    expect(rows[0]!.variants).toHaveLength(2);
    expect(hasChoice(rows[0]!)).toBe(true);
    expect(hasChoice(rows[1]!)).toBe(false);
  });
});

describe("what taking one does to the numbers", () => {
  it("applies a half-feat's increase to the ability the variant names", () => {
    expect(effectsOf(feat(
      "Observant (Wisdom)",
      "Increase your Intelligence or Wisdom score by 1, to a maximum of 20.",
    ))).toEqual({ increase: "wis" });
  });

  it("applies a fixed increase where the feat names it itself", () => {
    expect(effectsOf(feat(
      "Actor", "Increase your Charisma score by 1, to a maximum of 20.",
    ))).toEqual({ increase: "cha" });
  });

  it("gives Resilient both halves", () => {
    expect(effectsOf(feat(
      "Resilient (Constitution)",
      "Choose one ability score. Increase the chosen ability score by 1. "
        + "You gain proficiency in saving throws using the chosen ability.",
    ))).toEqual({ increase: "con", saveProficiency: "con" });
  });

  it("and does nothing at all for the eight hundred it cannot read", () => {
    // Half-applying a feat would be worse than being clear it applies none.
    expect(effectsOf(feat("Sentinel", "When you hit a creature with an opportunity attack…")))
      .toEqual({});
  });

  it("does not invent an ability the variant never named", () => {
    expect(variantAbility("Elemental Adept (Fire)")).toBe(null);
    expect(effectsOf(feat("Elemental Adept (Fire)", "Choose one type of damage."))).toEqual({});
  });
});

describe("against the file it was written for", () => {
  const has = fs.existsSync(SHIPPED);
  const load = () => JSON.parse(fs.readFileSync(SHIPPED, "utf8")) as never[];

  it.skipIf(!has)("the classic choice feats are core, not homebrew", () => {
    const all = load() as { name: string }[];
    const core = groupVariants(
      all.filter((f) => featMark(f.name) === null) as never[],
    ).map((g) => g.name);
    for (const want of ["Resilient", "Observant", "Athlete", "Weapon Master", "Elemental Adept"]) {
      expect(core, want).toContain(want);
    }
  });

  it.skipIf(!has)("and grouping shortens the list rather than lengthening it", () => {
    const all = load() as { name: string }[];
    const core = all.filter((f) => featMark(f.name) === null);
    const rows = groupVariants(core as never[]);
    expect(rows.length).toBeLessThan(core.length);
    expect(rows.length).toBeGreaterThan(90);
  });
});

describe("a name carrying two parentheticals", () => {
  it("is homebrew AND a variant, and both have to be read", () => {
    // 248 names do this. Reading only the first said it was core; reading
    // only the last said it was homebrew. Both are true of different halves.
    expect(featMark("Aereni Halflife (Wisdom) (TP)")).toBe("TP");
    expect(baseName("Aereni Halflife (Wisdom) (TP)")).toBe("Aereni Halflife (Wisdom) (TP)");
  });

  it("unwinds a nested axis", () => {
    expect(baseName("Squat Nimbleness (Dexterity + Acrobatics (Proficient))"))
      .toBe("Squat Nimbleness (Dexterity + Acrobatics (Proficient))");
  });

  it("still strips a plain one", () => {
    expect(baseName("Resilient (Constitution)")).toBe("Resilient");
  });
});
