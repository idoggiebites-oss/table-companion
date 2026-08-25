/* The class as a card, and who the character is.

   A name in a dropdown told you nothing until you picked it and read the
   paragraph underneath — the wrong way round when the paragraph IS the
   choice. And the builder asked for every number a character has without ever
   asking who they were. */
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

/* Languages, tools and background skills are closed pickers now — sixteen and
   fifty-three of them laid out at once made this step three and a half screens
   tall. Open the one you want, then choose in it. */
const openPick = async (page, label) => {
  const hd = page.getByRole("button", { name: new RegExp(`^${label}, \\d+ chosen$`) });
  if ((await hd.count()) && (await hd.first().getAttribute("aria-expanded")) === "false") {
    await hd.first().click();
    await page.waitForTimeout(250);
  }
};

/* The builder is a flow now: one question per screen, and the rail is how you
   move between them. Every step is reachable at any time — which is also how a
   person changes their mind about a race after picking spells. */
const atStep = async (page, label) => {
  const node = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await node.count()) { await node.first().click(); await page.waitForTimeout(250); }
};
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(300);
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

await page.getByRole("button", { name: "Build a character" }).click();
await atStep(page, "Class");
await page.waitForSelector(".klass-cards", { timeout: 20000 });

// --- the class, before you commit to it ----------------------------------
await atStep(page, "Class");
await atStep(page, "Class");
const cards = page.locator(".klass");
ok("the twelve are cards", await cards.count(), 12);
ok("nothing is chosen to begin with", await page.locator(".klass.on").count(), 0);

await atStep(page, "Class");
const wizard = page.locator(".klass", { has: page.locator(".nm", { hasText: /^Wizard$/ }) }).first();
const wizardText = (await wizard.innerText()).replace(/\s+/g, " ");
ok("a card says what the class is for", /arcane|magic|spell/i.test(wizardText), true);
ok("and what it plays like",
  (await wizard.locator(".ktag").allInnerTexts()).map((t) => t.toLowerCase()),
  ["spellcaster", "control"]);
ok("and how much bookkeeping it asks — five dots for a wizard",
  await wizard.locator(".kcx i.f").count(), 5);
await atStep(page, "Class");
const fighter = page.locator(".klass", { has: page.locator(".nm", { hasText: /^Fighter$/ }) }).first();
ok("against one for a fighter", await fighter.locator(".kcx i.f").count(), 1);
await page.screenshot({ path: `${OUT}/A0-class-cards.png`, fullPage: true });

await fighter.click();
await page.waitForTimeout(500);
await atStep(page, "Class");
ok("choosing one marks it", await page.locator(".klass.on").count(), 1);
ok("and the flow can move on",
  await page.getByRole("button", { name: "Continue" }).isDisabled(), false);

// --- who they are ---------------------------------------------------------
await atStep(page, "Class");
for (const s of ["Athletics", "Perception"]) {
  await atStep(page, "Skills");
  await page.getByRole("button", { name: `Train ${s.toLowerCase()}` }).click();
}
await atStep(page, "Race");
await page.selectOption('select[aria-label="Race"]', "human");
await page.waitForTimeout(600);
await atStep(page, "Scores");
await page.getByRole("button", { name: "Recommend" }).click();
await page.waitForTimeout(500);

await atStep(page, "Story");
const who = page.locator(".card", { hasText: "Who are they?" }).first();
await who.scrollIntoViewIfNeeded();
ok("the builder asks who they are", await who.count(), 1);
ok("and says none of it is required",
  /optional/i.test(await who.locator(".card-hd").innerText()), true);

const BOND = "I would do anything to protect my sister, Liora.";
await who.locator('textarea[aria-label="Bonds"]').fill(BOND);
await who.locator('textarea[aria-label="Flaws"]').fill("I never back down, even when I should.");
await who.locator('select[aria-label="Alignment"]').selectOption("Chaotic good");
await page.waitForTimeout(300);
// Against the string rather than a number I counted by hand and got wrong.
ok("counting what is left of the line",
  (await who.locator(".who-ct").allInnerTexts()).includes(`${BOND.length} / 120`), true);
await page.screenshot({ path: `${OUT}/A1-identity.png`, fullPage: true });

// Finish, and find it on the sheet.
await atStep(page, "Story");
await openPick(page, "Skills");
await page.getByRole("button", { name: "Train nature" }).click();
await atStep(page, "Story");
await openPick(page, "Skills");
await page.getByRole("button", { name: "Train animal handling" }).click();
await atStep(page, "Story");
await page.locator('input[aria-label="Background name"]').fill("Soldier");
await atStep(page, "Review");
await page.locator('input[aria-label="Character name"]').fill("Kaelen Lightfoot");
await atStep(page, "Gear");
const sel = page.locator('select[aria-label^="Choose"]');
for (let i = 0; i < (await sel.count()); i++) await sel.nth(i).selectOption({ index: 1 });
await atStep(page, "Scores");
const cls = page.locator(".card", { hasText: "Your class" }).locator("select");
for (let i = 0; i < (await cls.count()); i++) await cls.nth(i).selectOption({ index: 1 });
await atStep(page, "Gear");
const kit = page.locator(".kit select");
for (let i = 0; i < (await kit.count()); i++) await kit.nth(i).selectOption({ index: 1 });
await page.waitForTimeout(400);
await atStep(page, "Review");
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".hp-big", { timeout: 20000 });
await go(page, "sheet");

const card = page.locator(".card", { hasText: "Who they are" }).first();
await card.scrollIntoViewIfNeeded();
const said = (await card.innerText()).replace(/\s+/g, " ");
ok("it reaches the sheet", /protect my sister/i.test(said), true);
ok("with the alignment", /chaotic good/i.test(said), true);
ok("and only what was written — the blanks stay blank",
  /personality/i.test(said), false);
await page.screenshot({ path: `${OUT}/A2-identity-sheet.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
