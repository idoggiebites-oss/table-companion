/* The tablet and desktop layout.

   The tabs exist because a phone cannot show two things at once. Given the
   room, that constraint is gone: the fight stays on screen and the tab bar
   drives what sits beside it. So the test is not "does it look wider" — it is
   whether the fight is still readable while you are demonstrably somewhere
   else, and whether a phone is left exactly as it was. */
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
async function device(name, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}

// A DM on a laptop and a player on an iPad, landscape.
const dm = await device("dm", 1440, 900);
const player = await device("player", 1024, 768);

await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();
await dm.page.getByRole("button", { name: "Load sample" }).click();
await dm.page.waitForSelector('select[aria-label="Seat"], .join-row');
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForTimeout(600);

await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
const join = player.page.locator(".join-row", { hasText: "Kira Vance" });
if (await join.count()) await join.first().click();
await player.page.waitForSelector(".hp-big", { timeout: 20000 });

// Nothing changes until there is a fight to pin — a wide screen with no fight
// is just a wide screen.
ok("no fight, nothing pinned", await dm.page.locator(".pane-pin").count(), 0);
ok("and the Fight tab is still offered",
  (await dm.page.locator(".tab").allInnerTexts()).map((t) => t.toLowerCase()),
  ["combat", "party", "prep", "book", "log"]);

await go(dm.page, "combat");
await dm.page.getByRole("button", { name: "Add creature" }).click();
await dm.page.locator('input[aria-label="Creature 1 name"]').fill("Goblin Boss");
await dm.page.locator('input[aria-label="Creature 1 hp"]').fill("21");
await dm.page.getByRole("button", { name: "Roll for initiative" }).click();
await dm.page.waitForSelector('input[aria-label="Kira Vance initiative"]');
for (const [n, v] of [["Kira Vance", 18], ["Goblin Boss", 21]]) {
  await dm.page.locator(`input[aria-label="${n} initiative"]`).fill(String(v));
  await dm.page.getByRole("button", { name: `Set ${n} initiative` }).click();
}
await dm.page.getByRole("button", { name: "Begin", exact: true }).click();
await dm.page.waitForTimeout(1000);
await player.page.waitForTimeout(1200);

ok("a fight pins itself", await dm.page.locator(".pane-pin").count(), 1);
ok("and stops being a tab, because a tab showing you where you are is dead",
  (await dm.page.locator(".tab").allInnerTexts()).map((t) => t.toLowerCase()),
  ["party", "prep", "book", "log"]);
ok("the DM lands on the party rather than a blank screen",
  await dm.page.locator('[data-tab="party"].on').count(), 1);

// The whole point: somewhere else, and the fight is still there.
await go(dm.page, "prep");
ok("the fight is readable while you are demonstrably elsewhere",
  await dm.page.locator(".pane-pin .cbt", { hasText: "Goblin Boss" }).count(), 1);
ok("and the tab you chose is beside it, not underneath it",
  await dm.page.locator(".pane-main").count(), 1);
await dm.page.screenshot({ path: `${OUT}/50-dm-desktop.png` });

// One fight, one copy of it. Two mounts would mean two of every control.
ok("the fight is on screen once, not twice",
  await dm.page.locator(".track").count(), 1);

// The player's side: the sheet open, the turn still in view.
ok("a player gets the same deal", await player.page.locator(".pane-pin").count(), 1);
ok("with their sheet beside it",
  await player.page.locator('[data-tab="sheet"].on').count(), 1);
ok("and the part of the fight that is theirs stays visible",
  await player.page.locator(".pane-pin .pt").count(), 1);
await player.page.screenshot({ path: `${OUT}/51-player-ipad.png` });

// Their turn, in a column half the width it was designed for.
await dm.page.getByRole("button", { name: "Next turn" }).click();
await player.page.waitForSelector(".pane-pin .pt.acting", { timeout: 20000 });
await player.page.locator(".pt-atk").click();
await player.page.waitForTimeout(400);
if (/attacking with/i.test(await player.page.locator(".swing-step").innerText())) {
  await player.page.locator(".tgt-row").first().click();
  await player.page.waitForTimeout(300);
}
await player.page.locator(".tgt-row", { hasText: "Goblin Boss" }).first().click();
await player.page.waitForTimeout(400);
ok("the walkthrough still fits where it was pinned",
  /Roll a d20 and add/.test(await player.page.locator(".swing-step").innerText()), true);
const box = await player.page.locator(".pane-pin").boundingBox();
ok("and nothing has run off the side of it",
  box.x + box.width <= 1024, true);
await player.page.screenshot({ path: `${OUT}/52-player-turn-ipad.png` });

// An iPad gets turned sideways mid-session constantly. A width guess read
// once at startup would leave it in the wrong layout until a reload.
await player.page.setViewportSize({ width: 768, height: 1024 });
await player.page.waitForTimeout(600);
ok("turning the tablet upright puts it back to one column",
  await player.page.locator(".pane-pin").count(), 0);
ok("and the Fight tab comes back with it",
  await player.page.locator('[data-tab="combat"]').count(), 1);
await player.page.setViewportSize({ width: 1024, height: 768 });
await player.page.waitForTimeout(600);
ok("and back again on its side", await player.page.locator(".pane-pin").count(), 1);

// Two-up where the content is a pile of small cards. A sheet is nine boxes of
// numbers and reads badly as one column half a metre long.
await player.page.setViewportSize({ width: 1440, height: 950 });
await player.page.waitForTimeout(600);
await go(player.page, "sheet");
const cols = await player.page.locator(".pane-main").evaluate(
  (el) => getComputedStyle(el).columnCount,
);
ok("the sheet flows into two columns where there is room", cols, "2");
const wide = await player.page.locator(".pane-main").boundingBox();
const card = await player.page.locator(".pane-main .card").first().boundingBox();
ok("so a card is about half the pane, not all of it", card.width < wide.width * 0.6, true);
await player.page.screenshot({ path: `${OUT}/53-sheet-two-up.png` });

// The fight is a sequence, not a surface, and stays one column.
await go(player.page, "log");
ok("but the log does not — it is a sequence, and reading order matters",
  await player.page.locator(".pane-main").evaluate((el) => getComputedStyle(el).columnCount),
  "auto");

// The phone is what this app is for. It must be untouched.
const phone = await device("phone", 390, 844);
await phone.page.locator('input[aria-label="Room code"]').fill(code);
await phone.page.getByRole("button", { name: "Join", exact: true }).click();
await phone.page.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
const phoneJoin = phone.page.locator(".join-row", { hasText: "Kira Vance" });
if (await phoneJoin.count()) await phoneJoin.first().click();
await phone.page.waitForTimeout(1000);
ok("a phone pins nothing", await phone.page.locator(".pane-pin").count(), 0);
ok("and still has every tab it had", await phone.page.locator('[data-tab="combat"]').count(), 1);
const width = await phone.page.locator(".app").boundingBox();
ok("and does not scroll sideways", width.width <= 390, true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
