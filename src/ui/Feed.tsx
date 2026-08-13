/**
 * The action feed — the visible face of the event log.
 *
 * Every entry is attributed and reversible, which is what makes it acceptable
 * for anyone to change anyone else's numbers later. Undo appends a
 * compensating marker rather than removing anything, so a mistake stays in the
 * history and shows as struck through.
 */

import type { EffectiveBuild } from "../domain/build.js";
import type { DomainEvent } from "../domain/events.js";
import { isRevertible } from "../domain/events.js";
import { DM_ACTOR } from "../domain/permissions.js";
import { describeRoll, resolveRoll } from "../domain/roll.js";

const time = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function describe(e: DomainEvent, nameOf: (id: string) => string): string | null {
  switch (e.type) {
    case "characterAdded":
      return `${e.character.base.name} joined`;
    case "damageApplied":
      return `${nameOf(e.who)} took ${e.amount}`;
    case "healingApplied":
      return `${nameOf(e.who)} healed ${e.amount}`;
    case "tempHpGranted":
      return `${nameOf(e.who)} gained ${e.amount} temporary`;
    case "resourceSpent":
      return `${nameOf(e.who)} spent ${e.amount} × ${e.resource}`;
    case "resourceRestored":
      return `${nameOf(e.who)} regained ${e.amount} × ${e.resource}`;
    case "hitDiceSpent":
      return `${nameOf(e.who)} spent a hit die · rolled ${e.rolled}${
        e.conMod >= 0 ? ` + ${e.conMod}` : ` − ${Math.abs(e.conMod)}`
      }`;
    case "conditionAdded":
      return `${nameOf(e.who)} is ${e.condition}`;
    case "conditionRemoved":
      return `${nameOf(e.who)} is no longer ${e.condition}`;
    case "concentrationStarted":
      return `${nameOf(e.who)} is concentrating on ${e.on}`;
    case "concentrationEnded":
      return `${nameOf(e.who)} lost concentration`;
    case "concentrationChecked": {
      const r = resolveRoll(e.dice, e.mode, e.modifier);
      return `${nameOf(e.who)} concentration save · ${describeRoll("total", r).replace("total ", "")}`;
    }
    case "exhaustionChanged":
      return `${nameOf(e.who)} exhaustion ${e.delta > 0 ? "+" : ""}${e.delta}`;
    case "inspirationChanged":
      return `${nameOf(e.who)} ${e.value ? "gained" : "spent"} inspiration`;
    case "diceRolled":
      return `${nameOf(e.who)} rolled ${describeRoll(
        e.label,
        resolveRoll(e.dice, e.mode, e.modifier),
      )}`;
    case "deathSaveRecorded":
      return `${nameOf(e.who)} death save · ${e.result}`;
    case "areaDamageApplied": {
      const hit = e.targets.length;
      const saved = e.targets.filter((t) => t.saved).length;
      return `${e.label} · ${e.amount} ${e.damageType} · ${hit} target${
        hit === 1 ? "" : "s"
      }${saved > 0 ? ` · ${saved} saved` : ""}`;
    }
    case "combatStarted":
      return `Combat began · ${e.order.length} in initiative`;
    case "combatEnded":
      return "Combat ended";
    case "turnAdvanced":
      return null; // the feed would be nothing but this
    case "creatureDamaged":
      return `Creature took ${e.amount}`;
    case "disclosureSet":
      return `Disclosure set to ${e.level}`;
    case "shortRestTaken":
      return `Short rest · ${e.who.map(nameOf).join(", ")}`;
    case "longRestTaken":
      return `Long rest · ${e.who.map(nameOf).join(", ")}`;
    case "reverted":
      return null; // the marker shows on the event it undid, not on its own
  }
}

export function Feed({
  log, builds, reverted, onRevert,
}: {
  log: readonly DomainEvent[];
  builds: Readonly<Record<string, EffectiveBuild>>;
  reverted: ReadonlySet<string>;
  onRevert: (id: string) => void;
}) {
  const nameOf = (id: string) => builds[id]?.name ?? "Someone";
  /**
   * A signature only earns its place when somebody else did it. "Kira healed 4
   * — Kira" is noise; "Kira took 12 — DM" is the whole reason the DM is allowed
   * to edit another player's sheet.
   */
  const signedBy = (e: DomainEvent): string | null => {
    const subject = "who" in e && typeof e.who === "string" ? e.who : null;
    if (subject !== null && subject === e.by) return null;
    return e.by === DM_ACTOR ? "DM" : (builds[e.by]?.name ?? null);
  };
  const rows = [...log].reverse().filter((e) => e.type !== "reverted");

  if (rows.length === 0) {
    return <p className="faint">Nothing has happened yet.</p>;
  }

  return (
    <div className="feed">
      {rows.map((e) => {
        const text = describe(e, nameOf);
        if (text === null) return null;
        const undone = reverted.has(e.id);
        return (
          <div className={`fr${undone ? " undone" : ""}`} key={e.id}>
            <span className="t">{time(e.at)}</span>
            <span className="d">
              {text}
              {signedBy(e) && <> <span className="by">{signedBy(e)}</span></>}
            </span>
            {isRevertible(e) && (
              <button onClick={() => onRevert(e.id)} disabled={undone}>
                {undone ? "Undone" : "Undo"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
