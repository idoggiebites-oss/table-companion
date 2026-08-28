/* An opportunity attack is at the thing that provoked it.

   The DM offers a reaction — "the ogre is leaving your reach" — and the swing
   that answered it listed every creature on the board. That is not a choice
   the rules give you: you do not get to swing at whoever you like because
   somebody else walked away. The offer carried the provoker's NAME and not
   its id, so the aiming step had nothing to narrow by and left the rule to
   the table.

   Three creatures on the board on purpose, so "only one is offered" is a
   claim about aiming rather than about there being one thing to hit. */
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
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1300 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}
const go = async (page, tab) => {
  const t = page.locator(`[data-tab="${tab}"]`);
  if (await t.count()) { await t.first().click(); await page.waitForTimeout(400); }
};

const dm = await device("dm");
await dm.getByRole("button", { name: "Start a room" }).click();
await dm.waitForSelector(".rb-code");
const code = await dm.locator(".rb-code").innerText();
await dm.getByRole("button", { name: "Load sample" }).click();
await dm.waitForSelector(".seatbar");
await dm.selectOption('select[aria-label="Seat"]', "dm");
await dm.waitForTimeout(600);

const player = await device("player");
await player.locator('input[aria-label="Room code"]').fill(code);
await player.getByRole("button", { name: "Join", exact: true }).click();
await player.waitForSelector(".seatbar", { timeout: 20000 });
const join = player.locator(".join-row", { hasText: "Kira Vance" });
if (await join.count()) await join.first().click();
await player.waitForSelector(".hp-big", { timeout: 20000 });

// Three, so narrowing to one is a real narrowing.
await go(dm, "combat");
for (const [i, n] of [[1, "Ogre"], [2, "Wolf"], [3, "Bandit"]]) {
  await dm.getByRole("button", { name: "Add creature" }).click();
  await dm.locator(`input[aria-label="Creature ${i} name"]`).fill(n);
  await dm.locator(`input[aria-label="Creature ${i} hp"]`).fill("20");
}
await dm.getByRole("button", { name: "Roll for initiative" }).click();
await dm.waitForTimeout(600);

/* --- typing in one box must not empty the others -------------------------

   Each row holds its number in its own state until Set, and the list of rows
   returned EITHER an element or a nested array — which React reads as a
   fragment keyed by position. Settling one row changed the shape of the
   list, the children stopped lining up, every row remounted, and a DM
   filling in four initiatives lost three of them on the first press.

   It needs FOUR separately-named combatants to show: identical creatures
   roll as one group, and a group happens to reconcile cleanly. The bug lives
   in the list of one-member groups, which is the ordinary case. */
for (const [who, v] of [["Kira Vance", "5"], ["Ogre", "20"], ["Wolf", "18"], ["Bandit", "16"]]) {
  await dm.locator(`input[aria-label="${who} initiative"]`).fill(v);
}
await dm.getByRole("button", { name: "Set Kira Vance initiative" }).click();
await dm.waitForTimeout(600);
ok("settling one roll leaves the others as they were typed",
  await dm.locator('input[aria-label$="initiative"]')
    .evaluateAll((ns) => ns.map((n) => n.value)),
  ["20", "18", "16"]);

for (let g = 0; g < 12; g++) {
  const inp = dm.locator('input[aria-label$="initiative"]').first();
  if (!(await inp.count())) break;
  const who = (await inp.getAttribute("aria-label")).replace(" initiative", "");
  await inp.fill(who.includes("Kira") ? "5" : String(20 - g));
  const set = dm.getByRole("button", { name: `Set ${who} initiative` });
  if (!(await set.count())) break;
  await set.click();
  await dm.waitForTimeout(180);
}
await dm.getByRole("button", { name: "Begin", exact: true }).click();
await dm.waitForTimeout(900);
ok("the ogre is the one having its turn",
  await dm.locator(".cbt.on .nm").first().innerText(), "Ogre");
ok("and there are three creatures to be wrong about",
  await dm.locator(".cbt").count(), 4);

/* --- the carve-out, checked first ---------------------------------------

   An UNPROMPTED opportunity attack still offers everyone. Nobody has said
   who moved, so narrowing it would be the app inventing the trigger — and a
   narrowing that applied everywhere would be the same bug in the other
   direction. Checked before any offer exists, while the reaction is unspent. */
await go(player, "combat");
await player.waitForTimeout(600);
const unprompted = player.getByRole("button", { name: "Opportunity attack" });
ok("a player can take one nobody offered", await unprompted.count(), 1);
await unprompted.click();
await player.waitForTimeout(500);
await player.getByRole("button", { name: /longbow/i }).first().click();
await player.waitForTimeout(600);
ok("and then every creature is a candidate, because nobody said who moved",
  (await player.locator(".tgt-row").count()) > 1, true);
await player.getByRole("button", { name: /^Cancel|^Back/ }).first().click().catch(() => {});
await player.waitForTimeout(400);

// The DM offers Kira a reaction. The provoker is whoever is up.
await dm.getByRole("button", { name: "Offer a reaction" }).click();
await dm.waitForTimeout(400);
await dm.getByRole("button", { name: /Kira/ }).first().click();
await dm.waitForTimeout(300);
await dm.getByRole("button", { name: "Ask them" }).click();
await dm.waitForTimeout(900);

await player.waitForTimeout(900);
ok("the player is asked, wherever they are",
  await player.getByRole("button", { name: "Take a swing" }).count(), 1);
/* In the middle of the screen with a scrim, because this is the one moment
   the table has stopped and five people are waiting on one person. */
ok("and it interrupts rather than waiting to be found",
  await player.locator(".react-scrim").count(), 1);

await player.getByRole("button", { name: "Take a swing" }).click();
await player.waitForTimeout(900);
/* And it gets out of the way the instant they answer. A scrim that outlives
   its question blocks the very screen it just sent you to — which is what
   happened the first time, because the flag it watched was cleared a render
   later by the screen it opened. */
ok("and gets out of the way once answered",
  await player.locator(".react-scrim").count(), 0);
await player.getByRole("button", { name: /longbow/i }).first().click();
await player.waitForTimeout(700);

const targets = (await player.locator(".tgt-row").allInnerTexts()).map((t) => t.trim());
/* The whole point. Case-insensitive, because these are uppercased in CSS and
   innerText returns what is rendered. */
ok("the swing is aimed at the creature that provoked it", targets.length, 1);
ok("and it is the right one", /ogre/i.test(targets[0] ?? ""), true);
ok("not the two that had nothing to do with it",
  targets.some((t) => /wolf|bandit/i.test(t)), false);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
await browser.close();
