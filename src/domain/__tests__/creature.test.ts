/*
 * 416 type strings for fourteen kinds of thing.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { crBand, creatureKind } from "../creature.js";

describe("what kind of thing it is", () => {
  it("drops the subtype the file keeps inside the type", () => {
    expect(creatureKind("humanoid (any race)")).toBe("humanoid");
    expect(creatureKind("fiend (demon)")).toBe("fiend");
    expect(creatureKind("Undead")).toBe("undead");
  });

  it("and refuses to guess at one it does not know", () => {
    // A homebrew "swarm of tiny horrors" is not a beast just because the app
    // has nowhere else to put it.
    expect(creatureKind("swarm of tiny horrors")).toBe(null);
    expect(creatureKind(undefined)).toBe(null);
    expect(creatureKind("")).toBe(null);
  });
});

describe("how hard it is", () => {
  it("bands it the way a DM thinks about it", () => {
    // "CR 3.5" is not something anybody reasons with.
    expect(crBand(0)).toBe("fodder");
    expect(crBand(0.25)).toBe("fodder");
    expect(crBand(2)).toBe("fodder");
    expect(crBand(3)).toBe("standard");
    expect(crBand(8)).toBe("standard");
    expect(crBand(9)).toBe("deadly");
    expect(crBand(16)).toBe("deadly");
    expect(crBand(17)).toBe("legendary");
    expect(crBand(30)).toBe("legendary");
  });
});

describe("against the shipped bestiary", () => {
  const SHIPPED = "public/content/monster.json";
  const has = fs.existsSync(SHIPPED);
  const load = () =>
    JSON.parse(fs.readFileSync(SHIPPED, "utf8")) as { type?: string; cr: number }[];

  it.skipIf(!has)("puts almost all of them in one of the fourteen", () => {
    const all = load();
    const placed = all.filter((m) => creatureKind(m.type) !== null).length;
    expect(placed / all.length).toBeGreaterThan(0.9);
  });

  it.skipIf(!has)("turning 416 piles into something scannable", () => {
    const all = load();
    const raw = new Set(all.map((m) => (m.type ?? "").toLowerCase()));
    const kinds = new Set(all.map((m) => creatureKind(m.type)).filter(Boolean));
    expect(raw.size).toBeGreaterThan(100);
    expect(kinds.size).toBeLessThanOrEqual(14);
  });
});
