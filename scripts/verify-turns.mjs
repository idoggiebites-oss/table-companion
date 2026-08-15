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
await dm.page.waitForSelector(".seatbar");
// Making a character seats you in it, so the DM device has to step back out.
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForSelector(".pm-name");

await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForSelector(".seatbar", { timeout: 15000 });
await sitAs(player.page, "Kira Vance");
await player.page.waitForSelector(".hp-big", { timeout: 15000 });

// DM sets up a fight: Kira plus two goblins
// Setup names who is in the fight; initiative is rolled after staging.
await go(dm.page, "fight");
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
await dm.page.getByRole("button", { name: "Advance turn" }).click();
await player.page.waitForTimeout(900);
ok("dm advanced to the player", await activeName(dm), "Kira Vance");
ok("player is offered one once it is their turn",
  await player.page.getByRole("button", { name: "End turn" }).count(), 1);

// THE clause from the build plan: two devices press at the same instant,
// both naming turn 1, and the fight moves exactly one step.
await Promise.all([
  dm.page.getByRole("button", { name: "Advance turn" }).click(),
  player.page.getByRole("button", { name: "End turn" }).click(),
]);
await dm.page.waitForTimeout(1500);
ok("one move, not two", await activeName(dm), "Ambusher");
ok("both devices agree on the turn", await dm.page.locator(".cbt.on").count(), 1);

// the active creature is hidden from the players, so they see no active row —
// which is the disclosure ladder working, not a missing highlight
ok("player sees no highlighted row for a hidden creature",
  await player.page.locator(".cbt.on").count(), 0);
ok("player still knows how far away they are",
  (await player.page.locator(".turns-away").innerText()).toLowerCase(), "2 turns away");

// wrapping increments the round on both
await dm.page.getByRole("button", { name: "Advance turn" }).click();
await player.page.waitForTimeout(900);
ok("round advanced for the dm", await round(dm), "2");
ok("round advanced for the player", await round(player), "2");

// creature damage crosses to the player as vague health
await dm.page.locator('input[aria-label="Creature damage"]').fill("12");
await dm.page.locator(".cbt", { hasText: "Goblin Boss" }).locator(".hitbtn").click();
await player.page.waitForTimeout(800);
ok("dm sees the exact number",
  await dm.page.locator(".cbt", { hasText: "Goblin Boss" }).locator(".hp").innerText(), "9/21");
ok("player sees only that it is bloodied",
  await player.page.locator(".cbt", { hasText: "Goblin Boss" }).locator(".hp").innerText(), "Bloodied");

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
