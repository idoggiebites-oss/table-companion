/**
 * Everything you are carrying, on its own screen.
 *
 * Split off the sheet because it is a different activity: gear is sorted
 * between fights, at a shop or after a body, while the sheet is read DURING
 * one. Mixing them meant scrolling past your whole pack to reach your saving
 * throws.
 *
 * The consequences stay visible here even though they belong to the sheet —
 * armour class and what you would roll — because equipping is the one action
 * on this screen that changes them, and a change you have to navigate away to
 * see is a change nobody connects to what they just did.
 */

import { useMemo } from "react";
import { formatModifier } from "../domain/abilities.js";
import { describeAttack, resolveAttack } from "../domain/attack.js";
import type { EffectiveBuild } from "../domain/build.js";
import { armourClass, attacksFromEquipment } from "../domain/equipment.js";
import type { EventBody } from "../domain/events.js";
import {
  equippedItems, indexItems, mergeItems, type Item,
} from "../domain/items.js";
import type { CharacterState } from "../domain/project.js";
import { loadEquipment } from "../store/srd.js";
import { Inventory, useCatalogue } from "./Inventory.js";

export function Gear({
  build, state, append, homebrew,
}: {
  build: EffectiveBuild;
  state: CharacterState;
  /** The DM's own things, which are items like any other. */
  homebrew?: Readonly<Record<string, Item>> | undefined;
  append: (body: EventBody) => void;
}) {
  const items = useCatalogue(loadEquipment, true);
  // The DM's own things are items like any other.
  /*
   * One merged list, used for both looking a thing up by id and searching
   * for it by name. Merging into only the index was the bug: a homebrew
   * sword already in the bag resolved, and one you were trying to FIND did
   * not exist.
   */
  const all = useMemo(() => mergeItems(items ?? [], homebrew), [items, homebrew]);
  const catalogue = useMemo(() => indexItems(all), [all]);
  const worn = useMemo(
    () => equippedItems(state.inventory, state.equipped, catalogue),
    [state.inventory, state.equipped, catalogue],
  );
  const ac = armourClass(worn, build.abilityMods.dex, build.armourClass, build.abilities.str);
  const attacks = attacksFromEquipment(worn).map((a) =>
    resolveAttack(a, build.abilityMods, build.proficiencyBonus),
  );

  return (
    <>
      <section className="card">
        <div className="card-hd">
          <span className="label">What this gets you</span>
        </div>
        <div className="gear-sum">
          <div>
            <b className="num">{ac.value}</b>
            <span className="label">Armour class</span>
            <span className="faint">{ac.from}</span>
          </div>
          {ac.speedPenalty > 0 && (
            <p className="err">
              Too heavy for your Strength — 10 feet slower.
            </p>
          )}
          {ac.stealthDisadvantage && (
            <p className="faint">Disadvantage on Stealth while you wear this.</p>
          )}
          {attacks.map((a) => (
            <div className="gear-atk" key={a.name}>
              <span className="n">{a.name}</span>
              <span className="faint">{describeAttack(a)}</span>
              <span className="m num">{formatModifier(a.toHit)}</span>
            </div>
          ))}
          {attacks.length === 0 && (
            <p className="faint" style={{ margin: 0, fontSize: ".86rem" }}>
              Nothing drawn. Equip a weapon and it appears here and on your sheet.
            </p>
          )}
        </div>
      </section>

      <Inventory
        who={build.id}
        inventory={state.inventory}
        equipped={state.equipped}
        coins={state.coins}
        catalogue={catalogue}
        items={all}
        editable
        append={append}
      />
    </>
  );
}
