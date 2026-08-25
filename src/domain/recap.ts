/**
 * What happened last time.
 *
 * The log has held every session in full since the first commit and has never
 * been readable. Scrolling three hundred rows of "Kira took 7" backwards is
 * not remembering — it is archaeology — so the thing a table actually does is
 * ask out loud, and the answer is whatever four people half-remember.
 *
 * A recap is the log read forwards instead: the shape of a session rather
 * than its transactions. Three fights, somebody went down, you levelled, you
 * spent the night in the dark.
 *
 * Two rules it keeps to:
 *
 * The app never says what happened in the FICTION. It knows Kira took eleven
 * damage; it does not know the ghoul had her by the throat. So every line
 * here is a fact the app can stand behind, phrased plainly, and the story
 * around it stays where it belongs — with the people who were there.
 *
 * And it says nothing a player's log would not. The recap is built from
 * whatever events were handed to it, so a player's recap comes from a
 * player's log and the DM's prep never leaks into it sideways.
 */

import type { DomainEvent } from "./events.js";
import { describeRoom, isOpenGround } from "./terrain.js";

/**
 * Six hours between events starts a new session.
 *
 * A game that runs past midnight is one session; a week later is not. There
 * is no "end the session" button and there should not be — it is one more
 * thing to forget, and forgetting it would silently merge two nights into one
 * recap. A gap is something the table cannot fail to do.
 */
export const SESSION_GAP_MS = 6 * 60 * 60 * 1000;

export interface Session {
  readonly startedAt: number;
  readonly endedAt: number;
  readonly events: readonly DomainEvent[];
}

/** Split a log where the table went home. Oldest first. */
export function sessions(
  events: readonly DomainEvent[],
  gap: number = SESSION_GAP_MS,
): Session[] {
  const sorted = [...events].sort((a, b) => a.at - b.at);
  const out: Session[] = [];
  let run: DomainEvent[] = [];
  for (const e of sorted) {
    const last = run[run.length - 1];
    if (last && e.at - last.at > gap) {
      out.push(sessionOf(run));
      run = [];
    }
    run.push(e);
  }
  if (run.length > 0) out.push(sessionOf(run));
  return out;
}

function sessionOf(events: readonly DomainEvent[]): Session {
  return {
    startedAt: events[0]?.at ?? 0,
    endedAt: events[events.length - 1]?.at ?? 0,
    events,
  };
}

export interface Recap {
  readonly startedAt: number;
  readonly endedAt: number;
  /** The session in sentences, in the order a table would tell it. */
  readonly lines: readonly string[];
  /** The few numbers worth seeing at a glance. */
  readonly counts: readonly { readonly label: string; readonly value: string }[];
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Written out to ten, because "3 fights" reads like a spreadsheet. */
const WORDS = [
  "no", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten",
];
const count = (n: number, one: string, many = `${one}s`) =>
  `${WORDS[n] ?? n} ${n === 1 ? one : many}`;

/** A list that reads aloud: "Kira", "Kira and Bel", "Kira, Bel and Sam". */
export function andList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The session, in the order a table tells it: where they went, what they
 * fought, who nearly died, and what they came away with.
 */
export function recapOf(
  session: Session,
  nameOf: (id: string) => string,
): Recap {
  const lines: string[] = [];
  const counts: { label: string; value: string }[] = [];
  const seen = <T,>(list: T[]) => [...new Set(list)];

  const of = <T extends DomainEvent["type"]>(type: T) =>
    session.events.filter((e): e is Extract<DomainEvent, { type: T }> => e.type === type);

  // --- where ---------------------------------------------------------------
  const rooms = of("sceneSet")
    .map((e) => e.scene)
    .filter((room) => !isOpenGround(room))
    // describeRoom writes for the fight's own header, where a middot
    // separates the facts. In a sentence that reads as punctuation nobody
    // uses out loud.
    .map((room) => describeRoom(room).replace(/ · /g, ", "));
  if (rooms.length > 0) {
    const places = seen(rooms);
    lines.push(
      places.length === 1
        ? `You fought in ${places[0]}.`
        : `The ground kept changing: ${andList(places)}.`,
    );
  }

  // --- fights --------------------------------------------------------------
  const fights = of("combatBegan").length;
  if (fights > 0) {
    lines.push(`${capital(count(fights, "fight"))}.`);
    counts.push({ label: "Fights", value: String(fights) });
  }

  // --- the worst of it -----------------------------------------------------
  const hits = of("damageApplied");
  const worst = hits.reduce<{ who: string; amount: number } | null>(
    (top, e) => (top && top.amount >= e.amount ? top : { who: e.who, amount: e.amount }),
    null,
  );
  const taken = hits.reduce((n, e) => n + e.amount, 0);
  if (worst && worst.amount > 0) {
    lines.push(
      `The hardest hit of the night landed on ${nameOf(worst.who)}, for ${worst.amount}.`,
    );
    counts.push({ label: "Damage taken", value: String(taken) });
  }
  const healed = of("healingApplied").reduce((n, e) => n + e.amount, 0);
  if (healed > 0) counts.push({ label: "Healed", value: String(healed) });

  // --- who nearly died -----------------------------------------------------
  const saves = of("deathSaveRecorded");
  const down = seen(saves.map((e) => e.who));
  if (down.length > 0) {
    const died = down.filter(
      (who) =>
        saves.filter(
          (e) => e.who === who && (e.result === "failure" || e.result === "fumble"),
        ).length >= 3,
    );
    lines.push(
      `${andList(down.map(nameOf))} went down${
        died.length > 0 ? ` — and ${andList(died.map(nameOf))} did not get back up` : ""
      }.`,
    );
  }

  // --- what it earned ------------------------------------------------------
  const levelled = seen(of("levelGained").map((e) => e.who));
  if (levelled.length > 0) lines.push(`${andList(levelled.map(nameOf))} levelled.`);
  const xp = of("xpAwarded").reduce((n, e) => n + e.amount, 0);
  if (xp > 0) counts.push({ label: "XP each", value: String(xp) });

  const loot = of("lootGranted");
  const items = loot.reduce((n, e) => n + e.items.length, 0);
  const coins = loot.reduce((n, e) => n + e.coins, 0);
  if (items > 0 || coins > 0) {
    lines.push(
      `You came away with ${
        [items > 0 ? plural(items, "thing") : "", coins > 0 ? `${coins} copper` : ""]
          .filter(Boolean)
          .join(" and ")
      }.`,
    );
  }

  // --- and how you spent it ------------------------------------------------
  const casts = of("spellCast");
  if (casts.length > 0) {
    const tally = new Map<string, number>();
    for (const c of casts) tally.set(c.name, (tally.get(c.name) ?? 0) + 1);
    const [name, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]!;
    if (n > 1) lines.push(`${name} got cast ${plural(n, "time")}.`);
    counts.push({ label: "Spells cast", value: String(casts.length) });
  }
  const rests = of("longRestTaken").length;
  const naps = of("shortRestTaken").length;
  if (rests > 0 || naps > 0) {
    counts.push({
      label: "Rests",
      value: [naps > 0 ? `${naps} short` : "", rests > 0 ? `${rests} long` : ""]
        .filter(Boolean)
        .join(", "),
    });
  }

  /*
   * The one roll worth remembering. A natural twenty is the only die result a
   * table repeats afterwards, and it is in the log because the app never
   * rolls — every one of these was thrown by a person at the table.
   */
  const nat20 = of("diceRolled").filter((e) => e.dice.includes(20));
  if (nat20.length > 0) {
    const who = seen(nat20.map((e) => e.who)).map(nameOf);
    lines.push(
      `${count(nat20.length, "natural twenty")}, thrown by ${andList(who)}.`,
    );
  }

  return { startedAt: session.startedAt, endedAt: session.endedAt, lines, counts };
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nothing worth reading — a session where the app was only opened. */
export function isEmpty(recap: Recap): boolean {
  return recap.lines.length === 0 && recap.counts.length === 0;
}

/**
 * A date a table recognises. "Last night" and "a week ago" are how people
 * refer to sessions; an ISO date is how a database does.
 */
export function whenWas(at: number, now: number = Date.now()): string {
  const days = Math.floor((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${plural(days, "day")} ago`;
  if (days < 14) return "last week";
  if (days < 60) return `${plural(Math.round(days / 7), "week")} ago`;
  return `${plural(Math.round(days / 30), "month")} ago`;
}

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
