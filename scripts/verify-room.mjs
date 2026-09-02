/* Two independent browser contexts — two devices — on one room.
   The claims: state arrives, changes flow both ways, and a device that goes
   away and comes back catches up without losing what it did while gone. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

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
const errors = [];
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}
const hp = async (d) => (await d.page.locator(".hp-big").innerText()).replace(/\s+/g, " ");
const damage = async (d, n) => {
  await d.page.locator(".controls input").first().fill(String(n));
  await d.page.getByRole("button", { name: "Damage", exact: true }).click();
};

const dm = await device("dm");
const player = await device("player");

// --- the DM starts a room and makes a character --------------------------
await dm.page.getByRole("button", { name: "The table", exact: true }).click();
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();
ok("code is six characters", code.length, 6);
/* The header keeps the two things that are READ — the code and a dot — and
   the dot carries its meaning in words, because a colour is not a state
   anybody can name. Everything pressed is behind the gear. */
await dm.page.waitForSelector(".rb-dot.s-online", { timeout: 15000 });
ok("dm is live", await dm.page.locator(".rb-dot").getAttribute("aria-label"), "Live");

await dm.page.getByRole("button", { name: "Load sample" }).click();
// A room's DM is not moved into a character they create — they make them for
// other people — so playing this one is a deliberate choice.
await dm.page.waitForSelector('select[aria-label="Seat"], .join-row');
await sitAs(dm.page, "Kira Vance");
await dm.page.waitForSelector(".hp-big");
await damage(dm, 12);
await dm.page.waitForTimeout(600);
ok("dm applied damage", await hp(dm), "40 / 52");

// --- a second device joins by code and receives the whole log ------------
await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "The table", exact: true }).click();
await player.page.getByRole("button", { name: "Join", exact: true }).click();
// A joining device starts in the DM seat; taking a character is the real flow.
await player.page.waitForSelector('select[aria-label="Seat"], .join-row', { timeout: 15000 });
await sitAs(player.page, "Kira Vance");
await player.page.waitForSelector(".hp-big", { timeout: 15000 });
ok("player received the character", await hp(player), "40 / 52");
ok("player sees the same code", await player.page.locator(".rb-code").innerText(), code);
// The count has to reach the people already in the room, not just the arrival.
await dm.page.waitForTimeout(700);
await dm.page.getByRole("button", { name: "The table" }).click();
ok("dm's member count updated when someone joined",
  (await dm.page.locator(".rb-status").innerText()).includes("2 JOINED"), true);
await dm.page.getByRole("button", { name: "Close The table" }).click();
await player.page.screenshot({ path: `${OUT}/18-joined.png` });

// --- changes flow both ways ----------------------------------------------
await damage(player, 5);
await dm.page.waitForTimeout(800);
ok("player's damage reached the dm", await hp(dm), "35 / 52");

await dm.page.locator(".controls input").first().fill("10");
await dm.page.getByRole("button", { name: "Heal", exact: true }).click();
await player.page.waitForTimeout(800);
ok("dm's healing reached the player", await hp(player), "45 / 52");

// --- a device sleeps, acts offline, and comes back -----------------------
await player.ctx.setOffline(true);
await player.page.waitForTimeout(300);
await damage(player, 7);                        // written while disconnected
await player.page.waitForTimeout(300);
ok("player applied offline", await hp(player), "38 / 52");

await damage(dm, 3);                            // the table moved on meanwhile
await dm.page.waitForTimeout(500);
ok("dm moved on while player was away", await hp(dm), "42 / 52");

await player.ctx.setOffline(false);
await player.page.waitForTimeout(4000);         // reconnect backoff + sync
ok("player caught up and kept its own write", await hp(player), "35 / 52");
ok("dm received the player's offline write", await hp(dm), "35 / 52");
await player.page.screenshot({ path: `${OUT}/19-resynced.png` });

// --- and the room survives a reload --------------------------------------
await player.page.reload({ waitUntil: "networkidle" });
await player.page.waitForSelector(".hp-big", { timeout: 15000 });
ok("room rejoined automatically after reload", await player.page.locator(".rb-code").innerText(), code);
ok("state intact after reload", await hp(player), "35 / 52");

// --- undo crosses devices -------------------------------------------------
await go(dm.page, "log");
await dm.page.locator(".fr", { hasText: "took 3" }).first().getByRole("button", { name: "Undo" }).click();
await player.page.waitForTimeout(800);
ok("undo on the dm corrected the player", await hp(player), "38 / 52");

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
