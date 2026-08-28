/* What the app knows and had never said.

   Three things shipped with the data and were shown nowhere: what a condition
   does, what a class has given you, and what the numbers mean when you are on
   the floor. A first-time player needs all three, and the last one they need
   at the worst possible moment. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "domcontentloaded" });

await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });
await page.waitForTimeout(1200);
await go(page, "sheet");

// --- what a condition does ------------------------------------------------
ok("nothing is explained before anything is wrong",
  await page.locator(".cond").count(), 0);
await page.getByRole("button", { name: "Frightened", exact: true }).click();
await page.waitForTimeout(700);
ok("taking a condition explains it",
  await page.locator(".cond").count(), 1);
const cond = (await page.locator(".cond").innerText()).toLowerCase();
// The most asked question at a table, answered from data shipped since week one.
ok("in the rules' own words",
  cond.includes("disadvantage") && cond.includes("frightened"), true);
await page.getByRole("button", { name: "Frightened", exact: true }).click();
await page.waitForTimeout(500);
ok("and stops when it does", await page.locator(".cond").count(), 0);

// --- what your class gave you ---------------------------------------------
/* Behind a press now. Forty rows of features are not something a player
   should have to scroll past to reach their hit points — but the button says
   what it holds, and one tap opens it. */
ok("features are not in the way", await page.locator(".feat-row").count(), 0);
await page.getByRole("button", { name: /^Features, / }).click();
await page.waitForTimeout(400);
ok("features are listed", await page.locator(".feat-row").count() > 0, true);
const levels = await page.locator(".feat-hd .nm").allInnerTexts();
ok("newest first, because that is what people ask about",
  Number(levels[0].replace(/\D/g, "")) >= Number(levels[levels.length - 1].replace(/\D/g, "")), true);
await page.locator(".feat-hd").first().click();
await page.waitForTimeout(400);
ok("and open to show what they are",
  await page.locator(".feat-list .chip").count() > 0, true);

/* --- and only the ones this character has --------------------------------

   A complete compendium ships every archetype ever written for a class in
   one per-level table. The sample is a Ranger 8 who took Hunter; the table
   she is read from carries 372 feature names by that level, of which about
   two dozen are hers. Counted rather than eyeballed: "the list is shorter"
   is not something a screenshot can tell you. */
/* One level opens at a time — clicking them all in a row leaves exactly one
   open, which is how a count of four looked like the whole list. */
const shown = [];
for (const hd of await page.locator(".feat-hd").all()) {
  // One of them is already open from the assertion above; opening it again
  // closes it, which is how this loop first counted four.
  if ((await hd.getAttribute("aria-expanded")) === "false") await hd.click();
  await page.locator(".feat-list .chip").first().waitFor({ timeout: 5000 });
  shown.push(...(await page.locator(".feat-list .chip").allInnerTexts()));
  await hd.click();
  await page.waitForTimeout(60);
}
// The card counts them itself, in the header, which is the number a person
// reads. Collected names and counted names have to agree.
const counted = Number(
  (await page.locator(".card", { hasText: "Features" })
    .locator(".label.faint").first().innerText()).replace(/\D/g, ""),
);
ok("a Ranger 8 is shown a readable number of features",
  counted > 5 && counted < 40, true);
ok("and the card counts what it shows", shown.length, counted);
console.log(`      ${counted} shown, of 372 the table carries at this level`);
const said = shown.join(" | ");
ok("her own archetype's, by name", /Hunter's Prey/i.test(said), true);
/* The three that made this unreadable: two other archetypes, and an
   archetype that merely ends in the same word as hers. */
ok("not the Gloom Stalker's", /Dread Ambusher|Umbral Sight/i.test(said), false);
ok("not the Beast Master's", /Ranger's Companion/i.test(said), false);
ok("and not the Trophy Hunter's", /Visceral Attack|Trophy/i.test(said), false);
/* Nor the compendium's own scaffolding, which is not a feature of anything. */
ok("nor rows that were never features", /Starting Ranger|Multiclass Ranger/i.test(said), false);
await page.screenshot({ path: `${OUT}/65-guidance.png`, fullPage: true });

// --- what the numbers mean when you are down ------------------------------
await page.locator('input[aria-label="Amount"]').fill("99");
await page.getByRole("button", { name: "Damage", exact: true }).click();
await page.waitForTimeout(700);
ok("being down is explained where it happens",
  await page.locator(".down-help").count(), 1);
const help = (await page.locator(".down-help").innerText()).toLowerCase();
ok("with the rule stated plainly",
  /ten or more/.test(help) && /three successes/.test(help), true);
ok("and the count so far", /you have 0 and 0/.test(help), true);
ok("with the traps named",
  /natural 20/i.test(await page.locator(".down-note").innerText()), true);

await page.getByRole("button", { name: "success", exact: true }).click();
await page.waitForTimeout(500);
ok("the count moves as saves are recorded",
  /you have 1 and 0/.test((await page.locator(".down-help").innerText()).toLowerCase()), true);

for (let i = 0; i < 2; i++) {
  await page.getByRole("button", { name: "success", exact: true }).click();
  await page.waitForTimeout(400);
}
ok("and once stable it says what happens next",
  /stable/i.test(await page.locator(".down-help").innerText()), true);


/* --- every control a thumb can hit ---------------------------------------

   Three times now this app has shipped a control too small to press: the
   background chips at 30px, the feat rows at 39, and the skills table's
   proficiency circle at 18 — the only way to train a skill. Each was found by
   somebody at a table tapping twice and reporting it as a different bug ("I
   tap three to select two", "I tap one feat then another to confirm it").

   So it is measured here rather than remembered. */
const undersized = async (where) => {
  const bad = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, select, input")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.height >= 44) continue;
      out.push(`${(el.className || el.tagName).toString().split(" ")[0]} ${Math.round(r.height)}px`);
    }
    return [...new Set(out)];
  });
  ok(`nothing under 44px on ${where}`, bad, []);
};

await go(page, "sheet");
await undersized("the sheet");
await page.getByRole("button", { name: /^Skills, / }).click();
await page.waitForTimeout(300);
await undersized("the skills drawer");
await go(page, "gear");
await undersized("gear");


/* --- nothing on screen that was meant for the source ---------------------

   A block comment at JSX child position is literal TEXT. A fourteen-line
   note about how the combat screen is arranged shipped straight onto the
   combat screen, mid-fight, and every check passed: the suites measure
   positions and roles, and none of them read the page for prose that should
   not be there.

   The source is the wrong place to catch it — a regex cannot tell markup
   from code without parsing, and the attempt produced a hundred and two
   false positives. The PAGE can: comment punctuation is never legitimate
   visible text here. */
const noSourceOnScreen = async (pg, where) => {
  const stray = await pg.evaluate(() => {
    const t = document.body.innerText;
    const hits = [];
    for (const m of t.matchAll(/\/\*|\*\//g)) {
      hits.push(t.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, " "));
    }
    return [...new Set(hits)];
  });
  /* Joined, not compared as arrays: two empty arrays are not equal under
     the JSON compare this harness uses. */
  ok(`no source comment on ${where}`, stray.join(" | "), "");
};

await noSourceOnScreen(page, "the sheet");

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
