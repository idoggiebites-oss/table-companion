/* Phase 4's exit criterion: a character crosses a threshold mid-fight and
   nothing interrupts; they resolve it later and eighteen skill modifiers move
   without anyone touching them. */
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
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1200 } });
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
await dm.page.waitForSelector(".seatbar");
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForSelector(".prow");

await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForSelector(".seatbar", { timeout: 20000 });
await sitAs(player.page, "Kira Vance");
await player.page.waitForSelector(".hp-big", { timeout: 15000 });

// --- milestone mode makes XP absent, not greyed ---------------------------
await dm.page.getByRole("button", { name: "Milestone" }).click();
await dm.page.waitForTimeout(400);
await go(dm.page, "party");
ok("no XP column in a milestone campaign", await dm.page.locator(".prow .xp").count(), 0);
ok("and no XP award control",
  await dm.page.locator('input[aria-label="XP to award"]').count(), 0);
await dm.page.getByRole("button", { name: "Experience" }).click();
await dm.page.waitForTimeout(400);
ok("experience mode brings it back", await dm.page.locator(".prow .xp").count(), 1);

// --- a threshold crossed mid-fight must not interrupt ---------------------
await go(dm.page, "fight");
await dm.page.getByRole("button", { name: "Roll for initiative" }).click();
await dm.page.waitForSelector('input[aria-label="Kira Vance initiative"]');
await dm.page.locator('input[aria-label="Kira Vance initiative"]').fill("15");
await dm.page.getByRole("button", { name: "Set Kira Vance initiative" }).click();
await dm.page.getByRole("button", { name: "Begin", exact: true }).click();
await dm.page.waitForSelector(".cbt");
await player.page.waitForSelector(".cbt", { timeout: 15000 });

await go(dm.page, "party");
await dm.page.locator('input[aria-label="XP to award"]').fill("48000");
await dm.page.getByRole("button", { name: "Award the party" }).click();
await player.page.waitForTimeout(900);

ok("the DM sees a level owed", await dm.page.locator(".owe.on").innerText(), "1 LEVEL OWED");
ok("nothing interrupts the player mid-fight", await player.page.locator(".alarm").count(), 0);
ok("their combat view is untouched", await player.page.locator(".pt").count(), 1);
ok("but the sheet tab is marked", await player.page.locator('[data-tab="sheet"] .tab-dot').count(), 1);
await go(player.page, "sheet");
ok("and a quiet banner is waiting there", await player.page.locator(".lv").count(), 1);
ok("which says nothing is waiting on it",
  (await player.page.locator(".lv .faint").innerText()).includes("Nothing is waiting"), true);
await player.page.screenshot({ path: `${OUT}/32-pending.png` });

// --- resolved later, at the player's pace ---------------------------------
const before = {
  stealth: await player.page.getByRole("button", { name: /^stealth/ }).locator(".m").innerText(),
  prof: await player.page.locator(".strip div").nth(3).locator("b").innerText(),
  hp: (await player.page.locator(".hp-big").innerText()).replace(/\s+/g, " "),
};
ok("before: proficiency", before.prof, "+3");
ok("before: stealth", before.stealth, "+7");

await player.page.getByRole("button", { name: "Resolve it" }).click();
await player.page.waitForSelector(".lv-pad");
ok("it names the die", (await player.page.locator(".lv-ask").innerText()).includes("d10"), true);
ok("and offers the fixed average", (await player.page.locator(".lv-avg").innerText()).includes("8"), true);
await player.page.screenshot({ path: `${OUT}/33-levelup.png` });
await player.page.locator(".lv-pad button", { hasText: /^7$/ }).click();
await player.page.waitForTimeout(900);

ok("the banner is gone", await player.page.locator(".lv").count(), 0);
ok("hit points rose by the roll plus constitution",
  (await player.page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "52 / 61");
ok("proficiency moved", await player.page.locator(".strip div").nth(3).locator("b").innerText(), "+4");
ok("stealth moved with it, untouched by hand",
  await player.page.getByRole("button", { name: /^stealth/ }).locator(".m").innerText(), "+8");
ok("so did a saving throw",
  await player.page.locator(".stat.rollable", { hasText: /^dex/ }).first().locator(".m").innerText(), "+8");
ok("and the attack bonus",
  await player.page.locator(".atk", { hasText: "Longbow" }).locator(".m").innerText(), "+8");
ok("and hit dice",
  (await player.page.locator(".pool", { hasText: "Hit dice" }).locator(".ct").innerText()), "9 of 9");

// --- and the DM sees it resolved -----------------------------------------
await dm.page.waitForTimeout(900);
ok("the DM's roster shows the new level", await dm.page.locator(".owe").innerText(), "LEVEL 9");
ok("with the class line updated", (await dm.page.locator(".prow .cls").innerText()).toLowerCase(), "ranger 9");

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
