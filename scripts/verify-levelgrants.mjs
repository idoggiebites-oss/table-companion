/* What a level actually gives you.

   The level-up asked for hit points and an improvement and stopped. So a
   character built at 1 reached 3 and was never asked for a subclass, learned
   spells nobody mentioned, and gained features that appeared silently on the
   sheet. Every character meets this; only some multiclass. */
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

// A cleric at 1 — a caster who owes a subclass at 2, spells all the way up.
await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector('select[aria-label="Class"]', { timeout: 20000 });
await page.selectOption('select[aria-label="Class"]', "fighter");
await page.waitForTimeout(600);
for (const s of ["Athletics", "Perception"]) {
  const b = page.getByRole("button", { name: s, exact: true });
  if (await b.count()) await b.first().click();
}
await page.selectOption('select[aria-label="Race"]', "human");
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Recommend" }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "nature", exact: true }).click();
await page.getByRole("button", { name: "animal handling", exact: true }).click();
await page.locator('input[aria-label="Background name"]').fill("Acolyte");
await page.locator('input[aria-label="Character name"]').fill("Bel Ashcroft");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
const cls = page.locator(".card", { hasText: "Your class" }).locator("select");
for (let i = 0; i < (await cls.count()); i++) await cls.nth(i).selectOption({ index: 1 });
const kit = page.locator(".kit select");
for (let i = 0; i < (await kit.count()); i++) await kit.nth(i).selectOption({ index: 1 });
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });

// The DM grants a level.
await page.selectOption('select[aria-label="Seat"]', "dm");
await page.waitForTimeout(600);
await go(page, "party");
await page.getByRole("button", { name: "Milestone" }).click();
await page.waitForTimeout(500);
// Two levels: a fighter is asked for its archetype at 3.
for (let i = 0; i < 2; i++) {
  await page.getByRole("button", { name: "Level the party" }).click();
  await page.waitForTimeout(900);
}
await page.selectOption('select[aria-label="Seat"]', { label: "Bel Ashcroft" });
await page.waitForTimeout(700);
await go(page, "sheet");
await page.getByRole("button", { name: "Resolve it" }).first().click();
await page.waitForTimeout(1200);

// Level 2 is a fighter's Action Surge — a real feature whose name happens to
// carry a parenthetical. A rule that reads every parenthetical as a subclass
// would drop it from the list of what you just gained.
const atTwo = (await page.locator(".lv-gains").innerText()).replace(/\s+/g, " ");
ok("a plain feature keeps its parenthetical rather than being filtered away",
  /action surge/i.test(atTwo), true);

// No choice at 2, so take it and move to 3.
await page.locator(".lv-pad button").first().click();
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "Resolve it" }).first().click();
await page.waitForTimeout(1500);

const card = page.locator(".lv");
const said = (await card.innerText()).replace(/\s+/g, " ");
ok("the level names what it gives you", /you gain/i.test(said), true);
ok("rather than only asking for hit points",
  /roll a d10/i.test(said), true);
/* A compendium class table carries every subclass's features at every level.
   A cleric reaching 2 was told they gained "Channel Divinity (Snack Domain
   (HB))" — somebody else's. Nothing is theirs until they choose it. */
const gains = (await card.locator(".lv-gains").innerText()).replace(/\s+/g, " ");
ok("and names the archetype choice itself", /martial archetype/i.test(gains), true);
ok("but nothing belonging to an archetype they have not chosen",
  /champion|battle master|eldritch knight/i.test(gains), false);
await page.screenshot({ path: `${OUT}/90-level-grants.png`, fullPage: true });

// A cleric owes spells every level; the card has to say so and offer them.
/* The question a fighter is owed at 3, which nothing ever asked. */
ok("the subclass this level opens is asked for",
  await card.locator(".lv-choice").count() > 0, true);
ok("by name", /martial archetype/i.test(said), true);
ok("and the hit-point roll waits until it is answered",
  await card.locator(".lv-pad button").first().isDisabled(), true);

const option = card.locator(".lv-choice .chips button").first();
const chosen = await option.innerText();
await option.click();
await page.waitForTimeout(400);
ok("choosing one unblocks the roll",
  await card.locator(".lv-pad button").first().isDisabled(), false);
await page.screenshot({ path: `${OUT}/91-subclass-at-3.png`, fullPage: true });

await card.locator(".lv-pad button").first().click();
await page.waitForTimeout(1200);
await go(page, "sheet");
const sheet = (await page.locator(".app").innerText()).replace(/\s+/g, " ");
ok("and it reaches the sheet", sheet.toLowerCase().includes(chosen.toLowerCase()), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
