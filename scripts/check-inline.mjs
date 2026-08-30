/*
 * Stops the type and spacing scales from dissolving back into inline styles.
 *
 * The app had 262 of them. Eighty-two were a hand-picked `fontSize` and ninety
 * a hand-picked `marginTop` — which is how a stylesheet ends up with 0.94,
 * 0.95, 0.96 and 0.98rem all in use at once, three of them within a third of a
 * pixel on the same screen. Nothing was broken by any single one. What they add
 * up to is a screen where nothing lines up with anything and no one can say
 * why, which is the difference between the app and a mockup of it.
 *
 * So: a literal size or margin in JSX is refused, and the scale classes are
 * where those decisions live. Computed values are fine and always were — a bar
 * that is `width: ${pct}%` is doing something a class cannot.
 *
 * Run: node scripts/check-inline.mjs   (part of `npm run lint`)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const UI = "src/ui";
/* Only the two that had gone feral. Padding and gap are still inline in a few
   places and are not yet worth a rule — this check earns its keep by holding
   the ground just taken, not by being comprehensive. */
const BANNED = /\b(fontSize|marginTop|marginBottom|margin)\s*:\s*(["'.]|\d)/;

const problems = [];
for (const file of readdirSync(UI).filter((f) => f.endsWith(".tsx"))) {
  const lines = readFileSync(join(UI, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!line.includes("style={{")) return;
    const m = BANNED.exec(line);
    if (m) problems.push(`${file}:${i + 1}  ${m[1]} — ${line.trim().slice(0, 72)}`);
  });
}

if (problems.length > 0) {
  console.error(`check-inline: ${problems.length} inline size/margin in JSX\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`
  Use the scales instead:
    text    .note (0.84rem prose)  .aside (0.8rem inline)
    space   .mt-0 .mt-1 .mt-2 .mt-3 .mt-4   (0 6 8 12 16)
            .mb-0 .mb-1 .mb-2 .mb-3 .mb-4
  If a value must be computed at runtime, put it in a CSS custom property.`);
  process.exitCode = 1;
} else {
  console.log("check-inline: no literal sizes or margins in JSX");
}
