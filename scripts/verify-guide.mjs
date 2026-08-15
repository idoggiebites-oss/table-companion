/* Guidance on the action side.

   Two things a new player cannot get from a character sheet: what their turn
   actually offers, and what the DM just asked them for. The dice stay on the
   table — everything here asks for a number and never rolls one. */
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
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  return { ctx, page, name };
}

const dm = await device("dm");
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();

const p1 = await device("kira");
await p1.page.locator('input[aria-label="Room code"]').fill(code);
await p1.page.getByRole("button", { name: "Join", exact: true }).click();
await p1.page.waitForSelector('button:has-text("Load sample")', { timeout: 20000 });
await p1.page.getByRole("button", { name: "Load sample" }).click();
await p1.page.waitForSelector(".tabs", { timeout: 20000 });
await dm.page.waitForTimeout(1500);

// --- what the DM just asked for ------------------------------------------
await go(dm.page, "party");
await dm.page.getByRole("button", { name: "Ask", exact: true }).click();
await dm.page.selectOption('select[aria-label="What to roll"]', "perception");
await dm.page.locator('input[aria-label="Difficulty"]').fill("15");
await dm.page.getByRole("button", { name: "Ask the table" }).click();
await p1.page.waitForTimeout(1600);

ok("the ask reaches the player", await p1.page.locator(".ask-mine").count(), 1);
const ask = (await p1.page.locator(".ask-mine").innerText()).replace(/\s+/g, " ");
// The modifier is worked out, because finding Perception on a sheet while
// five people wait is exactly the friction this removes.
ok("with the modifier already worked out", /add \+\d/.test(ask), true);
ok("and what it is for", /perception/i.test(ask), true);
ok("and the number to beat, since the DM gave one", /Beat 15/.test(ask), true);
await p1.page.screenshot({ path: `${OUT}/66-ask.png`, fullPage: true });

// It follows you: a roll owed now is not something to go and find.
await go(p1.page, "gear");
ok("it follows you between tabs", await p1.page.locator(".ask-mine").count(), 1);

await p1.page.locator('input[aria-label="Check total"]').fill("18");
await p1.page.getByRole("button", { name: "Send", exact: true }).click();
await p1.page.waitForTimeout(1200);
ok("answering closes it on their side", await p1.page.locator(".ask-mine.done").count(), 1);

const answers = (await dm.page.locator(".ask-answers").innerText()).replace(/\s+/g, " ");
ok("and the DM sees the number", /18/.test(answers), true);
ok("with the pass worked out against their own DC",
  (await dm.page.locator(".ask-answers .chip.on").count()) > 0, true);
await dm.page.getByRole("button", { name: "Done", exact: true }).click();
await dm.page.waitForTimeout(700);
ok("closing it clears both sides", await p1.page.locator(".ask-mine").count(), 0);

// --- what your turn actually offers --------------------------------------
await go(dm.page, "fight");
await dm.page.getByRole("button", { name: "Add creature" }).click();
await dm.page.locator('input[aria-label="Creature 1 name"]').fill("Goblin");
await dm.page.getByRole("button", { name: "Roll for initiative" }).click();
await dm.page.waitForSelector('input[aria-label="Kira Vance initiative"]', { timeout: 20000 });
for (const [n, v] of [["Kira Vance", 20], ["Goblin", 2]]) {
  await dm.page.locator(`input[aria-label="${n} initiative"]`).fill(String(v));
  await dm.page.getByRole("button", { name: `Set ${n} initiative` }).click();
}
await dm.page.getByRole("button", { name: "Begin", exact: true }).click();
await p1.page.waitForTimeout(1600);

await p1.page.getByRole("button", { name: "What else can I do?" }).click();
await p1.page.waitForSelector(".menu-row");
const menu = (await p1.page.locator(".menu-hd .nm").allInnerTexts()).map((t) => t.toLowerCase());
// Nobody discovers these from a character sheet.
for (const name of ["dodge", "disengage", "hide", "help", "shove", "ready"]) {
  ok(`the menu offers ${name}`, menu.some((m) => m.includes(name)), true);
}
const rows = (await p1.page.locator(".menu-row").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
ok("each says what it costs", rows.every((r) => /ACTION|BONUS|REACTION/i.test(r)), true);
// Names and costs only until you point at one — eleven explanations at once
// is a rulebook, which is the thing a new player already could not read.
ok("and nothing is explained until asked", await p1.page.locator(".menu-more").count(), 0);
ok("the whole list fits without scrolling past it", rows.length <= 12, true);

await p1.page.locator(".menu-hd", { hasText: /Disengage/i }).click();
await p1.page.waitForTimeout(300);
ok("pointing at one explains it, and only it",
  await p1.page.locator(".menu-more").count(), 1);
ok("in play terms",
  /without anyone getting a free swing/i.test(await p1.page.locator(".menu-more .what").innerText()),
  true);
await p1.page.screenshot({ path: `${OUT}/67-menu.png`, fullPage: true });

await p1.page.locator(".menu-hd", { hasText: /Dodge/i }).click();
await p1.page.waitForTimeout(300);
await p1.page.getByRole("button", { name: "Do it" }).click();
await p1.page.waitForTimeout(700);
ok("taking one spends the action",
  await p1.page.locator('[aria-label="Action spent"]').count(), 1);
ok("and says what to tell the table",
  /dodge taken/i.test(await p1.page.locator(".pt-took").innerText()), true);

await p1.page.getByRole("button", { name: "What else can I do?" }).click();
await p1.page.waitForTimeout(400);
await p1.page.locator(".menu-hd", { hasText: /Dodge/i }).click();
await p1.page.waitForTimeout(300);
ok("and the rest now say why they cannot be taken",
  /your action is gone/i.test(await p1.page.locator(".menu-more .what").innerText()), true);
ok("with no way to take them", await p1.page.getByRole("button", { name: "Do it" }).count(), 0);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
