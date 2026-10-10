// Project folder test: projects saved as files in a folder (a OneDrive folder in real use). Served over http,
// because the browser's private file system, which stands in for the folder here, needs a real origin.
// Run: node tests/folder.cjs
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
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  const failures = [];
  const expect = (ok, msg) => ok || failures.push(msg);
  await page.goto(base);
  await page.waitForSelector("#authForm", { timeout: 10000 });
  await page.fill("[name=user]", "Folder");
  await page.press("[name=user]", "Enter");
  await page.waitForFunction(() => document.getElementById("auth").hidden);
  await page.evaluate(() => loadExample());
  await page.waitForTimeout(900);

  // project folder: the project is saved as a file; a teammate's save comes in; a clash asks, never overwrites.
  // The browser's private file system stands in for the OneDrive folder (same handles, no picker).
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    TEAM.handle = await root.getDirectoryHandle("folder-test", {
      create: true,
    });
    await teamSave();
    P.projectName = "Folder line";
    renderAll();
    await flushSave();
    accountDialog("team");
  });
  await page.waitForSelector("#tmLink");
  await page.click("#tmLink");
  await page.waitForTimeout(400);
  await page.evaluate(() => document.getElementById("dlg").close("cancel"));
  const readFile = (name) =>
    page.evaluate(async (n) => {
      const f = await (await TEAM.handle.getFileHandle(n)).getFile();
      return { j: JSON.parse(await f.text()), mod: f.lastModified };
    }, name);
  const fname = await page.evaluate(() => curEntry().file);
  // a change is saved in the browser at once but waits for the gap before the file is written ...
  await page.evaluate(() => {
    checkpoint();
    P.projectName = "Folder line v2";
    renderAll();
  });
  await page.waitForTimeout(2600);
  const f0 = await readFile(fname);
  // ... and leaving the tab writes it straight away
  await page.evaluate(async () => {
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 800));
    await folderRun;
    delete document.hidden; // back to the real value
  });
  const f1 = await readFile(fname);
  // switching to another project first writes the waiting change to this one's file
  const switched = await page.evaluate(async (n) => {
    folderWroteAt = 0;
    checkpoint();
    P.projectName = "Folder line v3";
    renderAll();
    await flushSave();
    folderWroteAt = Date.now(); // so the timer waits the full gap
    clearTimeout(folderTimer);
    folderTimer = 0;
    folderAfterSave();
    const here = PID;
    await openProject(IDX.list.find((e) => e.id !== here).id);
    const name = JSON.parse(
      await (await (await TEAM.handle.getFileHandle(n)).getFile()).text(),
    ).project.projectName;
    await openProject(here);
    return name;
  }, fname);
  // a leftover temporary file goes only once it is old
  const tidy = await page.evaluate(async () => {
    await TEAM.handle.getFileHandle("Folder line.leanstudio.json.crswap", {
      create: true,
    });
    const keptFresh = (await folderTidy()) === 0,
      goneOld = (await folderTidy(0)) === 1;
    return { keptFresh, goneOld };
  });
  const fMid = await readFile(fname);
  // opening another project and coming back writes nothing
  const backAgain = await page.evaluate(async () => {
    const here = PID;
    await openProject(IDX.list.find((e) => e.id !== here).id);
    await openProject(here);
    await folderRun;
    await new Promise((r) => setTimeout(r, 2200));
    await folderRun;
    return curEntry().file;
  });
  const f2 = await readFile(fname);
  // a teammate saves the file: with no local changes it simply comes in
  const theirs = await page.evaluate(async (n) => {
    const fh = await TEAM.handle.getFileHandle(n),
      j = JSON.parse(await (await fh.getFile()).text());
    j.project.projectName = "Saved by Sam";
    j.by = "Sam";
    await writeFile(fh, JSON.stringify(j));
    await folderCheck();
    return P.projectName;
  }, fname);
  // both change it: the banner asks; "use theirs" keeps mine as a copy in My projects
  const clash = await page.evaluate(async (n) => {
    P.projectName = "Mine, not saved to the file";
    await flushSave();
    clearTimeout(folderTimer);
    const fh = await TEAM.handle.getFileHandle(n),
      j = JSON.parse(await (await fh.getFile()).text());
    j.project.projectName = "Sam again";
    await new Promise((r) => setTimeout(r, 20));
    await writeFile(fh, JSON.stringify(j));
    await folderSync();
    const asked = !document.getElementById("syncWarn").hidden;
    const n0 = IDX.list.length;
    document.querySelector('#syncWarn [data-sync="theirs"]').click();
    await new Promise((r) => setTimeout(r, 600));
    return {
      asked,
      now: P.projectName,
      kept: IDX.list.length - n0,
      copy: IDX.list.at(-1).name,
      closed: document.getElementById("syncWarn").hidden,
    };
  }, fname);
  // and "save mine as a new file" leaves their file alone
  const mineNew = await page.evaluate(async (n) => {
    P.projectName = "Mine again";
    await flushSave();
    clearTimeout(folderTimer);
    const fh = await TEAM.handle.getFileHandle(n),
      j = JSON.parse(await (await fh.getFile()).text());
    j.project.projectName = "Sam third";
    await new Promise((r) => setTimeout(r, 20));
    await writeFile(fh, JSON.stringify(j));
    await folderSync();
    document.querySelector('#syncWarn [data-sync="mine"]').click();
    await new Promise((r) => setTimeout(r, 600));
    const now = curEntry().file,
      theirsName = JSON.parse(
        await (await (await TEAM.handle.getFileHandle(n)).getFile()).text(),
      ).project.projectName,
      mineName = JSON.parse(
        await (await (await TEAM.handle.getFileHandle(now)).getFile()).text(),
      ).project.projectName;
    return { now, theirsName, mineName };
  }, fname);
  // a file someone else put in the folder opens from the list, linked to it
  const opened = await page.evaluate(async () => {
    const j = JSON.parse(JSON.stringify(projectBundle()));
    j.project.projectName = "Sam's own line";
    j.by = "Sam";
    const fh = await TEAM.handle.getFileHandle(
      "Sams own line.leanstudio.json",
      {
        create: true,
      },
    );
    await writeFile(fh, JSON.stringify(j));
    const { files } = await folderFiles();
    await folderOpenFile(files.find((r) => r.name.startsWith("Sams")));
    return { name: P.projectName, file: curEntry().file };
  });
  expect(
    fname.endsWith(".leanstudio.json") &&
      f0.j.project.projectName === "Folder line" &&
      f1.j.project.projectName === "Folder line v2" &&
      switched === "Folder line v3" &&
      tidy.keptFresh &&
      tidy.goneOld &&
      backAgain === fname &&
      f2.mod === fMid.mod &&
      theirs === "Saved by Sam" &&
      clash.asked &&
      clash.now === "Sam again" &&
      clash.kept === 1 &&
      /my changes/.test(clash.copy) &&
      clash.closed &&
      mineNew.now !== fname &&
      mineNew.theirsName === "Sam third" &&
      mineNew.mineName === "Mine again" &&
      opened.name === "Sam's own line" &&
      opened.file === "Sams own line.leanstudio.json",
    "project folder is wrong: " +
      JSON.stringify({
        f0: f0.j.project.projectName,
        switched,
        tidy,

        fname,
        f1: f1.j.project.projectName,
        f1m: f1.mod,
        f2m: f2.mod,
        backAgain,
        theirs,
        clash,
        mineNew,
        opened,
      }),
  );

  const count = await page.evaluate(async () => {
    const names = [];
    for await (const [n] of TEAM.handle.entries()) names.push(n);
    return names;
  });
  expect(
    count.length === 3,
    "the folder holds more files than were asked for: " + count.join(", "),
  );
  expect(errors.length === 0, "errors: " + errors.join("; "));
  await browser.close();
  server.close();
  if (failures.length) {
    console.log("FAIL\n- " + failures.join("\n- "));
    process.exit(1);
  }
  console.log(
    "OK: projects save to a folder as files, teammates' saves come in, a clash asks and never overwrites",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
