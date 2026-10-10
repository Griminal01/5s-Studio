// Offline test: the app is served over http (a service worker needs it), loaded once, then the network is
// switched off and the page must still open and work. Run: node tests/offline.cjs
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = process.env.SITE_DIR
  ? path.resolve(process.env.SITE_DIR)
  : path.resolve(__dirname, ".."); // SITE_DIR: test a built copy
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file)) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, {
    "content-type": types[path.extname(file)] || "application/octet-stream",
  });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  const failures = [];
  const expect = (ok, msg) => ok || failures.push(msg);

  await page.goto(base);
  await page.waitForSelector("#authForm", { timeout: 10000 });
  // wait for the worker to take control and fill its cache
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(
    async () => {
      const keys = await caches.keys();
      if (!keys.length) return false;
      const c = await caches.open(keys[0]);
      return (
        (await c.keys()).length > 20 && !!navigator.serviceWorker.controller
      );
    },
    null,
    { timeout: 15000 },
  );
  const manifest = await page.evaluate(async () =>
    (await fetch("manifest.webmanifest")).json(),
  );
  expect(
    manifest.name === "Lean Studio" && manifest.icons.length >= 3,
    "the web app manifest is missing or incomplete",
  );

  // create an account and a project online, then lose the network
  await page.fill("[name=user]", "Offline");
  await page.press("[name=user]", "Enter");
  await page.waitForSelector("#svg", { timeout: 10000 });
  await page.evaluate(() => loadExample());
  // wait for the browser save to finish, not a fixed time: a slow machine can take longer
  await page.waitForFunction(
    () => STD().objects.length > 10 && !savePending && !saveRunning,
    null,
    { timeout: 10000 },
  );

  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector("#authForm, #svg", { timeout: 10000 });
  const first = await page.evaluate(() => ({
    title: document.title,
    auth: !document.getElementById("auth").hidden,
  }));
  expect(
    /Lean Studio/.test(first.title),
    "the page did not open offline: " + JSON.stringify(first),
  );
  // the last person opens straight away offline: people and projects live in the browser
  expect(!first.auth, "offline, the last person did not open straight away");
  await page.waitForSelector("#svg", { timeout: 10000 });
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    objects: STD().objects.length,
    name: P.projectName,
  }));
  expect(
    after.objects > 10,
    "the saved project was not there offline: " + JSON.stringify(after),
  );
  expect(errors.length === 0, "errors while offline: " + errors.join("; "));

  await browser.close();
  server.close();
  if (failures.length) {
    console.log("FAIL\n- " + failures.join("\n- "));
    process.exit(1);
  }
  console.log(
    "OK: installs, caches the app, and opens and works with the network off",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
