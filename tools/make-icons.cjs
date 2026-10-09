// Draws the app icons (PNG) from icons/icon.svg. Run: node tools/make-icons.cjs  (needs Playwright)
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const dir = path.resolve(__dirname, "..", "icons");
const svg = fs.readFileSync(path.join(dir, "icon.svg"), "utf8");
// "any" icons fill the square; the maskable one keeps its art inside the middle 80% so any shape can crop it
const sizes = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size, mask] of sizes) {
    await page.setViewportSize({ width: size, height: size });
    const inner = mask
      ? `<div style="position:absolute;inset:10%">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div>`
      : svg.replace("<svg ", '<svg width="100%" height="100%" ');
    await page.setContent(
      `<body style="margin:0;background:#1c2250;position:relative;width:${size}px;height:${size}px;overflow:hidden">${inner}</body>`,
    );
    await page.screenshot({ path: path.join(dir, name), omitBackground: false });
    console.log("wrote", name);
  }
  await browser.close();
})();
