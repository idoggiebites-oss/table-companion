/*
 * Every colour pair the design puts on screen, measured.
 *
 * Ported from V2, with the pair table extended for the ground this app
 * actually uses. V2 checks its tokens against `--canvas` and `--surface-1`;
 * V1 puts EVERY button and EVERY input on `--surface-2`, so a token that
 * passes in V2 can still be unreadable here. Five of V2's light values were
 * under the floor on that surface when they arrived and were nudged until
 * they passed — this is the check that found them, and the one that keeps
 * the next one honest.
 *
 * Also asserts the two copies of the dark block are identical. CSS has no way
 * to write it once, and a toggle that works while system-dark does not is the
 * classic way a themed stylesheet rots.
 *
 * Run: node scripts/check-contrast.mjs   (also part of `npm run lint`)
 */
import { readFileSync } from "node:fs";

const CSS = "src/app.css";

const hex = (h) => { h = h.trim().replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (h) => { const [r, g, b] = hex(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/*
 * Body text targets 4.5:1. Non-text indicators that carry meaning — a border
 * marking the active row, a bar fill — target 3:1. Anything below the second
 * number is not a style choice, it is a thing somebody cannot see.
 *
 * `--surface-2` is in every row because it is this app's button and field
 * ground, and `--gold-wash` because it is the ground under anything chosen.
 */
const GROUNDS = ["--canvas", "--surface-1", "--surface-2"];
const PAIRS = [
  ...["--ink", "--ink-dim", "--gold-ink", "--damage", "--heal", "--injured",
      "--bloodied", "--concentration", "--steel"]
    .flatMap((fg) => GROUNDS.map((bg) => [fg, bg, 4.5])),
  ...GROUNDS.map((bg) => ["--gold-edge", bg, 3.0]),
  /* The dimmest tier is a placeholder and a disabled control: seen, never
     read, so it answers to the non-text floor rather than the text one. */
  ...GROUNDS.map((bg) => ["--ink-faint", bg, 3.0]),
  ["--on-gold", "--gold-fill", 4.5],
  ["--ink", "--gold-wash", 4.5],
  ["--gold-ink", "--gold-wash", 4.5],
];

/** The declarations of one `{ … }` block, by selector, in source order. */
function blocks(css) {
  const out = [];
  /* `{` as well as `}` as the anchor: the dark block that matters most
     sits INSIDE `@media (…) {`, so the character before its selector is
     an opening brace and an anchor of `}` alone never finds it. */
  const re = /(^|[{}])\s*([^{}@]+?)\s*\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const decls = {};
    for (const d of m[3].split(";")) {
      const i = d.indexOf(":");
      if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
    out.push({ selector: m[2].trim(), decls, at: m.index });
  }
  return out;
}

/*
 * Comments first. This file opens with forty lines of prose containing
 * braces, colons and the very attribute selectors being looked for, and a
 * parser that reads them finds a `:root` block with no declarations in it.
 */
const css = readFileSync(CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const all = blocks(css);
const failures = [];

/* Light is every bare `:root` block merged, in source order. */
const light = {};
for (const b of all) if (b.selector === ":root") Object.assign(light, b.decls);

const byToggle = all.find((b) => b.selector === ':root[data-theme="dark"]');
const byMedia = all.find((b) => b.selector === ':root:not([data-theme="light"])');
if (!byToggle) failures.push('no `:root[data-theme="dark"]` block');
if (!byMedia) failures.push('no `:root:not([data-theme="light"])` block');

if (byToggle && byMedia) {
  const keys = [...new Set([...Object.keys(byToggle.decls), ...Object.keys(byMedia.decls)])];
  for (const k of keys.sort()) {
    const a = byMedia.decls[k], b = byToggle.decls[k];
    if (a !== b) {
      failures.push(
        `the two dark blocks disagree on ${k}: ` +
        `${a ?? "(absent under prefers-color-scheme)"} vs ${b ?? "(absent under data-theme)"}`,
      );
    }
  }
}

const dark = { ...light, ...(byToggle?.decls ?? {}) };

for (const [name, set] of [["light", light], ["dark", dark]]) {
  for (const [fg, bg, min] of PAIRS) {
    const a = set[fg], b = set[bg];
    if (!a || !b) { failures.push(`${name}: ${fg} on ${bg} — token not defined`); continue; }
    if (!a.startsWith("#") || !b.startsWith("#")) continue;
    const r = ratio(a, b);
    if (r < min) {
      failures.push(`${name}: ${fg} ${a} on ${bg} ${b} is ${r.toFixed(2)}:1, needs ${min}:1`);
    }
  }
}

if (failures.length) {
  console.error("check-contrast FAILED");
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`check-contrast: ${PAIRS.length * 2} pairs measured across both themes, all pass`);
