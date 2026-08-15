/* What the app knows and had never said.

   Three things shipped with the data and were shown nowhere: what a condition
   does, what a class has given you, and what the numbers mean when you are on
   the floor. A first-time player needs all three, and the last one they need
   at the worst possible moment. */
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
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "domcontentloaded" });

await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });
await page.waitForTimeout(1200);
await go(page, "sheet");

// --- what a condition does ------------------------------------------------
ok("nothing is explained before anything is wrong",
  await page.locator(".cond").count(), 0);
await page.getByRole("button", { name: "Frightened", exact: true }).click();
await page.waitForTimeout(700);
ok("taking a condition explains it",
  await page.locator(".cond").count(), 1);
const cond = (await page.locator(".cond").innerText()).toLowerCase();
// The most asked question at a table, answered from data shipped since week one.
ok("in the rules' own words",
  cond.includes("disadvantage") && cond.includes("frightened"), true);
await page.getByRole("button", { name: "Frightened", exact: true }).click();
await page.waitForTimeout(500);
ok("and stops when it does", await page.locator(".cond").count(), 0);

// --- what your class gave you ---------------------------------------------
ok("features are listed", await page.locator(".feat-row").count() > 0, true);
const levels = await page.locator(".feat-hd .nm").allInnerTexts();
ok("newest first, because that is what people ask about",
  Number(levels[0].replace(/\D/g, "")) >= Number(levels[levels.length - 1].replace(/\D/g, "")), true);
await page.locator(".feat-hd").first().click();
await page.waitForTimeout(400);
ok("and open to show what they are",
  await page.locator(".feat-list .chip").count() > 0, true);
await page.screenshot({ path: `${OUT}/65-guidance.png`, fullPage: true });

// --- what the numbers mean when you are down ------------------------------
await page.locator('input[aria-label="Amount"]').fill("99");
await page.getByRole("button", { name: "Damage", exact: true }).click();
await page.waitForTimeout(700);
ok("being down is explained where it happens",
  await page.locator(".down-help").count(), 1);
const help = (await page.locator(".down-help").innerText()).toLowerCase();
ok("with the rule stated plainly",
  /ten or more/.test(help) && /three successes/.test(help), true);
ok("and the count so far", /you have 0 and 0/.test(help), true);
ok("with the traps named",
  /natural 20/i.test(await page.locator(".down-note").innerText()), true);

await page.getByRole("button", { name: "success", exact: true }).click();
await page.waitForTimeout(500);
ok("the count moves as saves are recorded",
  /you have 1 and 0/.test((await page.locator(".down-help").innerText()).toLowerCase()), true);

for (let i = 0; i < 2; i++) {
  await page.getByRole("button", { name: "success", exact: true }).click();
  await page.waitForTimeout(400);
}
ok("and once stable it says what happens next",
  /stable/i.test(await page.locator(".down-help").innerText()), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
