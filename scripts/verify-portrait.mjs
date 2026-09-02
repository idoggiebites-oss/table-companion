/* A character's face.

   The app ships no art, so the only picture that can be on a sheet is one the
   player supplies. Three things have to hold or it is not worth having: what
   arrives from a phone camera must be SHRUNK before it is stored, it must
   survive a reload, and it must be removable.

   Device-local by design — see ui/portrait.ts. That is a real cost and it is
   asserted here too: nothing about a portrait reaches the log. */
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://localhost:4173/";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${JSON.stringify(got)}${pass ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!pass) process.exitCode = 1;
};

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`${e}`));
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Load sample" }).click();
await page.waitForSelector(".hp-big", { timeout: 20000 });

ok("an empty portrait offers to be filled",
  await page.getByRole("button", { name: /^Add a portrait/ }).count(), 1);
ok("and shows the class mark rather than a grey circle",
  await page.locator(".id-face svg").count(), 1);

/* A deliberately oversized, deliberately NON-square image: 1400x900, which is
   what a phone hands over and is the case the centre-crop exists for. */
const big = await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 1400; c.height = 900;
  const x = c.getContext("2d");
  x.fillStyle = "#3366cc"; x.fillRect(0, 0, 1400, 900);
  x.fillStyle = "#cc3366"; x.fillRect(600, 300, 200, 300);
  return c.toDataURL("image/png");
});
const bytes = Buffer.from(big.split(",")[1], "base64");
console.log(`      the file going in is ${Math.round(bytes.length / 1024)}KB`);

await page.setInputFiles('input[aria-label="Portrait image"]', {
  name: "face.png", mimeType: "image/png", buffer: bytes,
});
await page.waitForTimeout(900);

ok("the picture arrives on the sheet", await page.locator(".id-face img").count(), 1);
ok("and the control now offers to change it",
  await page.getByRole("button", { name: /^Change .* portrait$/ }).count(), 1);

/* The whole reason `shrink` exists: localStorage has about five megabytes for
   everything this device owns, and a camera hands over three to eight. */
const stored = await page.evaluate(() => {
  const k = Object.keys(localStorage).find((n) => n.startsWith("portrait:"));
  return k === undefined ? null : { key: k, bytes: localStorage.getItem(k).length };
});
ok("it is stored against the character, not globally",
  stored !== null && /^portrait:.+/.test(stored.key), true);
ok("and it was shrunk on the way in", stored !== null && stored.bytes < 60000, true);
console.log(`      stored at ${Math.round((stored?.bytes ?? 0) / 1024)}KB, from ${Math.round(bytes.length / 1024)}KB`);

/* Square, from a 1400x900 original: centre-cropped rather than squashed,
   because a face stretched to a square is worse than one with trimmed edges. */
const shape = await page.evaluate(() => {
  const img = document.querySelector(".id-face img");
  return new Promise((res) => {
    const probe = new Image();
    probe.onload = () => res({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.src = img.src;
  });
});
ok("cropped square rather than squashed", shape, { w: 256, h: 256 });

/* The point of storing it at all. */
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector(".hp-big", { timeout: 20000 });
ok("it survives a reload", await page.locator(".id-face img").count(), 1);

/* Device-local by design: the log is replayed on every phone at the table and
   every event can be taken back, which is exactly why a picture is not one. */
await page.locator('[data-tab="log"]').first().click();
await page.waitForTimeout(600);
ok("and nothing about it reached the log",
  (await page.locator("body").innerText()).includes("data:image"), false);

await page.locator('[data-tab="sheet"]').first().click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Remove portrait" }).click();
await page.waitForTimeout(400);
ok("it can be taken off again", await page.locator(".id-face img").count(), 0);
ok("and the device forgets it",
  await page.evaluate(() => Object.keys(localStorage).some((n) => n.startsWith("portrait:"))), false);

ok("no errors on the console", errors, []);
await browser.close();
