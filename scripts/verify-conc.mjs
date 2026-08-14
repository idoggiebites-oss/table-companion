/* The concentration loop: start it, take damage, get prompted with the right
   DC, roll a real d20, and watch it hold or drop. Plus conditions and
   exhaustion, which are ordinary state. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://localhost:4319/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 430, height: 1000 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

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
const face = (n) => page.locator(".rp-pad button", { hasText: new RegExp(`^${n}$`) });
const damage = async (n) => {
  await page.locator(".controls input").first().fill(String(n));
  await page.getByRole("button", { name: "Damage", exact: true }).click();
  await page.waitForTimeout(250);
};

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".hp-big");

// conditions are plain state
await page.getByRole("button", { name: "Prone", exact: true }).click();
await page.getByRole("button", { name: "Frightened", exact: true }).click();
ok("two conditions on", await page.locator(".chip.on.bad").count(), 2);
await page.getByRole("button", { name: "Prone", exact: true }).click();
ok("toggled one back off", await page.locator(".chip.on.bad").count(), 1);

// exhaustion is a level, and names its effect
await page.getByRole("button", { name: "Increase exhaustion" }).click();
await page.getByRole("button", { name: "Increase exhaustion" }).click();
ok("exhaustion effect for level 2", await page.locator(".exh").innerText(), "speed halved");

// no save owed while not concentrating
await damage(22);
ok("no prompt without concentration", await page.locator(".alarm").count(), 0);

await page.locator('input[aria-label="Spell to concentrate on"]').fill("Hunter's Mark");
await page.getByRole("button", { name: "Concentrate", exact: true }).click();
ok("concentrating", (await page.locator(".chip.conc").innerText()).toLowerCase(), "hunter's mark");

// 22 damage owes DC 11 — half, rounded down, floored at 10
await damage(22);
await page.waitForSelector(".alarm");
ok("prompt names the DC", (await page.locator(".alarm-q").innerText()).replace(/\s+/g, " "), "A Constitution save is owed · DC 11");
await page.screenshot({ path: `${OUT}/10-concentration.png` });

await page.getByRole("button", { name: "Roll the save" }).click();
await page.waitForSelector(".rollpad");
ok("pad carries the DC", await page.locator(".rp-ask").innerText(), "Roll a d20 and add +2. DC 11.");
await face(4).click(); // 4 + 2 = 6, misses DC 11
ok("verdict shown", (await page.locator(".rp-verdict").innerText()).toLowerCase(), "failed · dc 11");
await page.waitForTimeout(200);
ok("concentration dropped", await page.locator(".chip.conc").count(), 0);
ok("prompt cleared", await page.locator(".alarm").count(), 0);
await page.screenshot({ path: `${OUT}/11-conc-failed.png` });
await page.keyboard.press("Escape");

// a successful save keeps it
await page.locator('input[aria-label="Spell to concentrate on"]').fill("Spike Growth");
await page.getByRole("button", { name: "Concentrate", exact: true }).click();
await damage(6); // DC 10
await page.getByRole("button", { name: "Roll the save" }).click();
await face(15).click(); // 17 beats DC 10
await page.waitForTimeout(200);
ok("held on a success", (await page.locator(".chip.conc").innerText()).toLowerCase(), "spike growth");
await page.keyboard.press("Escape");

// Undo is replay, not time travel. Reverting the newest save re-owes it...
await go(page, "log");
await page.locator(".fr", { hasText: "concentration save" }).first()
  .getByRole("button", { name: "Undo" }).click();
await page.waitForTimeout(200);
await go(page, "sheet");
ok("undoing the latest save re-owes it", await page.locator(".alarm").count(), 1);
ok("still on the later spell", (await page.locator(".chip.conc").innerText()).toLowerCase(), "spike growth");

// ...while reverting the OLD failed save changes nothing visible, because the
// later concentrationStarted still replays and still clears what it cleared.
await go(page, "log");
await page.locator(".fr", { hasText: "concentration save" }).last()
  .getByRole("button", { name: "Undo" }).click();
await page.waitForTimeout(200);
await go(page, "sheet");
ok("reverting an older save does not resurrect the older spell",
  (await page.locator(".chip.conc").innerText()).toLowerCase(), "spike growth");

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
