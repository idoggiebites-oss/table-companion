/* "Tell me when it's my turn" on an iPhone.

   Apple gives Web Push to a Home Screen app and not to a Safari tab: in a
   tab, PushManager and Notification do not exist at all. Every support check
   failed, the button rendered nothing, and the player was told nothing — a
   feature that looks broken rather than absent.

   Simulated rather than assumed: an iPhone user agent, and the two globals
   Apple withholds deleted before any of the app's code runs. That is what
   iOS Safari actually presents. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

/** A device, optionally pretending to be an iPhone with what Apple withholds. */
async function device({ ios = false, installed = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ...(ios ? { userAgent: IPHONE } : {}),
  });
  if (ios) {
    await ctx.addInitScript(`
      delete window.PushManager;
      delete window.Notification;
      ${installed ? "navigator.standalone = true;" : ""}
    `);
  }
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}

const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(400);
};

// A room with somebody in it, because the buzz control lives beside the fight.
const dm = await device();
await dm.getByRole("button", { name: "Start a room" }).click();
await dm.waitForSelector(".rb-code");
const code = await dm.locator(".rb-code").innerText();
await dm.getByRole("button", { name: "Load sample" }).click();
await dm.waitForSelector('select[aria-label="Seat"], .join-row');

const join = async (page) => {
  await page.locator('input[aria-label="Room code"]').fill(code);
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await page.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 20000 });
  const row = page.locator(".join-row", { hasText: "Kira Vance" });
  if (await row.count()) await row.first().click();
  await page.waitForSelector(".hp-big", { timeout: 20000 });
  await go(page, "combat");
};

/* --- the bug: an iPhone in a tab is told nothing ------------------------ */
const phone = await device({ ios: true });
await join(phone);
ok("an iPhone in a tab has no push API at all",
  await phone.evaluate(() => "PushManager" in window || "Notification" in window), false);
const said = await phone.locator(".buzz-no").count();
ok("so the app says why rather than showing nothing", said, 1);
const words = (await phone.locator(".buzz-no").innerText()).replace(/\s+/g, " ");
ok("and says what to do about it", /Add to Home Screen/i.test(words), true);
ok("naming whose rule it is, since the app cannot change it",
  /Apple/i.test(words), true);
/* And what they land in. An iOS Home Screen app has its own storage, so the
   installed app opens with no room and no character — a player who follows
   the instruction and finds an empty app has been sent somewhere worse. The
   code is carried in the sentence so they can get back. */
ok("warning that the installed app starts empty",
  /starts out empty/i.test(words), true);
ok("and carrying the room code across the gap",
  words.includes(code), true);
ok("with no button that could not work", await phone.locator(".buzz-go").count(), 0);

/* Installed, the same phone gets the ordinary control — this message must
   not outlive the reason for it. The support check is what decides, so an
   installed phone with the API present is the case that matters. */
const app = await device();
await join(app);
ok("an ordinary browser still gets the button", await app.locator(".buzz-go").count(), 1);
ok("and no install message", await app.locator(".buzz-no").count(), 0);

/* A desktop with no push support is a dead end, not an install: telling a
   Mac to add the app to its Home Screen would be nonsense. */
const desk = await browser.newContext({ viewport: { width: 1200, height: 900 } });
await desk.addInitScript("delete window.PushManager; delete window.Notification;");
const mac = await desk.newPage();
await mac.goto(URL, { waitUntil: "networkidle" });
await join(mac);
ok("a desktop without push is told nothing, because there is nothing to do",
  await mac.locator(".buzz-no, .buzz-go").count(), 0);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
await browser.close();
