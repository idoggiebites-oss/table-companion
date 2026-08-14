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
import { describeBoon } from "../domain/boons.js";
import { formatCoins } from "../domain/money.js";
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
    case "progressionSet":
      return `Campaign advances by ${e.mode === "xp" ? "experience" : "milestone"}`;
    case "xpAwarded":
      return `${e.who.map(nameOf).join(", ")} gained ${e.amount.toLocaleString()} XP`;
    case "levelAwarded":
      return `${e.who.map(nameOf).join(", ")} may level up`;
    case "levelGained":
      return `${nameOf(e.who)} levelled up · +${e.hpGain} hit points`;
    case "encounterSaved":
      return `Saved encounter · ${e.encounter.name}`;
    case "encounterDeleted":
      return "Deleted an encounter";
    case "itemAdded":
      return `${nameOf(e.who)} gained ${e.stack.qty > 1 ? `${e.stack.qty} × ` : ""}${e.stack.name}${
        e.stack.note ? ` (${e.stack.note})` : ""
      }`;
    case "itemRemoved":
      return `${nameOf(e.who)} lost ${e.qty > 1 ? `${e.qty} × ` : ""}${e.name}`;
    case "itemEquipped":
      return `${nameOf(e.who)} drew ${e.name}`;
    case "itemUnequipped":
      return `${nameOf(e.who)} put away ${e.name}`;
    case "coinsChanged":
      return `${nameOf(e.who)} ${e.delta >= 0 ? "gained" : "spent"} ${formatCoins(Math.abs(e.delta))}`;
    case "combatStaged":
      return `Roll for initiative — ${e.combatants.length} in the fight`;
    case "initiativeRolled":
      return `Initiative ${e.value}`;
    case "combatBegan":
      return "The fight begins";
    case "movementSpent":
      return e.feet >= 0 ? `Moved ${e.feet} ft` : `Took back ${Math.abs(e.feet)} ft`;
    case "opportunityTaken":
      return `Opportunity attack${e.attackerWho ? ` by ${nameOf(e.attackerWho)}` : ""}`;
    case "boonGranted":
      return `${nameOf(e.who)} gained ${describeBoon(e.boon)}`;
    case "boonRemoved":
      return `${nameOf(e.who)} lost a boon`;
    case "npcSaved":
      return `Saved ${e.npc.name}${e.npc.role ? ` · ${e.npc.role}` : ""}`;
    case "npcDeleted":
      return "Deleted an NPC";
    case "traderOpened":
      return "Opened a shop";
    case "traderClosed":
      return "Closed the shop";
    case "itemBought":
      return `${nameOf(e.who)} bought ${e.stack.name} for ${formatCoins(e.price)}`;
    case "lootGranted": {
      const what = [
        ...e.items.map((i) => (i.qty > 1 ? `${i.qty} × ${i.name}` : i.name)),
        ...(e.coins > 0 ? [formatCoins(e.coins)] : []),
      ].join(", ");
      return e.to.kind === "party"
        ? `The party found ${what || "nothing"}`
        : `${nameOf(e.to.who)} was given ${what || "nothing"}`;
    }
    case "stashAssigned":
      return `${e.name} went to ${nameOf(e.to)}`;
    case "stashCoinsSplit":
      return `Coins split ${e.among.length} way${e.among.length === 1 ? "" : "s"}`;
    case "homebrewSaved":
      return `Saved a creature · ${e.statblock.name}`;
    case "homebrewDeleted":
      return "Deleted a homebrew creature";
    case "economySpent":
      return `${nameOf(e.who)} used their ${e.kind}`;
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
