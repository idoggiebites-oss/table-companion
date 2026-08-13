/**
 * The roll pad — pinned to the bottom of the viewport, not placed in the page.
 *
 * Anywhere in the document flow makes the distance between what you tapped and
 * where you type depend on where you happened to be scrolled. Pinned removes
 * that variable and puts the pad under your thumb, which matters when the
 * target is twenty small buttons.
 *
 * The app never rolls. It names the die, holds the modifier, and does the
 * arithmetic — advantage takes two taps and keeps the right one.
 */

import { useEffect, useState } from "react";
import type { Boon } from "../domain/boons.js";
import { formatModifier } from "../domain/abilities.js";
import {
  describeRoll,
  diceNeeded,
  resolveRoll,
  ROLL_MODES,
  type RollMode,
  type RollResult,
} from "../domain/roll.js";

export interface RollTarget {
  readonly label: string;
  readonly modifier: number;
  /** When the roll has a target number, the pad says whether it was met. */
  readonly dc?: number;
  /** Extra line under the title — what is at stake, for a save. */
  readonly note?: string;
  /**
   * Boons that touch this roll. Shown, never added: the pad holds the
   * modifier while a person rolls, and a boon is no different.
   */
  readonly boons?: readonly Boon[];
}

const MODE_LABEL: Record<RollMode, string> = {
  normal: "Normal",
  advantage: "Advantage",
  disadvantage: "Disadvantage",
};

export function RollPad({
  target, onClose, onRolled,
}: {
  target: RollTarget;
  onClose: () => void;
  onRolled: (mode: RollMode, dice: number[]) => void;
}) {
  const [mode, setMode] = useState<RollMode>("normal");
  const [dice, setDice] = useState<number[]>([]);
  const [result, setResult] = useState<RollResult | null>(null);

  // A new target is a new roll — never inherit half-entered dice.
  useEffect(() => {
    setDice([]);
    setResult(null);
  }, [target]);

  // Reserve room so the pinned pad never covers the row that opened it.
  useEffect(() => {
    document.body.classList.add("pad-open");
    return () => document.body.classList.remove("pad-open");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const need = diceNeeded(mode);

  function tap(face: number) {
    const next = [...dice, face];
    if (next.length < need) {
      setDice(next);
      return;
    }
    setResult(resolveRoll(next, mode, target.modifier));
    setDice([]);
    onRolled(mode, next);
  }

  function changeMode(m: RollMode) {
    setMode(m);
    setDice([]);
    setResult(null);
  }

  const ask =
    need === 1
      ? `Roll a d20 and add ${formatModifier(target.modifier)}.${
          target.dc === undefined ? "" : ` DC ${target.dc}.`
        }`
      : dice.length === 0
        ? "Roll two d20. Tap the first."
        : "Tap the second die.";

  return (
    <div className="rollpad" role="dialog" aria-label={`Roll ${target.label}`}>
      <div className="rp-head">
        <span className="rp-title">
          {target.label} <span className="num">{formatModifier(target.modifier)}</span>
        </span>
        <button className="rp-close" onClick={onClose} aria-label="Close roll pad">
          ✕
        </button>
      </div>
      {target.note && <p className="rp-note">{target.note}</p>}
      {/* Not folded into the modifier above: a printed total that disagrees
          with the table's own arithmetic is worse than a line to read. */}
      {(target.boons ?? []).map((b) => (
        <p className="rp-boon" key={b.id}>
          <span>{b.name}</span>
          <b>{b.modifier ?? "—"}</b>
        </p>
      ))}

      <div className="rp-modes">
        {ROLL_MODES.map((m) => (
          <button
            key={m}
            aria-pressed={mode === m}
            className={mode === m ? "on" : ""}
            onClick={() => changeMode(m)}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      <p className="rp-ask">{ask}</p>

      <div className="rp-pad">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((face) => (
          <button key={face} onClick={() => tap(face)} className={dice.includes(face) ? "held" : ""}>
            {face}
          </button>
        ))}
      </div>

      {result && (
        <div className={`rp-out${result.natural ? ` nat-${result.natural}` : ""}`}>
          <span className="rp-total num">{result.total}</span>
          {target.dc !== undefined && (
            <span className={`rp-verdict ${result.total >= target.dc ? "met" : "missed"}`}>
              {result.total >= target.dc ? "Made it" : "Failed"} · DC {target.dc}
            </span>
          )}
          <span className="rp-expl">{describeRoll(target.label, result)}</span>
        </div>
      )}
    </div>
  );
}
