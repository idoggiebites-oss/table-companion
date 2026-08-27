/*
 * Three moments, and nothing else.
 */
import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../events.js";
import { project } from "../project.js";
import { nudgesFor } from "../nudge.js";

let n = 0;
const ev = (b: object): DomainEvent =>
  ({ id: `e${++n}`, by: "dm", at: Date.now(), ...b }) as DomainEvent;

const pc = (id: string, name: string, initiative: number) => ({
  id: `pc-${id}`, name, initiative,
  source: { kind: "character", characterId: id },
  controller: { kind: "player", characterId: id },
  disclosure: "exact", surprised: false, speed: 30,
});
const monster = (id: string, name: string, initiative: number) => ({
  id, name, initiative,
  source: { kind: "creature", maxHp: 20 },
  controller: { kind: "dm" },
  disclosure: "vague", surprised: false, speed: 30,
});

const NAMES: Record<string, string> = { b1: "Kira", b2: "Bel" };
const nameOf = (id: string) => NAMES[id] ?? id;

const staged = ev({
  type: "combatStaged",
  combatants: [pc("b1", "Kira", 18), monster("g1", "Ghoul", 12), pc("b2", "Bel", 4)],
});
const began = [
  staged,
  ev({ type: "initiativeRolled", combatantId: "pc-b1", value: 18 }),
  ev({ type: "initiativeRolled", combatantId: "g1", value: 12 }),
  ev({ type: "initiativeRolled", combatantId: "pc-b2", value: 4 }),
  ev({ type: "combatBegan" }),
];

describe("initiative", () => {
  it("asks everyone who is in the fight", () => {
    const out = nudgesFor([staged], project([staged]), nameOf);
    expect(out.map((x) => x.to).sort()).toEqual(["b1", "b2"]);
    expect(out[0]?.title).toBe("Roll for initiative");
  });

  it("and nobody who is not — the ghoul has no phone", () => {
    const out = nudgesFor([staged], project([staged]), nameOf);
    expect(out).toHaveLength(2);
  });
});

describe("your turn", () => {
  it("buzzes whoever is up when the fight begins", () => {
    const out = nudgesFor([began[4]!], project(began), nameOf);
    expect(out).toEqual([{ to: "b1", title: "Your turn", body: "Kira is up · round 1." }]);
  });

  it("and whoever is up after it moves on", () => {
    const log = [...began, ev({ type: "turnAdvanced", from: 0 })];
    // Turn 2 is the ghoul: nobody is waiting on a phone.
    expect(nudgesFor([log[log.length - 1]!], project(log), nameOf)).toEqual([]);
    const further = [...log, ev({ type: "turnAdvanced", from: 1 })];
    expect(nudgesFor([further[further.length - 1]!], project(further), nameOf))
      .toEqual([{ to: "b2", title: "Your turn", body: "Bel is up · round 1." }]);
  });
});

describe("a roll the DM asked for", () => {
  it("goes to the people named, and says what for", () => {
    const asked = ev({
      type: "checkAsked", checkId: "c1", who: ["b1", "b2"],
      what: "perception", kind: "skill", dc: 14,
    });
    expect(nudgesFor([asked], project([asked]), nameOf)).toEqual([
      { to: "b1", title: "The DM wants a roll", body: "perception · DC 14." },
      { to: "b2", title: "The DM wants a roll", body: "perception · DC 14." },
    ]);
  });

  it("naming a save as a save, because it is owed rather than offered", () => {
    const asked = ev({
      type: "checkAsked", checkId: "c2", who: ["b1"], what: "dex", kind: "save",
    });
    expect(nudgesFor([asked], project([asked]), nameOf)[0]?.title).toBe("A save is owed");
  });

  it("and says nothing about a DC that was not given", () => {
    // "Roll perception" with no number is the DM keeping the number, which is
    // a deliberate move — the nudge must not invent one.
    const asked = ev({
      type: "checkAsked", checkId: "c3", who: ["b1"], what: "stealth", kind: "skill",
    });
    expect(nudgesFor([asked], project([asked]), nameOf)[0]?.body).toBe("stealth.");
  });
});

describe("what does not buzz", () => {
  it("damage, healing, a fight ending, somebody else's turn", () => {
    const quiet = [
      ev({ type: "damageApplied", who: "b1", amount: 12 }),
      ev({ type: "healingApplied", who: "b1", amount: 5 }),
      ev({ type: "combatEnded" }),
      ev({ type: "sceneSet", scene: { light: "dark", terrain: [] } }),
    ];
    expect(nudgesFor(quiet, project([...began, ...quiet]), nameOf)).toEqual([]);
  });

  it("and nobody is told twice in one batch", () => {
    // Called for initiative and asked for a roll in the same breath is one
    // buzz. Two is how people learn to swipe them away without reading.
    const asked = ev({
      type: "checkAsked", checkId: "c9", who: ["b1"], what: "perception", kind: "skill",
    });
    const out = nudgesFor([staged, asked], project([staged, asked]), nameOf);
    expect(out.filter((x) => x.to === "b1")).toHaveLength(1);
  });

  it("reads the state AFTER, so a batch says who is up at the end of it", () => {
    /*
     * A batch that begins the fight and advances past the first turn buzzes
     * whoever it lands on — not whoever it passed through. The alternative is
     * a phone that goes off for a turn that is already over.
     */
    const log = [...began, ev({ type: "turnAdvanced", from: 0 })];
    const out = nudgesFor(log.slice(4), project(log), nameOf);
    expect(out).toEqual([]);
  });
});
