import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The play shell: a pinned header, one scrolling middle, a pinned action bar,
 * and the tab bar under that. Ported from V2, band for band.
 *
 * A DOCUMENT, not a page. This app was a column you scrolled, with the chrome
 * riding along at the top and the tab bar fixed over the bottom of it — which
 * works until the thing you must press is below the fold, and at a table the
 * scroll happens while five people wait.
 *
 * FIVE ROWS ARE DECLARED and five children are always rendered, empty or not.
 * A grid sized for the children it happens to have hands the scroller an
 * `auto` row instead of `1fr` the moment one goes missing, and then the middle
 * stops scrolling and the page grows instead. V2 hit that once; it is why
 * `before` and `below` render as empty divs rather than being conditional.
 *
 * `dvh`, never `vh`: `100vh` on iOS includes browser chrome that is not there.
 */
export function Shell({
  title, lead, trail, before, below, children, counter, pane,
}: {
  title: string;
  /** The left slot. A back chevron, or nothing. */
  lead?: ReactNode;
  /** The right slot. */
  trail?: ReactNode;
  /** Sits under the header and stays pinned with it — a progress rail, a seat. */
  before?: ReactNode;
  /** Pinned below the action bar — the tab bar. */
  below?: ReactNode;
  /** Said above the actions: a count, a limit, what is still needed. */
  counter?: ReactNode;
  /** Names the scrolling middle, for the wide layout and for a suite. */
  pane?: string;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      {/*
        * Equal slots on BOTH sides, always rendered.
        *
        * `flex: 1` on the title centres it in what is LEFT OVER, so a back
        * chevron with no trailing button puts every title half a tap target
        * right of centre — visible on a phone and invisible in every test.
        * The slots are the width the buttons already claim, so an empty one
        * costs nothing that was not already spent.
        */}
      <header className="sh-head">
        <span className="sh-slot">{lead}</span>
        <h2 className="sh-title">{title}</h2>
        <span className="sh-slot sh-end">{trail}</span>
      </header>
      <div className="sh-band">{before}</div>
      <main className="sh-scroll" data-pane={pane}>{children}</main>
      {/*
        * The pinned bar, as a PORTAL TARGET rather than a prop.
        *
        * The control that ends a turn belongs to the screen that knows when it
        * is allowed — whether a DM may advance, whether a rest is available,
        * how many picks are still owed. Passing that up through this component
        * would mean every one of those rules gaining a second home in App, and
        * the two drifting. So the screen keeps its own control and renders it
        * DOWN here with `<Actions>`.
        *
        * Always rendered, never conditional: a footer that appears and
        * disappears changes the grid's row count, and the scroller loses its
        * `1fr` the moment it does. It collapses with `:empty` instead.
        */}
      <footer className="sh-foot" id="sh-actions">
        {counter !== undefined && <div className="sh-counter">{counter}</div>}
      </footer>
      <div className="sh-band">{below}</div>
    </div>
  );
}


/**
 * A screen's own primary controls, rendered into the shell's pinned bar.
 *
 * A portal rather than a prop, so the rule for whether a control is allowed
 * stays in the component that already knows it. `useState` + `useEffect`
 * rather than reading the DOM during render: the target is mounted by the
 * shell in the same commit, so the first render has nothing to portal into
 * and must return null and then re-run.
 */
export function Actions({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.getElementById("sh-actions")); }, []);
  return host === null ? null : createPortal(<div className="sh-acts">{children}</div>, host);
}
