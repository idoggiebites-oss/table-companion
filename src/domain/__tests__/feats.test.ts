/*
 * Whether the app can tell you qualify for a feat — and what it does when it
 * cannot, which is most of the interesting part.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { blocked, byFeatOrder, meets } from "../feats.js";

const SHIPPED = "public/content/feat.json";
const who = (over: Partial<Parameters<typeof meets>[1]> = {}) => ({
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  spellSlots: [],
  knowsSpells: false,
  race: "Wood elf",
  ...over,
});

describe("a prerequisite the app can check", () => {
  it("reads an ability score", () => {
    expect(meets("Strength 13 or higher", who({
      abilities: { str: 15, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    }))).toEqual({ ok: true });
    const no = meets("Strength 13 or higher", who());
    expect(blocked(no) && no.why).toBe("Needs Strength 13.");
  });

  it("takes either where the rule says either", () => {
    const w = who({ abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 14, cha: 8 } });
    expect(meets("Intelligence or Wisdom 13 or higher", w).ok).toBe(true);
  });

  it("knows whether you can cast at all", () => {
    expect(meets("The ability to cast at least one spell", who()).ok).toBe(false);
    expect(meets("The ability to cast at least one spell", who({ spellSlots: [2] })).ok).toBe(true);
    // A warlock or a subclass caster may know spells without a slot table here.
    expect(meets("The ability to cast at least one spell", who({ knowsSpells: true })).ok).toBe(true);
  });

  it("matches a race loosely, because both sides are free text", () => {
    expect(meets("Elf or Half-Elf", who({ race: "Wood elf" })).ok).toBe(true);
    expect(meets("Elf (Drow)", who({ race: "High Elf" })).ok).toBe(true);
    const no = meets("Halfling", who({ race: "Wood elf" }));
    expect(blocked(no)).toBe(true);
  });
});

describe("a prerequisite it cannot check", () => {
  it("states it and gets out of the way", () => {
    // Being wrong in this direction is worse: the table can always say no,
    // but the app saying no is the end of it.
    const v = meets("Fighting Style Feature", who());
    expect(v.ok).toBe(true);
    expect("unverified" in v && v.unverified).toBe("Fighting Style Feature");
  });

  it("never blocks on a proficiency it does not model", () => {
    expect(meets("Proficiency with heavy armor", who()).ok).toBe(true);
  });

  it("has nothing to say about a feat with no prerequisite", () => {
    expect(meets("", who())).toEqual({ ok: true });
    expect(meets(undefined as never, who())).toEqual({ ok: true });
  });
});

describe("reading order", () => {
  it("puts the game's own feats first", () => {
    const rows = [{ name: "Aberrant Dragonmark (HB)" }, { name: "Alert" }, { name: "Actor" }];
    expect([...rows].sort(byFeatOrder).map((f) => f.name)).toEqual([
      "Actor", "Alert", "Aberrant Dragonmark (HB)",
    ]);
  });

  it.skipIf(!fs.existsSync(SHIPPED))("which is most of why it matters", () => {
    // 756 of 850 are marked. Without the sort the whole visible list is
    // somebody's homebrew, exactly as it was for spells.
    const all = JSON.parse(fs.readFileSync(SHIPPED, "utf8")) as { name: string }[];
    const first = [...all].sort(byFeatOrder).slice(0, 20);
    expect(first.every((f) => !f.name.includes("("))).toBe(true);
    // The ones a player is actually looking for are in reach rather than
    // eight hundred rows down.
    // The picker shows the unmarked set unfiltered, so every feat a new
    // player has heard of has to be in it — a flat cap of sixty ran out at F
    // and left Sentinel unreachable.
    const core = all.filter((f) => !f.name.includes("(")).map((f) => f.name);
    expect(core.length).toBeLessThan(200);
    for (const want of ["Alert", "Great Weapon Master", "Sentinel", "War Caster", "Lucky"]) {
      expect(core, want).toContain(want);
    }
  });
});
