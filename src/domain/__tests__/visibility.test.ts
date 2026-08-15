import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../events.js";
import { isDmOnly, mayRevert, visibleInLog } from "../visibility.js";

const dm = { kind: "dm" } as const;
const kira = { kind: "player", characterId: "kira" } as const;
const ev = (type: string, by = "dm"): DomainEvent =>
  ({ type, by, id: "e1", at: 1 }) as unknown as DomainEvent;

describe("what a player's log may say", () => {
  it("keeps the DM's prep behind the screen", () => {
    // A log two tabs away was announcing the villain they had just written
    // down, which undoes the disclosure ladder from behind.
    for (const t of ["npcSaved", "homebrewSaved", "encounterSaved", "disclosureSet"]) {
      expect(visibleInLog(ev(t), kira), t).toBe(false);
      expect(visibleInLog(ev(t), dm), t).toBe(true);
    }
  });

  it("hides a creature quietly losing hit points", () => {
    // The track can hide a creature's health as carefully as it likes while
    // the log says it took seven.
    expect(visibleInLog(ev("creatureDamaged"), kira)).toBe(false);
  });

  it("keeps what the table watched happen", () => {
    for (const t of [
      "damageApplied", "healingApplied", "attackClaimed", "attackResolved",
      "checkAsked", "xpAwarded", "levelAwarded", "spellCast", "areaDamageApplied",
    ]) {
      expect(visibleInLog(ev(t), kira), t).toBe(true);
    }
  });

  it("shows the DM everything", () => {
    expect(isDmOnly("npcSaved")).toBe(true);
    expect(visibleInLog(ev("npcSaved"), dm)).toBe(true);
  });
});

describe("who may take something back", () => {
  it("lets the DM undo anything", () => {
    expect(mayRevert(ev("damageApplied", "kira"), dm)).toBe(true);
  });

  it("lets a player undo their own", () => {
    expect(mayRevert(ev("damageApplied", "kira"), kira)).toBe(true);
  });

  it("but not somebody else's", () => {
    // Undoing another person's action is a conversation, not a button.
    expect(mayRevert(ev("damageApplied", "dm"), kira)).toBe(false);
    expect(mayRevert(ev("damageApplied", "bel"), kira)).toBe(false);
  });
});
