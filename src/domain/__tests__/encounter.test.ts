import { describe, expect, it } from "vitest";
import {
  addEntry, awardableXp, creatureCount, EMPTY_ENCOUNTER, isUsableBudget,
  patchEntry, rawXp, setCount, totals, type Encounter,
} from "../encounter.js";

const goblin = {
  statblockId: "goblin", name: "Goblin", count: 4, xpEach: 50,
  hpMode: "average" as const, disclosure: "vague" as const,
};
const boss = {
  statblockId: "hobgoblin-captain", name: "Hobgoblin Captain", count: 1, xpEach: 700,
  hpMode: "rolled" as const, disclosure: "hidden" as const,
};
const enc: Encounter = { id: "e1", name: "Ambush", entries: [goblin, boss] };

describe("totals", () => {
  it("counts every instance, not every group", () => {
    expect(creatureCount(enc)).toBe(5);
  });

  it("sums XP across instances — the arithmetic nobody enjoys", () => {
    expect(rawXp(enc)).toBe(900);
  });

  it("splits evenly, rounding down", () => {
    expect(totals(enc, 4).perCharacter).toBe(225);
    expect(totals(enc, 7).perCharacter).toBe(128);
  });

  it("never divides by zero when nobody has been imported yet", () => {
    expect(totals(enc, 0).perCharacter).toBe(900);
  });
});

describe("XP is awarded raw", () => {
  it("is the plain sum, with no multiplier applied", () => {
    // Any multiplier estimates danger and is never earned. Awarding an
    // adjusted total roughly doubles a party's progression over a campaign.
    expect(awardableXp(enc)).toBe(rawXp(enc));
  });
});

describe("difficulty is the DM's own table, or nothing", () => {
  it("reports no band when no budget was supplied", () => {
    expect(totals(enc, 4).band).toBeNull();
  });

  it("uses a budget the DM typed in", () => {
    const budget = { easy: 400, medium: 800, hard: 1200, deadly: 1800 };
    expect(totals(enc, 4, budget).band).toBe("medium");
    expect(totals({ ...enc, entries: [goblin] }, 4, budget).band).toBe("trivial");
    expect(totals({ ...enc, entries: [{ ...boss, count: 3 }] }, 4, budget).band).toBe("deadly");
  });

  it("refuses a budget that is not ascending or not positive", () => {
    expect(isUsableBudget({ easy: 400, medium: 800, hard: 1200, deadly: 1800 })).toBe(true);
    expect(isUsableBudget({ easy: 900, medium: 800, hard: 1200, deadly: 1800 })).toBe(false);
    expect(isUsableBudget({ easy: 0, medium: 800, hard: 1200, deadly: 1800 })).toBe(false);
    expect(isUsableBudget({ easy: 400, medium: 800, hard: 1200 })).toBe(false);
  });
});

describe("building", () => {
  it("adds a group", () => {
    expect(addEntry(EMPTY_ENCOUNTER, goblin).entries).toHaveLength(1);
  });

  it("merges a repeat rather than listing it twice", () => {
    const e = addEntry(addEntry(EMPTY_ENCOUNTER, goblin), { ...goblin, count: 2 });
    expect(e.entries).toHaveLength(1);
    expect(e.entries[0]!.count).toBe(6);
  });

  it("drops a group taken to zero", () => {
    expect(setCount(enc, "goblin", 0).entries.map((x) => x.statblockId)).toEqual([
      "hobgoblin-captain",
    ]);
  });

  it("sets disclosure and hit point mode per group", () => {
    const e = patchEntry(enc, "goblin", { disclosure: "hidden", hpMode: "rolled" });
    expect(e.entries[0]).toMatchObject({ disclosure: "hidden", hpMode: "rolled" });
    // and leaves the other group alone
    expect(e.entries[1]).toMatchObject({ disclosure: "hidden", hpMode: "rolled" });
  });
});
