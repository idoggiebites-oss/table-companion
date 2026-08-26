/* The only claim worth testing: does it work with the network gone.
   Everything else about a PWA is paperwork. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://localhost:4319/";
const OUT = "/tmp/tc-shots";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const context = await browser.newContext({ viewport: { width: 430, height: 940 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const ok = (label, got, want) => {
  const pass = got === want;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};

/* Skills and saves sit behind a press now: the sheet stopped being forty rows
   to scroll past on the way to the hit points. */
const openDrawer = async (page, which) => {
  const hd = page.getByRole("button", { name: new RegExp(`^${which}, `) });
  await hd.waitFor({ timeout: 20000 });
  if ((await hd.getAttribute("aria-expanded")) !== "true") await hd.click();
  await page.waitForTimeout(300);
};

/** Sections are tabs now; content is one tap away rather than a scroll. */
const go = async (page, tab) => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(250);
};

await page.goto(URL, { waitUntil: "networkidle" });

// manifest is linked and parses
const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
ok("manifest linked", typeof manifestHref === "string", true);
const manifest = await page.evaluate(async (href) => (await fetch(href)).json(), manifestHref);
ok("app name", manifest.name, "Table Companion");
ok("standalone display", manifest.display, "standalone");
ok("has a maskable icon", manifest.icons.some((i) => i.purpose === "maskable"), true);
ok("no orientation lock", manifest.orientation, undefined);
ok("apple touch icon present", await page.locator('link[rel="apple-touch-icon"]').count(), 1);

// the service worker installs, activates, and claims this very page
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });
ok("service worker controlling", await page.evaluate(() => navigator.serviceWorker.controller !== null), true);

const cached = await page.evaluate(async () => {
  const names = await caches.keys();
  const out = [];
  for (const n of names) out.push(...(await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname));
  return out;
});
ok("icons precached, not just declared", cached.some((p) => p.endsWith("icon-512.png")), true);
ok("apple touch icon precached", cached.some((p) => p.endsWith("apple-touch-icon.png")), true);

// make a character so there is state to survive the outage
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".hp-big");
await page.locator(".controls input").first().fill("12");
await page.getByRole("button", { name: "Damage", exact: true }).click();
await page.waitForTimeout(400);

// pull the plug
await context.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector(".hp-big", { timeout: 15000 });
ok("app loads with no network", (await page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "40 / 52");

// and is still fully usable offline
await (await openDrawer(page, "Skills"), page).getByRole("button", { name: /^perception/ }).click();
await page.waitForSelector(".rollpad");
await page.locator(".rp-pad button", { hasText: /^11$/ }).click();
ok("rolling works offline", await page.locator(".rp-total").innerText(), "17");
await page.keyboard.press("Escape");
await page.locator(".controls input").first().fill("8");
await page.getByRole("button", { name: "Heal", exact: true }).click();
await page.waitForTimeout(300);
ok("state changes offline", (await page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "48 / 52");
await page.screenshot({ path: `${OUT}/16-offline.png` });

// and survives a second offline reload
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector(".hp-big", { timeout: 15000 });
ok("offline writes persisted", (await page.locator(".hp-big").innerText()).replace(/\s+/g, " "), "48 / 52");

await context.setOffline(false);
console.log(errors.length ? `\nPAGE ERRORS:\n${errors.join("\n")}` : "\nno page errors");
if (errors.length) process.exitCode = 1;
await browser.close();
