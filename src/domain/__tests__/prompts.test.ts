/*
 * What to do about it.
 *
 * Every prompt is asserted in both directions, because a rule that only ever
 * answers one way is not a rule — the control is the half that keeps it
 * honest. And the last case here is the one that matters most: the DM's half
 * of this file must not reach a player's screen.
 */
import { describe, expect, it } from "vitest";
import type { Combatant } from "../combat.js";
import type { DomainEvent } from "../events.js";
import { project } from "../project.js";
import { promptsFor } from "../prompts.js";
import { sessions } from "../recap.js";
import { characterOf, kira } from "./fixtures.js";

let n = 0;
const T0 = new Date("2026-08-20T19:00:00Z").getTime();
const ev = (b: object): DomainEvent =>
  ({ id: `e${++n}`, by: "dm", at: T0 + ++n * 1000, ...b }) as DomainEvent;

const NAMES: Record<string, string> = { kira: "Kira", fighter5: "Roy" };
const nameOf = (id: string) => NAMES[id] ?? id;

/** The prompts one seat is shown, given a whole log. */
function shown(log: readonly DomainEvent[], seat: "dm" | string) {
  const state = project(log);
  const session = sessions(log)[sessions(log).length - 1]!;
  return promptsFor(
    seat === "dm" ? { kind: "dm" } : { kind: "player", characterId: seat },
    state,
    log,
    session,
    nameOf,
  );
}
const ids = (log: readonly DomainEvent[], seat: "dm" | string) =>
  shown(log, seat).map((p) => p.id);
const textOf = (log: readonly DomainEvent[], seat: "dm" | string, id: string) =>
  shown(log, seat).find((p) => p.id === id)?.text;

const party = (...extra: DomainEvent[]): DomainEvent[] => [
  ev({ type: "characterAdded", character: kira }),
  ev({ type: "progressionSet", mode: "milestone" }),
  ...extra,
];
const hurt = ev({ type: "damageApplied", who: "kira", amount: 7 });

describe("a player is told what changed on their sheet", () => {
  it("a level the DM granted and nobody took", () => {
    expect(textOf(party(ev({ type: "levelAwarded", who: ["kira"] })), "kira", "level-waiting"))
      .toBe("A level is waiting to be taken.");
  });

  it("counted in words when it is more than one", () => {
    const log = party(
      ev({ type: "levelAwarded", who: ["kira"] }),
      ev({ type: "levelAwarded", who: ["kira"] }),
    );
    expect(textOf(log, "kira", "level-waiting")).toBe("Two levels are waiting to be taken.");
  });

  it("and nothing at all when there is none owed", () => {
    expect(ids(party(), "kira")).not.toContain("level-waiting");
  });

  it("the hit points the session left them on", () => {
    expect(textOf(party(hurt), "kira", "still-hurt")).toBe("You are on 45 of 52 hit points.");
  });

  it("but not at full health", () => {
    expect(ids(party(), "kira")).not.toContain("still-hurt");
  });

  it("and not to somebody who did not get back up — the recap already said so", () => {
    const log = party(
      ev({ type: "damageApplied", who: "kira", amount: 99 }),
      ...(["failure", "failure", "failure"] as const).map((result) =>
        ev({ type: "deathSaveRecorded", who: "kira", result }),
      ),
    );
    expect(project(log).characters["kira"]?.dead).toBe(true);
    expect(ids(log, "kira")).not.toContain("still-hurt");
  });

  it("what is still spent, named", () => {
    const log = party(
      ev({
        type: "spellCast", who: "kira", spellId: "s1", name: "Hunter's Mark",
        atLevel: 1, concentration: true,
      }),
    );
    expect(textOf(log, "kira", "still-spent")).toBe("Still spent: Level 1 slots.");
  });

  it("and says nothing about what brings it back, because they differ", () => {
    // Hit dice come back on a long rest, and only half of them. Pact slots
    // come back on a short one. One sentence covering both is wrong about one.
    const log = party(ev({ type: "hitDiceSpent", who: "kira", rolled: 4, conMod: 2 }));
    expect(textOf(log, "kira", "still-spent")).not.toContain("rest");
  });
});

describe("the half of the sheet nobody opens", () => {
  const roy = characterOf("fighter", 5, { id: "fighter5", name: "Roy" });
  const withRoy = (...extra: DomainEvent[]): DomainEvent[] => [
    ev({ type: "characterAdded", character: roy }),
    ev({ type: "progressionSet", mode: "milestone" }),
    ...extra,
  ];
  const played = ev({ type: "damageApplied", who: "fighter5", amount: 3 });

  it("names the class features that have never been spent", () => {
    expect(textOf(withRoy(played), "fighter5", "never-used"))
      .toBe("Second Wind and Action Surge have never been used.");
  });

  it("drops one the moment it is used", () => {
    const log = withRoy(
      played,
      ev({ type: "resourceSpent", who: "fighter5", resource: "secondWind", amount: 1 }),
    );
    expect(textOf(log, "fighter5", "never-used")).toBe("Action Surge has never been used.");
  });

  it("counts a use from any session, not only this one", () => {
    const log = withRoy(
      ev({ type: "resourceSpent", who: "fighter5", resource: "secondWind", amount: 1 }),
      { ...played, at: T0 + 7 * 24 * 3_600_000 } as DomainEvent,
    );
    expect(textOf(log, "fighter5", "never-used")).toBe("Action Surge has never been used.");
  });

  it("and says nothing to a character who was not at the table", () => {
    // Built on Tuesday, played never. Being told on the day they are made
    // that half their sheet is untouched is the app calling a new player
    // behind before they have sat down.
    expect(ids(withRoy(), "fighter5")).not.toContain("never-used");
  });

  it("hit dice and spell slots are not features", () => {
    // A ranger has no class resources at all, so the only thing this could
    // find is the slots — and it must not.
    expect(ids(party(hurt), "kira")).not.toContain("never-used");
  });

  it("the spells known and never cast", () => {
    const know = (id: string, name: string) =>
      ev({
        type: "spellLearned", who: "kira",
        spell: { id, name, level: 1, school: "evocation", concentration: false, ritual: false, prepared: true },
      });
    const log = party(hurt, know("s1", "Hunter's Mark"), know("s2", "Cure Wounds"));
    expect(textOf(log, "kira", "never-cast")).toBe("You know two spells and have never cast one.");

    const cast = [...log, ev({
      type: "spellCast", who: "kira", spellId: "s1", name: "Hunter's Mark",
      atLevel: 1, concentration: false,
    })];
    expect(textOf(cast, "kira", "never-cast")).toBe("You know two spells; one has never been cast.");
  });

  it("and not over one spell in four, which is nobody's neglected half", () => {
    const know = (id: string) =>
      ev({
        type: "spellLearned", who: "kira",
        spell: { id, name: id, level: 1, school: "evocation", concentration: false, ritual: false, prepared: true },
      });
    const cast = (id: string) =>
      ev({
        type: "spellCast", who: "kira", spellId: id, name: id, atLevel: 1, concentration: false,
      });
    const four = party(hurt, know("s1"), know("s2"), know("s3"), know("s4"));

    expect(ids([...four, cast("s1"), cast("s2"), cast("s3")], "kira")).not.toContain("never-cast");
    expect(textOf([...four, cast("s1"), cast("s2")], "kira", "never-cast"))
      .toBe("You know four spells; two have never been cast.");
  });

  it("and nothing once every one of them has been cast", () => {
    const log = party(
      hurt,
      ev({
        type: "spellLearned", who: "kira",
        spell: { id: "s1", name: "Hunter's Mark", level: 1, school: "evocation", concentration: false, ritual: false, prepared: true },
      }),
      ev({
        type: "spellCast", who: "kira", spellId: "s1", name: "Hunter's Mark",
        atLevel: 1, concentration: false,
      }),
    );
    expect(ids(log, "kira")).not.toContain("never-cast");
  });
});

describe("the DM is told what to prepare", () => {
  const goblin: Combatant = {
    id: "c1", name: "Goblin", initiative: 12,
    source: { kind: "creature", maxHp: 7 },
    controller: { kind: "dm" }, disclosure: "present",
  };
  const encounter = (id: string, xpEach: number) =>
    ev({
      type: "encounterSaved",
      encounter: {
        id, name: `Fight ${id}`,
        entries: [{ statblockId: "goblin", name: "Goblin", count: 1, xpEach, hpMode: "average", disclosure: "present" }],
      },
    });

  it("a fight nobody ended", () => {
    const log = party(ev({ type: "combatStarted", order: [goblin] }));
    expect(textOf(log, "dm", "fight-open")).toBe("A fight is still running — round 1.");
  });

  it("but not once it is over", () => {
    const log = party(
      ev({ type: "combatStarted", order: [goblin] }),
      ev({ type: "combatEnded" }),
    );
    expect(ids(log, "dm")).not.toContain("fight-open");
  });

  it("who is still owed a level, by name", () => {
    const log = party(ev({ type: "levelAwarded", who: ["kira"] }));
    expect(textOf(log, "dm", "levels-waiting")).toBe("Kira has a level waiting.");
  });

  it("fights that earned nothing, in an XP campaign", () => {
    const log = [
      ev({ type: "characterAdded", character: kira }),
      ev({ type: "progressionSet", mode: "xp" }),
      ev({ type: "combatBegan" }),
    ];
    expect(textOf(log, "dm", "no-xp")).toBe("One fight, and no XP awarded.");
  });

  it("and never in a milestone one, where that is how it works", () => {
    expect(ids(party(ev({ type: "combatBegan" })), "dm")).not.toContain("no-xp");
  });

  it("nor when the XP went out", () => {
    const log = [
      ev({ type: "characterAdded", character: kira }),
      ev({ type: "progressionSet", mode: "xp" }),
      ev({ type: "combatBegan" }),
      ev({ type: "xpAwarded", who: ["kira"], amount: 200 }),
    ];
    expect(ids(log, "dm")).not.toContain("no-xp");
  });

  it("loot still sitting in the stash", () => {
    const log = party(ev({
      type: "lootGranted", to: { kind: "party" },
      items: [{ itemId: "rope", name: "Rope", qty: 1 }, { itemId: "torch", name: "Torch", qty: 1 }],
      coins: 30,
    }));
    expect(textOf(log, "dm", "stash-waiting")).toBe("The stash still holds two things and 30 copper.");
  });

  it("the prep the party has just outgrown", () => {
    const log = party(
      encounter("e1", 25),
      ev({ type: "levelGained", who: "kira", classId: "ranger", hpGain: 6 }),
    );
    expect(textOf(log, "dm", "outgrown"))
      .toBe("One of your saved encounters is trivial against the party as it is now.");
  });

  it("but only after a level — otherwise it is a standing complaint", () => {
    expect(ids(party(encounter("e1", 25)), "dm")).not.toContain("outgrown");
  });

  it("and not about a fight that is still dangerous", () => {
    const log = party(
      encounter("e1", 5000),
      ev({ type: "levelGained", who: "kira", classId: "ranger", hpGain: 6 }),
    );
    expect(ids(log, "dm")).not.toContain("outgrown");
  });

  it("an empty drawer", () => {
    expect(textOf(party(hurt), "dm", "nothing-prepared"))
      .toBe("Nothing is prepared: no places, no encounters.");
  });

  it("which stays quiet once there is a place in it", () => {
    const log = party(ev({
      type: "scenePrepared",
      scene: { id: "s1", name: "The cellar", room: { light: "dark", terrain: [] } },
    }));
    expect(ids(log, "dm")).not.toContain("nothing-prepared");
  });
});

describe("the seam", () => {
  it("a player is never shown the DM's half", () => {
    // The empty drawer, the stash and the saved encounters are prep. A player
    // reading their own recap must not learn what the DM has not prepared.
    const log = party(hurt, ev({
      type: "lootGranted", to: { kind: "party" }, items: [], coins: 30,
    }));
    const mine = ids(log, "kira");
    for (const id of ["nothing-prepared", "stash-waiting", "no-xp", "fight-open", "levels-waiting"]) {
      expect(mine).not.toContain(id);
    }
  });

  it("and the DM is not shown a character's own sheet", () => {
    expect(ids(party(hurt), "dm")).not.toContain("still-hurt");
  });
});
