/**
 * What to do about it.
 *
 * The recap says what happened, and it stops there. The two questions arrive
 * together, though: a table that has just read "you levelled and came away
 * with three things" is exactly the table about to ask what that changed on
 * their sheet — and the DM reading the same night back is asking the same
 * question from the other side of the screen, where it is called "what do I
 * prepare for next time".
 *
 * So: a short list of prompts, each one a fact and a screen that answers it.
 * Three rules decide what belongs here.
 *
 * It has to be TRUE from the log rather than inferred from what a session
 * usually means. "You are on 7 of 24" is a fact; "you had a rough night" is a
 * story, and the story belongs to the people who were there — the same line
 * recap.ts draws.
 *
 * Something has to be DOABLE about it, on a screen this carries the way to.
 * A prompt with nowhere to go is a complaint.
 *
 * And it says nothing a player's log would not. Prompts are built from the
 * events handed in, so a player's come from a player's log, and the DM's half
 * of this file only ever runs in the DM's seat.
 */

import type { Seat } from "./combat.js";
import type { CharacterId, ResolvedResource } from "./build.js";
import {
  creatureCount, totals, type DifficultyBudget, type Encounter,
} from "./encounter.js";
import type { DomainEvent } from "./events.js";
import { budgetForParty, encounterMultiplier } from "./non-srd.js";
import { levelsOwed, type CampaignState } from "./project.js";
import { andList, capital, inWords, spelled, type Session } from "./recap.js";

/** The screens a prompt can send someone to. Tab ids, from App. */
export type PromptTab = "sheet" | "spells" | "party" | "prep" | "combat";

export interface Prompt {
  /** Stable, so a test can name one and the card can key on it. */
  readonly id: string;
  /** One sentence, and every number in it comes from the log. */
  readonly text: string;
  readonly go: PromptTab;
  /** What that screen is called, in the words the tab bar uses. */
  readonly where: string;
}

const WHERE: Record<PromptTab, string> = {
  sheet: "Your sheet",
  spells: "Your spells",
  party: "The party",
  prep: "Prep",
  combat: "The fight",
};

const prompt = (id: string, text: string, go: PromptTab): Prompt =>
  ({ id, text, go, where: WHERE[go] });

/**
 * Names, and then a count for the tail.
 *
 * A prompt that lists nine spent resources is a paragraph, and a paragraph in
 * a list of prompts is one nobody finishes reading.
 */
function few(names: readonly string[], max = 3): string {
  if (names.length <= max) return andList(names);
  return `${names.slice(0, max).join(", ")} and ${spelled(names.length - max, "other")}`;
}

/**
 * Hit dice and spell slots are resources, and they are not FEATURES: a wizard
 * who has never spent a hit die is not neglecting half their character, they
 * are a wizard who has not been hurt. Only what a class gave them counts.
 */
function isClassFeature(r: ResolvedResource): boolean {
  return r.id !== "hitDice" && r.id !== "pactSlots" && !/^slot\d+$/.test(r.id);
}

/** Did this character do anything at all in this session? */
function tookPart(session: Session, id: CharacterId): boolean {
  return session.events.some((e) => "who" in e && e.who === id);
}

export function promptsFor(
  seat: Seat,
  state: CampaignState,
  /** What this device may see, reverted events already dropped. */
  log: readonly DomainEvent[],
  /** The session being read — the latest one, or there is nothing to prompt. */
  session: Session,
  nameOf: (id: CharacterId) => string,
): Prompt[] {
  return seat.kind === "dm"
    ? dmPrompts(state, session, nameOf)
    : playerPrompts(seat.characterId, state, log, session);
}

/**
 * In the order VISION law 7 asks for: what is waiting on you, then what is
 * true right now, then the half of the sheet you have never opened.
 */
function playerPrompts(
  id: CharacterId,
  state: CampaignState,
  log: readonly DomainEvent[],
  session: Session,
): Prompt[] {
  const build = state.builds[id];
  const c = state.characters[id];
  if (!build || !c) return [];
  const out: Prompt[] = [];

  const owed = levelsOwed(state, id);
  if (owed > 0) {
    out.push(prompt(
      "level-waiting",
      owed === 1
        ? "A level is waiting to be taken."
        : `${capital(spelled(owed, "level"))} are waiting to be taken.`,
      "sheet",
    ));
  }

  /*
   * Not for the dead. The recap has already said they did not get back up,
   * and "you are on 0 of 24 hit points" underneath it is the app telling
   * somebody the worst thing that happened to them twice.
   */
  if (!c.dead && c.currentHp < build.maxHp) {
    out.push(prompt(
      "still-hurt",
      `You are on ${c.currentHp} of ${build.maxHp} hit points.`,
      "sheet",
    ));
  }

  /*
   * Says what is gone, and NOT what brings it back: these recharge on
   * different rests, and one sentence covering both would be wrong about one
   * of them.
   */
  const spent = build.resources.filter((r) => (c.spent[r.id] ?? 0) > 0);
  if (spent.length > 0) {
    out.push(prompt("still-spent", `Still spent: ${few(spent.map((r) => r.name))}.`, "sheet"));
  }

  /*
   * The half of the sheet nobody opens. Only for somebody who was at the
   * table this session — a character built on Tuesday has not neglected
   * anything yet, and being told so on the day they are made is the app
   * telling a new player they are already behind.
   */
  if (tookPart(session, id)) {
    const everSpent = new Set(
      log.flatMap((e) => (e.type === "resourceSpent" && e.who === id ? [e.resource] : [])),
    );
    const never = build.resources.filter(
      (r) => isClassFeature(r) && r.max > 0 && !everSpent.has(r.id),
    );
    if (never.length > 0) {
      out.push(prompt(
        "never-used",
        `${few(never.map((r) => r.name))} ${never.length === 1 ? "has" : "have"} never been used.`,
        "sheet",
      ));
    }

    const everCast = new Set(
      log.flatMap((e) => (e.type === "spellCast" && e.who === id ? [e.spellId] : [])),
    );
    /*
     * Half, before this is worth saying. A wizard will always have a spell
     * they have not reached for, and a prompt that fires at one in twenty is
     * a prompt nobody reads by the third session. The ask this answers is the
     * HALF of a sheet somebody never opens.
     */
    const uncast = c.spells.filter((s) => !everCast.has(s.id));
    if (c.spells.length > 0 && uncast.length * 2 >= c.spells.length) {
      out.push(prompt(
        "never-cast",
        uncast.length === c.spells.length
          ? `You know ${spelled(c.spells.length, "spell")} and have never cast one.`
          : `You know ${spelled(c.spells.length, "spell")}; ${
              inWords(uncast.length)
            } ${uncast.length === 1 ? "has" : "have"} never been cast.`,
        "spells",
      ));
    }
  }

  return out;
}

/**
 * The same question in the DM's voice. What is unfinished, what the party is
 * owed, and what the night just did to the prep.
 */
function dmPrompts(
  state: CampaignState,
  session: Session,
  nameOf: (id: CharacterId) => string,
): Prompt[] {
  const out: Prompt[] = [];
  const of = <T extends DomainEvent["type"]>(type: T) =>
    session.events.filter((e): e is Extract<DomainEvent, { type: T }> => e.type === type);

  if (state.combat) {
    out.push(prompt(
      "fight-open",
      `A fight is still running — round ${state.combat.round}.`,
      "combat",
    ));
  }

  const waiting = Object.keys(state.builds).filter((id) => levelsOwed(state, id) > 0);
  if (waiting.length > 0) {
    out.push(prompt(
      "levels-waiting",
      `${andList(waiting.map(nameOf))} ${waiting.length === 1 ? "has" : "have"} a level waiting.`,
      "party",
    ));
  }

  /*
   * Only in an XP campaign. A milestone night with three fights and nothing
   * handed out is how milestone campaigns work, and prompting about it would
   * be the app arguing with a decision the DM already made.
   */
  const fights = of("combatBegan").length;
  if (state.progression === "xp" && fights > 0 && of("xpAwarded").length === 0) {
    out.push(prompt("no-xp", `${capital(spelled(fights, "fight"))}, and no XP awarded.`, "party"));
  }

  const { items, coins } = state.stash;
  if (items.length > 0 || coins > 0) {
    out.push(prompt(
      "stash-waiting",
      `The stash still holds ${
        [items.length > 0 ? spelled(items.length, "thing") : "", coins > 0 ? `${coins} copper` : ""]
          .filter(Boolean)
          .join(" and ")
      }.`,
      "party",
    ));
  }

  /*
   * What levelling did to the prep. A fight built against level 3 is not
   * wrong at level 5, it is TRIVIAL — and the DM finds that out by running
   * it. The bands are the encounter builder's own, so this says what that
   * screen would say if the DM opened all four and read them.
   *
   * Only after a level, because otherwise it is a standing complaint about
   * encounters that were fine when they were written.
   */
  const saved = Object.values(state.encounters).filter((e) => creatureCount(e) > 0);
  const levels = Object.values(state.builds).map((b) => b.totalLevel);
  const budget = budgetForParty(levels);
  if (of("levelGained").length > 0 && budget && saved.length > 0) {
    const trivial = saved.filter((e) => bandOf(e, levels.length, budget) === "trivial");
    if (trivial.length > 0) {
      out.push(prompt(
        "outgrown",
        `${capital(inWords(trivial.length))} of your saved encounters ${
          trivial.length === 1 ? "is" : "are"
        } trivial against the party as it is now.`,
        "prep",
      ));
    }
  }

  if (Object.keys(state.scenes).length === 0 && Object.keys(state.encounters).length === 0) {
    out.push(prompt("nothing-prepared", "Nothing is prepared: no places, no encounters.", "prep"));
  }

  return out;
}

/** The encounter builder's own band, for the party as it stands today. */
function bandOf(e: Encounter, partySize: number, budget: DifficultyBudget) {
  return totals(e, partySize, budget, encounterMultiplier(creatureCount(e))).band;
}
