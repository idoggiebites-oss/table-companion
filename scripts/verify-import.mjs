/* Imports a Fight Club XML file through the real file input, checks the gaps
   are shown rather than hidden, and confirms the prefilled form produces a
   character the sheet renders correctly. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://localhost:4319/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 430, height: 1000 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

const ok = (label, got, want) => {
  const pass = got === want;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};

/* The builder is a flow: the rail is how you move between its steps. */
const atStep = async (page, label) => {
  const node = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await node.count()) { await node.first().click(); await page.waitForTimeout(250); }
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

/** Sections are tabs now; content is one tap away rather than a scroll. */
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};

await page.goto(URL, { waitUntil: "networkidle" });
await page.setInputFiles('input[type="file"]', "fixtures/kira.fc5.xml");
await page.waitForSelector(".read");

const read = (await page.locator(".read").innerText()).replace(/\s+/g, " ");
ok("read the name", read.includes("Kira Vance"), true);
ok("read the class", read.includes("ranger 8"), true);
ok("read max hp", read.includes("52"), true);
ok("read proficiencies", read.includes("2 saves · 5 skills"), true);

const issues = (await page.locator(".issues").innerText()).replace(/\s+/g, " ");
ok("names the armour class field", issues.includes("Armour class — Not in the export"), true);
ok("names the speed field", issues.includes("Speed — Not in the export"), true);
ok("warns about racial modifiers", issues.includes("NOT added"), true);
ok("surfaces the unmapped proficiency", issues.includes("Thieves' Tools"), true);
ok("flags missing spell slots", issues.toLowerCase().includes("slots by hand"), true);
await page.screenshot({ path: `${OUT}/8-import.png`, fullPage: true });

await page.getByRole("button", { name: "Fill the form with this" }).click();
ok("form took the name", await page.locator("#nm").inputValue(), "Kira Vance");
ok("form took the class", await page.locator("#cl").inputValue(), "ranger");
ok("form took the level", await page.locator("#lv").inputValue(), "8");
ok("form took a score", await page.locator("#ab-dex").inputValue(), "18");
ok("gap left at its default", await page.locator("#ac").inputValue(), "10");

// close the gaps the export could not carry, then create
await page.locator("#ac").fill("16");
await page.locator("#sp").fill("35");
await page.locator("#sl-0").fill("4");
await page.locator("#sl-1").fill("3");
await answerGear(page);
await atStep(page, "Review");
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".hp-big");

ok("sheet shows imported hp", (await page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "52 / 52");
ok("sheet shows the fixed armour class", await page.locator(".strip div").first().locator("b").innerText(), "16");
ok("proficiency derived from level", await page.locator(".strip div").nth(3).locator("b").innerText(), "+3");
ok("stealth from the import", await page.getByRole("button", { name: /^stealth/ }).locator(".m").innerText(), "+7");
ok("slots became a pool", await page.locator(".pool", { hasText: "Level 1 slots" }).locator(".ct").innerText(), "4 of 4");
await page.screenshot({ path: `${OUT}/9-imported-sheet.png` });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
