/* What a spell is for, before you read a word of it.

   "Faerie Fire" and "Fog Cloud" mean nothing to somebody choosing their first
   cantrips, and reading twenty descriptions to find the one that does damage
   is homework rather than a choice. */
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
const atStep = async (page, label) => {
  const node = page.getByRole("button", { name: new RegExp(`^Step \\d+, ${label}$`) });
  if (await node.count()) { await node.first().click(); await page.waitForTimeout(250); }
};
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });

await page.getByRole("button", { name: "Build a character" }).click();
await page.waitForSelector(".klass-cards", { timeout: 20000 });

// The mark carries the class's colour; nothing else does.
const hue = await page.locator(".klass", { has: page.locator(".nm", { hasText: /^Wizard$/ }) })
  .locator(".kg").evaluate((el) => getComputedStyle(el).color);
const hue2 = await page.locator(".klass", { has: page.locator(".nm", { hasText: /^Fighter$/ }) })
  .locator(".kg").evaluate((el) => getComputedStyle(el).color);
ok("a class mark carries its own colour", hue !== hue2, true);
const nameColour = await page.locator(".klass .nm").first()
  .evaluate((el) => getComputedStyle(el).color);
const nameColour2 = await page.locator(".klass .nm").nth(3)
  .evaluate((el) => getComputedStyle(el).color);
ok("but the names stay the ink they are everywhere else", nameColour, nameColour2);

// A druid: enough spells in every pile for the chips to matter.
await page.getByRole("button", { name: "Druid", exact: true }).click();
await page.waitForTimeout(600);
for (const s of ["nature", "perception"]) {
  const t = page.getByRole("button", { name: `Train ${s}` });
  if (await t.count()) await t.click();
}
await atStep(page, "Race");
await page.selectOption('select[aria-label="Race"]', { index: 1 });
await page.waitForTimeout(600);
await atStep(page, "Spells");
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /^Cantrips,/ }).first().click();
await page.waitForTimeout(1400);

const names = () => page.locator(".chooser-list .menu-hd .nm").allInnerTexts();
const all = await names();
ok("cantrips are offered", all.length > 0, true);

const tags = await page.locator(".chooser-list .menu-hd .role").allInnerTexts();
ok("each says what it is for", tags.length, all.length);
ok("in the four words a person can hold in their head",
  [...new Set(tags.map((t) => t.toLowerCase()))].every((t) =>
    ["damage", "healing", "control", "utility"].includes(t)), true);
await page.screenshot({ path: `${OUT}/D0-roles.png`, fullPage: true });

// The chips narrow the list to one pile.
const chip = page.locator(".roles .role", { hasText: /^Damage/ }).first();
ok("and the piles can be asked for one at a time", await chip.count(), 1);
await chip.click();
await page.waitForTimeout(500);
const only = await page.locator(".chooser-list .menu-hd .role").allInnerTexts();
/* Counted before it is judged. `every` on an empty array is true, so this
   assertion passed while the tags were not rendering at all — which is how a
   broken row read as a working filter. */
ok("which leaves something to choose", only.length > 0, true);
ok("and shows only that pile", only.every((t) => /damage/i.test(t)), true);
ok("fewer than everything", only.length < all.length, true);
await page.screenshot({ path: `${OUT}/D1-roles-filtered.png`, fullPage: true });

await chip.click();
await page.waitForTimeout(400);
ok("tapping it again gives them all back", (await names()).length, all.length);


// --- skills, and the class box ------------------------------------------
await atStep(page, "Skills");
ok("skills are a step of their own now",
  await page.locator(".skl").count(), 1);
/* Named, not numbered. This pinned Skills to position 2 and broke the day
   the order changed — the claim was only ever that skills are a step of
   their own with a name on the rail, and where they sit in the flow is a
   product decision this suite has no opinion about. */
ok("named on the rail",
  await page.getByRole("button", { name: /^Step \d+, Skills$/ }).count(), 1);
ok("and no longer buried under the class",
  await page.locator(".klass-cards").count(), 0);

await atStep(page, "Class");
/* Twelve cards is taller than a phone. They scroll inside their own box so
   the rail and the running total stay on screen. */
const box = await page.locator(".klass-cards").evaluate((el) => ({
  scrolls: el.scrollHeight > el.clientHeight + 4,
  within: el.clientHeight < window.innerHeight,
}));
ok("the classes scroll inside their own card", box.scrolls, true);
ok("rather than moving the page", box.within, true);
const railTop = await page.locator(".cr-rail").boundingBox();
await page.locator(".klass-cards").evaluate((el) => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(300);
const railAfter = await page.locator(".cr-rail").boundingBox();
ok("so the rail does not move when you scroll them", railTop.y, railAfter.y);
await page.screenshot({ path: `${OUT}/D2-class-box.png`, fullPage: false });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
