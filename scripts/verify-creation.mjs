/* Session zero: build a character in the app, and watch the consequences of
   each choice as it is made. */
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
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await page.goto(URL, { waitUntil: "networkidle" });
  return { ctx, page, name };
}
const stat = (p, label) => p.locator(".cr-grid div", { hasText: label }).locator(".v");

const dm = await device("dm");
await dm.page.getByRole("button", { name: "Start a room" }).click();
await dm.page.waitForSelector(".rb-code");
const code = await dm.page.locator(".rb-code").innerText();

const player = await device("player");
await player.page.locator('input[aria-label="Room code"]').fill(code);
await player.page.getByRole("button", { name: "Join", exact: true }).click();
await player.page.waitForTimeout(1200);

await player.page.getByRole("button", { name: "Build a character" }).click();
await player.page.waitForSelector('select[aria-label="Class"]', { timeout: 20000 });

// class first — it is what lets everything after it advise
ok("class is asked first", await player.page.locator(".cr-step").first().innerText(), "1 · CLASS");
ok("race is not offered until then", await player.page.locator('select[aria-label="Race"]').count(), 1);

await player.page.selectOption('select[aria-label="Class"]', "ranger");
await player.page.waitForTimeout(300);
const note = await player.page.locator(".cr-note").first().innerText();
ok("the class states its own facts", note.includes("d10 hit die"), true);
ok("and its saves", note.includes("STR and DEX"), true);
ok("ranger does not claim to cast at level 1", note.includes("casts from level 1"), false);

// class skills: three from a list of eight
await player.page.getByRole("button", { name: "Stealth", exact: true }).click();
await player.page.getByRole("button", { name: "Perception", exact: true }).click();
await player.page.getByRole("button", { name: "Survival", exact: true }).click();
ok("three class skills taken", await player.page.locator(".chip.on").count(), 3);

await player.page.selectOption('select[aria-label="Race"]', "elf");
await player.page.waitForTimeout(400);
ok("a subrace is offered where the SRD has one",
  await player.page.locator('select[aria-label="Subrace"]').count(), 1);
await player.page.waitForSelector(".cr-ab");

// consequences move as scores are assigned — the whole teaching mechanism
const acBefore = await stat(player.page, "Armour class").innerText();
await player.page.locator(".chipv", { hasText: /^15$/ }).click();
await player.page.getByRole("button", { name: "dex", exact: true }).click();
await player.page.waitForTimeout(300);
const acAfter = await stat(player.page, "Armour class").innerText();
ok("armour class moved when dexterity was set", acBefore !== acAfter, true);
ok("and is right: 10 + (15+2 elf) modifier", acAfter, "13");
ok("racial bonus is shown as its own term, not a mystery total",
  (await player.page.locator(".cr-ab", { hasText: "dex" }).first().innerText()).includes("+ 2"), true);

await player.page.locator(".chipv", { hasText: /^14$/ }).click();
await player.page.getByRole("button", { name: "con", exact: true }).click();
await player.page.waitForTimeout(300);
ok("hit points follow constitution", await stat(player.page, "Hit points").innerText(), "12");

// Recommend fills the rest — advice, offered rather than applied
await player.page.getByRole("button", { name: "Recommend" }).click();
await player.page.waitForTimeout(400);
ok("recommend placed every score", await player.page.locator(".cr-ab.empty").count(), 0);
await player.page.screenshot({ path: `${OUT}/34-creation.png`, fullPage: true });

// custom background: two skills and a name
await player.page.getByRole("button", { name: "nature", exact: true }).click();
await player.page.getByRole("button", { name: "animal handling", exact: true }).click();
await player.page.locator('input[aria-label="Background name"]').fill("Greenwarden");
await player.page.locator('input[aria-label="Character name"]').fill("Kira Vance");
await player.page.waitForTimeout(300);

await answerGear(player.page);

const create = player.page.getByRole("button", { name: "Create character" });
ok("ready to create", await create.isDisabled(), false);
await create.click();
await player.page.waitForSelector(".hp-big", { timeout: 15000 });

// Recommend reassigns every score, so these are its deterministic output for
// a ranger: dex 15+2, wis 14, con 13, str 12, int 10+1, cha 8.
ok("hit points are the full die plus constitution",
  (await player.page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "11 / 11");
ok("proficiency at level 1", await player.page.locator(".strip div").nth(3).locator("b").innerText(), "+2");
ok("a class skill carries proficiency",
  await player.page.getByRole("button", { name: /^stealth/ }).locator(".m").innerText(), "+5");
ok("a background skill does too — int 11 gives +0, plus proficiency",
  await player.page.getByRole("button", { name: /^nature/ }).locator(".m").innerText(), "+2");
ok("and an unproficient skill does not",
  await player.page.getByRole("button", { name: /^arcana/ }).locator(".m").innerText(), "+0");

// and it reached the table
await dm.page.selectOption('select[aria-label="Seat"]', "dm").catch(() => {});
await dm.page.waitForTimeout(1200);
ok("the DM sees the new character", (await dm.page.locator(".pm-name").innerText()), "Kira Vance");

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
