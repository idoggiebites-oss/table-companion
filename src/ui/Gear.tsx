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
  carryLimit,
  weightOf,
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
  /* What it all weighs, against what this character can carry. */
  const carried = weightOf(state.inventory, (id) => catalogue[id]);
  const limit = carryLimit(build.abilities.str);
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
          {/*
            * What you are carrying against what you can, and what your armour
            * bought — ported from V2's carry band.
            *
            * The limit is Strength x 15, the rule as written, and it is NOT
            * enforced: it is a number the table reads. A player who decides to
            * drag the chest anyway is making a ruling, and an app that refuses
            * it has taken that ruling from the person whose it is.
            */}
          <div className="carry">
            <span className="carry-hd">
              <span className="label">Carry weight</span>
              <span className="label">Armour class</span>
            </span>
            <span className="carry-b">
              <span className="carry-w num">
                {carried.toFixed(1)}<i> / {limit} lb</i>
              </span>
              <span className="carry-ac num">{ac.value}</span>
            </span>
            <span className="carry-tr">
              <i
                className={`carry-fl${carried > limit ? " over" : ""}`}
                style={{ width: `${Math.min(100, Math.round((carried / Math.max(1, limit)) * 100))}%` }}
              />
            </span>
            <span className="carry-from">{ac.from}</span>
            {/* What the armour costs, beside the number it bought: a sheet
                that says 18 and not "disadvantage on Stealth" has told half
                the story. */}
            {(ac.stealthDisadvantage || ac.speedPenalty > 0) && (
              <span className="carry-cost">
                {[
                  ac.stealthDisadvantage ? "Disadvantage on Stealth" : null,
                  ac.speedPenalty > 0
                    ? `Speed ${build.speed - ac.speedPenalty} ft. — you are not strong enough for this armour`
                    : null,
                ].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
          {attacks.map((a) => (
            <div className="gear-atk" key={a.name}>
              <span className="n">{a.name}</span>
              <span className="faint">{describeAttack(a)}</span>
              <span className="m num">{formatModifier(a.toHit)}</span>
            </div>
          ))}
          {attacks.length === 0 && (
            <p className="faint note">
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
