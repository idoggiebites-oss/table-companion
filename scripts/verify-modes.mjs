/* The player's two modes, and the reaction pip that spans them. */
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
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1100 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}

const dm = await device("dm");
const player = await device("player");

await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();
await dm.page.getByRole("button", { name: "Load sample" }).click();
await dm.page.waitForSelector('select[aria-label="Seat"]');
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForSelector(".pm-name");

await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForSelector('select[aria-label="Seat"]', { timeout: 15000 });
await player.page.selectOption('select[aria-label="Seat"]', { label: "Kira Vance" });
await player.page.waitForSelector(".hp-big", { timeout: 15000 });

// A goblin goes first, so the player starts the fight waiting.
await dm.page.locator('input[aria-label="Kira Vance initiative"]').fill("12");
await dm.page.getByRole("button", { name: "Add creature" }).click();
await dm.page.locator('input[aria-label="Creature 1 name"]').fill("Goblin");
await dm.page.locator('input[aria-label="Creature 1 initiative"]').fill("20");
await dm.page.getByRole("button", { name: "Start combat", exact: true }).click();
await player.page.waitForSelector(".pt", { timeout: 15000 });

// ---- waiting -------------------------------------------------------------
ok("waiting, not acting", await player.page.locator(".pt.waiting").count(), 1);
ok("one enormous number", await player.page.locator(".pt-dist .num").innerText(), "1");
ok("nothing to end", await player.page.getByRole("button", { name: "End turn" }).count(), 0);
ok("only the reaction is offered while waiting",
  await player.page.locator(".econ .ec").count(), 1);
ok("and it is available",
  await player.page.locator('button[aria-label="Reaction available"]').count(), 1);
await player.page.screenshot({ path: `${OUT}/25-waiting.png` });

// the reaction is spendable on somebody else's turn — that is its whole point
await player.page.locator('button[aria-label="Reaction available"]').click();
await player.page.waitForTimeout(400);
ok("reaction spent while another creature is up",
  await player.page.locator('button[aria-label="Reaction spent"]').count(), 1);
ok("the table sees it",
  (await dm.page.locator(".feed").innerText()).includes("used their reaction"), true);

// ---- acting --------------------------------------------------------------
await dm.page.getByRole("button", { name: "Advance turn" }).click();
await player.page.waitForTimeout(900);
ok("now acting", await player.page.locator(".pt.acting").count(), 1);
ok("the turn is announced", await player.page.locator(".pt-turn").innerText(), "YOUR TURN");
ok("all three are offered", await player.page.locator(".econ .ec").count(), 3);
ok("the reaction came back with the turn",
  await player.page.locator('button[aria-label="Reaction available"]').count(), 1);
await player.page.screenshot({ path: `${OUT}/26-acting.png` });

await player.page.locator('button[aria-label="Bonus available"]').click();
await player.page.waitForTimeout(300);
ok("bonus action marked spent",
  await player.page.locator('button[aria-label="Bonus spent"]').count(), 1);

// ending the turn from the big control
await player.page.locator(".pt-end").click();
await dm.page.waitForTimeout(900);
ok("the dm saw the turn end", await dm.page.locator(".cbt.on .nm").innerText(), "Goblin");
ok("back to waiting", await player.page.locator(".pt.waiting").count(), 1);
ok("the spent bonus is still spent between turns",
  await player.page.locator(".econ .ec").count(), 1);

// coming round again refills everything
await dm.page.getByRole("button", { name: "Advance turn" }).click();
await player.page.waitForTimeout(900);
ok("acting again", await player.page.locator(".pt.acting").count(), 1);
ok("everything came back",
  await player.page.locator(".econ .ec.up").count(), 3);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
