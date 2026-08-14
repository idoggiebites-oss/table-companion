/* Who is allowed to be the DM.

   The seat is device-local and always was, but "which seats this device may
   take" is not the device's business to decide. The room knows who started it,
   so the room answers. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  // Arrays are compared by value here — several assertions are seat lists.
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};
// The class kit can ask which martial weapon; answer it before creating.
const answerGear = async (page) => {
  const sel = page.locator('select[aria-label^="Choose"]');
  for (let i = 0; i < (await sel.count()); i++) {
    await sel.nth(i).selectOption({ index: 1 });
  }
  await page.waitForTimeout(200);
};

/** Sections are tabs now; content is one tap away rather than a scroll. */
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1300 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => {
    // The deliberate wrong-key attempt below is answered with a 403, which the
    // browser logs. That is the server working, not a fault.
    // Production sends no status text, so this reads "403 ()" there and
    // "403 (Forbidden)" locally. Either way it is the server refusing the
    // deliberate wrong key below.
    if (m.type() !== "error" || /\b403\b/.test(m.text())) return;
    errors.push(`${name}: ${m.text()}`);
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}
const seats = (p) => p.locator('select[aria-label="Seat"] option').allInnerTexts();

const dm = await device("dm");
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();

// A character has to exist before there is a seat bar at all.
await dm.page.getByRole("button", { name: "Build a character" }).click();
await dm.page.waitForSelector('select[aria-label="Class"]', { timeout: 20000 });
await dm.page.selectOption('select[aria-label="Class"]', "fighter");
await dm.page.waitForTimeout(300);
for (const s of ["Athletics", "Perception"]) {
  await dm.page.getByRole("button", { name: s, exact: true }).click();
}
await dm.page.selectOption('select[aria-label="Race"]', "human");
await dm.page.waitForTimeout(400);
await dm.page.getByRole("button", { name: "Recommend" }).click();
await dm.page.getByRole("button", { name: "nature", exact: true }).click();
await dm.page.getByRole("button", { name: "animal handling", exact: true }).click();
await dm.page.locator('input[aria-label="Background name"]').fill("Soldier");
await dm.page.locator('input[aria-label="Character name"]').fill("Kira Vance");
await answerGear(dm.page);
await dm.page.getByRole("button", { name: "Create character" }).click();
await dm.page.waitForSelector('select[aria-label="Seat"]', { timeout: 20000 });

ok("the DM may sit anywhere — including in a character",
  await seats(dm.page), ["the DM", "Kira Vance"]);
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForTimeout(400);
await go(dm.page, "book");
ok("and the DM's own tools are there", await dm.page.getByRole("button", { name: "Monsters" }).count(), 1);
await go(dm.page, "party");

const player = await device("player");
await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForSelector('select[aria-label="Seat"]', { timeout: 20000 });
await player.page.waitForTimeout(1200);

ok("a player is offered characters and nothing else", await seats(player.page), ["Kira Vance"]);
// The seat DEFAULTS to the DM on a fresh device, so hiding the option is not
// enough — a player who never touches the selector must still be moved off it.
ok("and is not left sitting in the DM's seat by default",
  await player.page.locator('select[aria-label="Seat"]').inputValue(), await dm.page
    .locator('select[aria-label="Seat"] option', { hasText: "Kira Vance" }).getAttribute("value"));
// Stronger with tabs: the section does not exist for them at all.
ok("so the monster reference is not theirs to open",
  await player.page.locator('[data-tab="book"]').count(), 0);

// Reload: the answer has to survive, on both sides, or a DM refreshing the
// page loses their own campaign.
await dm.page.reload({ waitUntil: "networkidle" });
await dm.page.waitForSelector('select[aria-label="Seat"]', { timeout: 20000 });
await dm.page.waitForTimeout(1500);
ok("the DM is still the DM after a reload", await seats(dm.page), ["the DM", "Kira Vance"]);
ok("and still in the DM's seat",
  await dm.page.locator('select[aria-label="Seat"]').inputValue(), "dm");

await player.page.reload({ waitUntil: "networkidle" });
await player.page.waitForSelector('select[aria-label="Seat"]', { timeout: 20000 });
await player.page.waitForTimeout(1500);
ok("the player is still not, after a reload", await seats(player.page), ["Kira Vance"]);

// ---- the DM key: a second device, and recovery after losing one ----------

ok("the key is not on screen by default — the room bar is what people lean over to read",
  await dm.page.locator(".rb-second .rb-code").count(), 0);
ok("a player is never even offered it", await player.page.getByRole("button", { name: "DM key" }).count(), 0);

await dm.page.getByRole("button", { name: "DM key" }).click();
await dm.page.waitForSelector(".rb-second .rb-code");
const key = await dm.page.locator(".rb-second .rb-code").innerText();
await dm.page.screenshot({ path: "/tmp/tc-shots/43-dm-key.png", clip: { x: 0, y: 0, width: 430, height: 240 } });
ok("it is grouped for typing, not shouting", /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key), true);
ok("and is not the join code", key.replace("-", "") === code, false);

// The tablet: the same DM, a second device. It joins like anyone else first.
const tablet = await device("tablet");
await tablet.page.locator('input[aria-label="Room code"]').fill(code);
await tablet.page.getByRole("button", { name: "Join", exact: true }).click();
await tablet.page.waitForSelector('select[aria-label="Seat"]', { timeout: 20000 });
await tablet.page.waitForTimeout(1200);
ok("arrives as a player like anyone else", await seats(tablet.page), ["Kira Vance"]);

await tablet.page.getByRole("button", { name: /I.m the DM/ }).click();
await tablet.page.screenshot({ path: "/tmp/tc-shots/44-claim.png", clip: { x: 0, y: 0, width: 430, height: 240 } });
await tablet.page.locator('input[aria-label="DM key"]').fill("QQQQQQQQ");
await tablet.page.getByRole("button", { name: "Claim DM" }).click();
await tablet.page.waitForTimeout(900);
ok("a wrong key is refused", await tablet.page.locator(".rb-error").innerText(), "That key does not match.");
ok("and changes nothing", await seats(tablet.page), ["Kira Vance"]);

await tablet.page.locator('input[aria-label="DM key"]').fill(key);
await tablet.page.getByRole("button", { name: "Claim DM" }).click();
await tablet.page.waitForTimeout(1200);
ok("the right key seats the tablet as a DM too", await seats(tablet.page), ["the DM", "Kira Vance"]);
await tablet.page.selectOption('select[aria-label="Seat"]', "dm");
await tablet.page.waitForTimeout(400);
await go(tablet.page, "book");
ok("with the DM's tools", await tablet.page.getByRole("button", { name: "Monsters" }).count(), 1);

// Additive, not a transfer: the laptop is still the DM. A DM with two devices
// is one person, not a handover.
await dm.page.reload({ waitUntil: "networkidle" });
await dm.page.waitForSelector('select[aria-label="Seat"]', { timeout: 20000 });
await dm.page.waitForTimeout(1500);
ok("and the first device did not lose the seat", await seats(dm.page), ["the DM", "Kira Vance"]);

// Leaving the room returns a device to being its own table.
await player.page.getByRole("button", { name: "Leave" }).click();
await player.page.waitForTimeout(800);
ok("a device on its own is its own DM again", await seats(player.page), ["the DM", "Kira Vance"]);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
