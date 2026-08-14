/* The private door.

   A workers.dev subdomain is Cloudflare's zone, not ours, so Cloudflare
   Access — which needs a hostname you own — is not available. This is the
   same job in the Worker: one shared passphrase for one long-lived cookie.

   It is a door, not identity: it stops strangers, it does not tell one player
   from another. What keeps the DM's creatures hidden is still the disclosure
   ladder, which works on the seat. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://127.0.0.1:8787/";
const PASS = process.env.PASSPHRASE ?? "open-sesame";
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
// The gate is optional and currently off. Nothing to test on an open site,
// and asserting a door that was deliberately removed is noise.
if ((await (await fetch(URL)).status) !== 401) {
  console.log("SKIP  this deployment is not gated (no SITE_PASSPHRASE)");
  await browser.close();
  process.exit(0);
}

const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`${e}`));
// A locked API request is a 401 by design; the browser logs it.
page.on("console", (m) => m.type() === "error" && !/\b401\b/.test(m.text()) && errors.push(m.text()));
await page.goto(URL, { waitUntil: "domcontentloaded" });

ok("a stranger gets a door, not the app", await page.locator("form").count(), 1);
ok("and the app is not behind it in the DOM", await page.locator(".app").count(), 0);
ok("the door says what it is",
  (await page.locator("p").first().innerText()).toLowerCase().includes("private"), true);
await page.screenshot({ path: `${OUT}/61-gate.png` });

// The wrong answer says so and stays shut.
await page.locator('input[aria-label="Passphrase"]').fill("definitely not it");
await page.getByRole("button", { name: "Open" }).click();
await page.waitForTimeout(600);
ok("a wrong passphrase is refused", await page.locator("form").count(), 1);
ok("and says so rather than failing silently",
  (await page.locator("p").first().innerText()).toLowerCase().includes("not it"), true);

await page.locator('input[aria-label="Passphrase"]').fill(PASS);
await page.getByRole("button", { name: "Open" }).click();
await page.waitForSelector(".app", { timeout: 20000 });
ok("the right one opens the app", await page.locator(".app").count(), 1);

// The cookie is the point: it must survive a reload, and it must not be the
// passphrase itself.
const cookies = await ctx.cookies();
const tc = cookies.find((c) => c.name === "tc_pass");
ok("a cookie is set", tc !== undefined, true);
ok("holding a hash, never the passphrase", tc?.value.includes(PASS), false);
ok("and not readable by scripts", tc?.httpOnly, true);

await page.reload({ waitUntil: "networkidle" });
ok("no second challenge on reload", await page.locator("form.unlock, input[aria-label='Passphrase']").count(), 0);
ok("the app is simply there", await page.locator(".app").count(), 1);

// And the app still works through the door.
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".tabs", { timeout: 20000 });
ok("the SRD data loads through the gate",
  (await page.locator(".hp-big").innerText()).includes("/"), true);
await page.getByRole("button", { name: "Start a room" }).click();
await page.waitForSelector(".rb-code", { timeout: 20000 });
ok("and so does the room API", (await page.locator(".rb-code").innerText()).length, 6);
await page.waitForTimeout(1200);
ok("including the socket, which carries the cookie too",
  (await page.locator(".rb-status").innerText()).toLowerCase().includes("live"), true);

// A fresh device is challenged again — the cookie is per-browser.
const other = await browser.newContext({ viewport: { width: 430, height: 900 } });
const p2 = await other.newPage();
await p2.goto(URL, { waitUntil: "domcontentloaded" });
ok("another device is asked in its turn", await p2.locator("form").count(), 1);

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno console errors");
if (errors.length) process.exitCode = 1;
await browser.close();
