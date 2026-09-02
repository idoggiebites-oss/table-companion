/*
 * Icons are SVG. No source file draws one with a character.
 *
 * Measured in this codebase before the rule was written: of the 25 codepoints
 * the UI shipped, EIGHT were `Extended_Pictographic`, and U+2728 SPARKLES —
 * the wizard's mark — has `Emoji_Presentation=Yes`, which means colour is the
 * default and the U+FE0E text selector is a hint a platform is free to
 * ignore. A wizard's class card was rendering a colour sparkle on iOS and
 * nothing in CSS could stop it. Seven more were the platform's choice, which
 * is worse than wrong: correct on the machine they were written on.
 *
 * MUST match \p{Extended_Pictographic} and never \p{Emoji} — \p{Emoji}
 * matches all ten digits, `#` and `*`, so the naive version flags every
 * number in an app whose entire subject is numbers, and is then baselined
 * away as noise.
 *
 * What legitimately remains is text and stays text: chevrons, the middot,
 * dashes, and the ✦ / ◇ / − / ✕ family. None of those are pictographic.
 *
 * Imported content is the case this cannot reach — a homebrew statblock may
 * carry an emoji in its name. That is the content author's, and it renders as
 * they wrote it; the app does not police a table's own words.
 *
 * Run: node scripts/check-glyphs.mjs   (also part of `npm run lint`)
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PICTO = /\p{Extended_Pictographic}/u;
const EXT = /\.(ts|tsx|css|html)$/;

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const failures = [];
for (const file of [...walk("src"), "index.html"].filter((f) => EXT.test(f))) {
  const src = readFileSync(file, "utf8");
  [...src].forEach((ch, i) => {
    if (!PICTO.test(ch)) return;
    const line = src.slice(0, i).split("\n").length;
    const cp = ch.codePointAt(0).toString(16).toUpperCase();
    const always = /\p{Emoji_Presentation}/u.test(ch);
    failures.push(
      `${file}:${line} contains ${JSON.stringify(ch)} (U+${cp})` +
      `${always ? " — ALWAYS colour, no selector can stop it" : ""} — icons are SVG, see ui/Icon.tsx`,
    );
  });
}

if (failures.length > 0) {
  console.error(`check-glyphs: ${failures.length} pictographic character(s) in source`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("check-glyphs: no icon is drawn with a character");
