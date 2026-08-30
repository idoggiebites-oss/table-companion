/* A breath weapon is not an attack roll.

   "Each creature in that line must make a DC 18 Dexterity saving throw,
   taking 54 (12d8) acid damage on a failed save, or half as much damage on a
   successful one" has no to-hit in it at all — and tapping it opened the
   swing walkthrough anyway, because tapping an action led there whatever the
   action was. Four thousand of the twenty thousand actions in the compendium
   ask for a save; 2,665 ask for nothing else.

   What the app supplies is the number, the ability and what a success costs.
   Where the line falls and who is in it belongs to the table — law four. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });
const go = async (tab) => {
  const t = page.locator(`[data-tab="${tab}"]`);
  if (await t.count()) { await t.first().click(); await page.waitForTimeout(400); }
};

await page.getByRole("button", { name: "Start a room" }).click();
await page.waitForSelector(".rb-code");
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector('select[aria-label="Seat"], .join-row');
await page.selectOption('select[aria-label="Seat"]', "dm");
await page.waitForTimeout(600);

// A dragon, so the fight has something with a breath weapon in it.
await go("prep");
await page.getByRole("button", { name: "Build" }).first().click();
await page.waitForTimeout(700);
await page.locator('input[aria-label="Add a monster"]').fill("Adult Black Dragon");
await page.waitForTimeout(800);
await page.locator("button.pick").first().click();
await page.waitForTimeout(600);
const save = page.getByRole("button", { name: /^(Save|Keep|Done)/i }).first();
if (await save.count()) { await save.click(); await page.waitForTimeout(700); }

await go("combat");
await page.selectOption('select[aria-label="Drop in an encounter"]', { index: 1 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Roll for initiative" }).click();
await page.waitForTimeout(600);
for (let g = 0; g < 10; g++) {
  const inp = page.locator('input[aria-label$="initiative"]').first();
  if (!(await inp.count())) break;
  const who = (await inp.getAttribute("aria-label")).replace(" initiative", "");
  await inp.fill(who.includes("Kira") ? "3" : "20");
  const set = page.getByRole("button", { name: `Set ${who} initiative` });
  if (!(await set.count())) break;
  await set.click();
  await page.waitForTimeout(180);
}
await page.getByRole("button", { name: "Begin", exact: true }).click();
await page.waitForTimeout(900);
ok("the dragon is up", /dragon/i.test(await page.locator(".cbt.on .nm").first().innerText()), true);

/* Its whole statblock is on screen — that is the statblock work. What
   matters here is what happens when the DM taps the breath weapon. */
/* The statblock folds away on a phone — open by default only where there is
   room for it. Open it, the way a DM on a phone would. */
const hd = page.locator(".sb-turn-hd");
if (await hd.count() && (await hd.getAttribute("aria-expanded")) === "false") {
  await hd.click();
  await page.waitForTimeout(500);
}
const breath = page.getByRole("button", { name: /^Use Acid Breath/ });
ok("its breath weapon is tappable", await breath.count(), 1);
await breath.click();
await page.waitForTimeout(700);

/* Not the swing: there is no attack roll in a breath weapon, and offering
   one is the app inventing a rule. */
ok("tapping it does not ask for an attack roll",
  await page.locator(".swing").count(), 0);
ok("it opens the tool that asks who was caught",
  await page.locator(".area").count(), 1);

const said = (await page.locator(".area-from").innerText()).replace(/\s+/g, " ");
ok("naming the save the book asks for", /DC 18 DEX/i.test(said), true);
ok("and what a success costs", /half on a save/i.test(said), true);
/* Read off the creature's own action rather than typed by the DM. */
ok("with the damage filled in", await page.locator('input[aria-label="Area damage amount"]').inputValue(), "54");
ok("and the damage type", await page.locator('input[aria-label="Area damage type"]').inputValue(), "acid");
/* Named after the action, so the log reads as what happened rather than as
   "area damage". Matched loosely: whether the compendium carries the recharge
   in the name is not what this is about. */
ok("and the name, so the log reads as what happened",
  /^Acid Breath/.test(await page.locator('input[aria-label="Effect name"]').inputValue()), true);

/* An ordinary attack still goes to the swing. A save that applied everywhere
   would be the same bug in the other direction. */
await page.getByRole("button", { name: /^Close|^Never mind|^Cancel/ }).first().click().catch(() => {});
await page.waitForTimeout(500);
const bite = page.getByRole("button", { name: /^Use Bite/ });
if (await bite.count()) {
  await bite.click();
  await page.waitForTimeout(600);
  ok("an attack with a to-hit still asks for one",
    await page.locator(".area").count(), 0);
}

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
await browser.close();
