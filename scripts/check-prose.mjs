/*
 * A comment is not a comment where a comment is text.
 *
 * `/* … *\/` at JSX child position is not a comment. It is LITERAL TEXT, and
 * fourteen lines about how the combat screen is arranged shipped onto the
 * combat screen, in a fight, under the initiative order. Nothing failed:
 * TypeScript is happy, the bundle is happy, the page renders. The only reader
 * that could have caught it was a person looking at that screen, and "I looked
 * at it" is not a check.
 *
 * Three browser suites now read their own page for comment punctuation, which
 * is the right check in the wrong place three times over: it costs a browser,
 * it only covers the screens somebody thought to visit, and it can only ever
 * find the ones already shipped.
 *
 * This is the same check where the mistake is made. An earlier attempt to read
 * it out of the source with a regular expression produced a hundred and two
 * false positives, because "is this line inside JSX children" is not a
 * question text can answer. So it is not asked of text: TypeScript parses the
 * file and every JsxText node — the parser's own word for "this renders" — is
 * examined. No heuristics, and nothing to tune.
 *
 * Run: node scripts/check-prose.mjs   (part of `npm run lint`)
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const DIRS = ["src/ui", "src/domain", "worker"];

/** Comment punctuation. Never legitimate visible text in this app. */
const GIVEAWAY = /\/\*|\*\//;

const problems = [];
for (const dir of DIRS) {
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".tsx"))) {
    const path = join(dir, f);
    const text = readFileSync(path, "utf8");
    const src = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const walk = (node) => {
      if (ts.isJsxText(node) && GIVEAWAY.test(node.getText())) {
        const { line } = src.getLineAndCharacterOfPosition(node.getStart());
        const said = node.getText().trim().replace(/\s+/g, " ").slice(0, 60);
        problems.push(`${path}:${line + 1}  ${said}`);
      }
      ts.forEachChild(node, walk);
    };
    walk(src);
  }
}

if (problems.length > 0) {
  console.error(`check-prose: ${problems.length} comment(s) rendering as text\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`
  A comment among JSX children needs the braces: {/* … */}
  Without them it is text, and it is on the page.`);
  process.exitCode = 1;
} else {
  console.log("check-prose: no source comment renders as text");
}
