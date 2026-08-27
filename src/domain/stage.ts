/**
 * Turning prep into an initiative order.
 *
 * This was inside the combat screen's setup panel, which meant a fight could
 * only be started from one place — and scenes need to start one from another.
 * Pulled out whole rather than reimplemented: two ways to build the same
 * fight is two places for six goblins to arrive with one hit point each.
 */

import type { Combatant } from "./combat.js";
import type { Encounter } from "./encounter.js";
import { instanceLabel, rollHp, type Statblock } from "./statblock.js";

/**
 * A monster as the fight will carry it.
 *
 * "Just what is needed" turned out to be a thirtieth of the creature: across
 * seven common monsters, 17 of 57 entries survived this boundary. Multiattack
 * is dropped from nearly every statblock in the game, and a goblin arrives
 * without Nimble Escape.
 *
 * The fix is an id rather than a copy. The catalogue is already loaded in the
 * fight, so the whole statblock is one lookup away — and a corrected monster
 * corrects the fights that are already running, which copying it into the log
 * would not.
 */
export interface StagedCreature {
  readonly name: string;
  readonly maxHp: number;
  readonly ac?: number;
  readonly attacks?: readonly { name: string; toHit?: number; dice?: string; type?: string }[];
  /** Where the rest of it is. Absent for anything staged before this existed. */
  readonly statblockId?: string;
}

/** Which side, if either, walked into it. */
export type Surprise = "none" | "monsters" | "players";

/** Everything in an encounter, counted out one at a time. */
export function creaturesFrom(
  enc: Encounter,
  catalogue: readonly Statblock[],
): StagedCreature[] {
  const out: StagedCreature[] = [];
  for (const entry of enc.entries) {
    const sb = catalogue.find((m) => m.id === entry.statblockId);
    for (let i = 0; i < entry.count; i++) {
      out.push({
        name: instanceLabel(entry.name, i, entry.count),
        // An unknown statblock lands as 1, which is visible as wrong rather
        // than plausible — the same choice the encounter builder makes.
        maxHp: sb ? (entry.hpMode === "rolled" ? rollHp(sb.hitDice) : sb.hp) : 1,
        ...(sb ? { ac: sb.ac, statblockId: sb.id } : {}),
        // Its actions come with it, so the DM taps rather than reads a
        // statblock aloud and types the numbers off it.
        ...(sb
          ? {
              attacks: sb.actions
                .filter((a) => a.attackBonus !== undefined || a.damage?.length)
                .map((a) => ({
                  name: a.name,
                  ...(a.attackBonus !== undefined ? { toHit: a.attackBonus } : {}),
                  ...(a.damage?.[0]?.dice ? { dice: a.damage[0].dice } : {}),
                  ...(a.damage?.[0]?.type ? { type: a.damage[0].type.toLowerCase() } : {}),
                })),
            }
          : {}),
      });
    }
  }
  return out;
}

/**
 * The initiative order, before anybody has rolled.
 *
 * Players are exact and monsters are vague, which is the disclosure the table
 * expects on the first round and the DM can raise per creature later.
 */
export function combatantsFor({
  characters, creatures, surprise = "none", now = Date.now(),
}: {
  characters: readonly { id: string; name: string; speed: number }[];
  creatures: readonly StagedCreature[];
  surprise?: Surprise;
  now?: number;
}): Combatant[] {
  return [
    ...characters.map((b) => ({
      id: `pc-${b.id}`,
      name: b.name,
      initiative: null,
      source: { kind: "character" as const, characterId: b.id },
      controller: { kind: "player" as const, characterId: b.id },
      disclosure: "exact" as const,
      surprised: surprise === "players",
      speed: b.speed,
    })),
    ...creatures.map((c, i) => ({
      id: `cr-${now.toString(36)}-${i}`,
      name: c.name || `Creature ${i + 1}`,
      initiative: null,
      source: {
        kind: "creature" as const,
        maxHp: c.maxHp,
        ...(c.ac ? { ac: c.ac } : {}),
        // The same field was dropped twice: once staging a creature out of an
        // encounter, and again turning it into a combatant here.
        ...(c.statblockId ? { statblockId: c.statblockId } : {}),
        ...(c.attacks?.length ? { attacks: c.attacks } : {}),
      },
      controller: { kind: "dm" as const },
      disclosure: "vague" as const,
      surprised: surprise === "monsters",
      speed: 30,
    })),
  ];
}
