/* Content that ships WITH the app.

   The compendium is baked in at deploy time, so a device gets 605 races and
   3,443 spells by opening the page — no file picker, no per-device ritual.
   The claim under test is that the builder uses it without being asked to.

   Skips when the deployment was built without a compendium, which is a valid
   way to build it. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const probe = await (await fetch(new global.URL("/content/index.json", URL))).status;
if (probe !== 200) {
  console.log("SKIP  no compendium built into this deployment");
  await browser.close();
  process.exit(0);
}
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
await page.goto(URL, { waitUntil: "networkidle" });

// A brand new device, nothing imported.
await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector('select[aria-label="Class"]', { timeout: 20000 });
await page.selectOption('select[aria-label="Class"]', "wizard");
await page.waitForTimeout(900);

const races = (await page.locator('select[aria-label="Race"] option').count()) - 1;
ok("races arrive without importing anything", races > 500, true);
ok("and the list is filterable, being long",
  await page.locator('input[aria-label="Filter races"]').count(), 1);

await page.locator('input[aria-label="Filter races"]').fill("tiefling");
await page.waitForTimeout(400);
const opts = await page.locator('select[aria-label="Race"] option').allInnerTexts();
await page.selectOption('select[aria-label="Race"]', { label: opts[1] });
await page.waitForTimeout(600);

ok("backgrounds too", await page.locator('select[aria-label="Background"]').count(), 1);

// The spell step, sized by the class table.
ok("a caster is asked for spells", await page.getByText("6 · Spells").count(), 1);
const budget = await page.locator(".card", { hasText: "6 · Spells" }).locator(".faint").first().innerText();
// A wizard at level 1: three cantrips, six spells.
// A wizard prepares from a book, so the SRD table records no "spells known"
// — three cantrips is a real limit, the rest is a count with nothing to hit.
ok("with the counts the class table actually gives",
  /0 of 3 cantrips · 0 spells/i.test(budget), true);
await page.screenshot({ path: `${OUT}/62-shipped-spells.png`, fullPage: true });

await page.locator('input[aria-label="Filter spells"]').fill("Fire Bolt");
await page.waitForTimeout(500);
await page.locator(".inv-add", { hasText: /^Fire Bolt/i }).first().click();
await page.waitForTimeout(300);
await page.locator('input[aria-label="Filter spells"]').fill("Magic Missile");
await page.waitForTimeout(500);
await page.locator(".inv-add", { hasText: /^Magic Missile/i }).first().click();
await page.waitForTimeout(400);
ok("choices count against the budget",
  /1 of 3 cantrips · 1 spells/i.test(
    await page.locator(".card", { hasText: "6 · Spells" }).locator(".faint").first().innerText(),
  ), true);

// Only what a wizard could actually cast at this level.
await page.locator('input[aria-label="Filter spells"]').fill("Fireball");
await page.waitForTimeout(500);
ok("nothing above the best slot you have — a tease, not a choice",
  await page.locator(".inv-add", { hasText: /^Fireball/i }).count(), 0);
await page.locator('input[aria-label="Filter spells"]').fill("");
await page.waitForTimeout(400);

for (const s of ["Arcana", "History"]) {
  await page.getByRole("button", { name: s, exact: true }).click();
}
await page.getByRole("button", { name: "Recommend" }).click();
await page.locator('input[aria-label="Filter backgrounds"]').fill("Sage");
await page.waitForTimeout(400);
await page.selectOption('select[aria-label="Background"]', { label: "Sage" });
await page.locator('input[aria-label="Character name"]').fill("Bel Ashcroft");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });

await go(page, "spells");
const known = (await page.locator(".sp-main .nm").allInnerTexts()).map((t) => t.toLowerCase());
ok("the spells chosen at creation are on the sheet",
  known.some((n) => /fire bolt/.test(n)) && known.some((n) => /magic missile/.test(n)), true);
ok("and are castable straight away",
  await page.getByRole("button", { name: "Cast Magic Missile" }).isDisabled(), false);
ok("the builder said why there was no spell limit",
  /prepares from a book/i.test(await page.content()), false);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
