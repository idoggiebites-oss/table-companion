/**
 * The switch, wherever a list is long because of imported content.
 *
 * One control, one wording, one place in every card — a person who learns it
 * on the class step should not have to find it again on the spell step.
 *
 * It hides itself when there is nothing to hide. A deployment without a
 * compendium has nothing marked in it, and a switch that never changes
 * anything is worse than no switch.
 */

export function HomebrewToggle({
  on, hidden, onChange,
}: {
  on: boolean;
  /** How many entries the switch is keeping out of the list right now. */
  hidden: number;
  onChange: (on: boolean) => void;
}) {
  if (hidden === 0 && !on) return null;
  return (
    <button
      className={`hb-toggle${on ? " on" : ""}`}
      aria-pressed={on}
      aria-label="Show homebrew and third-party content"
      onClick={() => onChange(!on)}
    >
      <i />
      {on ? "Homebrew shown" : `${hidden} more from your compendium`}
    </button>
  );
}
