/**
 * Concentration.
 *
 * Tracking what someone is concentrating on is the boring half. The valuable
 * half is that damage already flows through the app, so it knows a saving
 * throw is owed and what its DC is — a number tables routinely compute wrong
 * or skip entirely. That is the clearest thing this app does that paper
 * cannot.
 */

/** Half the damage taken, or 10, whichever is higher. */
export function concentrationDc(damage: number): number {
  return Math.max(10, Math.floor(damage / 2));
}

/** One save owed, from one instance of damage. */
export interface ConcentrationCheck {
  readonly dc: number;
  readonly fromDamage: number;
}

export function checkFor(damage: number): ConcentrationCheck {
  return { dc: concentrationDc(damage), fromDamage: damage };
}
