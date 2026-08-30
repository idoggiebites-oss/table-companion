/* Initiative across two devices, and the clause from the build plan that
   matters most: two people press advance at the same instant and the turn
   moves once. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = got === want;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};

/** Sit as a character: a device claims its own once, then picks a seat. */
const sitAs = async (page, name) => {
  // A device joining a campaign that already has characters is asked which
  // one it is, once; after that it is an ordinary seat change.
  const join = page.locator(".join-row", { hasText: name });
  if (await join.count()) await join.first().click();
  else await page.selectOption('select[aria-label="Seat"]', { label: name });
  await page.waitForTimeout(500);
};

/** Sections are tabs now; content is one tap away rather than a scroll. */
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}
const activeName = (d) => d.page.locator(".cbt.on .nm").innerText();
const round = (d) => d.page.locator(".card-hd .num").first().innerText();

const dm = await device("dm");
const player = await device("player");

await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();
await dm.page.getByRole("button", { name: "Load sample" }).click();
await dm.page.waitForSelector('select[aria-label="Seat"], .join-row');
// Making a character seats you in it, so the DM device has to step back out.
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForSelector(".pm-name");

await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 15000 });
await sitAs(player.page, "Kira Vance");
await player.page.waitForSelector(".hp-big", { timeout: 15000 });

// DM sets up a fight: Kira plus two goblins
// Setup names who is in the fight; initiative is rolled after staging.
await go(dm.page, "combat");
await dm.page.getByRole("button", { name: "Add creature" }).click();
await dm.page.locator('input[aria-label="Creature 1 name"]').fill("Goblin Boss");

await dm.page.locator('input[aria-label="Creature 1 hp"]').fill("21");
await dm.page.getByRole("button", { name: "Add creature" }).click();
await dm.page.locator('input[aria-label="Creature 2 name"]').fill("Ambusher");

await dm.page.getByRole("button", { name: "Roll for initiative" }).click();
await dm.page.waitForSelector('input[aria-label="Kira Vance initiative"]');
for (const [name, roll] of [["Kira Vance", 18], ["Goblin Boss", 21], ["Ambusher", 9]]) {
  await dm.page.locator(`input[aria-label="${name} initiative"]`).fill(String(roll));
  await dm.page.getByRole("button", { name: `Set ${name} initiative` }).click();
}
await dm.page.getByRole("button", { name: "Begin", exact: true }).click();
await dm.page.waitForSelector(".cbt.on");
await player.page.waitForSelector(".cbt.on", { timeout: 15000 });

ok("highest initiative is up", await activeName(dm), "Goblin Boss");
ok("player sees the same fight", await activeName(player), "Goblin Boss");
ok("dm sees every combatant", await dm.page.locator(".cbt").count(), 3);
await dm.page.screenshot({ path: `${OUT}/20-dm-initiative.png` });

// disclosure: hide the ambusher from the players
const ambusher = dm.page.locator(".cbt", { hasText: "Ambusher" });
await ambusher.locator(".disc").click();   // vague -> exact
await ambusher.locator(".disc").click();   // exact -> hidden
await player.page.waitForTimeout(800);
ok("dm hid a creature from the players", await player.page.locator(".cbt").count(), 2);
ok("dm still sees it", await dm.page.locator(".cbt").count(), 3);
ok("player sees vague health, not a number",
  await player.page.locator(".cbt", { hasText: "Goblin Boss" }).locator(".hp").innerText(), "Unharmed");
ok("dm sees exact health",
  await dm.page.locator(".cbt", { hasText: "Goblin Boss" }).locator(".hp").innerText(), "21/21");
await player.page.screenshot({ path: `${OUT}/21-player-initiative.png` });

// A player waiting is offered nothing to press at all — not a greyed button,
// which would still invite a tap.
ok("player is offered no end-turn control while waiting",
  await player.page.getByRole("button", { name: "End turn" }).count(), 0);

// advance to Kira, so BOTH devices have an enabled button naming the same turn
await dm.page.getByRole("button", { name: "Next turn" }).click();
await player.page.waitForTimeout(900);
ok("dm advanced to the player", await activeName(dm), "Kira Vance");
ok("player is offered one once it is their turn",
  await player.page.getByRole("button", { name: "End turn" }).count(), 1);

/* THE clause from the build plan: two devices press at the same instant,
   both naming turn 1, and the fight moves exactly one step.

   This used to be two clicks inside a Promise.all and a hope. When the sync
   landed between them the player's device read an already-advanced turn,
   sent a valid `from` for it, and the fight moved twice — the app behaving
   correctly on the input it got, and the suite failing anyway. A test that
   fails on correct behaviour is worse than no test.

   So the race is arranged rather than raced for. The player goes offline,
   which is what "at the same instant" means in a distributed system: they
   provably cannot have seen the DM's advance. Their press queues and flushes
   on reconnect, naming turn 1 — and `advance` drops a `from` that is not the
   current turn, which is the invariant this exists to prove. */
await player.ctx.setOffline(true);
await player.page.waitForTimeout(300);
await player.page.getByRole("button", { name: "End turn" }).click();
await dm.page.getByRole("button", { name: "Next turn" }).click();
await dm.page.waitForTimeout(800);
ok("the DM's press moves the fight", await activeName(dm), "Ambusher");
await player.ctx.setOffline(false);
// Long enough for the reconnect, the replay, and the stale press to be
// dropped — a flush that has not happened yet proves nothing.
await player.page.waitForTimeout(2500);
ok("one move, not two", await activeName(dm), "Ambusher");
/* The player's device agrees — but not by naming who is up. The Ambusher is
   hidden from them, so no row on their screen is the active one, and that is
   the ladder working rather than a stale render. What they can see is that
   the turn is no longer theirs. */
await player.page.getByRole("button", { name: "The table" }).click();
ok("the player is back on the same log",
  await player.page.locator(".rb-status").innerText(), "LIVE · 2 JOINED");
await player.page.getByRole("button", { name: "Close The table" }).click();
ok("and their turn is over, so nothing is offered to end",
  await player.page.getByRole("button", { name: "End turn" }).count(), 0);
ok("both devices agree on the turn", await dm.page.locator(".cbt.on").count(), 1);

// the active creature is hidden from the players, so they see no active row —
// which is the disclosure ladder working, not a missing highlight
ok("player sees no highlighted row for a hidden creature",
  await player.page.locator(".cbt.on").count(), 0);
ok("player still knows how far away they are",
  (await player.page.locator(".turns-away").innerText()).toLowerCase(), "2 turns away");

// wrapping increments the round on both
await dm.page.getByRole("button", { name: "Next turn" }).click();
await player.page.waitForTimeout(900);
ok("round advanced for the dm", await round(dm), "2");
ok("round advanced for the player", await round(player), "2");

/* Creature damage crosses to the player as vague health. Typed on the row it
   belongs to now — the shared box at the foot of the card fed every row and
   said so nowhere, which is exactly how it read at a table. */
await dm.page.locator(".cbt", { hasText: "Goblin Boss" })
  .getByRole("button", { name: /^Hurt or heal/ }).click();
await dm.page.waitForTimeout(300);
await dm.page.locator('input[aria-label="Amount for Goblin Boss"]').fill("12");
await dm.page.getByRole("button", { name: "Damage Goblin Boss", exact: true }).click();
await player.page.waitForTimeout(800);
ok("dm sees the exact number",
  await dm.page.locator(".cbt", { hasText: "Goblin Boss" }).locator(".hp").innerText(), "9/21");
ok("player sees only that it is bloodied",
  await player.page.locator(".cbt", { hasText: "Goblin Boss" }).locator(".hp").innerText(), "Bloodied");

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
