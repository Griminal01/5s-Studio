// Smoke test: the app boots with no errors and every view renders.
// Run: npm test   (uses a local file:// load, no server needed)
const { chromium } = require("playwright");
const path = require("node:path");

const VIEWS = [
  "smed",
  "boards",
  "documents",
  "tags",
  "actions",
  "tracking",
  "problems",
  "layout",
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) =>
    errors.push(
      "pageerror: " +
        e.message +
        " " +
        String(e.stack).split("\n").slice(1, 4).join(" | "),
    ),
  );
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });

  await page.goto("file://" + path.resolve(__dirname, "..", "index.html"));
  const failures = [];
  const expect = (cond, msg) => cond || failures.push(msg);

  // first visit: create the first account through the real sign-in screen
  await page.waitForSelector("#authForm", { timeout: 10000 });
  await page.fill("[name=user]", "Tester");
  await page.fill("[name=pw]", "tester-pass");
  await page.fill("[name=pw2]", "tester-pass");
  await page.press("[name=pw2]", "Enter");
  await page.waitForSelector("#svg", { timeout: 10000 });
  await page.waitForFunction(() => document.getElementById("auth").hidden);
  expect(
    (await page.textContent("#userBtn")) === "Tester",
    "the account name is not shown in the header",
  );
  for (const v of VIEWS) {
    await page.click(`[data-view="${v}"]`);
    await page.waitForTimeout(300);
    const visible = await page.evaluate((view) => {
      const ids = {
        layout: "layoutView",
        smed: "smedView",
        boards: "boardView",
        documents: "docView",
        tags: "regView",
        actions: "regView",
        tracking: "trackView",
        problems: "problemView",
      };
      const el = document.getElementById(ids[view]);
      return !!el && !el.hidden && el.innerHTML.trim().length > 0;
    }, v);
    if (!visible) failures.push(`view "${v}" did not render`);
  }

  // daily check and red tag through the real forms
  await page.click('[data-add="daily"]');
  await page.fill('#dlgForm [name="checker"]', "Tester");
  await page.click("#dlgOk");
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    newTag({}); // opens the form; not awaited because it resolves on close
  });
  await page.fill('#dlgForm [name="title"]', "Smoke tag");
  await page.click("#dlgOk");
  await page.waitForTimeout(300);
  const made = await page.evaluate(() => ({
    daily: S().kind === "daily" && S().checker === "Tester",
    tags: P.tags.length,
  }));
  if (!made.daily) failures.push("starting a daily check did not work");
  if (made.tags !== 1) failures.push("raising a red tag did not work");

  // example project: loads, has no layout problems, documents print, data round-trips
  await page.evaluate(() => {
    window.print = () => {};
    loadExample(); // added as a new project; nothing is replaced
  });
  await page.waitForTimeout(900);
  const ex = await page.evaluate(() => {
    const sh = S(),
      I = issues(sh),
      problems = [
        I.blocked,
        I.structure,
        I.walkBlock,
        I.aisleClash,
        I.wallHits,
        I.conflicts,
      ].reduce((n, a) => n + a.length, 0);
    printDocumentMap();
    const map = document
      .getElementById("printDoc")
      .querySelectorAll("svg, tr").length;
    printDocumentList();
    const list = document
      .getElementById("printDoc")
      .querySelectorAll("tr").length;
    document.body.classList.remove("printing-doc");
    const json = JSON.stringify(P);
    return {
      objects: sh.objects.length,
      marks: sh.marks.length,
      docs: P.documents.length,
      actions: P.actions.length,
      boards: P.boards.length,
      slots: P.boards.reduce((n, b) => n + b.slots.length, 0),
      tags: P.tags.length,
      dailies: dailies().length,
      sheets: P.sheets.length,
      problems,
      map,
      list,
      overdue: P.documents.filter(docOverdue).length,
      roundTrip: JSON.stringify(validate(JSON.parse(json))) === json,
    };
  });
  expect(
    ex.objects > 20 && ex.marks > 8,
    "example layout is missing objects or tape",
  );
  expect(
    ex.docs >= 10 && ex.actions >= 3 && ex.sheets >= 10,
    "example is missing documents, actions or the proposal",
  );
  expect(
    ex.problems === 0,
    "example layout has " + ex.problems + " layout problems",
  );
  expect(ex.map > 10 && ex.list > 10, "document map or list did not print");
  expect(ex.overdue >= 1, "example should show an overdue document review");
  expect(ex.roundTrip, "example project changed when validated again");
  // areas: in the example, drawn with the real tool, designation, flags, print, old files
  const ar0 = await page.evaluate(() => {
    const sh = STD(),
      daily = P.sheets.filter((x) => x.kind === "daily").pop();
    return {
      n: P.areas.length,
      empty: P.areas.filter((a) => !areaItems(a, sh).length).length,
      unplaced: sh.objects
        .filter((o) => o.kind === "item" && !areaOf(o, sh))
        .map((o) => o.label),
      std: issues(sh).outOfArea.length,
      daily: issues(daily).outOfArea.length,
    };
  });
  expect(
    ar0.n >= 6 && ar0.empty === 0 && ar0.unplaced.length === 0,
    "example areas are missing or leave items out: " + JSON.stringify(ar0),
  );
  expect(
    ar0.std === 0 && ar0.daily >= 1,
    "designated items should leave the standard clean and be flagged on a daily check: " +
      JSON.stringify(ar0),
  );
  await page.evaluate(() => openSheet(STD().id));
  await page.waitForTimeout(300);
  await page.keyboard.press("q");
  const bb = await page.locator("#svg").boundingBox();
  for (const [a, b] of [
    [0.05, 0.05],
    [0.12, 0.05],
    [0.12, 0.12],
    [0.05, 0.12],
  ]) {
    await page.mouse.click(bb.x + bb.width * a, bb.y + bb.height * b);
    await page.waitForTimeout(450);
  }
  await page.mouse.click(bb.x + bb.width * 0.05, bb.y + bb.height * 0.05);
  await page.waitForTimeout(400);
  const ar1 = await page.evaluate(() => ({
    n: P.areas.length,
    corners: P.areas.at(-1).pts.length,
    tool: ui.tool,
    selected: ui.sel[0] === P.areas.at(-1).id,
  }));
  expect(
    ar1.n === ar0.n + 1 &&
      ar1.corners === 4 &&
      ar1.tool === "select" &&
      ar1.selected,
    "drawing an area with the Area tool did not work: " + JSON.stringify(ar1),
  );
  await page.fill('#pane [data-f="name"]', "Smoke zone");
  await page.press('#pane [data-f="name"]', "Tab");
  const ar2 = await page.evaluate(() => {
    const o = STD().objects.find((x) => x.label === "Waste bin"),
      a = P.areas.at(-1);
    ui.sel = [o.id];
    ui.tab = "item";
    renderSide();
    return {
      name: a.name,
      hasSelect: !!document.querySelector("#pane [data-item-area]"),
    };
  });
  expect(
    ar2.name === "Smoke zone" && ar2.hasSelect,
    "renaming an area or the designation list did not work: " +
      JSON.stringify(ar2),
  );
  await page.selectOption("#pane [data-item-area]", { label: "Smoke zone" });
  const ar3 = await page.evaluate(() => {
    const o = STD().objects.find((x) => x.label === "Waste bin"),
      flagged = issues(STD()).outOfArea.some((z) => z.o === o);
    printAreas(areasOn());
    const out = {
      flagged,
      sheets: document.querySelectorAll("#printDoc .areapage").length,
      page: document.getElementById("pageStyle")?.textContent || "",
    };
    document.body.classList.remove("printing-doc");
    document.getElementById("pageStyle")?.remove();
    document.getElementById("printDoc").className = "";
    ui.sel = [P.areas.at(-1).id];
    act("del");
    return {
      ...out,
      left: P.areas.length,
      released: STD().objects.find((x) => x.label === "Waste bin").area === "",
    };
  });
  expect(
    ar3.flagged && ar3.sheets === ar0.n + 1 && /A3 landscape/.test(ar3.page),
    "designation flag or area printing did not work: " + JSON.stringify(ar3),
  );
  expect(
    ar3.left === ar0.n && ar3.released,
    "deleting an area should release its items: " + JSON.stringify(ar3),
  );
  // problem solving: examples, the real forms, 5-Why, fishbone, countermeasures, A3, Pareto
  await page.click('[data-view="problems"]');
  await page.waitForTimeout(200);
  const pr0 = await page.evaluate(() => ({
    n: P.problems.length,
    linked: P.actions.filter((a) => a.prob).length,
    closed: P.problems.filter((x) => x.status === "Closed").length,
    pareto: paretoData().list.length,
    rows: document.querySelectorAll("#psTbl tr.click").length,
  }));
  expect(
    pr0.n >= 4 &&
      pr0.linked >= 6 &&
      pr0.closed >= 1 &&
      pr0.pareto >= 3 &&
      pr0.rows >= 3,
    "example problems are missing or do not show: " + JSON.stringify(pr0),
  );
  await page.click("#psNew");
  await page.fill('#dlgForm [name="title"]', "Smoke problem");
  await page.click("#dlgOk");
  await page.waitForTimeout(300);
  await page.click('[data-ps-sub="why"]');
  await page.click('[data-pa="why-add"]');
  await page.fill('[data-why="0:text"]', "Because A");
  await page.press('[data-why="0:text"]', "Tab");
  await page.click('[data-pa="why-root"]');
  await page.click('[data-ps-sub="fish"]');
  await page.fill('[data-fadd="machine"]', "Worn bearing");
  await page.press('[data-fadd="machine"]', "Enter");
  await page.check('[data-fl^="machine:"]');
  await page.click('[data-ps-sub="act"]');
  await page.click('[data-pa="act-add"]');
  await page.fill('#dlgForm [name="title"]', "Replace bearing");
  await page.click("#dlgOk");
  await page.waitForTimeout(300);
  const pr1 = await page.evaluate(() => {
    const x = P.problems.at(-1),
      a = P.actions.at(-1);
    printProblem(x);
    const out = {
      title: x.title,
      whys: x.whys.length,
      root: x.root,
      cause: x.fish.machine[0]?.likely,
      linked: a.prob === x.id && a.source === probNo(x),
      a3: document.querySelectorAll("#printDoc .a3cols section").length,
      fish: document.querySelectorAll("#printDoc .a3fish svg").length,
      page: document.getElementById("pageStyle")?.textContent || "",
      view: ui.view,
    };
    document.body.classList.remove("printing-doc");
    document.getElementById("pageStyle")?.remove();
    document.getElementById("printDoc").className = "";
    const j = JSON.stringify(P);
    out.roundTrip = JSON.stringify(validate(JSON.parse(j))) === j;
    return out;
  });
  expect(
    pr1.title === "Smoke problem" &&
      pr1.whys === 1 &&
      pr1.root === "Because A" &&
      pr1.cause &&
      pr1.linked,
    "the 5-Why, fishbone or countermeasure link did not work: " +
      JSON.stringify(pr1),
  );
  expect(
    pr1.a3 === 6 &&
      pr1.fish === 1 &&
      /A3 landscape/.test(pr1.page) &&
      pr1.view === "problems",
    "the A3 report did not build: " + JSON.stringify(pr1),
  );
  expect(pr1.roundTrip, "problems changed when validated again");
  await page.click('[data-ps-sub="review"]');
  await page.click('[data-pa="close"]');
  await page.click("#dlgOk"); // closing early asks first
  await page.waitForTimeout(300);
  const pr2 = await page.evaluate(() => P.problems.at(-1).status);
  expect(pr2 === "Closed", "closing a problem did not work");
  await page.click('[data-view="smed"]');
  await page.click("#smProblem");
  await page.click("#dlgOk");
  await page.waitForTimeout(300);
  const pr3 = await page.evaluate(() => ({
    co: !!P.problems.at(-1).co,
    kind: P.problems.at(-1).category,
    view: ui.view,
  }));
  expect(
    pr3.co && pr3.kind === "Changeover" && pr3.view === "problems",
    "raising a problem from a changeover did not work: " + JSON.stringify(pr3),
  );
  await page.click('[data-view="layout"]');
  // boards: edit a board through the real form, then build and "print" labels
  await page.click('[data-view="boards"]');
  await page.click('[data-bid] [data-bd="edit"]');
  const before = await page.evaluate(() => P.boards[0].slots.length);
  await page.click("#bdAdd");
  await page.fill("#bdRows tr:last-child [data-k=name]", "Smoke spanner");
  await page.click("#dlgOk");
  await page.waitForTimeout(300);
  const lab = await page.evaluate(() => {
    const b = P.boards[0];
    const items = labelItems(b.id, { slot: true, board: true, kanban: false });
    printLabels(items);
    const out = {
      slots: b.slots.length,
      last: b.slots.at(-1).name,
      labels: document.querySelectorAll("#printDoc .lbl").length,
      expected: b.slots.length + 1,
      page: document.getElementById("pageStyle")?.textContent || "",
      printing: document.getElementById("printDoc").className,
    };
    document.body.classList.remove("printing-doc");
    document.getElementById("pageStyle")?.remove();
    document.getElementById("printDoc").className = "";
    return out;
  });
  expect(
    lab.slots === before + 1 && lab.last === "Smoke spanner",
    "editing a board did not save the new slot",
  );
  expect(
    lab.labels === lab.expected,
    "label count is wrong: " + lab.labels + " vs " + lab.expected,
  );
  expect(
    /size:\s*70mm 24mm/.test(lab.page) && lab.printing === "labels",
    "label page size was not set",
  );
  // SMED: edit a step, check the maths, use the stopwatch, build the work sheet
  await page.click('[data-view="smed"]');
  const sm0 = await page.evaluate(() => {
    const c = P.smed.changeovers[0],
      r = smedResult(c);
    return {
      n: P.smed.changeovers.length,
      now: r.now.downtime,
      after: r.after.downtime,
      id: c.id,
    };
  });
  expect(
    sm0.n >= 3 && sm0.after < sm0.now,
    "example SMED data is missing or the plan does not save time",
  );
  await page.click(`[data-co="${sm0.id}"]`);
  await page.fill("#smSteps tbody tr:first-child [data-k=dur]", "5:00");
  await page.press("#smSteps tbody tr:first-child [data-k=dur]", "Enter");
  await page.waitForTimeout(200);
  const sm1 = await page.evaluate(() => ({
    dur: P.smed.changeovers[0].steps[0].dur,
    now: smedResult(P.smed.changeovers[0]).now.downtime,
    kpi: document.querySelector("#smViz .smedk b")?.textContent,
  }));
  expect(
    sm1.dur === 300 && sm1.now > sm0.now,
    "editing a step time did not change the stopped time",
  );
  await page.click("#smTimer");
  await page.click('[data-tm="startBefore"]');
  await page.fill("#tmName", "Prep tools");
  await page.click('[data-tm="done"]');
  await page.click('[data-tm="stopped"]');
  await page.fill("#tmName", "Strip the machine");
  await page.click('[data-tm="done"]');
  await page.fill('#dlgForm [name="name"]', "Smoke timed changeover");
  await page.click("#dlgOk");
  await page.waitForTimeout(400);
  const sm2 = await page.evaluate(() => {
    const c = P.smed.changeovers.at(-1);
    return {
      name: c.name,
      types: c.steps.map((s) => s.type).join(","),
      view: ui.view,
    };
  });
  expect(
    sm2.name === "Smoke timed changeover" &&
      sm2.types === "before,internal" &&
      sm2.view === "smed",
    "the stopwatch did not record the changeover: " + JSON.stringify(sm2),
  );
  const sm3 = await page.evaluate(() => {
    printSmedSheet(P.smed.changeovers[0]);
    const out = {
      gantts: document.querySelectorAll("#printDoc .gantt").length,
      rows: document.querySelectorAll("#printDoc table.fixed tr").length,
    };
    document.body.classList.remove("printing-doc");
    document.getElementById("pageStyle")?.remove();
    document.getElementById("printDoc").className = "";
    return out;
  });
  expect(
    sm3.gantts === 2 && sm3.rows > 10,
    "the SMED work sheet did not build",
  );
  for (const v of VIEWS) {
    await page.click(`[data-view="${v}"]`);
    await page.waitForTimeout(150);
  }

  // an old v7 backup (made with the original single file) still opens: red tags,
  // actions and daily checks come back, formal audits are parked, not lost
  const v7 = require("node:fs").readFileSync(
    path.resolve(__dirname, "fixtures", "v7-backup.json"),
    "utf8",
  );
  const old = await page.evaluate((txt) => {
    const q = validate(JSON.parse(txt).project);
    return {
      kinds: q.sheets.map((s) => s.kind).join(","),
      tags: q.tags.length,
      linked: q.actions[0]?.tag === q.tags[0]?.id,
      audits: q.parked?.audits?.length || 0,
      areas: q.areas.map((a) => a.name + "/" + a.legacy?.line).join(","),
      problems: q.problems.length,
      again: (validate(JSON.parse(JSON.stringify(q))).parked?.audits || [])
        .length,
    };
  }, v7);
  expect(
    old.kinds === "standard,daily" && old.tags === 1 && old.linked,
    "old v7 backup did not open fully: " + JSON.stringify(old),
  );
  expect(
    old.areas === "Area 1/ld",
    "an old audit area did not come back as an area: " + JSON.stringify(old),
  );
  expect(
    old.audits === 1 && old.again === 1,
    "old v7 audits were not kept: " + JSON.stringify(old),
  );

  // regressions found in review
  const reg = await page.evaluate(() => {
    const c = blankChangeover();
    c.steps = [
      blankStep({ name: "A", who: "O1", dur: 60, at: 0 }),
      blankStep({ name: "B", who: "O2", dur: 60, at: 60 }),
    ];
    const r = smedResult(c); // nothing planned: the plan must equal what was observed
    return { now: r.now.downtime, after: r.after.downtime };
  });
  expect(
    reg.now === 120 && reg.after === 120,
    "a timed changeover shows a saving with no plan: " + JSON.stringify(reg),
  );
  await page.evaluate(() => {
    newDocument({});
  });
  await page.fill('#dlgForm [name="title"]', "Enter test");
  await page.press('#dlgForm [name="title"]', "Enter");
  const stillOpen = await page.evaluate(
    () => document.getElementById("dlg").open,
  );
  expect(
    stillOpen,
    "Enter in a dialog field closed the dialog and threw the input away",
  );
  if (stillOpen) await page.click("#dlgCancel");

  // accounts and projects
  const acc = await page.evaluate(async () => {
    const users = await idb.get("auth/users");
    const stored = JSON.stringify(users);
    return {
      noPassword:
        !stored.includes("tester-pass") &&
        users[0].hash.length > 20 &&
        users[0].iter >= 100000,
      projects: IDX.list.length,
      active: P.projectName,
    };
  });
  expect(
    acc.noPassword,
    "the password is stored in the clear, or too weakly hashed",
  );
  expect(
    acc.projects === 2,
    "the example should be added as a second project: " + JSON.stringify(acc),
  );
  // switching projects keeps both
  const sw = await page.evaluate(async () => {
    const mine = IDX.list.find((e) => e.id !== PID).id;
    await openProject(mine);
    const a = P.projectName;
    await openProject(IDX.list.find((e) => e.id !== PID).id);
    return { a, b: P.projectName, blank: IDX.list.length };
  });
  expect(
    sw.a !== sw.b,
    "switching projects did not change the open project: " + JSON.stringify(sw),
  );
  // a teammate's published file opens as a copy in my list
  const copied = await page.evaluate(async () => {
    const j = JSON.parse(JSON.stringify(projectBundle()));
    j.by = "Sam";
    const n0 = IDX.list.length;
    await openTeammateBundle(j, "Sam", "Packing line");
    const e = IDX.list.find((x) => x.from === "Sam");
    return {
      added: IDX.list.length - n0,
      from: e && e.from,
      open: P.projectName,
    };
  });
  expect(
    copied.added === 1 && copied.from === "Sam",
    "a teammate's file did not open as a copy: " + JSON.stringify(copied),
  );
  // wrong password is refused, right one works, a second account sees none of this
  await page.evaluate(() => {
    signOut();
  });
  await page.waitForSelector("#authBody [data-u]", { timeout: 10000 });
  await page.click("#authBody [data-u]");
  await page.fill("[name=pw]", "not-the-password");
  await page.press("[name=pw]", "Enter");
  await page.waitForFunction(
    () => document.getElementById("authMsg").textContent.length > 0,
  );
  expect(
    await page.evaluate(() => !document.getElementById("auth").hidden),
    "a wrong password let someone in",
  );
  // a wrong guess makes the button wait a moment before the next try
  await page.waitForSelector("#authForm [type=submit]:not([disabled])");
  await page.fill("[name=pw]", "tester-pass");
  await page.press("[name=pw]", "Enter");
  await page.waitForFunction(() => document.getElementById("auth").hidden);
  await page.waitForSelector("#svg");
  expect(
    (await page.evaluate(() => IDX.list.length)) === 3,
    "the signed-in account lost its projects",
  );
  await page.evaluate(() => {
    signOut();
  });
  await page.waitForSelector("#authBody [data-new]");
  await page.click("#authBody [data-new]");
  await page.fill("[name=user]", "Second");
  await page.fill("[name=pw]", "second-pass");
  await page.fill("[name=pw2]", "second-pass");
  await page.press("[name=pw2]", "Enter");
  await page.waitForFunction(() => document.getElementById("auth").hidden);
  await page.waitForSelector("#svg");
  const other = await page.evaluate(() => ({
    name: CUR.name,
    projects: IDX.list.length,
    objects: P.sheets[0].objects.length,
  }));
  expect(
    other.name === "Second" && other.projects === 1 && other.objects === 0,
    "a second account can see another account's work: " + JSON.stringify(other),
  );

  failures.push(...errors);
  await browser.close();
  if (failures.length) {
    console.error("FAIL\n- " + failures.join("\n- "));
    process.exit(1);
  }
  console.log(
    "OK: boots, " +
      VIEWS.length +
      " views render, sign-in, projects and team copies work, daily check and red tag forms work, example project loads and prints, old v7 backup opens, no console errors",
  );
})();
