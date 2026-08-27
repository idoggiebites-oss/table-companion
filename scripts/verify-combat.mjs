/* The tab a table stares at.

   Five things were wrong with it and every one of them was found by taking a
   screenshot rather than by reading the code: the control a DM presses forty
   times an evening was one of five equal buttons, whose turn it was lived in
   a highlight, damage went through one box at the foot of the card that fed
   every row, opening conditions shoved the initiative order half a screen
   down, and two creatures typed with the same name were the same creature as
   far as the app was concerned. */
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
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1300 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}

const dm = await device("dm");
await dm.getByRole("button", { name: "Start a room" }).click();
await dm.waitForSelector(".rb-code");
const code = await dm.locator(".rb-code").innerText();
await dm.getByRole("button", { name: "Load sample" }).click();
await dm.waitForSelector(".seatbar");
await dm.selectOption('select[aria-label="Seat"]', "dm");
await dm.waitForSelector(".pm-name");

const player = await device("player");
await player.locator('input[aria-label="Room code"]').fill(code);
await player.getByRole("button", { name: "Join", exact: true }).click();
await player.waitForSelector(".seatbar", { timeout: 20000 });
const join = player.locator(".join-row", { hasText: "Kira Vance" });
if (await join.count()) await join.first().click();
await player.waitForSelector(".hp-big", { timeout: 20000 });

// --- between fights, which is most of a session ---------------------------
await go(player, "combat");
await player.waitForSelector(".ready-for", { timeout: 20000 });
const between = (await player.locator(".ready-for").innerText()).replace(/\s+/g, " ");
ok("the tab says what you would bring, not just 'no fight'",
  /what you would bring/i.test(between), true);
ok("naming the weapon in your hands", /Longbow/.test(between), true);
ok("what is left to spend", /HIT DICE/i.test(between), true);
ok("and how you are standing", /52 of 52 hit points/.test(between), true);
await player.screenshot({ path: `${OUT}/50-between-fights.png`, fullPage: true });

// --- two of a thing -------------------------------------------------------
await go(dm, "combat");
for (const [i, hp] of [[1, 22], [2, 22]]) {
  await dm.getByRole("button", { name: "Add creature" }).click();
  await dm.locator(`input[aria-label="Creature ${i} name"]`).fill("Ghoul");
  await dm.locator(`input[aria-label="Creature ${i} hp"]`).fill(String(hp));
}
await dm.getByRole("button", { name: "Roll for initiative" }).click();
await dm.waitForSelector('input[aria-label="Kira Vance initiative"]');
/* Typed as two Ghouls; they cannot both be "Ghoul" in a track, a log, or an
   aria-label — which is how this was found. */
ok("two creatures typed alike are numbered apart",
  (await dm.locator('input[aria-label$="initiative"]').all()).length, 3);
for (const [n, v] of [["Kira Vance", 18], ["Ghoul 1", 12], ["Ghoul 2", 7]]) {
  await dm.locator(`input[aria-label="${n} initiative"]`).fill(String(v));
  await dm.getByRole("button", { name: `Set ${n} initiative` }).click();
}
await dm.getByRole("button", { name: "Begin", exact: true }).click();
await dm.waitForTimeout(700);

// --- whose turn it is -----------------------------------------------------
const upNow = (await dm.locator(".up").innerText()).replace(/\s+/g, " ");
ok("whose turn it is, in words", /UP NOW Kira Vance/i.test(upNow), true);
ok("and who follows", /THEN Ghoul 1/i.test(upNow), true);
ok("with the turn counted, not just the round",
  /turn 1 of 3/i.test(await dm.locator(".card-hd").first().innerText()), true);

const next = dm.getByRole("button", { name: "Next turn" });
ok("the control a DM presses most is its own", await next.count(), 1);
ok("and says who it hands to",
  /Ghoul 1 is up/i.test(await next.innerText()), true);
await next.click();
await dm.waitForTimeout(600);
ok("pressing it moves the fight on",
  /UP NOW Ghoul 1/i.test((await dm.locator(".up").innerText()).replace(/\s+/g, " ")), true);
await dm.screenshot({ path: `${OUT}/51-turn-tracker.png`, fullPage: true });

// --- hurting one thing, not every thing -----------------------------------
const hpOf = async (name) =>
  (await dm.locator(".cbt", { hasText: new RegExp(`^\\d+\\s*${name}`) }).first().locator(".hp").innerText()).trim();
await dm.getByRole("button", { name: "Hurt or heal Ghoul 2" }).click();
await dm.waitForTimeout(300);
await dm.locator('input[aria-label="Amount for Ghoul 2"]').fill("14");
await dm.getByRole("button", { name: "Damage Ghoul 2", exact: true }).click();
await dm.waitForTimeout(500);
ok("the number lands on the row it was typed on", await hpOf("Ghoul 2"), "8/22");
ok("and not on the one beside it", await hpOf("Ghoul 1"), "22/22");

/* Healing is the same control the other way. It has a ceiling: a ghoul
   patched up twice used to read 30/22, which is not a state the game has. */
await dm.getByRole("button", { name: "Hurt or heal Ghoul 2" }).click();
await dm.waitForTimeout(300);
await dm.locator('input[aria-label="Amount for Ghoul 2"]').fill("99");
await dm.getByRole("button", { name: "Heal Ghoul 2", exact: true }).click();
await dm.waitForTimeout(500);
ok("healing stops at what it started with", await hpOf("Ghoul 2"), "22/22");

// --- conditions, without moving the list ----------------------------------
const rowTop = async () =>
  Math.round((await dm.locator(".cbt").last().boundingBox()).y);
const before = await rowTop();
await dm.locator(".cbt", { hasText: "Ghoul 1" }).getByRole("button", { name: "Add a condition" }).click();
await dm.waitForSelector(".cnd-pick", { timeout: 5000 });
ok("the picker opens as a sheet", await dm.locator(".cnd-pick").count(), 1);
ok("and the initiative order stays where it was", await rowTop(), before);
await dm.getByRole("button", { name: "prone", exact: true }).click();
await dm.waitForTimeout(500);
ok("what is wrong with it shows on its row",
  await dm.locator(".cbt", { hasText: "Ghoul 1" }).locator(".cnd.on").count(), 1);
/* Which is the whole point of tracking it: the player's dice change. */
await player.waitForTimeout(900);
ok("and the players can see it too",
  (await player.locator(".cbt", { hasText: "Ghoul 1" }).innerText()).toLowerCase().includes("prone"), true);

// --- something arrives ----------------------------------------------------
await dm.getByRole("button", { name: "Something arrives" }).click();
await dm.waitForTimeout(300);
await dm.locator('input[aria-label="Arrival name"]').fill("Ghast");
await dm.locator('input[aria-label="Arrival hit points"]').fill("36");
await dm.locator('input[aria-label="Arrival initiative"]').fill("15");
await dm.getByRole("button", { name: "It joins the fight" }).click();
await dm.waitForTimeout(700);
const order = await dm.locator(".cbt .nm").allInnerTexts();
ok("it lands in the order at its own initiative",
  order, ["Kira Vance", "Ghast", "Ghoul 1", "Ghoul 2"]);
/* Without stealing the turn that was in progress. */
ok("and nobody's turn is skipped",
  /UP NOW Ghoul 1/i.test((await dm.locator(".up").innerText()).replace(/\s+/g, " ")), true);
ok("it can be hurt like anything else",
  await dm.getByRole("button", { name: "Hurt or heal Ghast" }).count(), 1);
await dm.screenshot({ path: `${OUT}/52-reinforcements.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
