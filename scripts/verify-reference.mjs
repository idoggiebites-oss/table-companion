/* The SRD reference: DM only, loaded on demand, and present offline. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const ctx = await browser.newContext({ viewport: { width: 430, height: 1100 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

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

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector('select[aria-label="Seat"], .join-row');

// A player must not be able to look monsters up — that is the disclosure
// ladder. With tabs the claim gets stronger: the section does not exist for
// them at all, so there is nothing to find rather than something to hide.
ok("a player has no Book tab", await page.locator('[data-tab="book"]').count(), 0);

await page.selectOption('select[aria-label="Seat"]', "dm");
await page.waitForSelector(".tabs");
await go(page, "book");
ok("dm has one", await page.getByRole("button", { name: "Monsters" }).count(), 1);

// the data is not fetched until it is asked for
const before = await page.evaluate(() =>
  performance.getEntriesByType("resource").filter((r) => r.name.includes("monsters.json")).length);
ok("nothing loaded before opening", before, 0);

await page.getByRole("button", { name: "Monsters" }).click();
await page.waitForSelector(".mrow", { timeout: 20000 });
const after = await page.evaluate(() =>
  performance.getEntriesByType("resource").filter((r) => r.name.includes("monsters.json")).length);
ok("fetched on first open", after, 1);
// 334 SRD creatures, plus whatever a shipped compendium adds. Asserting the
// floor keeps this true either way.
const total = Number(
  /of (\d+)/.exec(await page.locator(".card-body p.faint").last().innerText())?.[1] ?? "0",
);
ok("the whole SRD is there, and anything shipped with it", total >= 334, true);

await page.locator('input[aria-label="Search monsters"]').fill("goblin");
await page.waitForTimeout(300);
const names = await page.locator(".mrow .nm").allInnerTexts();
ok("search finds the goblin", names.includes("Goblin"), true);

await page.locator(".mrow", { hasText: /^Goblin/ }).first().click();
await page.waitForSelector(".sb");
const sb = (await page.locator(".sb").innerText()).replace(/\s+/g, " ");
ok("armour class is right", sb.includes("15 AC"), true);
ok("hit points and dice are right", sb.includes("7 HP (2d6)"), true);
ok("it carries its actions", sb.includes("Scimitar"), true);
ok("and its traits", sb.toLowerCase().includes("nimble escape"), true);
await page.screenshot({ path: `${OUT}/27-reference.png` });

// searching by creature type, which is how a DM actually looks
await page.locator('input[aria-label="Search monsters"]').fill("dragon");
await page.waitForTimeout(300);
ok("type search returns dragons", (await page.locator(".mrow").count()) > 5, true);

// CR filter
await page.locator('input[aria-label="Search monsters"]').fill("");
await page.locator('input[aria-label="Maximum challenge rating"]').fill("1");
await page.waitForTimeout(300);
const crs = await page.locator(".mrow .cr").allInnerTexts();
ok("every result is within the band", crs.every((c) => {
  const v = c.replace("CR ", "");
  const n = v.includes("/") ? Number(v.split("/")[0]) / Number(v.split("/")[1]) : Number(v);
  return n <= 1;
}), true);

// and it survives losing the network, which is the whole point at a table
await ctx.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
await go(page, "book");
await page.getByRole("button", { name: "Monsters" }).click();
await page.waitForSelector(".mrow", { timeout: 20000 });
ok("the reference works with no network", (await page.locator(".mrow").count()) > 0, true);
await ctx.setOffline(false);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
