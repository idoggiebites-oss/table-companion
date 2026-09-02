import { Icon, type IconName } from "./Icon.js";

/**
 * One bar, at the bottom, with an icon and a word on every entry.
 *
 * It was a row of six words across the TOP of the page, tracked uppercase at
 * 0.6rem, sitting under three other bars — and six of them at 14px of padding
 * needed 416px on a phone that has 354, so the row scrolled sideways. A tab
 * you have to swipe to is a tab a first-timer does not know exists.
 *
 * At the bottom it is where the thumb already is, it cannot be scrolled past,
 * and it never competes with the content for the top of the screen. The icon
 * is what makes the word optional at a glance — which is the whole reason six
 * entries now fit where six words did not.
 *
 * The split it expresses is unchanged, and so are its rules: the three
 * attention modes the design started from — glance (a fight), lean-in (your
 * sheet), desk (prep) — because those are already different postures, not
 * screens invented to hold overflow.
 *
 * The cost of tabs is that things go out of sight, and one of the things that
 * can go out of sight is a concentration save owed RIGHT NOW. So a tab can
 * carry a dot, and the two genuinely urgent transitions — a fight starting, a
 * save falling due — move you rather than waiting to be noticed. Nothing else
 * does: being yanked off a page mid-sentence is its own kind of wrong.
 *
 * `data-tab` stays exactly as it was. Sixty-three browser suites navigate by
 * it, and a redraw is not a reason to make every one of them find a new door.
 */

export interface TabDef<Id extends string> {
  readonly id: Id;
  readonly label: string;
  readonly icon: IconName;
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
          {/* The dot rides the icon, so it reads as "this place" rather than
              floating between two labels. */}
          <span className="tab-g">
            <Icon name={t.icon} size={22} />
            {t.dot && <i className="tab-dot" />}
          </span>
          <span className="tab-l">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
