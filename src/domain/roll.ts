/**
 * Resolving a d20 roll the player made with real dice.
 *
 * The app never generates a number. It names the die, holds the modifier, and
 * does the arithmetic — which is the whole division of labour the product
 * rests on. Advantage is the case worth having in one place: two fields and
 * the app keeps the right one, so nobody does the comparison in their head
 * and nobody picks up the wrong die.
 */

export type RollMode = "normal" | "advantage" | "disadvantage";

export const ROLL_MODES: readonly RollMode[] = ["normal", "advantage", "disadvantage"];

export function diceNeeded(mode: RollMode): 1 | 2 {
  return mode === "normal" ? 1 : 2;
}

export interface RollResult {
  readonly kept: number;
  /** The die advantage or disadvantage threw away, if there was one. */
  readonly dropped: number | null;
  readonly modifier: number;
  readonly total: number;
  /** Natural 20 or natural 1 on the KEPT die — the dropped one never counts. */
  readonly natural: "twenty" | "one" | null;
}

export function resolveRoll(
  dice: readonly number[],
  mode: RollMode,
  modifier: number,
): RollResult {
  const need = diceNeeded(mode);
  if (dice.length !== need) {
    throw new RangeError(`${mode} needs ${need} dice, got ${dice.length}`);
  }
  for (const d of dice) {
    if (!Number.isInteger(d) || d < 1 || d > 20) {
      throw new RangeError(`${d} is not a d20 result`);
    }
  }

  const [a, b] = dice as [number, number?];
  let kept = a;
  let dropped: number | null = null;
  if (b !== undefined) {
    kept = mode === "advantage" ? Math.max(a, b) : Math.min(a, b);
    dropped = mode === "advantage" ? Math.min(a, b) : Math.max(a, b);
  }

  return {
    kept,
    dropped,
    modifier,
    total: kept + modifier,
    natural: kept === 20 ? "twenty" : kept === 1 ? "one" : null,
  };
}

export function describeRoll(label: string, r: RollResult): string {
  const sign = r.modifier < 0 ? "−" : "+";
  const base = `${label} ${r.total} · ${r.kept} ${sign} ${Math.abs(r.modifier)}`;
  const dropped = r.dropped === null ? "" : ` (${r.dropped} dropped)`;
  const nat = r.natural === "twenty" ? " · natural 20" : r.natural === "one" ? " · natural 1" : "";
  return base + dropped + nat;
}
