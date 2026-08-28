/**
 * Legendary actions, and what the lair does.
 *
 * The most-forgotten things on a statblock. Three a round, spent after
 * somebody ELSE's turn, back at the start of the creature's own; and a lair
 * action on initiative count 20 that belongs to the place rather than to
 * anybody in it. A DM running a dragon holds all of that while also holding
 * the fiction, and the usual outcome is that the dragon never uses any of it.
 *
 * So it sits on screen during OTHER creatures' turns, which is exactly when
 * it is available and exactly when nothing else is asking for the DM's
 * attention. On the dragon's own turn it goes away — a dragon that legendary
 * acts on its own turn is taking four actions instead of one, and that is the
 * mistake this is most likely to cause if it stays visible.
 */

import { useState } from "react";
import type { EventBody } from "../domain/events.js";
import {
  legendaryLeft, mayTakeLegendary,
  type LairAction, type LegendaryOption,
} from "../domain/legendary.js";

export function Legendary({
  who, name, budget, spent, options, isTheirTurn, append,
}: {
  who: string;
  name: string;
  budget: number;
  spent: number | undefined;
  options: readonly LegendaryOption[];
  /** Their own turn: they cannot take one, and offering it invites the error. */
  isTheirTurn: boolean;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (options.length === 0 || isTheirTurn) return null;

  const left = legendaryLeft(budget, spent);
  return (
    <div className="legend">
      <div className="legend-hd">
        <span className="label">{name} · legendary</span>
        {budget > 0 ? (
          <span className="faint num">{left} of {budget} left</span>
        ) : (
          /*
           * The book did not say how many — the SRD strips the heading and
           * ships only the options, so 84 creatures arrive with a list of
           * things to do and no budget. Inventing three would be the app
           * making up a rule; asking once is what it can honestly do.
           */
          <span className="row legend-ask">
            <label className="label" htmlFor={`leg-${who}`}>how many a round</label>
            <input
              id={`leg-${who}`}
              type="number" min={1} max={9}
              aria-label={`How many legendary actions ${name} gets`}
              style={{ width: 62 }}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n > 0) {
                  append({ type: "legendaryBudgetSet", combatantId: who, budget: n });
                }
              }}
            />
          </span>
        )}
      </div>
      {options.map((o) => {
        const can = mayTakeLegendary({ budget, spent, isTheirTurn, cost: o.cost });
        const shown = open === o.name;
        return (
          <div className="menu-row" key={o.name}>
            <button
              className="menu-hd"
              aria-expanded={shown}
              aria-label={`${o.name}, legendary`}
              onClick={() => setOpen(shown ? null : o.name)}
            >
              <span className="nm">{o.name}</span>
              <span className="cost">{o.cost === 1 ? "1 action" : `${o.cost} actions`}</span>
            </button>
            {shown && (
              <div className="menu-more">
                <p className="then">{o.desc}</p>
                <button
                  className="menu-take"
                  /* Only blocked when a budget IS stated and is short. Where
                     the book says nothing, the DM decides. */
                  disabled={budget > 0 && !can}
                  aria-label={`Take ${o.name}`}
                  onClick={() => {
                    append({
                      type: "legendaryTaken",
                      combatantId: who,
                      what: `${name}: ${o.name}`,
                      cost: o.cost,
                    });
                    setOpen(null);
                  }}
                >
                  {budget > 0 && !can ? "Not enough left" : "Take it"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The place's own action.
 *
 * Not any creature's turn, which is why it is here rather than on a row: it
 * fires on its own initiative count and belongs to the lair. Once per round,
 * and the round it was last taken is what stops the DM wondering.
 */
export function Lair({
  lair, round, append,
}: {
  lair: (LairAction & { readonly usedInRound?: number }) | null | undefined;
  round: number;
  append: (body: EventBody) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!lair) return null;
  const used = lair.usedInRound === round;
  return (
    <div className="legend lair">
      <button
        className="legend-hd"
        aria-expanded={open}
        aria-label="The lair itself"
        onClick={() => setOpen(!open)}
      >
        <span className="label">The lair · on {lair.at}</span>
        <span className="faint num">{used ? "taken this round" : "waiting"}</span>
      </button>
      {open && (
        <div className="menu-more">
          <p className="then">{lair.text}</p>
          <button
            className="menu-take"
            disabled={used}
            aria-label="The lair acts"
            onClick={() => {
              append({ type: "lairTaken", round });
              setOpen(false);
            }}
          >
            {used ? "Already taken this round" : "It acts"}
          </button>
        </div>
      )}
    </div>
  );
}
