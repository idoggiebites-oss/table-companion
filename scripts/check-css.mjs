/*
 * Guards against the two CSS mistakes that have actually shipped here.
 *
 * 1. COLLISION. `.track` and `.ar` were each claimed by two different
 *    components. Both broke something visually somewhere unrelated, and both
 *    were caught only because a browser assertion happened to compare text.
 *    A top-level class now belongs to exactly one section.
 *
 * 2. MISSING SPACE BEFORE AN INLINE BADGE. Four times now, JSX like
 *    `{name}<span className="badge">…` has rendered "KiraYOURS" — fine
 *    visually because CSS adds a margin, wrong for innerText, copy-paste and
 *    screen readers. Use <Tag>, which carries its own leading space.
 *
 * Run: node scripts/check-css.mjs   (also part of `npm run lint`)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CSS = "src/app.css";
const UI = "src/ui";

/** Everything before the first section marker is the shared design system. */
const SECTION_RE = /^\/\* -+ (.+?) -+ \*\/$/;

/**
 * Sections that own SHARED primitives. Components are expected to scope these
 * inside their own rules (`.rp-out .num`), so a bare claim here is not a
 * collision — it is the point. Anything not listed owns its classes alone.
 */
const SHARED_SECTIONS = new Set([
  "base (shared design system)",
  "shared utilities",
  "chips",
  "pips",
]);

function sections(css) {
  const out = [{ name: "base (shared design system)", lines: [] }];
  for (const line of css.split("\n")) {
    const m = SECTION_RE.exec(line.trim());
    if (m) out.push({ name: m[1], lines: [] });
    else out.at(-1).lines.push(line);
  }
  return out;
}

/**
 * Classes a section CLAIMS, meaning it declares them bare: `.foo {` or
 * `.foo, .bar {`. Two sections claiming the same bare name is the bug — that
 * is exactly how .track and .ar each ended up meaning two different things.
 *
 * Qualified rules are extensions, not claims: `.chip.bad`, `.stat.rollable`,
 * `.six > *` all refine something another section already owns, which is
 * normal and wanted.
 */
function claimedClasses(lines) {
  const found = new Set();
  for (const line of lines) {
    for (const part of line.split(",")) {
      const m = /^\s*\.([A-Za-z][\w-]*)\s*(\{|,|$)/.exec(part);
      if (m) found.add(m[1]);
    }
  }
  return found;
}

/**
 * Classes a section uses as a DESCENDANT, like the `.ar` in `.preview .ar`.
 * These are the victims: a bare `.ar {` claimed elsewhere matches inside
 * .preview too, which is precisely how the rest-preview arrow silently became
 * a grid. Compounds like `.chip.bad` are NOT descendants — they refine the
 * same element and are a normal way to extend a shared class.
 */
function descendantClasses(lines) {
  const found = new Set();
  for (const line of lines) {
    const head = line.split("{")[0];
    if (!head.trim().startsWith(".") && !head.trim().startsWith("#")) continue;
    for (const part of head.split(",")) {
      const bits = part.trim().split(/\s+|>/).filter(Boolean);
      for (const bit of bits.slice(1)) {
        const m = /^\.([A-Za-z][\w-]*)/.exec(bit);
        if (m) found.add(m[1]);
      }
    }
  }
  return found;
}

const problems = [];

const cssText = readFileSync(CSS, "utf8");
const parsed = sections(cssText);
const owner = new Map();
const descendants = new Map();

for (const s of parsed) {
  for (const cls of descendantClasses(s.lines)) {
    if (!descendants.has(cls)) descendants.set(cls, new Set());
    descendants.get(cls).add(s.name);
  }
}

for (const s of parsed) {
  for (const cls of claimedClasses(s.lines)) {
    const existing = owner.get(cls);
    if (existing && existing !== s.name) {
      problems.push(
        `.${cls} is claimed by two sections:\n` +
          `      "${existing}"\n      "${s.name}"\n` +
          `    Rename one — a class belongs to a single component.`,
      );
    } else {
      owner.set(cls, s.name);
    }
    // A bare claim also reaches inside anyone else's scoped rules — unless
    // the class is a shared primitive, which components are meant to scope.
    if (SHARED_SECTIONS.has(s.name)) continue;
    for (const other of descendants.get(cls) ?? []) {
      if (other !== s.name) {
        problems.push(
          `.${cls} is claimed bare by "${s.name}", but "${other}" already\n` +
            `    scopes a .${cls} inside its own rules. The bare rule matches there\n` +
            `    too. Rename the new one.`,
        );
      }
    }
  }
}

/*
 * The badge check.
 *
 * JSX renders a space only when it is TEXT. Whitespace spanning a newline is
 * dropped, and a space inside a JS expression (`{flag && <span/>}`) was never
 * text — so `{name}` above `{flag && <span className="badge"/>}` renders
 * "KiraYOURS". It looks right on screen because the badge has a left margin,
 * and is wrong in innerText, copy-paste and to a screen reader. This has
 * shipped four times.
 *
 * Rendered space comes from an explicit {" "} or a fragment opened with a
 * space: `<> <span …`.
 */

/** A left margin belongs to the LAST class in a selector: `.fr .by` → by. */
const marginLeft = new Set(
  cssText
    .split(/\n(?=\.)/)
    .filter((b) => /margin-left:\s*[1-9]/.test(b))
    .map((b) => {
      const head = /^([^{]+)\{/.exec(b)?.[1] ?? "";
      const classes = head.trim().split(",")[0].trim().split(/[\s>]+/).filter(Boolean);
      return /^\.([A-Za-z][\w-]*)/.exec(classes.at(-1) ?? "")?.[1];
    })
    .filter(Boolean),
);

/** `{expr}` then, on the next line, `{expr <span className="badge">}`. */
const ADJACENT = /\}(\s*\n\s*)\{([^\n]*?)<span className=(?:"|\{`)([\w -]*?)(?:"|`)/g;
/** A badge butted straight onto text or an expression, same line. */
const INLINE = /[}\w]<span className=(?:"|\{`)([\w -]*?)(?:"|`)/g;

const rendersSpace = (between) =>
  between.includes('{" "}') || /<>\s/.test(between);

for (const file of readdirSync(UI).filter((f) => f.endsWith(".tsx"))) {
  const src = readFileSync(join(UI, file), "utf8");
  const flag = (index, cls) => {
    const line = src.slice(0, index).split("\n").length;
    problems.push(
      `${file}:${line} <span className="${cls}"> renders with nothing before it.\n` +
        `    Glued in innerText, copy-paste and to a screen reader.\n` +
        `    Put {" "} before it, or open a fragment with a space: <> <span …`,
    );
  };

  for (const m of src.matchAll(ADJACENT)) {
    if (!m[3].split(/\s+/).some((c) => marginLeft.has(c))) continue;
    if (rendersSpace(m[1] + m[2])) continue;
    flag(m.index, m[3]);
  }
  for (const m of src.matchAll(INLINE)) {
    if (!m[1].split(/\s+/).some((c) => marginLeft.has(c))) continue;
    flag(m.index, m[1]);
  }
}

if (problems.length > 0) {
  console.error(`\ncheck-css: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  process.exit(1);
}
console.log(
  `check-css: ${owner.size} classes claimed across ${parsed.length} sections, no collisions`,
);

/* --- the 44px rule, checked where it is written ------------------------

   Four controls have shipped too small to press: background chips at 30,
   feat rows at 39, the skills table's proficiency circle at 18 (the only way
   to train a skill), and a creature's rename button at 0. Each was found by
   somebody at a table tapping twice and reporting it as a different bug.

   The browser suites measure this, but only on the screens they happen to
   visit — which is how `.cnd-list .cnd` sat at 40 and `.sc-said button` at
   36 without either being noticed. A stylesheet can be read whole, so it is:
   any min-height under 44 has to say why, on the same line, and the reason
   is then in the diff where a reviewer sees it.

   `tap-ok:` is the escape hatch, deliberately ugly. Decorative rings drawn
   inside a full-size hit area are the legitimate case. */
const TAP = 44;
const undersized = [];
cssText.split("\n").forEach((line, i) => {
  const m = /min-height:\s*(\d+(?:\.\d+)?)px/.exec(line);
  if (!m) return;
  if (Number(m[1]) >= TAP) return;
  if (/tap-ok:/.test(line)) return;
  undersized.push(`${i + 1}: ${line.trim()}`);
});
if (undersized.length > 0) {
  console.error(
    `check-css: ${undersized.length} control(s) under ${TAP}px with no "tap-ok:" reason\n` +
      undersized.map((x) => `  ${x}`).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(`check-css: no min-height under ${TAP}px without a stated reason`);
}

/*
 * A custom property that was never defined.
 *
 * CSS fails silently and it fails WHOLE: `border: 1px solid var(--line)` with
 * no --line is not a border in the wrong colour, it is no border at all — the
 * entire shorthand is invalid at computed-value time and falls back to its
 * initial value. Nothing warns. The build succeeds. The page renders.
 *
 * Twenty-four declarations across this stylesheet were doing that, and they
 * had clustered in the newest sections, because a variable invented from
 * memory while writing a new component is exactly how it happens: --line for
 * --rule, --accent for --gold, --sunk for --ground. Three of the seven
 * controls on a creature's row had never had a border, which is a good part
 * of why recent work looked flatter than old work.
 *
 * A fallback — var(--hp, 1) — is a deliberate default and always fine.
 */
function deadVariables(css) {
  const defined = new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
  const bad = [];
  for (const m of css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
    if (!defined.has(m[1])) {
      const line = css.slice(0, m.index).split("\n").length;
      bad.push(`${line}: var(${m[1]}) is never defined — the whole declaration is dropped`);
    }
  }
  return [...new Set(bad)];
}

const dead = deadVariables(readFileSync("src/app.css", "utf8"));
if (dead.length > 0) {
  console.error(`check-css: ${dead.length} declaration(s) using a variable that does not exist\n`);
  for (const d of dead) console.error(`  \u2717 ${d}`);
  console.error("\n  Define it, fix the name, or give it a fallback: var(--x, <value>).");
  process.exitCode = 1;
} else {
  console.log("check-css: every custom property used is defined");
}
