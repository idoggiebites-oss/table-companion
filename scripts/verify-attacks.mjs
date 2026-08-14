/* Attacks: the derived bonus, finesse, off-hand damage, and rolling to hit
   through the same pad as everything else. */
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

/** Sections are tabs now; content is one tap away rather than a scroll. */
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
const row = (name) => page.locator(".atk", { hasText: name }).first();

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".hp-big");

ok("three attacks listed", await page.locator(".atk").count(), 3);
ok("longbow bonus derived", await row("Longbow").locator(".m").innerText(), "+7");
ok("longbow damage line", await row("Longbow").locator(".d").innerText(), "1d8+4 piercing · 150/600 ft");
ok("finesse used dexterity", await page.locator(".atk", { hasText: "Shortsword" }).first().locator(".d").innerText(), "1d6+4 piercing · finesse, light");
ok("off-hand adds no ability mod", await row("off-hand").locator(".d").innerText(), "1d6 piercing · no ability modifier");
await page.screenshot({ path: `${OUT}/14-attacks.png` });

// rolling to hit uses the same pad, and reminds you what damage to roll
await row("Longbow").click();
await page.waitForSelector(".rollpad");
ok("pad names the attack", (await page.locator(".rp-title").innerText()).toLowerCase().replace(/\s+/g, " "), "longbow +7");
ok("pad reminds the damage", await page.locator(".rp-note").innerText(), "Damage 1d8+4 piercing · 150/600 ft");
await page.locator(".rp-pad button", { hasText: /^13$/ }).click();
ok("to-hit total", await page.locator(".rp-total").innerText(), "20");
ok("attack row marked", await row("Longbow").getAttribute("class"), "atk sel");
await page.screenshot({ path: `${OUT}/15-attack-roll.png` });
await page.keyboard.press("Escape");

await go(page, "log");
ok("roll reached the feed", (await page.locator(".feed").innerText()).includes("Longbow 20"), true);
await go(page, "sheet");

// a hand-entered attack derives its bonus from ability and proficiency
page.once("dialog", (d) => d.accept()); // must be armed before the click
await page.getByRole("button", { name: "Start over" }).click();
await page.waitForSelector('input[type="file"]');
// The manual form is folded away by default now — thirty fields should not
// be the first thing on an empty table.
await page.getByRole("button", { name: "Enter by hand" }).click();
await page.locator("#nm").fill("Brom");
await page.selectOption("#cl", "fighter");
await page.locator("#lv").fill("5");
await page.locator("#ab-str").fill("18");
await page.getByRole("button", { name: "Add attack" }).click();
await page.locator('input[aria-label="Attack 1 name"]').fill("Greataxe");
await page.selectOption('select[aria-label="Attack 1 ability"]', "str");
await page.selectOption('select[aria-label="Attack 1 die"]', "12");
await page.locator('input[aria-label="Attack 1 damage type"]').fill("slashing");
await page.getByRole("button", { name: "Create character" }).click();
await page.waitForSelector(".hp-big");
// str +4, proficiency +3 at level 5
ok("entered attack derives +7", await row("Greataxe").locator(".m").innerText(), "+7");
ok("entered attack damage", await row("Greataxe").locator(".d").innerText(), "1d12+4 slashing");

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
