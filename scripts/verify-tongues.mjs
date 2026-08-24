/* Languages and tool proficiencies.

   The builder asked for skills, saves, spells, feats and gear, then produced
   a character who spoke nothing and could use nothing. The data was in the
   compendium the whole time — 603 of 605 races carry a Languages trait and
   every class states its tools — and it was read past. */
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
  await page.waitForTimeout(300);
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

// A rogue: the one core class whose tool line names something outright.
await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector(".klass-cards", { timeout: 20000 });
await page.getByRole("button", { name: "Rogue", exact: true }).click();
await page.waitForTimeout(500);
for (const s of ["Stealth", "Perception", "Acrobatics", "Deception"]) {
  const b = page.getByRole("button", { name: s, exact: true });
  if (await b.count()) await b.first().click();
}
await page.selectOption('select[aria-label="Race"]', "dwarf");
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Recommend" }).click();
await page.waitForTimeout(500);

const card = page.locator(".card", { hasText: "Languages & tools" }).first();
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
const said = (await card.innerText()).replace(/\s+/g, " ");

ok("the race's own languages are stated, not asked for",
  /dwarf gives you common, dwarvish/i.test(said), true);
ok("and the class's tools with them",
  /thieves' tools/i.test(said), true);
ok("neither is offered as a choice — you already have them",
  await card.getByRole("button", { name: "Speak Dwarvish" }).count(), 0);
ok("what is left to choose is a background's two",
  (await card.locator(".card-hd .faint").innerText()).trim(), "0 of 2");
await page.screenshot({ path: `${OUT}/80-tongues.png`, fullPage: true });

// The tool list is the compendium's, not one somebody typed out.
const tools = await card.locator('.chips button[aria-label^="Use "]').allInnerTexts();
ok("tools come from the item catalogue", tools.length > 30, true);
ok("and are the mundane ones, not treasure",
  tools.some((t) => /Herbalism Kit/i.test(t)) && !tools.some((t) => /legendary/i.test(t)), true);

await card.getByRole("button", { name: "Speak Elvish" }).click();
await card.getByRole("button", { name: "Use Herbalism Kit" }).click();
await page.waitForTimeout(300);
ok("two picks fills the background's allowance",
  (await card.locator(".card-hd .faint").innerText()).trim(), "2 of 2");
ok("and a third is refused rather than silently ignored",
  await card.getByRole("button", { name: "Speak Orc" }).isDisabled(), true);

// Finish, and see it on the sheet.
await page.getByRole("button", { name: "nature", exact: true }).click();
await page.getByRole("button", { name: "animal handling", exact: true }).click();
await page.locator('input[aria-label="Background name"]').fill("Guild thief");
await page.locator('input[aria-label="Character name"]').fill("Bel Ashcroft");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
const cls = page.locator(".card", { hasText: "Your class" }).locator("select");
for (let i = 0; i < (await cls.count()); i++) await cls.nth(i).selectOption({ index: 1 });
const kit = page.locator(".kit select");
for (let i = 0; i < (await kit.count()); i++) await kit.nth(i).selectOption({ index: 1 });
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".hp-big", { timeout: 20000 });
await go(page, "sheet");

const sheet = page.locator(".card", { hasText: "Languages & tools" }).first();
await sheet.scrollIntoViewIfNeeded();
const shown = (await sheet.innerText()).replace(/\s+/g, " ");
ok("the sheet says what they speak", /common, dwarvish, elvish/i.test(shown), true);
ok("and what they can use", /thieves' tools, herbalism kit/i.test(shown), true);
ok("with Common listed once, though two sources gave it",
  (shown.match(/common/gi) ?? []).length, 1);
await page.screenshot({ path: `${OUT}/81-tongues-sheet.png`, fullPage: true });


// --- who they are ---------------------------------------------------------
// The builder asked for every number a character has and never once asked
// this. It is the difference between a build and somebody's character.
console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
