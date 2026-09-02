import { useCallback, useEffect, useState } from "react";

/**
 * Which of the two themes this device is showing, and how to swap it.
 *
 * Ported from V2. Device-local by definition: a theme is a fact about a
 * phone, not about the campaign, so it never becomes an Event and never
 * reaches another device. `localStorage` rather than the log, for the same
 * reason the seat lives there.
 *
 * THREE states, not two. "system" is the default and is the ABSENCE of a
 * `data-theme` attribute, which is exactly what app.css is written for: a
 * bare `:root` for light, a `prefers-color-scheme: dark` block guarded by
 * `:not([data-theme="light"])`, and a `[data-theme="dark"]` block so an
 * explicit choice wins in both directions.
 *
 * Getting this wrong is invisible until somebody holds the phone. In V2 the
 * state began as a hardcoded `"light"` while the stylesheet followed the
 * system, so on a phone in dark mode the app rendered DARK and the toggle
 * believed it was light — the first press set what was already set, and the
 * button appeared to do nothing at all. Resolve the CURRENT theme from
 * matchMedia; never assume it.
 */
export type Theme = "light" | "dark" | "system";

const KEY = "theme";

const stored = (): Theme => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    /* Private mode, or storage denied. A theme is not worth failing over. */
    return "system";
  }
};

const systemDark = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

/** The ground, so the browser's own chrome matches the page under it. */
const GROUND = { light: "#faf7f2", dark: "#131416" } as const;

/**
 * index.html ships two `theme-color` tags with `media` attributes, which is
 * right while nothing has been chosen and wrong the moment something is: a
 * media query cannot know about `data-theme`. So an explicit choice drops
 * both and leaves one plain tag saying what is actually on screen.
 */
function paintChrome(showing: "light" | "dark", explicit: boolean) {
  const head = document.head;
  const all = [...head.querySelectorAll('meta[name="theme-color"]')];
  if (!explicit) {
    /* Restore the pair. Cheap, and it only runs on a return to "system". */
    if (all.length === 2 && all.every((m) => m.hasAttribute("media"))) return;
    for (const m of all) m.remove();
    for (const [k, v] of Object.entries(GROUND)) {
      const m = document.createElement("meta");
      m.setAttribute("name", "theme-color");
      m.setAttribute("content", v);
      m.setAttribute("media", `(prefers-color-scheme: ${k})`);
      head.append(m);
    }
    return;
  }
  for (const m of all.slice(1)) m.remove();
  const one = all[0] ?? head.appendChild(document.createElement("meta"));
  one.setAttribute("name", "theme-color");
  one.removeAttribute("media");
  one.setAttribute("content", GROUND[showing]);
}

export function useTheme(): {
  /** What the screen is actually showing, which is what a label must name. */
  readonly showing: "light" | "dark";
  readonly choice: Theme;
  /** Swap to the opposite of what is on screen, and remember it. */
  readonly flip: () => void;
  /** Back to following the phone. */
  readonly follow: () => void;
} {
  const [choice, setChoice] = useState<Theme>(stored);
  const [dark, setDark] = useState(systemDark);

  /* Follow the system while nothing has been chosen, so the label stays true
     when the phone turns itself dark at sunset. */
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const q = matchMedia("(prefers-color-scheme: dark)");
    const on = () => setDark(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);

  const showing = choice === "system" ? (dark ? "dark" : "light") : choice;

  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
    paintChrome(showing, choice !== "system");
  }, [choice, showing]);

  const remember = useCallback((next: Theme) => {
    setChoice(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch { /* see `stored` */ }
  }, []);

  const flip = useCallback(
    () => remember(showing === "light" ? "dark" : "light"),
    [remember, showing],
  );
  const follow = useCallback(() => remember("system"), [remember]);

  return { showing, choice, flip, follow };
}
