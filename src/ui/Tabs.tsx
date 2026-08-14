/**
 * Tabs.
 *
 * The app had grown into one column you scrolled through, which is fine at a
 * desk and wrong at a table: the thing you need is three thumb-flicks away
 * while somebody waits for you. The split follows the three attention modes
 * the design started from — glance (a fight), lean-in (your sheet), desk
 * (prep) — because those are already different postures, not different
 * screens invented to hold overflow.
 *
 * The cost of tabs is that things go out of sight, and one of the things that
 * can go out of sight is a concentration save owed RIGHT NOW. So a tab can
 * carry a dot, and the two genuinely urgent transitions — a fight starting,
 * a save falling due — move you rather than waiting to be noticed. Nothing
 * else does: being yanked off a page mid-sentence is its own kind of wrong.
 */

export interface TabDef<Id extends string> {
  readonly id: Id;
  readonly label: string;
  /** A dot, for something that wants attention but is not urgent. */
  readonly dot?: boolean;
}

export function Tabs<Id extends string>({
  tabs, active, onPick,
}: {
  tabs: readonly TabDef<Id>[];
  active: Id;
  onPick: (id: Id) => void;
}) {
  return (
    <nav className="tabs" aria-label="Sections">
      {tabs.map((t) => (
        <button
          key={t.id}
          data-tab={t.id}
          className={`tab${t.id === active ? " on" : ""}`}
          aria-current={t.id === active ? "page" : undefined}
          aria-label={t.dot ? `${t.label} — needs attention` : t.label}
          onClick={() => onPick(t.id)}
        >
          {t.label}
          {t.dot && <i className="tab-dot" />}
        </button>
      ))}
    </nav>
  );
}
