/* Renders the app mark to PNG using the installed Chrome, so icons are
   generated from one SVG source rather than committed as opaque binaries.
   Re-run after changing MARK. */
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const GROUND = "#0F1211";
const STEEL = "#6E8FA8";

/** A d20 in outline — the instrument, not the fantasy. */
const MARK = (inset) => `
  <rect width="512" height="512" fill="${GROUND}"/>
  <g transform="translate(256 256) scale(${1 - inset}) translate(-256 -256)">
    <path d="M256 64 L432 168 L432 344 L256 448 L80 344 L80 168 Z"
          fill="none" stroke="${STEEL}" stroke-width="26" stroke-linejoin="round"/>
    <path d="M256 64 L256 208 M256 208 L432 168 M256 208 L80 168
             M256 208 L160 396 M256 208 L352 396"
          fill="none" stroke="${STEEL}" stroke-width="16" stroke-linejoin="round" opacity="0.85"/>
  </g>`;

const svg = (inset) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${MARK(inset)}</svg>`;

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});

async function png(file, size, inset) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:${GROUND}}svg{display:block;width:${size}px;height:${size}px}</style>${svg(inset)}`,
  );
  await page.screenshot({ path: file, omitBackground: false });
  await page.close();
  console.log(`  ${file} (${size}px)`);
}

console.log("icons:");
await png("public/icon-192.png", 192, 0);
await png("public/icon-512.png", 512, 0);
// Maskable icons are cropped to a circle; keep the mark inside the inner 80%.
await png("public/icon-maskable-512.png", 512, 0.2);
await png("public/apple-touch-icon.png", 180, 0.06);

writeFileSync("public/icon.svg", svg(0));
console.log("  public/icon.svg");

await browser.close();
