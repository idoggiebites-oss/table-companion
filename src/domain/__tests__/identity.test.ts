/*
 * Who they are, as opposed to what they can do.
 */
import { describe, expect, it } from "vitest";
import { assemble } from "../creation.js";
import { effectiveBuild } from "../build.js";

const base = {
  name: "Kaelen", classSkills: [],
  baseScores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  race: { id: "human", name: "Human", speed: 30, abilityBonuses: {} },
  klass: { id: "fighter", name: "Fighter", hitDie: 10, saves: ["str", "con"], spellSlots: [] },
  background: { name: "Noble", skills: [], tools: [] },
} as never;

describe("a character who is somebody", () => {
  it("carries what the player wrote", () => {
    const b = assemble({
      ...(base as object),
      identity: { alignment: "Chaotic good", bonds: "I protect my sister, Liora." },
    } as never);
    expect(b.identity?.bonds).toBe("I protect my sister, Liora.");
    expect(effectiveBuild({ base: b, deltas: [] }).identity.alignment).toBe("Chaotic good");
  });

  it("stores nothing when nothing was written", () => {
    // A blank one is a character too — it should not put an empty object on
    // every build in the log.
    expect(assemble(base).identity).toBeUndefined();
    expect(assemble({ ...(base as object), identity: { bonds: "   " } } as never).identity)
      .toBeUndefined();
  });

  it("reads as empty rather than absent on the sheet", () => {
    expect(effectiveBuild({ base: assemble(base), deltas: [] }).identity).toEqual({});
  });

  it("changes nothing mechanical", () => {
    const plain = effectiveBuild({ base: assemble(base), deltas: [] });
    const written = effectiveBuild({
      base: assemble({ ...(base as object), identity: { flaws: "I never back down." } } as never),
      deltas: [],
    });
    expect(written.maxHp).toBe(plain.maxHp);
    expect(written.armourClass).toBe(plain.armourClass);
    expect(written.skillMods).toEqual(plain.skillMods);
  });
});
