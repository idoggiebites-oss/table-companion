/* Tabs.

   The point is less scrolling, but the risk is things going out of sight —
   so what this actually tests is that nothing urgent can hide behind a tab,
   and that the two sides get different sections. */
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
  await page.waitForTimeout(250);
};
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}
const tabsOf = (p) => p.locator(".tab").allInnerTexts();
const activeTab = (p) => p.locator(".tab.on").getAttribute("data-tab");

const dm = await device("dm");
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();
await dm.page.waitForTimeout(800);

ok("the DM's sections are their responsibilities",
  (await tabsOf(dm.page)).map((t) => t.toLowerCase()),
  ["fight", "party", "prep", "book", "log"]);
// Never "Fight" when there is no fight — that is a dead screen with
// "No fight yet" on it.
ok("and an empty table opens on the party, not on a fight that is not happening",
  await activeTab(dm.page), "party");
ok("with session zero right there", await dm.page.getByText("Session zero").count(), 1);
await dm.page.screenshot({ path: `${OUT}/51-dm-tabs.png`, fullPage: true });

const p1 = await device("kira");
await p1.page.locator('input[aria-label="Room code"]').fill(code);
await p1.page.getByRole("button", { name: "Join", exact: true }).click();
await p1.page.waitForSelector('button:has-text("Build a character")', { timeout: 20000 });
await p1.page.getByRole("button", { name: "Build a character" }).click();
await p1.page.waitForSelector('select[aria-label="Class"]', { timeout: 20000 });
await p1.page.selectOption('select[aria-label="Class"]', "fighter");
await p1.page.waitForTimeout(300);
for (const s of ["Athletics", "Perception"]) {
  await p1.page.getByRole("button", { name: s, exact: true }).click();
}
await p1.page.selectOption('select[aria-label="Race"]', "human");
await p1.page.waitForTimeout(400);
await p1.page.getByRole("button", { name: "Recommend" }).click();
await p1.page.getByRole("button", { name: "nature", exact: true }).click();
await p1.page.getByRole("button", { name: "animal handling", exact: true }).click();
await p1.page.locator('input[aria-label="Background name"]').fill("Soldier");
await p1.page.locator('input[aria-label="Character name"]').fill("Kira Vance");
await p1.page.getByRole("button", { name: "Create character" }).click();
await p1.page.waitForSelector(".tabs", { timeout: 20000 });
await p1.page.waitForTimeout(600);

ok("a player gets different sections",
  (await tabsOf(p1.page)).map((t) => t.toLowerCase()),
  ["fight", "sheet", "gear", "log"]);
ok("and lands on their own sheet", await activeTab(p1.page), "sheet");
ok("there is no prep or reference for them",
  await p1.page.locator('[data-tab="prep"], [data-tab="book"]').count(), 0);

// Gear is the pack; the sheet keeps the numbers it produces.
await go(p1.page, "gear");
ok("gear holds what you carry",
  await p1.page.locator(".card", { hasText: "Carrying" }).count(), 1);
ok("and states what it gets you",
  await p1.page.locator(".gear-sum").count(), 1);
ok("the sheet is not carrying the pack any more",
  await (async () => {
    await go(p1.page, "sheet");
    return p1.page.locator(".card", { hasText: "Carrying" }).count();
  })(), 0);

// The log is its own place on both sides.
await go(p1.page, "log");
ok("a player has the log", await p1.page.locator(".feed").count(), 1);
await go(dm.page, "log");
ok("so does the DM", await dm.page.locator(".feed").count(), 1);

// --- nothing urgent may hide behind a tab --------------------------------
await go(p1.page, "gear");
await go(dm.page, "fight");
await dm.page.getByRole("button", { name: "Add creature" }).click();
await dm.page.locator('input[aria-label="Creature 1 name"]').fill("Goblin");
await dm.page.getByRole("button", { name: "Roll for initiative" }).click();
await p1.page.waitForTimeout(1800);

// A fight starting is combat focus mode: it moves you, rather than leaving a
// dot on a tab you are not looking at.
ok("a fight starting pulls the player to it", await activeTab(p1.page), "fight");
ok("and the DM too", await activeTab(dm.page), "fight");

await dm.page.locator('input[aria-label="Kira Vance initiative"]').fill("18");
await dm.page.getByRole("button", { name: "Set Kira Vance initiative" }).click();
await dm.page.locator('input[aria-label="Goblin initiative"]').fill("4");
await dm.page.getByRole("button", { name: "Set Goblin initiative" }).click();
await dm.page.getByRole("button", { name: "Begin", exact: true }).click();
await p1.page.waitForTimeout(1500);
ok("your turn marks the fight tab",
  await p1.page.locator('[data-tab="fight"] .tab-dot').count(), 1);

// A concentration save is owed NOW, which is the one thing allowed to take
// the screen from wherever you are.
await go(p1.page, "gear");
ok("the player wandered off to their gear", await activeTab(p1.page), "gear");
await go(p1.page, "sheet");
await p1.page.locator('input[aria-label="Spell to concentrate on"]').fill("Hunter's Mark");
await p1.page.getByRole("button", { name: "Concentrate", exact: true }).click();
await p1.page.waitForTimeout(500);
await go(p1.page, "gear");
await go(dm.page, "party");
await dm.page.locator('input[aria-label="Kira Vance amount"]').fill("5");
await dm.page.locator(".pm").getByRole("button", { name: "Damage" }).click();
await p1.page.waitForTimeout(1600);
ok("a save owed now takes the screen", await activeTab(p1.page), "sheet");
ok("and the prompt is the thing on it", await p1.page.locator(".alarm").count(), 1);
await p1.page.screenshot({ path: `${OUT}/52-player-tabs.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
