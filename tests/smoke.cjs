// Smoke test: the app boots with no errors and every view renders.
// Run: npm test   (uses a local file:// load, no server needed)
const { chromium } = require("playwright");
const path = require("node:path");

const VIEWS = [
  "setup",
  "documents",
  "docmap",
  "docactions",
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
  // go to a page the way a person does: the section button, then the page in the bar under the header
  const SECTION = {
    setup: "5s",
    layout: "5s",
    tracking: "5s",
    tags: "5s",
    actions: "5s",
    documents: "docs",
    docmap: "docs",
    docactions: "docs",
    problems: "improve",
  };
  const go = async (v) => {
    const cur = await page.evaluate(() => sectionOf(ui.view).id);
    if (cur !== SECTION[v])
      await page.click(`#gnav [data-section="${SECTION[v]}"]`);
    await page.click(`#subnav [data-view="${v}"]`);
  };

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
    await go(v);
    await page.waitForTimeout(300);
    const visible = await page.evaluate((view) => {
      const ids = {
        setup: "setupView",
        layout: "layoutView",
        documents: "docView",
        docmap: "docView",
        docactions: "regView",
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

  // navigation: three sections with their pages, address bar follows the page, Back works, phone tab bar
  await go("layout");
  await go("problems");
  const nav1 = await page.evaluate(() => ({
    sections: document.querySelectorAll("#gnav [data-section]").length,
    pages: [...document.querySelectorAll("#subnav [data-view]")]
      .map((b) => b.dataset.view)
      .join(),
    hash: location.hash,
    cur: document.querySelector('#gnav [aria-current="true"]')?.dataset.section,
    title: document.title,
  }));
  expect(
    nav1.sections === 3 &&
      nav1.pages === "problems" &&
      nav1.hash === "#/problems" &&
      nav1.cur === "improve" &&
      /Problem/.test(nav1.title),
    "navigation did not follow Sam's three sections: " + JSON.stringify(nav1),
  );
  await page.goBack();
  await page.waitForTimeout(250);
  const nav2 = await page.evaluate(() => ({
    view: ui.view,
    hash: location.hash,
  }));
  expect(
    nav2.view === "layout" && nav2.hash === "#/layout",
    "browser Back did not return to the layout: " + JSON.stringify(nav2),
  );
  await page.evaluate(() => {
    location.hash = "#/tags";
  });
  await page.waitForTimeout(250);
  expect(
    (await page.evaluate(() => ui.view)) === "tags",
    "opening a #/tags link did not show the red tags",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const nav3 = await page.evaluate(() => ({
    bar: getComputedStyle(document.getElementById("tabbar")).display,
    gnav: getComputedStyle(document.getElementById("gnav")).display,
    tabs: document.querySelectorAll("#tabbar button").length,
  }));
  expect(
    nav3.bar === "flex" && nav3.gnav === "none" && nav3.tabs === 3,
    "phone navigation is not a three-section tab bar: " + JSON.stringify(nav3),
  );
  await page.click('#tabbar [data-section="docs"]');
  await page.waitForTimeout(250);
  expect(
    (await page.evaluate(() => sectionOf(ui.view).id)) === "docs",
    "the Documents tab did not open the document mapping section",
  );
  await page.setViewportSize({ width: 1600, height: 900 });
  await go("layout");

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
  // layout editing: toolbar under the selection, box select, align, copy/paste, typed position
  await go("layout");
  await page.evaluate(() => {
    openSheet(STD().id);
    ui.sel = [];
    fitView();
    drawNow();
  });
  const at = (label) =>
    page.evaluate((l) => {
      const o = S().objects.find((x) => x.label === l),
        r = svg.getBoundingClientRect();
      return {
        x: r.left + ((o.x - ui.vb.x) / ui.vb.w) * r.width,
        y: r.top + ((o.y - ui.vb.y) / vbH()) * r.height,
        h: (o.h / ui.vb.w) * r.width,
      };
    }, label);
  const tq = await at("Quality check station");
  await page.mouse.click(tq.x, tq.y);
  await page.waitForTimeout(200);
  const le1 = await page.evaluate(() => ({
    bar: !document.getElementById("selbar").hidden,
    buttons: document.querySelectorAll("#selbar [data-sb]").length,
    noList: !document.querySelector("#pane .item-categories"),
  }));
  expect(
    le1.bar && le1.buttons >= 5 && le1.noList,
    "the selection toolbar did not show: " + JSON.stringify(le1),
  );
  const tc = await at("Cleaning station");
  await page.keyboard.press("Escape");
  await page.keyboard.down("Shift");
  await page.mouse.move(tq.x - 60, tq.y - 45);
  await page.mouse.down();
  await page.mouse.move(tc.x + 60, tc.y + 45, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await page.waitForTimeout(200);
  const le2 = await page.evaluate(() =>
    selected()
      .map((f) => f.x.label)
      .filter(Boolean),
  );
  expect(
    le2.includes("Quality check station") && le2.includes("Cleaning station"),
    "Shift-drag box select did not pick up both items: " + JSON.stringify(le2),
  );
  await page.click('#pane [data-a="align"][data-id="top"]');
  const le3 = await page.evaluate(() => {
    const tops = selected()
      .filter((f) => f.t === "obj")
      .map((f) => Math.round(bboxOf(f).y0 * 100));
    return new Set(tops).size === 1;
  });
  expect(le3, "aligning top edges did not line them up");
  await page.keyboard.press("Control+c");
  const le4 = await page.evaluate(() => {
    const n = selected().length;
    openSheet(P.sheets.find((x) => x.kind === "proposal").id);
    return { n, before: S().objects.length };
  });
  await page.keyboard.press("Control+v");
  const le5 = await page.evaluate(() => S().objects.length);
  expect(
    le5 === le4.before + le4.n,
    "copy and paste onto another sheet did not work: " +
      JSON.stringify([le4, le5]),
  );
  await page.keyboard.press("Control+z");
  await page.evaluate(() => {
    openSheet(STD().id);
    const o = S().objects.find((x) => x.label === "Spill kit");
    ui.sel = [o.id];
    ui.tab = "item";
    renderSide();
  });
  await page.fill('#pane [data-f="px"]', "12.5");
  await page.press('#pane [data-f="px"]', "Tab");
  const le6 = await page.evaluate(() =>
    toUser(S().objects.find((x) => x.label === "Spill kit").x),
  );
  expect(le6 === 12.5, "typing a position did not move the item: " + le6);
  await page.keyboard.press("Control+z");
  await page.evaluate(() => {
    ui.sel = [];
    renderSide();
    draw();
  });

  // problem solving: examples, the board (fishbone, numbered actions, whys, hypothesis), A3, Pareto
  await go("problems");
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
  // the board: fishbone cause -> numbered action, why chain, hypothesis, all on one screen
  await page.fill('[data-fadd="machine"]', "Worn bearing");
  await page.press('[data-fadd="machine"]', "Enter");
  await page.click('[data-pb="likely"]');
  await page.click('[data-pb="cause-act"]');
  await page.fill("#paTitle", "Replace bearing");
  await page.press("#paTitle", "Enter");
  await page.waitForTimeout(200);
  await page.fill('[data-why="0:text"]', "Because A");
  await page.press('[data-why="0:text"]', "Tab");
  await page.click('[data-pa="why-root"]');
  await page.fill('[data-pf="hypothesis"]', "The bearing is worn");
  await page.press('[data-pf="hypothesis"]', "Tab");
  const prb = await page.evaluate(() => ({
    num: document.querySelectorAll(".pboard .cnum").length,
    cause: P.actions.at(-1).cause === P.problems.at(-1).fish.machine[0]?.id,
  }));
  expect(
    prb.num >= 2 && prb.cause,
    "an action raised from a cause is not numbered on both: " +
      JSON.stringify(prb),
  );
  const prp = await page.evaluate(() => {
    printBoard(P.problems.at(-1));
    const out = {
      fish: document.querySelectorAll("#printDoc .fcol").length,
      inputs: document.querySelectorAll("#printDoc input, #printDoc textarea")
        .length,
      text:
        document
          .getElementById("printDoc")
          .textContent.includes("WORN BEARING") ||
        document
          .getElementById("printDoc")
          .textContent.includes("Worn bearing"),
    };
    document.body.classList.remove("printing-doc");
    document.getElementById("pageStyle")?.remove();
    return out;
  });
  expect(
    prp.fish === 6 && prp.inputs === 0 && prp.text,
    "the board did not print as plain text: " + JSON.stringify(prp),
  );
  const pr1 = await page.evaluate(() => {
    const x = P.problems.at(-1),
      a = P.actions.at(-1);
    printProblem(x);
    const out = {
      title: x.title,
      whys: x.whys.length,
      root: x.root,
      hyp: x.hypothesis,
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
      pr1.hyp === "The bearing is worn" &&
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
  await page.click('[data-ps-sub="details"]');
  await page.click('[data-pa="close"]');
  await page.click("#dlgOk"); // closing early asks first
  await page.waitForTimeout(300);
  const pr2 = await page.evaluate(() => P.problems.at(-1).status);
  expect(pr2 === "Closed", "closing a problem did not work");
  await go("layout");
  // documents live on their own map, not on the layout
  await go("layout");
  const dm0 = await page.evaluate(() => ({
    layoutPins: document.querySelectorAll('#svg [data-pk="doc"]').length,
    docTool: !!document.querySelector('[data-tool="doc"]'),
  }));
  await go("docmap");
  await page.waitForTimeout(300);
  const dm1 = await page.evaluate(() => ({
    mapPins: document.querySelectorAll('#dmSvg [data-pk="doc"]').length,
    pinned: P.documents.filter((d) => d.x != null && d.status !== "Withdrawn")
      .length,
    list: document.querySelectorAll(".dmlist [data-dmgo]").length,
  }));
  expect(
    dm0.layoutPins === 0 &&
      !dm0.docTool &&
      dm1.mapPins === dm1.pinned &&
      dm1.mapPins > 5 &&
      dm1.list > 5,
    "documents should be on their own map, not the layout: " +
      JSON.stringify([dm0, dm1]),
  );
  const unpin = await page.evaluate(() => {
    const d = P.documents.find((x) => x.x != null);
    d.x = d.y = null;
    renderDocuments();
    return d.id;
  });
  await page.click(`[data-dmpin="${unpin}"]`);
  const dmBox = await page.locator("#dmSvg").boundingBox();
  await page.mouse.click(dmBox.x + dmBox.width / 2, dmBox.y + dmBox.height / 2);
  expect(
    await page.evaluate(
      (id) => P.documents.find((x) => x.id === id).x != null,
      unpin,
    ),
    "pinning a document on the document map did not work",
  );
  // scope: the whole factory, then one area, through the real picker
  await go("layout");
  const sc0 = await page.evaluate(() => {
    const sh = STD(),
      a = P.areas.find((x) => areaItems(x, sh).length);
    return {
      id: a && a.id,
      all: document.querySelectorAll('#svg [data-t="obj"]').length,
      scope: ui.scope,
    };
  });
  expect(sc0.id && sc0.scope === "", "scope test needs an area with items");
  // choose it on the Setup page, from the chip on the layout
  await page.click("#subnav .scopechip");
  await page.waitForSelector("#setupView .scard");
  const su0 = await page.evaluate(() => ({
    view: ui.view,
    cards: document.querySelectorAll("#setupView [data-scard]").length,
    areas: areasOn(STD()).length,
  }));
  expect(
    su0.view === "setup" && su0.cards === su0.areas + 1,
    "Setup page does not list the factory and every area: " +
      JSON.stringify(su0),
  );
  await page.click(`#setupView [data-su="work"][data-id="${sc0.id}"]`);
  await page.waitForTimeout(300);
  const sc1 = await page.evaluate(() => ({
    scope: ui.scope,
    n: document.querySelectorAll('#svg [data-t="obj"]').length,
    bar: !document.getElementById("scopeBar").hidden,
    hash: location.hash,
    tagArea: ui.reg.tags.area,
  }));
  expect(
    sc1.scope === sc0.id &&
      sc1.n > 0 &&
      sc1.n < sc0.all &&
      sc1.bar &&
      sc1.hash.includes(sc0.id) &&
      sc1.tagArea === sc0.id,
    "choosing an area did not scope the layout: " +
      JSON.stringify({ sc0, sc1 }),
  );
  // document pages are always the whole factory, whatever the 5S scope
  await go("docactions");
  const sc2 = await page.evaluate(() => ({
    rows: document.querySelectorAll("#regTbl tr[data-actid]").length,
    area: !!document.querySelector('#regView [data-f="area"]'),
  }));
  expect(
    sc2.rows >= 3 && !sc2.area,
    "document actions are hidden by the 5S area scope: " + JSON.stringify(sc2),
  );
  await go("layout");
  await page.click("#scopeAll");
  await page.waitForTimeout(300);
  const sc3 = await page.evaluate(() => ({
    scope: ui.scope,
    n: document.querySelectorAll('#svg [data-t="obj"]').length,
  }));
  expect(
    sc3.scope === "" && sc3.n === sc0.all,
    "Show the whole factory did not bring everything back: " +
      JSON.stringify({ sc0, sc3 }),
  );
  for (const v of VIEWS) {
    await go(v);
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
  // boards and SMED were removed from the studio: their data is parked untouched, not lost
  const parked = await page.evaluate(() => {
    const q = JSON.parse(JSON.stringify(P));
    q.boards = [{ id: "b1", name: "Old board", slots: [] }];
    q.smed = { weeks: 48, changeovers: [{ id: "c1", name: "Old changeover" }] };
    q.labels = { size: "tze24" };
    const v = validate(q),
      again = validate(JSON.parse(JSON.stringify(v)));
    return {
      gone: v.boards === undefined && v.smed === undefined,
      boards: v.parked?.boards?.[0]?.name,
      smed: v.parked?.smed?.changeovers?.[0]?.name,
      again: again.parked?.boards?.[0]?.name === "Old board",
      none: P.parked?.boards === undefined,
    };
  });
  expect(
    parked.gone &&
      parked.boards === "Old board" &&
      parked.smed === "Old changeover" &&
      parked.again &&
      parked.none,
    "boards or SMED data was not parked safely: " + JSON.stringify(parked),
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

  // the rename is display only: team files with the old name still open
  const rb = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector(".brand h1").textContent,
    oldName: TEAM_FILE.test("5S-Studio__Sam__Line 1.json"),
    newName: teamFileName("Sam", "Line 1"),
  }));
  expect(
    /Lean Studio/.test(rb.title) &&
      rb.h1 === "Lean Studio" &&
      rb.oldName &&
      rb.newName === "Lean-Studio__Sam__Line 1.json",
    "the rename to Lean Studio is incomplete: " + JSON.stringify(rb),
  );
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
