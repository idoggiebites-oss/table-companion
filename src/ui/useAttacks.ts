/**
 * What a character can swing, derived once.
 *
 * The sheet, the gear screen and the combat walkthrough all need the same
 * answer: equipment-derived attacks first, then anything imported or typed by
 * hand that the equipment does not already cover. Three copies of that would
 * drift, and the one that drifted would be the one a beginner is reading
 * during a fight.
 */

import { useMemo } from "react";
import { resolveAttack, type ResolvedAttack } from "../domain/attack.js";
import type { EffectiveBuild } from "../domain/build.js";
import { armourClass, attacksFromEquipment, type ArmourClass } from "../domain/equipment.js";
import { equippedItems, indexItems, mergeItems, type Item } from "../domain/items.js";
import type { CharacterState } from "../domain/project.js";
import { loadEquipment } from "../store/srd.js";
import { useCatalogue } from "./Inventory.js";

/**
 * Both arguments are optional because hooks cannot be called conditionally —
 * the combat screen asks for this before knowing whether the seat holds a
 * character at all.
 */
export function useAttacks(
  build: EffectiveBuild | undefined,
  state: CharacterState | undefined,
  /*
   * The DM's own things, which are items like any other — a homebrew sword
   * has to swing, and nothing downstream of here should have to know where
   * it came from.
   */
  homebrew?: Readonly<Record<string, Item>>,
): { attacks: ResolvedAttack[]; ac: ArmourClass | null; ready: boolean } {
  const items = useCatalogue(loadEquipment, true);
  const catalogue = useMemo(
    () => indexItems(mergeItems(items ?? [], homebrew)),
    [items, homebrew],
  );
  const worn = useMemo(
    () => (state ? equippedItems(state.inventory, state.equipped, catalogue) : []),
    [state, catalogue],
  );

  const ac = build
    ? armourClass(worn, build.abilityMods.dex, build.armourClass, build.abilities.str)
    : null;

  const attacks = useMemo(() => {
    if (!build) return [];
    const gear = attacksFromEquipment(worn).map((a) =>
      resolveAttack(a, build.abilityMods, build.proficiencyBonus),
    );
    return [...gear, ...build.attacks.filter((a) => !gear.some((g) => g.name === a.name))];
  }, [worn, build]);

  return { attacks, ac, ready: items !== null };
}
