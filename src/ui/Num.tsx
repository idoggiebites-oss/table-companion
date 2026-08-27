/**
 * A number you can actually edit.
 *
 * Every number box in this app clamped on each keystroke: `+e.target.value ||
 * 1`. Backspace the "1" out of a level field and it is instantly 1 again —
 * so changing a 1 to a 5 means typing the 5 first and then hunting for the
 * cursor to delete the 1. On a phone, with a numeric keypad, that is a fight.
 *
 * The fix is to separate what is TYPED from what is COMMITTED. The box may be
 * empty mid-edit; the app keeps the last good number. Leaving the field puts
 * the committed number back on screen, so a box is never left blank and the
 * value it shows is always one the app agreed to.
 *
 * Clamping happens on commit rather than on keystroke for the same reason:
 * typing "12" into a field with a minimum of 10 passes through "1", and a
 * clamp on keystroke rewrites it to 10 before the 2 arrives.
 */

import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  readonly value: number;
  readonly onChange: (n: number) => void;
  readonly min?: number;
  readonly max?: number;
};

export function Num({ value, onChange, min, max, onBlur, ...rest }: Props) {
  /** What is in the box while it is being typed in. Null means "show value". */
  const [draft, setDraft] = useState<string | null>(null);

  const clamp = (n: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n));

  return (
    <input
      {...rest}
      type="number"
      /* A phone should offer digits, not a full keyboard. */
      inputMode="numeric"
      {...(min === undefined ? {} : { min })}
      {...(max === undefined ? {} : { max })}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw.trim() === "") return; // empty is a state of the box, not a value
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(clamp(n));
      }}
      onBlur={(e) => {
        // Back to what was agreed: an empty box shows the last good number.
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
