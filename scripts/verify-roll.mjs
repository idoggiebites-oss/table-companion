/* Drives the roll pad: normal, advantage keeping the higher die, and the
   dropped die appearing in the feed. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://localhost:4319/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 430, height: 940 } });
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

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".hp-big");

// perception is +6 for a Ranger 8 with wis 16 and proficiency
await page.getByRole("button", { name: /^perception/ }).click();
await page.waitForSelector(".rollpad");
ok("pad names the roll", (await page.locator(".rp-title").innerText()).replace(/\s+/g, " ").toLowerCase(), "perception +6");
ok("pad is pinned to the viewport", await page.locator(".rollpad").evaluate((el) => getComputedStyle(el).position), "fixed");
const box = await page.locator(".rollpad").boundingBox();
ok("pad sits at the bottom of the screen", Math.round(box.y + box.height) >= 930, true);
await page.screenshot({ path: `${OUT}/5-rollpad.png` });

await face(14).click();
ok("normal total", await page.locator(".rp-total").innerText(), "20");
ok("normal working", await page.locator(".rp-expl").innerText(), "perception 20 · 14 + 6");

// advantage: two taps, keeps the higher, names the dropped one
await page.getByRole("button", { name: "Advantage", exact: true }).click();
ok("asks for two dice", await page.locator(".rp-ask").innerText(), "Roll two d20. Tap the first.");
await face(7).click();
ok("asks for the second", await page.locator(".rp-ask").innerText(), "Tap the second die.");
await face(18).click();
ok("keeps the higher", await page.locator(".rp-total").innerText(), "24");
ok("names the dropped die", await page.locator(".rp-expl").innerText(), "perception 24 · 18 + 6 (7 dropped)");
await page.screenshot({ path: `${OUT}/6-advantage.png` });

// natural 20 called out on the kept die
await page.getByRole("button", { name: "Normal", exact: true }).click();
await face(20).click();
ok("natural 20 flagged", (await page.locator(".rp-expl").innerText()).includes("natural 20"), true);

// the row that opened it stays marked
ok("tapped row is marked", await page.locator(".stat.sel .n").first().innerText(), "perception WIS");

// escape closes
await page.keyboard.press("Escape");
ok("escape dismisses", await page.locator(".rollpad").count(), 0);

// rolls reach the feed and change no state
const hp = (await page.locator(".hp-big").innerText()).replace(/\s+/g, " ");
ok("rolling changed no state", hp, "52 / 52");
await go(page, "log");
const feed = (await page.locator(".feed").innerText()).replace(/\s+/g, " ");
ok("feed records the advantage roll", feed.includes("(7 dropped)"), true);
await page.screenshot({ path: `${OUT}/7-feed.png`, fullPage: true });

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
