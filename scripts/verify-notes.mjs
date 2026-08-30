/* What a player wrote down.

   The one thing at a table that has always been on paper and the one thing
   nobody can find afterwards. In the log, because a note on one phone dies
   with that phone — which makes it readable by the DM's device, and the card
   says so rather than implying otherwise. What is tested here is that the
   promise the app prints is the promise it keeps: the other player's screen
   never shows it. */
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
  await page.waitForTimeout(300);
};
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}

const dm = await device("dm");
await dm.getByRole("button", { name: "Start a room" }).click();
await dm.waitForSelector(".rb-code");
const code = await dm.locator(".rb-code").innerText();
await dm.getByRole("button", { name: "Load sample" }).click();
await dm.waitForSelector('select[aria-label="Seat"], .join-row');
await dm.selectOption('select[aria-label="Seat"]', "dm");
await dm.waitForSelector(".pm-name");

// A second character, so there is somebody to be kept out.
await dm.getByRole("button", { name: "This device" }).click();
await dm.getByRole("button", { name: "Add character" }).click();
await dm.waitForTimeout(400);
await dm.getByRole("button", { name: "Load sample" }).click();
await dm.waitForTimeout(900);

const kira = await device("kira");
await kira.locator('input[aria-label="Room code"]').fill(code);
await kira.getByRole("button", { name: "Join", exact: true }).click();
await kira.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
const pick = kira.locator(".join-row").first();
if (await pick.count()) await pick.click();
await kira.waitForSelector(".hp-big", { timeout: 20000 });

// --- writing ---------------------------------------------------------------
await go(kira, "notes");
await kira.waitForSelector(".nt", { timeout: 20000 });
ok("the box says who can read it",
  /only you and the dm/i.test(await kira.locator(".nt-who").innerText()), true);
ok("and nothing is saved before it is written",
  await kira.getByRole("button", { name: "Save", exact: true }).isDisabled(), true);

const written = "The innkeeper lied about the cellar. Ask Bel about the ring.";
await kira.locator(".nt").fill(written);
await kira.waitForTimeout(300);
ok("typing marks it unsaved",
  /unsaved/i.test(await kira.locator(".card-hd .label.q").first().innerText()), true);
await kira.getByRole("button", { name: "Save", exact: true }).click();
await kira.waitForTimeout(700);
ok("saving says so", /saved/i.test(await kira.locator(".card-hd .label.q").first().innerText()), true);
await kira.screenshot({ path: `${OUT}/42-notes.png`, fullPage: true });

// --- it comes back ---------------------------------------------------------
/* The whole reason it is in the log rather than on the phone: another device,
   same character, same notes. */
const second = await device("second");
await second.locator('input[aria-label="Room code"]').fill(code);
await second.getByRole("button", { name: "Join", exact: true }).click();
await second.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
const same = second.locator(".join-row").first();
if (await same.count()) await same.click();
await second.waitForSelector(".hp-big", { timeout: 20000 });
await go(second, "notes");
await second.waitForSelector(".nt", { timeout: 20000 });
ok("a second device has them", await second.locator(".nt").inputValue(), written);

// --- and the promise -------------------------------------------------------
/* The DM can read them, which is what the card says. */
await go(dm, "log");
await dm.waitForTimeout(600);
const dmLog = await dm.locator(".feed").innerText();
ok("the DM's log records that something was written",
  /wrote something down/i.test(dmLog), true);
/* But never the note itself — a log is read over shoulders. */
ok("without printing it", /innkeeper/i.test(dmLog), false);

const bel = await device("bel");
await bel.locator('input[aria-label="Room code"]').fill(code);
await bel.getByRole("button", { name: "Join", exact: true }).click();
await bel.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
const rows = bel.locator(".join-row");
if ((await rows.count()) > 1) await rows.nth(1).click();
else await rows.first().click();
await bel.waitForSelector(".hp-big", { timeout: 20000 });
await go(bel, "log");
await bel.waitForTimeout(800);
ok("the other player is not told it happened",
  /wrote something down/i.test(await bel.locator(".feed").innerText()), false);
await go(bel, "notes");
await bel.waitForSelector(".nt", { timeout: 20000 });
ok("and their own page is their own", await bel.locator(".nt").inputValue(), "");

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
