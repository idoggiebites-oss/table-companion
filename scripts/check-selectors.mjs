/*
 * Guards the browser suites against selectors that can match two things.
 *
 * SubclassPick was given the feat picker's classes because it wanted the same
 * look. Nothing in the app broke. What broke was `page.locator(".feat-pick")`
 * in the FEATS' suite, which silently started measuring the subclass list and
 * reported four failures a long way from the cause.
 *
 * check-css cannot see that: it only knows classes a stylesheet section
 * CLAIMS, and borrowing happens in JSX. So the check belongs here, where the
 * harm is — a suite reaching for a class that more than one component wears
 * is a suite that will one day measure the wrong one.
 *
 * Two ways out of a flag, both fine:
 *   - give the component its own class (what SubclassPick should have done)
 *   - drive the element by role and name instead, which is what most of these
 *     suites already do and what does not move when markup does
 *
 * Run: node scripts/check-selectors.mjs   (part of `npm run lint`)
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UI = "src/ui";
const SCRIPTS = "scripts";

/*
 * Classes a component wears, read from its JSX. Template literals are split
 * on the punctuation that surrounds interpolation, so `${on ? " on" : ""}`
 * contributes `on` and nothing else — which is right: a suite selecting `.on`
 * is exactly as ambiguous as one selecting `.feat-pick`.
 */
function wornClasses() {
  const worn = new Map();
  for (const file of readdirSync(UI).filter((f) => f.endsWith(".tsx"))) {
    const src = readFileSync(join(UI, file), "utf8");
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      for (const raw of (m[1] ?? m[2] ?? "").split(/[\s${}?:'"+()!.&|]+/)) {
        const name = raw.trim();
        if (!/^[a-z][\w-]*$/.test(name)) continue;
        if (!worn.has(name)) worn.set(name, new Set());
        worn.get(name).add(file);
      }
    }
  }
  return worn;
}

/*
 * Shared shapes, worn on purpose by many components. Selecting one of these
 * is ambiguous by nature and the suites know it — they scope them. Listing
 * them here rather than inferring, because "shared" is a decision somebody
 * made and not a thing to guess from counts.
 */
const SHARED = new Set([
  "card", "card-hd", "card-body", "row", "label", "faint", "num", "chip",
  "chips", "on", "menu", "menu-row", "menu-hd", "menu-more", "menu-take",
  "nm", "cost", "then", "what", "controls", "pool", "seg", "err", "linky",
  "inv-row", "inv-add", "tgt-row", "swing-step", "fld", "pop-text", "selectable",
]);

const worn = wornClasses();
const problems = [];

/*
 * What a suite chained its selector ONTO.
 *
 * `.sub-book .menu-hd` is scoped by its first part, and this check always
 * knew that. `card.locator(".menu-hd")` is the same scoping written with a
 * dot instead of a space, and it did not — so seventeen of the forty-three it
 * recorded were suites that had already done the thing it was asking for.
 * A check that is wrong two times in five is one nobody works through, which
 * is exactly what a baseline "meant to shrink" then does not do.
 *
 * Scoped means: chained onto a call — `page.getByRole(…).locator(".v")` — or
 * onto a variable holding a locator. Everything else is the page itself,
 * where `.v` really can match any of the seven things wearing it.
 */
const LOCATORY = /\.locator\(|getBy(?:Role|Text|Label|TestId)\(|\.filter\(|\.first\(\)|\.last\(\)|\.nth\(/;

function locatorVars(src) {
  const held = new Set();
  for (const m of src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*)/g)) {
    if (LOCATORY.test(m[2])) held.add(m[1]);
  }
  return held;
}

for (const file of readdirSync(SCRIPTS).filter((f) => /^verify.*\.mjs$/.test(f))) {
  const src = readFileSync(join(SCRIPTS, file), "utf8");
  const seen = new Set();
  const held = locatorVars(src);
  for (const m of src.matchAll(/([A-Za-z_$][\w$.]*|\))\s*\.locator\(\s*["'`]\.([a-z][\w-]*)["'`]/g)) {
    const [recv, cls] = [m[1], m[2]];
    if (SHARED.has(cls) || seen.has(cls)) continue;
    // `foo.bar.locator(…)`: either end of the path may be the locator.
    const parts = recv.split(".");
    if (recv === ")" || held.has(parts[0]) || held.has(parts[parts.length - 1])) continue;
    seen.add(cls);
    const files = worn.get(cls);
    if (files && files.size > 1) {
      problems.push(
        `${file} selects ".${cls}", which ${files.size} components wear:\n` +
          `    ${[...files].sort().join(", ")}\n` +
          `    It will match whichever renders first. Give one its own class,\n` +
          `    or drive it by role and name instead.`,
      );
    }
  }
}

/*
 * A baseline, not a wall.
 *
 * There are 43 of these today — `.v` is worn by seven components and
 * `.swing-ask` by six — and that number IS the finding: it is why changing
 * one dropdown to a list cost thirty suite edits. Failing on all of them
 * would block every commit until a day-long cleanup, which is how a useful
 * check gets deleted.
 *
 * So the known ones are recorded and the NEXT one fails. The baseline is
 * meant to shrink: when a suite is rewritten to drive by role and name, its
 * lines come out of the file and can never come back unnoticed.
 */
const BASELINE = "scripts/selector-baseline.txt";
const keys = problems.map((p) => p.split("\n")[0]).sort();

let known = [];
try {
  known = readFileSync(BASELINE, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
} catch {
  // No baseline yet: the next block writes one.
}

if (process.argv.includes("--bless")) {
  writeFileSync(BASELINE, `${keys.join("\n")}\n`);
  console.log(`check-selectors: baseline written with ${keys.length} known`);
} else {
  const fresh = keys.filter((k) => !known.includes(k));
  const fixed = known.filter((k) => !keys.includes(k));
  if (fresh.length > 0) {
    console.error(`check-selectors: ${fresh.length} NEW ambiguous selector(s)\n`);
    for (const p of problems) {
      if (fresh.includes(p.split("\n")[0])) console.error(`  ✗ ${p}\n`);
    }
    console.error("  Give the component its own class, or drive it by role and name.");
    console.error("  If it is genuinely fine: node scripts/check-selectors.mjs --bless");
    process.exitCode = 1;
  } else {
    console.log(
      `check-selectors: ${keys.length} known, none new` +
        (fixed.length > 0
          ? ` — and ${fixed.length} fewer than the baseline, so re-bless it`
          : ""),
    );
  }
}
