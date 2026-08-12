/**
 * The health indicator.
 *
 * Thresholds are the game's, not arbitrary: bloodied is exactly half, which is
 * a rules term rather than a design choice. The same four steps drive the
 * exact bar and the vague health players are shown, so one scale does two jobs.
 */

export type HealthStep = "unharmed" | "injured" | "bloodied" | "near";

export function healthStep(current: number, max: number): HealthStep {
  if (max <= 0) return "near";
  const pct = current / max;
  if (pct >= 1) return "unharmed";
  if (pct > 0.5) return "injured";
  if (pct > 0.25) return "bloodied";
  return "near";
}

/** What a player is allowed to see when the DM has not revealed numbers. */
export const VAGUE_LABEL: Record<HealthStep, string> = {
  unharmed: "Unharmed",
  injured: "Injured",
  bloodied: "Bloodied",
  near: "Near death",
};

export function HpBar({ current, max }: { current: number; max: number }) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return (
    <div className={`hpbar is-${healthStep(current, max)}`} style={{ "--hp": ratio } as React.CSSProperties}>
      <div className="hpbar-track">
        <div className="hpbar-ghost" />
        <div className="hpbar-fill" />
      </div>
    </div>
  );
}
