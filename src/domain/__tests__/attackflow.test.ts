import { describe, expect, it } from "vitest";
import { claimsFrom, describeVerdict, sortClaims, verdictFor, type AttackClaim } from "../attackflow.js";

const claim = (o: Partial<AttackClaim> & { id: string }): AttackClaim => ({
  who: "kira", whoName: "Kira", targetId: "cr-1", targetName: "Goblin",
  weapon: "Longsword", toHit: 18, damage: 7, damageType: "slashing", at: 1, ...o,
});

describe("what the DM's screen suggests", () => {
  it("says whether the roll beat the armour class", () => {
    expect(verdictFor(18, 15)).toBe("hits");
    expect(verdictFor(14, 15)).toBe("misses");
  });

  it("counts equalling it as a hit, which is the rule people misremember", () => {
    expect(verdictFor(15, 15)).toBe("hits");
  });

  it("declines to guess when no armour class is known", () => {
    // A creature typed in mid-fight has none, and guessing would be worse
    // than asking.
    expect(verdictFor(18, undefined)).toBe("unknown");
    expect(describeVerdict(18, undefined)).toBe("18 to hit");
  });

  it("shows its working, so the DM can overrule it", () => {
    expect(describeVerdict(18, 15)).toBe("18 against 15 — hits");
  });
});

describe("the queue", () => {
  it("is answered oldest first", () => {
    const out = sortClaims([claim({ id: "b", at: 2 }), claim({ id: "a", at: 1 })]);
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("can be read per player", () => {
    const all = [claim({ id: "a" }), claim({ id: "b", who: "bel" })];
    expect(claimsFrom(all, "kira").map((c) => c.id)).toEqual(["a"]);
  });
});
