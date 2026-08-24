/* The DM's book: monsters by kind, and spells at all.

   A complete compendium ships 6,633 monsters under 416 distinct type strings,
   which is not a filter, it is a second search. And there was nowhere for a
   DM to look up a spell — a player casts Hold Person, the table looks at the
   DM, and the DM had the whole bestiary and not one spell. */
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
const ctx = await browser.newContext({ viewport: { width: 430, height: 1500 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Start a room" }).click();
await page.waitForSelector(".rb-code");
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".seatbar");
await page.selectOption('select[aria-label="Seat"]', "dm");
await page.waitForTimeout(600);
await go(page, "book");

// --- monsters -------------------------------------------------------------
const ref = page.locator(".card", { hasText: "Reference" }).first();
await ref.getByRole("button", { name: "Monsters" }).click();
await page.waitForTimeout(2500);

const kinds = await ref.locator(".roles").first().locator(".role").allInnerTexts();
ok("the bestiary is piled by kind", kinds.length > 8, true);
ok("in the rulebook's fourteen rather than the file's four hundred",
  kinds.length <= 14, true);
ok("naming them", /undead/i.test(kinds.join(" ")) && /dragon/i.test(kinds.join(" ")), true);

const bands = await ref.locator(".roles").nth(1).locator(".role").allInnerTexts();
ok("and by how hard, in bands rather than decimals",
  bands.some((b) => /CR 0.2/i.test(b)) && bands.some((b) => /CR 17/i.test(b)), true);
await page.screenshot({ path: `${OUT}/E0-monster-kinds.png`, fullPage: true });

/* The list is capped at sixty for display, so counting rows cannot show a
   filter working — both sides read sixty. The chip's own tally is the pool
   behind it, which is what actually moves. */
const tally = async (label) =>
  Number((await ref.getByRole("button", { name: label }).innerText()).match(/(\d+)\s*$/)?.[1]);
const undead = await tally("Only undead");
const ooze = await tally("Only ooze");
ok("each pile knows its own size", undead > 0 && ooze > 0, true);
ok("and they are different piles", undead !== ooze, true);

/* The rows are capped at sixty for display and every pile here is bigger
   than that, so counting rows cannot show the filter biting. What the rows
   ARE is the proof: with a kind chosen, nothing of another kind survives. */
const rows = async () => ref.locator(".mrow").count();
const kindsShown = async () => [
  ...new Set((await ref.locator(".mrow .ty").allInnerTexts())
    .map((t) => t.split("(")[0].trim().toLowerCase())),
];
const beforeKinds = await kindsShown();
ok("unfiltered, the list is a mixture", beforeKinds.length > 1, true);

await ref.getByRole("button", { name: "Only ooze" }).click();
await page.waitForTimeout(600);
ok("choosing a kind leaves only that kind", await kindsShown(), ["ooze"]);
ok("and still has something to read", (await rows()) > 0, true);

await ref.getByRole("button", { name: "Only ooze" }).click();
await page.waitForTimeout(500);
ok("tapping it again gives the mixture back",
  (await kindsShown()).length > 1, true);

// --- spells, which the DM could not reach at all -------------------------
const book = page.locator(".card", { hasText: "Spells" }).first();
ok("the DM can look a spell up", await book.count(), 1);
await book.getByRole("button", { name: "Look one up" }).click();
await page.waitForTimeout(3000);

const roles = await book.locator(".roles .role").allInnerTexts();
ok("piled the same way a player's are",
  roles.some((r) => /damage/i.test(r)) && roles.some((r) => /control/i.test(r)), true);

await book.locator('input[aria-label="Search spells"]').fill("hold person");
await page.waitForTimeout(600);
const hits = book.locator(".menu-hd .nm");
ok("finding the one that was cast at the table",
  (await hits.allInnerTexts()).some((n) => /hold person/i.test(n)), true);

await book.locator(".menu-hd", { hasText: /hold person/i }).first().click();
await page.waitForTimeout(400);
const text = await book.locator(".menu-more .then").first().innerText();
/* Whole, not truncated: the DM is here to RULE on it, and the sentence that
   matters is usually the last one. */
ok("and reading the whole of it", text.length > 200, true);
ok("including how it ends", /end of its turns|saving throw/i.test(text), true);
await page.screenshot({ path: `${OUT}/E1-dm-spells.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
