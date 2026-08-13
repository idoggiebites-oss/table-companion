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
