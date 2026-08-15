import { describe, expect, it } from "vitest";
import { consolidateRaces, splitName, STANDARD, type RaceLike } from "../races.js";

const flat = (name: string, bonuses: Record<string, number>): RaceLike => ({
  id: name.toLowerCase().replace(/\W+/g, "-"), name, size: "M", speed: 30, abilityBonuses: bonuses,
});

describe("reading the compendium's naming", () => {
  it("splits base from variant", () => {
    expect(splitName("Halfling, Lightfoot")).toEqual({ base: "Halfling", variant: "Lightfoot" });
    expect(splitName("Dragonborn")).toEqual({ base: "Dragonborn", variant: null });
  });

  it("keeps a variant that contains punctuation of its own", () => {
    expect(splitName("Elf, Drow / Dark").variant).toBe("Drow / Dark");
  });
});

describe("folding variants into one race", () => {
  const halflings = [
    flat("Halfling, Lightfoot", { dex: 2, cha: 1 }),
    flat("Halfling, Stout", { dex: 2, con: 1 }),
  ];

  it("stops the same person appearing three times", () => {
    const out = consolidateRaces([], halflings);
    expect(out.map((r) => r.name)).toEqual(["Halfling"]);
    expect(out[0]!.subraces?.map((s) => s.name)).toEqual(["Lightfoot", "Stout"]);
  });

  it("gives the base what every variant agrees on", () => {
    // +2 dex is every halfling; the third point is what differs.
    expect(consolidateRaces([], halflings)[0]!.abilityBonuses).toEqual({ dex: 2 });
  });

  it("and each subrace only the remainder", () => {
    const subs = consolidateRaces([], halflings)[0]!.subraces!;
    expect(subs.find((s) => s.name === "Lightfoot")!.abilityBonuses).toEqual({ cha: 1 });
    expect(subs.find((s) => s.name === "Stout")!.abilityBonuses).toEqual({ con: 1 });
  });

  it("so base plus subrace still equals what the file said", () => {
    const race = consolidateRaces([], halflings)[0]!;
    for (const sub of race.subraces!) {
      const total: Record<string, number> = { ...race.abilityBonuses };
      for (const [k, v] of Object.entries(sub.abilityBonuses)) total[k] = (total[k] ?? 0) + v;
      const original = halflings.find((h) => h.name.endsWith(sub.name))!;
      expect(total).toEqual(original.abilityBonuses);
    }
  });

  it("leaves a race with no variants alone", () => {
    const out = consolidateRaces([], [flat("Dragonborn", { str: 2, cha: 1 })]);
    expect(out[0]!.subraces).toEqual([]);
    expect(out[0]!.abilityBonuses).toEqual({ str: 2, cha: 1 });
  });

  it("keeps the plain version reachable when one exists", () => {
    // "Human" and "Human, Variant" are both real entries.
    const out = consolidateRaces([], [
      flat("Human", { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }),
      flat("Human, Variant", { str: 1, dex: 1 }),
    ]);
    const subs = out[0]!.subraces!;
    expect(subs[0]!.name).toBe(STANDARD);
    expect(subs[0]!.abilityBonuses).toEqual({});
    expect(subs.map((s) => s.name)).toContain("Variant");
  });

  it("falls back to no shared base when the variants agree on nothing", () => {
    const out = consolidateRaces([], [
      flat("Genasi, Air", { con: 2, dex: 1 }),
      flat("Genasi, Earth", { con: 2, str: 1 }),
      flat("Genasi, Fire", { con: 2, int: 1 }),
    ]);
    expect(out[0]!.abilityBonuses).toEqual({ con: 2 });
    expect(out[0]!.subraces).toHaveLength(3);
  });
});

describe("merging with data already shaped that way", () => {
  const srdHalfling: RaceLike = {
    id: "halfling", name: "Halfling", size: "Small", speed: 25,
    abilityBonuses: { dex: 2 },
    traits: [{ name: "Lucky", desc: "Reroll a 1." }],
    subraces: [
      { id: "lightfoot", name: "Lightfoot Halfling", abilityBonuses: { cha: 1 } },
      { id: "stout", name: "Stout Halfling", abilityBonuses: { con: 1 } },
    ],
  };

  it("does not list a subrace twice under different spellings", () => {
    const out = consolidateRaces([srdHalfling], [
      flat("Halfling, Lightfoot", { dex: 2, cha: 1 }),
      flat("Halfling, Stout", { dex: 2, con: 1 }),
      flat("Halfling, Ghostwise", { dex: 2, wis: 1 }),
    ]);
    expect(out).toHaveLength(1);
    const names = out[0]!.subraces!.map((s) => s.name);
    expect(names.filter((n) => /lightfoot/i.test(n))).toHaveLength(1);
    expect(names).toContain("Ghostwise");
  });

  it("keeps the shipped entry's traits, which the flat one lacks", () => {
    const out = consolidateRaces([srdHalfling], [flat("Halfling, Ghostwise", { dex: 2, wis: 1 })]);
    expect(out[0]!.traits?.[0]?.name).toBe("Lucky");
    expect(out[0]!.speed).toBe(25);
  });

  it("passes through a shipped race the compendium never mentions", () => {
    const out = consolidateRaces([srdHalfling], [flat("Dragonborn", { str: 2 })]);
    expect(out.map((r) => r.name).sort()).toEqual(["Dragonborn", "Halfling"]);
  });
});

describe("what the subrace dropdown reads like", () => {
  it("drops the race's own name from inside its own list", () => {
    // "Lightfoot Halfling" beside "Stout" reads as two kinds of thing, and
    // the dropdown is already headed by the race.
    const out = consolidateRaces(
      [{
        id: "halfling", name: "Halfling", size: "Small", speed: 25,
        abilityBonuses: { dex: 2 },
        subraces: [{ id: "lightfoot-halfling", name: "Lightfoot Halfling", abilityBonuses: { cha: 1 } }],
      }],
      [flat("Halfling, Stout", { dex: 2, con: 1 })],
    );
    expect(out[0]!.subraces?.map((s) => s.name)).toEqual(["Lightfoot", "Stout"]);
  });

  it("still dedupes across the two spellings", () => {
    const out = consolidateRaces(
      [{
        id: "halfling", name: "Halfling", size: "Small", speed: 25,
        abilityBonuses: { dex: 2 },
        subraces: [{ id: "lightfoot-halfling", name: "Lightfoot Halfling", abilityBonuses: { cha: 1 } }],
      }],
      [flat("Halfling, Lightfoot", { dex: 2, cha: 1 })],
    );
    expect(out[0]!.subraces).toHaveLength(1);
  });

  it("leaves a name alone when stripping would empty it", () => {
    const out = consolidateRaces(
      [{
        id: "elf", name: "Elf", size: "M", speed: 30, abilityBonuses: { dex: 2 },
        subraces: [{ id: "elf-x", name: "Elf", abilityBonuses: {} }],
      }],
      [flat("Elf, Wood", { dex: 2, wis: 1 })],
    );
    expect(out[0]!.subraces?.[0]?.name).toBe("Elf");
  });
});
