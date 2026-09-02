/* 44px, everywhere a thumb goes — measured on the page rather than read off
   the stylesheet.

   Four controls have shipped too small to press: background chips at 30, feat
   rows at 39, the skills table's proficiency circle at 18 (the only way to
   train a skill), and a creature's rename button at 0. Every one was found by
   somebody tapping twice at a table and reporting it as a different bug.

   `check-css` reads the stylesheet whole and refuses a `min-height` under 44
   without a stated reason. What it cannot see is a control that never
   declares one — sized by its padding, its content, or a class it borrowed —
   which is three of those four. Only the rendered box knows.

   So this walks the app: twelve screens, the sheet with its drawers open, and
   the builder step by step, which is where three of the four lived. It asserts
   nothing about how any of them is styled. It measures what a thumb has to
   hit, at 390px, which is the narrowest phone the app claims to support. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const TAP = 44;
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};

/* Everything a finger is meant to land on. A zero-sized box is not on screen
   — collapsed drawers and the steps you are not standing on are full of them
   — and measuring those would report the whole app as broken. */
const TOO_SMALL = (tap) => {
  const out = [];
  for (const el of document.querySelectorAll('button, select, input, [role="button"]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.height >= tap) continue;
    const name = (el.getAttribute("aria-label") || el.textContent || el.tagName)
      .trim().replace(/\s+/g, " ").slice(0, 34);
    const cls = (el.className || "").toString().split(" ").filter(Boolean).join(".");
    out.push(`${Math.round(r.height)}px ${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""} "${name}"`);
  }
  return [...new Set(out)];
};

/* Joined rather than compared as arrays: two empty arrays are not equal under
   the JSON compare this harness uses, and a failure has to PRINT what it
   found or the next person only learns that something, somewhere, is 33px. */
const measure = async (page, where) =>
  ok(`nothing under ${TAP}px on ${where}`, (await page.evaluate(TOO_SMALL, TAP)).join(" | "), "");

async function device() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1400 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(URL, { waitUntil: "networkidle" });
  return page;
}
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(400);
};

// --- a campaign somebody is playing ---------------------------------------
const app = await device();
await app.getByRole("button", { name: "The table", exact: true }).click();
await app.getByRole("button", { name: "Start a room" }).click();
await app.waitForSelector(".rb-code");
await measure(app, "the room, before anything");

await app.getByRole("button", { name: "Load sample" }).click();
await app.waitForSelector('select[aria-label="Seat"], .join-row');
await app.waitForTimeout(600);
await app.selectOption('select[aria-label="Seat"]', "dm");
await app.waitForTimeout(500);
for (const tab of ["party", "prep", "book", "log", "combat"]) {
  await go(app, tab);
  await measure(app, `the DM's ${tab}`);
}

/* The two sheets behind the header. Everything that used to be a bar across
   the top of every screen is in one of them now. */
for (const which of ["The table", "This device"]) {
  await app.getByRole("button", { name: which }).click();
  await app.waitForTimeout(250);
  await measure(app, `${which} sheet`);
  await app.getByRole("button", { name: `Close ${which}` }).click();
  await app.waitForTimeout(200);
}

const seats = await app.locator('select[aria-label="Seat"] option').allInnerTexts();
await app.selectOption('select[aria-label="Seat"]', { label: seats.find((o) => !/dm/i.test(o)) });
await app.waitForTimeout(700);
for (const tab of ["sheet", "spells", "gear", "notes", "log", "combat"]) {
  if (!(await app.locator(`[data-tab="${tab}"]`).count())) continue;
  await go(app, tab);
  await measure(app, `a player's ${tab}`);
}

/* The skills table's tick was 18px behind one of these. */
await go(app, "sheet");
for (const which of ["Skills", "Saves", "Features"]) {
  const hd = app.getByRole("button", { name: new RegExp(`^${which}, `) });
  if (await hd.count()) { await hd.first().click(); await app.waitForTimeout(300); }
}
await measure(app, "the sheet with its drawers open");

// --- and the builder, step by step ----------------------------------------
// Background chips at 30 and feat rows at 39 both lived in here.
const build = await device();
await build.getByRole("button", { name: "The table", exact: true }).click();
await build.getByRole("button", { name: "Start a room" }).click();
await build.waitForSelector(".rb-code");
await build.getByRole("button", { name: "Build a character" }).click();
await build.waitForSelector(".klass-cards", { timeout: 20000 });
await measure(build, "the builder's first question");
await build.getByRole("button", { name: "Ranger", exact: true }).click();
await build.waitForTimeout(400);
for (const label of ["Race", "Story", "Scores", "Skills", "Gear", "Review"]) {
  const node = build.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (!(await node.count())) continue;
  await node.first().click();
  await build.waitForTimeout(350);
  await measure(build, `the builder's ${label.toLowerCase()} step`);
}

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
