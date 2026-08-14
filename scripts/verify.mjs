/* Drives the built app in the installed Chrome: create a character, take a
   hit, spend a slot, long-rest, then undo the rest. Asserts the numbers the
   domain tests already cover actually reach the screen. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://localhost:4173/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 430, height: 1000 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

const hp = () => page.locator(".hp-big").innerText();
const ok = (label, got, want) => {
  const pass = got === want;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};

/** Sections are tabs now; content is one tap away rather than a scroll. */
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".hp-big");
ok("starts at full", (await hp()).replace(/\s+/g, " "), "52 / 52");
ok("proficiency shown", await page.locator(".strip div").nth(3).locator("b").innerText(), "+3");
ok("passive perception", await page.locator(".strip div").nth(4).locator("b").innerText(), "16");
await page.screenshot({ path: `${OUT}/1-sheet.png`, fullPage: false });

// 29 damage -> bloodied
await page.locator(".controls input").first().fill("29");
await page.getByRole("button", { name: "Damage", exact: true }).click();
await page.waitForTimeout(700);
ok("after damage", (await hp()).replace(/\s+/g, " "), "23 / 52");
ok("bar tone is bloodied", await page.locator(".hpbar").getAttribute("class"), "hpbar is-bloodied");
await page.screenshot({ path: `${OUT}/2-damaged.png` });

// spend two first-level slots via pips
const slotRow = page.locator(".pool", { hasText: "Level 1 slots" });
await slotRow.locator("button.pip.on").last().click();
await slotRow.locator("button.pip.on").last().click();
ok("slots spent", await slotRow.locator(".ct").innerText(), "2 of 4");

// long rest: preview then commit
await page.getByRole("button", { name: "Long rest" }).click();
await page.waitForSelector(".preview");
const preview = (await page.locator(".preview").innerText()).replace(/\s+/g, " ");
ok("preview restores hp", preview.includes("23→52"), true);
await page.screenshot({ path: `${OUT}/3-rest-preview.png` });
await page.getByRole("button", { name: "Take the rest" }).click();
await page.waitForTimeout(700);
ok("rested to full", (await hp()).replace(/\s+/g, " "), "52 / 52");
ok("slots back", await slotRow.locator(".ct").innerText(), "4 of 4");

// undo the rest from the feed — replay without it, no inverse operation
await go(page, "log");
const restRow = page.locator(".fr", { hasText: "Long rest" }).first();
await restRow.getByRole("button", { name: "Undo" }).click();
await page.waitForTimeout(700);
await go(page, "sheet");
ok("undo restores pre-rest hp", (await hp()).replace(/\s+/g, " "), "23 / 52");
ok("undo restores spent slots", await slotRow.locator(".ct").innerText(), "2 of 4");
await page.screenshot({ path: `${OUT}/4-undone.png` });

// persistence across a reload
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".hp-big");
ok("survives reload", (await hp()).replace(/\s+/g, " "), "23 / 52");

console.log(errors.length ? `\nCONSOLE ERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
