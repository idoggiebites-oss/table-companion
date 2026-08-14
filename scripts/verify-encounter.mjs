/* The phase 3 exit criterion: build an encounter beforehand, open it later,
   and run the fight without typing a monster stat. */
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

// --- the night before, on a laptop --------------------------------------
const laptop = await device("laptop");
await laptop.page.getByRole("button", { name: "Start a room" }).click();
await laptop.page.waitForSelector(".rb-code");
const code = await laptop.page.locator(".rb-code").innerText();
await laptop.page.getByRole("button", { name: "Load sample" }).click();
await laptop.page.waitForSelector('select[aria-label="Seat"]');
await laptop.page.selectOption('select[aria-label="Seat"]', "dm");
await laptop.page.waitForSelector(".pm-name");

await go(laptop.page, "prep");
await laptop.page.getByRole("button", { name: "Build" }).click();
await laptop.page.waitForSelector('input[aria-label="Add a monster"]', { timeout: 20000 });

await laptop.page.locator('input[aria-label="Add a monster"]').fill("goblin");
await laptop.page.waitForSelector(".pick");
await laptop.page.locator(".pick", { hasText: /^Goblin/ }).first().click();
await laptop.page.waitForSelector(".ent");
for (let i = 0; i < 5; i++) await laptop.page.locator('button[aria-label="One more Goblin"]').click();
ok("six goblins", await laptop.page.locator(".ent .ct").first().innerText(), "6");

// the working, not just the verdict
const calc = (await laptop.page.locator(".calc").innerText()).replace(/\s+/g, " ").toLowerCase();
ok("raw XP summed across instances", calc.includes("300 raw xp"), true);
ok("multiplier shown with its reason", calc.includes("2 6 creatures"), true);
ok("adjusted total shown", calc.includes("600 adjusted"), true);
ok("a band is rated against the party", (await laptop.page.locator(".band-name").innerText()).length > 0, true);
await laptop.page.screenshot({ path: `${OUT}/28-encounter.png` });

// the bracket step: one more goblin adds 50 raw but 275 adjusted
await laptop.page.locator('button[aria-label="One more Goblin"]').click();
const calc7 = (await laptop.page.locator(".calc").innerText()).replace(/\s+/g, " ").toLowerCase();
ok("seventh goblin adds its raw XP", calc7.includes("350 raw xp"), true);
ok("and crosses a multiplier bracket", calc7.includes("2.5 7 creatures"), true);
ok("so adjusted jumps by more than its worth", calc7.includes("875 adjusted"), true);
await laptop.page.locator('button[aria-label="One fewer Goblin"]').click();

// prep-time disclosure and rolled hit points
await laptop.page.locator('button[aria-label="Goblin disclosure"]').click(); // vague -> exact
await laptop.page.locator('button[aria-label="Goblin disclosure"]').click(); // exact -> hidden
await laptop.page.locator('button[aria-label="Goblin hit points"]').click(); // average -> rolled
ok("disclosure set at prep", await laptop.page.locator('button[aria-label="Goblin disclosure"]').innerText(), "HIDDEN");
ok("hit points set to rolled", await laptop.page.locator('button[aria-label="Goblin hit points"]').innerText(), "ROLLED");

await laptop.page.locator('input[aria-label="Encounter name"]').fill("Road ambush");
await laptop.page.getByRole("button", { name: "Save for later" }).click();
await go(laptop.page, "prep");
await laptop.page.waitForSelector(".sv-row");
ok("saved for later", await laptop.page.locator(".sv-row .nm").innerText(), "Road ambush");

// --- at the table, on a different device ---------------------------------
const tablet = await device("tablet");
await tablet.page.locator('input[aria-label="Room code"]').fill(code);
await tablet.page.getByRole("button", { name: "Join", exact: true }).click();
await tablet.page.waitForSelector('select[aria-label="Seat"]', { timeout: 20000 });
await tablet.page.waitForTimeout(1000);
// The DM's second device is still the DM, but it has to prove it — joining
// with the room code makes you a player, whoever you are.
await laptop.page.getByRole("button", { name: "DM key" }).click();
const dmKey = await laptop.page.locator(".rb-second .rb-code").innerText();
await tablet.page.getByRole("button", { name: /I.m the DM/ }).click();
await tablet.page.locator('input[aria-label="DM key"]').fill(dmKey);
await tablet.page.getByRole("button", { name: "Claim DM" }).click();
await tablet.page.waitForTimeout(1200);
await tablet.page.selectOption('select[aria-label="Seat"]', "dm");
await tablet.page.waitForTimeout(600);
await go(tablet.page, "prep");
await tablet.page.waitForSelector(".sv-row", { timeout: 20000 });
ok("the prep arrived on the other device",
  await tablet.page.locator(".sv-row .nm").innerText(), "Road ambush");
ok("with its creature count", (await tablet.page.locator(".sv-row").innerText()).includes("6 creatures"), true);

// one tap
await tablet.page.getByRole("button", { name: "Drop in" }).click();
await tablet.page.waitForSelector(".cbt", { timeout: 15000 });
const names = await tablet.page.locator(".cbt .nm").allInnerTexts();
ok("six labelled instances plus the character", names.length, 7);
ok("instances are numbered, not stacked", names.includes("Goblin 1") && names.includes("Goblin 6"), true);

const hps = await tablet.page.locator(".cbt", { hasText: /Goblin/ }).locator(".hp").allInnerTexts();
const maxes = hps.map((h) => Number(h.split("/")[1]));
ok("every goblin has its own hit points", maxes.length, 6);
ok("rolled, so they are not all identical", new Set(maxes).size > 1, true);
ok("and every roll is possible on 2d6",
  maxes.length > 0 && maxes.every((m) => m >= 2 && m <= 12), true);
await tablet.page.screenshot({ path: `${OUT}/29-dropped.png` });

// the disclosure default came with them
await laptop.page.waitForTimeout(900);
const playerView = await device("player");
await playerView.page.locator('input[aria-label="Room code"]').fill(code);
await playerView.page.getByRole("button", { name: "Join", exact: true }).click();
await playerView.page.waitForSelector('select[aria-label="Seat"]', { timeout: 20000 });
await playerView.page.selectOption('select[aria-label="Seat"]', { label: "Kira Vance" });
await playerView.page.waitForTimeout(1200);
const seen = await playerView.page.locator(".cbt .nm").allInnerTexts();
ok("hidden creatures are absent for the player", seen.some((n) => n.startsWith("Goblin")), false);
ok("the player still sees themselves", seen.includes("Kira Vance"), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
