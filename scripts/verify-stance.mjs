/* Advantage, conditions on creatures, the actions that were only sentences,
   and reactions that arrive rather than being remembered.

   The through-line: shove the goblin over, and the next attack says
   "advantage: the goblin is prone" without anyone looking anything up. That
   sentence is the whole feature — the rest is the plumbing that earns it. */
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
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}

const dm = await device("dm");
const player = await device("player");

await dm.page.getByRole("button", { name: "The table", exact: true }).click();
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();
await dm.page.getByRole("button", { name: "Load sample" }).click();
await dm.page.waitForSelector('select[aria-label="Seat"], .join-row');
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForSelector(".pm-name");

await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "The table", exact: true }).click();
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
const join = player.page.locator(".join-row", { hasText: "Kira Vance" });
if (await join.count()) await join.first().click();
else await player.page.selectOption('select[aria-label="Seat"]', { label: "Kira Vance" });
await player.page.waitForSelector(".hp-big", { timeout: 20000 });

// A fight, with Kira first.
await go(dm.page, "combat");
await dm.page.getByRole("button", { name: "Add creature" }).click();
await dm.page.locator('input[aria-label="Creature 1 name"]').fill("Goblin");
await dm.page.locator('input[aria-label="Creature 1 hp"]').fill("20");
await dm.page.getByRole("button", { name: "Roll for initiative" }).click();
await dm.page.waitForSelector('input[aria-label="Kira Vance initiative"]');
for (const [n, v] of [["Kira Vance", 20], ["Goblin", 5]]) {
  await dm.page.locator(`input[aria-label="${n} initiative"]`).fill(String(v));
  await dm.page.getByRole("button", { name: `Set ${n} initiative` }).click();
}
await dm.page.getByRole("button", { name: "Begin", exact: true }).click();
await player.page.waitForSelector(".pt.acting", { timeout: 20000 });
await go(player.page, "combat");

// --- a straight roll, first, so the change has something to be measured against
const step = () => player.page.locator(".swing-step");
const swing = async () => {
  await player.page.locator(".pt-atk").click();
  await player.page.waitForTimeout(400);
  // Kira carries three weapons, so the walkthrough asks which one first.
  if (/attacking with/i.test(await step().innerText())) {
    await player.page.locator(".tgt-row").first().click();
    await player.page.waitForTimeout(300);
  }
  const target = player.page.locator(".tgt-row", { hasText: "Goblin" }).first();
  if (await target.count()) await target.click();
  await player.page.waitForTimeout(400);
  const ask = (await player.page.locator(".swing-step").innerText()).replace(/\s+/g, " ");
  const why = await player.page.locator(".stance").count();
  const reason = why ? await player.page.locator(".stance").innerText() : null;
  return { ask, reason };
};
/** Out of the walkthrough, however many steps deep it is. */
const backOut = async () => {
  for (let i = 0; i < 3; i++) {
    const b = step().getByRole("button", { name: /^(Back|Cancel)$/ });
    if ((await step().count()) === 0 || (await b.count()) === 0) break;
    await b.first().click();
    await player.page.waitForTimeout(300);
  }
};

const first = await swing();
ok("with nothing to say it asks for one d20", /Roll a d20 and add/.test(first.ask), true);
ok("and gives no reason, because there is none", first.reason, null);
await backOut();

// --- the DM puts the goblin on its back -----------------------------------
const goblinRow = dm.page.locator(".cbt", { hasText: "Goblin" });
await goblinRow.getByRole("button", { name: "Add a condition" }).click();
await dm.page.waitForTimeout(300);
await dm.page.locator(".pop-pane .cnd", { hasText: "prone" }).click();
await dm.page.waitForTimeout(900);
ok("the DM can say what is wrong with a creature",
  (await goblinRow.locator(".cnd.on").innerText()).toLowerCase(), "prone");
ok("and the table can see it — a condition is watched, not deduced",
  await player.page.locator(".cbt", { hasText: "Goblin" }).locator(".cnd.on").count(), 1);
await dm.page.screenshot({ path: `${OUT}/40-conditions.png`, fullPage: true });

// --- which changes the dice, and says why ---------------------------------
const second = await swing();
ok("a prone target up close is two dice, take the higher",
  /Roll two d20s and take the higher/.test(second.ask), true);
ok("and it says why, which is the part that teaches",
  second.reason, "Advantage: Goblin is prone");
await player.page.screenshot({ path: `${OUT}/41-advantage.png`, fullPage: true });
await backOut();

// --- the rule nobody believes ---------------------------------------------
await dm.page.locator(".cbt", { hasText: "Kira Vance" }).scrollIntoViewIfNeeded();
await go(player.page, "sheet");
const poison = player.page.getByRole("button", { name: /poisoned/i }).first();
await poison.click();
await player.page.waitForTimeout(700);
await go(player.page, "combat");
const third = await swing();
ok("one of each cancels to a single d20", /Roll a d20 and add/.test(third.ask), true);
ok("and it says so rather than dropping the losing half",
  /They cancel\.$/.test(third.reason ?? ""), true);
await backOut();
await go(player.page, "sheet");
await player.page.getByRole("button", { name: /poisoned/i }).first().click();
await player.page.waitForTimeout(700);
await go(player.page, "combat");

// --- Dodge stops being a sentence -----------------------------------------
await player.page.getByRole("button", { name: "What else can I do?" }).click();
await player.page.waitForTimeout(300);
await player.page.getByRole("button", { name: "Dodge", exact: true }).click();
await player.page.waitForTimeout(250);
await player.page.getByRole("button", { name: "Do it" }).click();
await player.page.waitForTimeout(900);
await go(dm.page, "log");
ok("dodging is recorded, not just narrated",
  /Dodging/i.test(await dm.page.locator(".feed").innerText()), true);
await go(dm.page, "combat");

// --- a readied action lives where the DM can see it -----------------------
await player.page.waitForTimeout(400);
await go(player.page, "combat");
ok("but the action is gone, so nothing else is offered",
  await player.page.locator(".pt-atk").isDisabled(), true);

// A fresh round, so there is an action to spend on Ready.
await dm.page.getByRole("button", { name: "Next turn" }).click();
await dm.page.waitForTimeout(700);
await dm.page.getByRole("button", { name: "Next turn" }).click();
await player.page.waitForSelector(".pt.acting", { timeout: 20000 });

await player.page.getByRole("button", { name: "What else can I do?" }).click();
await player.page.waitForTimeout(300);
await player.page.getByRole("button", { name: "Ready", exact: true }).click();
await player.page.waitForTimeout(250);
await player.page.getByRole("button", { name: "Do it" }).click();
await player.page.waitForTimeout(300);
await player.page.locator('input[aria-label="Trigger"]').fill("when it comes through the door, I shoot");
await player.page.getByRole("button", { name: "Hold it" }).click();
await player.page.waitForTimeout(900);
ok("what somebody is holding is on the DM's screen",
  /comes through the door/i.test(await dm.page.locator(".ready-row").innerText()), true);
await dm.page.screenshot({ path: `${OUT}/42-readied.png`, fullPage: true });
await dm.page.getByRole("button", { name: "It fired" }).click();
await dm.page.waitForTimeout(700);
ok("and clears when it does", await dm.page.locator(".ready-row").count(), 0);

// --- the reaction arrives instead of being remembered ---------------------
await dm.page.getByRole("button", { name: "Next turn" }).click();
await dm.page.waitForTimeout(900);
ok("a player waiting is offered nothing unprompted",
  await player.page.locator(".react-ask").count(), 0);

/* The prompt has to reach somebody who is NOT looking at the fight.

   This was the app's most time-critical moment and it had the weakest signal
   of anything urgent: it lived inside the fight and carried no dot, so a
   player on their gear screen saw nothing at all while five people waited. */
await go(player.page, "gear");
await dm.page.getByRole("button", { name: "Offer a reaction" }).click();
await dm.page.waitForTimeout(300);
await dm.page.locator(".offer-row", { hasText: "Kira Vance" }).click();
await dm.page.locator('input[aria-label="Reason for the reaction"]')
  .fill("the goblin is leaving your reach");
await dm.page.getByRole("button", { name: "Ask them" }).click();
await player.page.waitForTimeout(1400);
ok("the moment arrives on whatever screen they are on",
  /leaving your reach/i.test(await player.page.locator(".react-ask").innerText()), true);
/* In the middle of the screen with a scrim behind it: the table has stopped
   and five people are waiting on one person, so it interrupts rather than
   being another card to find. */
ok("and it interrupts, rather than waiting to be noticed",
  await player.page.locator(".react-scrim").count(), 1);
ok("without moving them off the screen they were on",
  await player.page.locator('[data-tab="gear"].on').count(), 1);
ok("and the fight is marked, so the way back is obvious",
  await player.page.locator('[data-tab="combat"] .tab-dot').count(), 1);
await player.page.screenshot({ path: `${OUT}/43-reaction.png`, fullPage: true });

/* Declining first, and taking second, because taking SPENDS the reaction —
   after which the DM cannot offer another and there is nothing left to
   decline. The order is the rule, not the suite's convenience. */
await player.page.getByRole("button", { name: "Let it go" }).click();
await player.page.waitForTimeout(1000);
ok("letting it go clears it", await player.page.locator(".react-ask").count(), 0);
ok("and takes the scrim with it", await player.page.locator(".react-scrim").count(), 0);

await dm.page.getByRole("button", { name: "Offer a reaction" }).click();
await dm.page.waitForTimeout(300);
await dm.page.locator(".offer-row", { hasText: "Kira Vance" }).click();
await dm.page.locator('input[aria-label="Reason for the reaction"]')
  .fill("it steps past you again");
await dm.page.getByRole("button", { name: "Ask them" }).click();
await player.page.waitForTimeout(1400);
ok("a second offer interrupts again", await player.page.locator(".react-ask").count(), 1);

// Saying yes takes you to the swing rather than asking the question twice.
await player.page.getByRole("button", { name: "Take a swing" }).click();
await player.page.waitForTimeout(1000);
ok("saying yes goes straight to the swing",
  await player.page.locator('[data-tab="combat"].on').count(), 1);
ok("with the walkthrough already open",
  await player.page.locator(".swing-step").count(), 1);
/* And the prompt is gone. A scrim that outlived its question would be sitting
   over the very swing it just opened — which is what happened the first time,
   because the flag it watched was cleared a render later by that screen. */
ok("and the prompt got out of the way",
  await player.page.locator(".react-scrim").count(), 0);
await backOut();


// --- the arc the whole thing exists for -----------------------------------
// Shove it over, the DM rules on the contest, and the next attack says
// "advantage" without anyone looking anything up.
await dm.page.locator(".cbt", { hasText: "Goblin" }).locator(".cnd.on").click();
await dm.page.waitForTimeout(800);
ok("a condition comes off again",
  await dm.page.locator(".cbt", { hasText: "Goblin" }).locator(".cnd.on").count(), 0);

await dm.page.getByRole("button", { name: "Next turn" }).click();
await player.page.waitForSelector(".pt.acting", { timeout: 20000 });
await player.page.getByRole("button", { name: "What else can I do?" }).click();
await player.page.waitForTimeout(300);

// Help has a step of its own now, and says so honestly when there is nobody.
await player.page.getByRole("button", { name: "Help", exact: true }).click();
await player.page.waitForTimeout(250);
await player.page.getByRole("button", { name: "Do it" }).click();
await player.page.waitForTimeout(400);
ok("Help asks who, rather than spending your action on nothing",
  /who are you helping/i.test(await step().innerText()), true);
ok("and says plainly when there is nobody to help",
  /nobody else is in this fight/i.test(await step().innerText()), true);
await step().getByRole("button", { name: "Back" }).click();
await player.page.waitForTimeout(300);

await player.page.getByRole("button", { name: "Shove", exact: true }).click();
await player.page.waitForTimeout(250);
await player.page.getByRole("button", { name: "Do it" }).click();
await player.page.waitForTimeout(400);
await player.page.locator(".tgt-row", { hasText: "Goblin" }).first().click();
await player.page.waitForTimeout(300);
await player.page.locator('input[aria-label="Athletics total"]').fill("17");
await player.page.getByRole("button", { name: "Send to the DM" }).click();
await dm.page.waitForTimeout(1200);
ok("a contest the app cannot settle goes to the person who can",
  /athletics 17/i.test(await dm.page.locator(".shove-ask").innerText()), true);
await dm.page.screenshot({ path: `${OUT}/44-shove.png`, fullPage: true });

await dm.page.getByRole("button", { name: "Down it goes" }).click();
await player.page.waitForTimeout(1200);
ok("the DM's ruling lands on the creature",
  (await player.page.locator(".cbt", { hasText: "Goblin" }).locator(".cnd.on").innerText())
    .toLowerCase(), "prone");

// Shoving cost the action, so the swing that reads the consequence is next
// turn's — which is also how it goes at a table.
await dm.page.getByRole("button", { name: "Next turn" }).click();
await dm.page.waitForTimeout(700);
await dm.page.getByRole("button", { name: "Next turn" }).click();
await player.page.waitForSelector(".pt-atk:not([disabled])", { timeout: 20000 });
const after = await swing();
ok("and the next swing knows it, with no one looking anything up",
  after.reason, "Advantage: Goblin is prone");
await backOut();

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
