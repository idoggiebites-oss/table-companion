/* What a big creature does between everybody else's turns.

   Legendary actions are the most-forgotten thing on a statblock: three a
   round, spent after somebody ELSE's turn, back at the start of the
   creature's own. 702 of the shipped creatures have them and the app tracked
   none of it. Neither did it track a creature's ordinary action economy —
   players have had one since the beginning, and a DM running six goblins held
   "has that one used its bonus action" in their head, six times, a round.

   The rule this is most likely to get wrong in the other direction is a
   dragon taking a legendary action on its OWN turn, which gives it four
   actions instead of one. So that is asserted too. */
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
const page = await (await browser.newContext({ viewport: { width: 430, height: 1500 } })).newPage();
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
await page.waitForSelector(".seatbar");
await page.selectOption('select[aria-label="Seat"]', "dm");
await page.waitForTimeout(600);

await go("prep");
await page.getByRole("button", { name: "Build" }).first().click();
await page.waitForTimeout(700);
await page.locator('input[aria-label="Add a monster"]').fill("Adult Black Dragon");
await page.waitForTimeout(800);
await page.locator("button.pick").first().click();
await page.waitForTimeout(600);
const keep = page.getByRole("button", { name: /^(Save|Keep|Done)/i }).first();
if (await keep.count()) { await keep.click(); await page.waitForTimeout(700); }

await go("combat");
await page.selectOption('select[aria-label="Drop in an encounter"]', { index: 1 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Roll for initiative" }).click();
await page.waitForTimeout(600);
// The PLAYER goes first, so the dragon's legendary actions are available.
for (let g = 0; g < 10; g++) {
  const inp = page.locator('input[aria-label$="initiative"]').first();
  if (!(await inp.count())) break;
  const who = (await inp.getAttribute("aria-label")).replace(" initiative", "");
  await inp.fill(who.includes("Kira") ? "20" : "5");
  const set = page.getByRole("button", { name: `Set ${who} initiative` });
  if (!(await set.count())) break;
  await set.click();
  await page.waitForTimeout(180);
}
await page.getByRole("button", { name: "Begin", exact: true }).click();
await page.waitForTimeout(1000);
ok("the player is up, so the dragon may act between turns",
  await page.locator(".cbt.on .nm").first().innerText(), "Kira Vance");

/* --- a creature's own action economy ------------------------------------ */
ok("a creature carries its own action economy now",
  await page.getByRole("button", { name: /^Adult Black Dragon action$/ }).count(), 1);
await page.getByRole("button", { name: /^Adult Black Dragon bonus action$/ }).click();
await page.waitForTimeout(500);
ok("and spending one shows it as spent",
  await page.getByRole("button", { name: /^Adult Black Dragon bonus action, spent$/ }).count(), 1);
/* A mis-tap mid-fight needs one press back, not a conversation. */
await page.getByRole("button", { name: /^Adult Black Dragon bonus action, spent$/ }).click();
await page.waitForTimeout(400);
ok("and tapping again takes it back",
  await page.getByRole("button", { name: /^Adult Black Dragon bonus action$/ }).count(), 1);

/* --- legendary actions --------------------------------------------------- */
const leg = page.locator(".legend").first();
ok("the dragon's legendary actions are on screen", await leg.count(), 1);
/* The SRD ships the options and strips the "(3/Turn)" heading, so this one
   arrives with things to do and no budget. Inventing three would be the app
   making up a rule — it asks instead, once. */
const head = (await leg.locator(".legend-hd").first().innerText()).replace(/\s+/g, " ");
ok("and says so when the book did not state a budget",
  /how many a round/i.test(head), true);
await leg.locator('input[aria-label^="How many legendary actions"]').fill("3");
await page.waitForTimeout(700);
ok("which the DM states once, and it sticks",
  /3 of 3 left/i.test((await leg.locator(".legend-hd").first().innerText()).replace(/\s+/g, " ")), true);
/* Read off the statblock, costs and all — Wing Attack costs two. */
const names = await leg.locator(".menu-hd .nm").allInnerTexts();
ok("and the options it actually has",
  names.map((n) => n.toLowerCase()).sort(),
  ["detect", "tail attack", "wing attack"]);
ok("with what each costs",
  (await leg.locator(".menu-hd .cost").allInnerTexts()).map((t) => t.toLowerCase()),
  ["1 action", "1 action", "2 actions"]);

await leg.getByRole("button", { name: "Wing Attack, legendary" }).click();
await page.waitForTimeout(300);
await leg.getByRole("button", { name: "Take Wing Attack" }).click();
await page.waitForTimeout(700);
ok("taking one that costs two spends two",
  /1 of 3 left/i.test((await leg.locator(".legend-hd").first().innerText()).replace(/\s+/g, " ")), true);

/* And what is left is enforced: one action remains, Wing Attack costs two. */
await leg.getByRole("button", { name: "Wing Attack, legendary" }).click();
await page.waitForTimeout(300);
ok("and one it can no longer afford is refused rather than silently allowed",
  await leg.getByRole("button", { name: "Take Wing Attack" }).isDisabled(), true);
await leg.getByRole("button", { name: "Wing Attack, legendary" }).click();
await page.waitForTimeout(200);

/* --- the lair ------------------------------------------------------------

   The SRD's dragon carries no lair entry either, so there is nothing to show
   — and showing one anyway would be the app inventing a place. The lair line
   appears for the creatures whose statblock states one. */
ok("no lair line for a statblock that does not describe one",
  await page.locator(".legend.lair").count(), 0);

/* --- the mistake this must not cause ------------------------------------- */
await page.getByRole("button", { name: "Next turn" }).click();
await page.waitForTimeout(900);
ok("it is the dragon's turn now",
  /dragon/i.test(await page.locator(".cbt.on .nm").first().innerText()), true);
/* A dragon that legendary-acts on its own turn takes four actions instead of
   one. Offering it is what causes that, so it is not offered. */
ok("on its own turn its legendary actions are not offered",
  await page.locator(".legend").filter({ hasText: "legendary" }).count(), 0);
/* And they come back at the START of its turn, which is the rule. */
await page.getByRole("button", { name: "Next turn" }).click();
await page.waitForTimeout(900);
ok("and by the next round they are back",
  /3 of 3 left/i.test((await page.locator(".legend").first().locator(".legend-hd").first().innerText()).replace(/\s+/g, " ")), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
await browser.close();
