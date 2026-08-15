/* Starting equipment, in the builder.

   A character who arrives with nothing is one the first fight cannot use. The
   SRD writes the choices as prose — "(a) a martial weapon and a shield or (b)
   two martial weapons" — so the real claim under test is that the sentence
   became a choice, and that what was chosen is actually being carried. */
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
// The builder asks two kinds of question before it will finish: which martial
// weapon the kit means, and what the class asks about itself — a domain, a
// fighting style. Answer both.
const answerGear = async (page) => {
  const sel = page.locator('select[aria-label^="Choose"]');
  for (let i = 0; i < (await sel.count()); i++) {
    await sel.nth(i).selectOption({ index: 1 });
  }
  const cls = page.locator(".card", { hasText: "Your class" }).locator("select");
  for (let i = 0; i < (await cls.count()); i++) {
    await cls.nth(i).selectOption({ index: 1 });
  }
  await page.waitForTimeout(250);
};
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector('select[aria-label="Class"]', { timeout: 20000 });
await page.selectOption('select[aria-label="Class"]', "fighter");
await page.waitForTimeout(400);
for (const s of ["Athletics", "Perception"]) {
  await page.getByRole("button", { name: s, exact: true }).click();
}
await page.selectOption('select[aria-label="Race"]', "human");
await page.waitForTimeout(600);
await page.waitForSelector(".gear-step");

// The sentence became a choice.
const opts = (n) => page.locator(".gear-choice").nth(n).locator(".chip").allInnerTexts();
ok("the book's prose became lettered options",
  (await opts(0)).map((t) => t.toLowerCase()),
  ["chain mail", "leather armor, longbow, and 20 arrows"]);
ok("and a three-way one stays three",
  (await opts(3)).length, 2); // fighter's pack choice is two
ok("a category is asked as a question, not assumed",
  await page.locator('select[aria-label="Choose martial weapon"]').count(), 1);
await page.screenshot({ path: `${OUT}/55-gear-step.png`, fullPage: true });

// An unanswered category must not be silently dropped from the kit.
await page.getByRole("button", { name: "Recommend" }).click();
await page.getByRole("button", { name: "nature", exact: true }).click();
await page.getByRole("button", { name: "animal handling", exact: true }).click();
await page.locator('input[aria-label="Background name"]').fill("Soldier");
await page.locator('input[aria-label="Character name"]').fill("Kira Vance");
await page.waitForTimeout(400);
// This suite is about the GEAR gate, so settle what the class asks first —
// otherwise the two blocks are indistinguishable.
const cls = page.locator(".card", { hasText: "Your class" }).locator("select");
for (let i = 0; i < (await cls.count()); i++) await cls.nth(i).selectOption({ index: 1 });
await page.waitForTimeout(300);

const create = page.getByRole("button", { name: "Create character" });
ok("an unanswered weapon choice blocks creation rather than vanishing",
  await create.isDisabled(), true);
ok("and says which one", (await page.locator(".card").last().innerText()).toLowerCase()
  .includes("martial weapon"), true);

await page.selectOption('select[aria-label="Choose martial weapon"]', { label: "Greatsword" });
await page.waitForTimeout(400);
ok("answering it unblocks", await create.isDisabled(), false);

// Take the second option on the armour choice, to prove the pick is read.
await page.locator(".gear-choice").first().getByRole("button", { name: /leather armor/i }).click();
await page.waitForTimeout(400);
await create.click();
await page.waitForSelector(".tabs", { timeout: 20000 });
await go(page, "gear");

const carried = (await page.locator(".inv-row .nm").allInnerTexts()).map((t) => t.toLowerCase());
ok("the chosen armour is carried, not the other one", carried.some((c) => c.includes("leather armor")), true);
ok("and the one not chosen is not", carried.some((c) => c.includes("chain mail")), false);
ok("the rest of that option came with it",
  carried.some((c) => c.includes("longbow")) && carried.some((c) => c.includes("arrow")), true);
ok("the quantity survived", (await page.locator(".inv-row", { hasText: /arrow/i }).innerText()).includes("20"), true);
ok("the category answer is carried", carried.some((c) => c.includes("greatsword")), true);
ok("and the fixed half of the choice too", carried.some((c) => c.includes("shield")), true);
await page.screenshot({ path: `${OUT}/56-carried.png`, fullPage: true });

// One event, so one undo takes the whole kit back.
await go(page, "log");
ok("the kit arrived as one line", (await page.locator(".feed").innerText()).toLowerCase()
  .includes("was given"), true);

// --- buying your own instead --------------------------------------------
await page.getByRole("button", { name: "Add character" }).click();
await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector('select[aria-label="Class"]', { timeout: 20000 });
await page.selectOption('select[aria-label="Class"]', "monk");
await page.waitForTimeout(400);
// Named, not read off the page: .chip is uppercased in CSS, so innerText
// gives "ACROBATICS" while the accessible name is still "Acrobatics".
for (const s of ["Acrobatics", "Stealth"]) {
  await page.getByRole("button", { name: s, exact: true }).first().click();
}
await page.selectOption('select[aria-label="Race"]', "human");
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Buy your own" }).click();
await page.waitForTimeout(300);
// The monk's wealth is 5d4 with NO multiplier, which is the one that catches
// people out — and 12.5 gp is why money is copper.
ok("the monk's purse is not multiplied",
  (await page.locator(".gear-step .cr-note").innerText()).includes("12 gp 5 sp"), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
