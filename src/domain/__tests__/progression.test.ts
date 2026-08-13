import { describe, expect, it } from "vitest";
import { levelForXp, MAX_LEVEL, xpForLevel, xpToNextLevel } from "../progression.js";

describe("the advancement table", () => {
  it("starts at zero and tops out at 355,000", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(20)).toBe(355_000);
    expect(MAX_LEVEL).toBe(20);
  });

  it("rises at every step", () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(xpForLevel(l)!, `level ${l}`).toBeGreaterThan(xpForLevel(l - 1)!);
    }
  });

  it("has no level beyond the table", () => {
    expect(xpForLevel(21)).toBeNull();
    expect(xpForLevel(0)).toBeNull();
  });
});

describe("what a total earns", () => {
  it("maps the boundaries exactly", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(47_999)).toBe(8);
    expect(levelForXp(48_000)).toBe(9);
  });

  it("stops at the top rather than running off the end", () => {
    expect(levelForXp(355_000)).toBe(20);
    expect(levelForXp(9_999_999)).toBe(20);
  });
});

describe("distance to the next level", () => {
  it("counts down", () => {
    expect(xpToNextLevel(47_800)).toEqual({ next: 9, needed: 200 });
  });
  it("is null at the cap", () => {
    expect(xpToNextLevel(400_000)).toBeNull();
  });
});
