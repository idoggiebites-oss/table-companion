/* Homebrew: the escape hatch for everything the SRD cannot carry. It has to
   behave like any other creature, everywhere. */
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
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 1200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}

const dm = await device("dm");
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();
await dm.page.getByRole("button", { name: "Load sample" }).click();
await dm.page.waitForSelector('select[aria-label="Seat"]');
await dm.page.selectOption('select[aria-label="Seat"]', "dm");
await dm.page.waitForSelector(".pm-name");

await dm.page.getByRole("button", { name: "Add a creature" }).click();
await dm.page.waitForSelector('input[aria-label="Creature name"]', { timeout: 20000 });

await dm.page.locator('input[aria-label="Creature name"]').fill("Bandit Warlord");
await dm.page.locator('input[aria-label="Creature type"]').fill("humanoid");
await dm.page.locator('input[aria-label="Homebrew armour class"]').fill("17");
await dm.page.locator('input[aria-label="Homebrew hit dice"]').fill("9d8+18");
await dm.page.locator('input[aria-label="Homebrew str"]').fill("16");

// hit points are derived from the expression, and the range is stated
// Scoped to the homebrew note itself — a positional ".card-body p" broke
// the moment another panel rendered a paragraph earlier in the page.
const note = (await dm.page.locator(".hb-note").innerText()).replace(/\s+/g, " ");
ok("average hit points derived", note.includes("Average 58 hit points"), true);
ok("and the rolled range stated", note.includes("between 27 and 90"), true);

// a bad expression is refused rather than silently accepted
await dm.page.locator('input[aria-label="Homebrew hit dice"]').fill("loads");
ok("nonsense is rejected", await dm.page.locator(".err").count(), 1);
ok("and saving is blocked", await dm.page.getByRole("button", { name: "Save creature" }).isDisabled(), true);
await dm.page.locator('input[aria-label="Homebrew hit dice"]').fill("9d8+18");

// XP is suggested from SRD creatures at the same CR, never asserted
await dm.page.selectOption('select[aria-label="Homebrew challenge rating"]', "6");
await dm.page.waitForTimeout(300);
ok("XP suggested for CR 6", await dm.page.locator('input[aria-label="Homebrew XP"]').inputValue(), "2300");

await dm.page.locator('input[aria-label="Action name"]').fill("Greataxe");
await dm.page.locator('input[aria-label="Action description"]').fill("+6 to hit, 1d12+4 slashing");
await dm.page.screenshot({ path: `${OUT}/30-homebrew.png` });
await dm.page.getByRole("button", { name: "Save creature" }).click();
await dm.page.waitForSelector(".sv-row");
ok("saved", (await dm.page.locator(".sv-row .nm").first().innerText()), "Bandit Warlord");
ok("with its numbers", (await dm.page.locator(".sv-row").first().innerText()).includes("58 HP"), true);

// it behaves like any other creature in the reference
await dm.page.getByRole("button", { name: "Monsters" }).click();
await dm.page.waitForSelector(".mrow", { timeout: 20000 });
await dm.page.locator('input[aria-label="Search monsters"]').fill("warlord");
await dm.page.waitForTimeout(300);
ok("findable in the reference, marked as yours",
  (await dm.page.locator(".mrow .nm").first().innerText()).toLowerCase(), "bandit warlord yours");
await dm.page.locator(".mrow").first().click();
await dm.page.waitForSelector(".sb");
ok("its statblock renders", (await dm.page.locator(".sb").innerText()).includes("Greataxe"), true);

// and in the encounter builder, and into initiative
await dm.page.getByRole("button", { name: "Build" }).click();
await dm.page.waitForSelector('input[aria-label="Add a monster"]');
await dm.page.locator('input[aria-label="Add a monster"]').fill("warlord");
await dm.page.waitForSelector(".pick");
await dm.page.locator(".pick").first().click();
await dm.page.waitForSelector(".ent");
ok("its XP reaches the maths",
  (await dm.page.locator(".calc").innerText()).replace(/\s+/g, " ").toLowerCase().includes("2,300 raw xp"), true);

await dm.page.getByRole("button", { name: "Drop into initiative" }).click();
await dm.page.waitForSelector(".cbt", { timeout: 15000 });
const row = dm.page.locator(".cbt", { hasText: "Bandit Warlord" });
ok("it reached initiative", await row.count(), 1);
ok("with its own hit points, not a fallback",
  await row.locator(".hp").innerText(), "58/58");
await dm.page.screenshot({ path: `${OUT}/31-homebrew-fight.png` });

// and it syncs, because prep on a laptop is used on a tablet
const tablet = await device("tablet");
await tablet.page.locator('input[aria-label="Room code"]').fill(code);
await tablet.page.getByRole("button", { name: "Join", exact: true }).click();
await tablet.page.waitForSelector('select[aria-label="Seat"]', { timeout: 20000 });
await tablet.page.selectOption('select[aria-label="Seat"]', "dm");
await tablet.page.waitForSelector(".sv-row", { timeout: 20000 });
ok("the creature reached the other device",
  (await tablet.page.locator(".saved").innerText()).includes("Bandit Warlord"), true);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
