// Smoke test: the app boots with no errors and every view renders.
// Run: npm test   (uses a local file:// load, no server needed)
const { chromium } = require("playwright");
const path = require("node:path");

const VIEWS = [
  "setup",
  "tasks",
  "lines",
  "zones",
  "documents",
  "docmap",
  "docactions",
  "tags",
  "actions",
  "tracking",
  "ideas",
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
    setup: "setup",
    lines: "setup",
    zones: "setup",
    layout: "5s",
    tasks: "5s",
    tracking: "5s",
    tags: "5s",
    actions: "5s",
    documents: "docs",
    docmap: "docs",
    docactions: "docs",
    ideas: "improve",
    problems: "improve",
  };
  const go = async (v) => {
    const cur = await page.evaluate(() => sectionOf(ui.view).id);
    if (cur !== SECTION[v])
      await page.click(`#gnav [data-section="${SECTION[v]}"]`);
    await page.click(`#subnav [data-view="${v}"]`);
  };

  // first visit: type a name on the real "Who is working?" screen; there is no password
  await page.waitForSelector("#authForm", { timeout: 10000 });
  expect(
    !(await page.$("#authForm [type=password]")),
    "the first screen still asks for a password",
  );
  await page.fill("[name=user]", "Tester");
  await page.press("[name=user]", "Enter");
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
        tasks: "taskView",
        lines: "setupView",
        zones: "setupView",
        layout: "layoutView",
        documents: "docView",
        docmap: "docView",
        docactions: "regView",
        tags: "regView",
        actions: "regView",
        tracking: "trackView",
        ideas: "ideaView",
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
    nav1.sections === 4 &&
      nav1.pages === "ideas,problems" &&
      nav1.hash === "#/problems" &&
      nav1.cur === "improve" &&
      /Problem/.test(nav1.title),
    "navigation did not follow the four sections: " + JSON.stringify(nav1),
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
    nav3.bar === "flex" && nav3.gnav === "none" && nav3.tabs === 4,
    "phone navigation is not a four-section tab bar: " + JSON.stringify(nav3),
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
  // tape plan (A3, true scale), colour standard, and tape types from before version 12
  const tp = await page.evaluate(() => {
    const t0 = P.marking.types[0];
    t0.supplier = "Supplier A";
    t0.roll = 30;
    applyMarking();
    printTapePlan();
    const d = document.getElementById("printDoc"),
      svg = d.querySelector(".tpplan svg"),
      vb = svg ? svg.getAttribute("viewBox").split(" ").map(Number) : [0, 0, 0],
      out = {
        page: document.getElementById("pageStyle")?.textContent || "",
        plan: !!svg,
        scale: svg
          ? Math.round((vb[2] * mpu() * 1000) / parseFloat(svg.style.width))
          : 0,
        said: (d.textContent.match(/Scale 1:(\d+)/) || [])[1],
        key: d.querySelectorAll(".tpside .tpt")[0]?.querySelectorAll("tr")
          .length,
        supplier: d.textContent.includes("Supplier A"),
        runs: d.querySelectorAll(".tpruns tr").length - 1,
      };
    printColourStandard();
    out.std = d.querySelectorAll(".cst tr").length - 1;
    document.body.classList.remove("printing-doc");
    const old = JSON.parse(JSON.stringify(P));
    old.version = 11;
    for (const t of old.marking.types)
      for (const k of ["roll", "supplier", "code", "ref"]) delete t[k];
    delete old.marking.std;
    const v = validate(old);
    out.migrated =
      v.version >= 12 &&
      v.marking.types.every((t) => t.roll === 0 && t.supplier === "") &&
      v.marking.std.no === "";
    t0.supplier = "";
    t0.roll = 0;
    applyMarking();
    return out;
  });
  expect(
    tp.plan &&
      /A3 landscape/.test(tp.page) &&
      tp.scale > 0 &&
      String(tp.scale) === tp.said &&
      tp.key >= 5 &&
      tp.supplier &&
      tp.runs >= 8 &&
      tp.std >= 7 &&
      tp.migrated,
    "tape plan, colour standard or version 12 migration is wrong: " +
      JSON.stringify(tp),
  );
  // improvement log: raise an idea through the form, rate it, add an action from inside it, chart, print
  await go("ideas");
  const im0 = await page.evaluate(() => ({
    n: P.ideas.length,
    rows: document.querySelectorAll("#ideaTbl tr[data-ideaid]").length,
    badge: document.querySelector('[data-badge="ideas"]')?.textContent,
    late: document
      .querySelector('[data-badge="ideas"]')
      ?.classList.contains("late"),
  }));
  await page.click("#imNew");
  await page.fill("#dlg [name=title]", "Smoke idea: a hook for the brush");
  await page.fill("#dlg [name=by]", "An operator");
  await page.click("#dlgOk");
  await page.waitForTimeout(200);
  const added = await page.evaluate(() => P.ideas.at(-1));
  await page.click(`#ideaTbl [data-ideaid="${added.id}"]`);
  await page.selectOption("#dlg [name=gain]", "3");
  await page.selectOption("#dlg [name=effort]", "1");
  await page.click("#imAct");
  await page.waitForTimeout(200);
  await page.fill("#dlg [name=title]", "Fit the hook");
  await page.click("#dlgOk");
  await page.waitForTimeout(300);
  const im1 = await page.evaluate((id) => {
    const x = P.ideas.find((i) => i.id === id),
      a = P.actions.find((y) => y.idea === id),
      reopened = document.getElementById("dlg").open;
    document.getElementById("dlg").close("cancel");
    return {
      no: ideaNo(x),
      by: x.by,
      quick: ideaQuick(x),
      act: a ? a.stream + ":" + a.title : "",
      reopened,
    };
  }, added.id);
  await page.waitForTimeout(150);
  await page.click('[data-im-tab="chart"]');
  const im2 = await page.evaluate(() => {
    const chart = {
      cells: document.querySelectorAll("#ideaView .icell").length,
      quick: document.querySelectorAll("#ideaView .z-q .ichip").length,
    };
    ui.reg.ideas.tab = "log";
    printIdeas();
    chart.printed = document.querySelectorAll("#printDoc tr").length;
    document.body.classList.remove("printing-doc");
    // a project from before version 13: no ideas, an action pointing at an idea that is gone
    const old = JSON.parse(JSON.stringify(P));
    delete old.ideas;
    old.version = 12;
    old.actions[0].idea = "gone";
    old.actions[0].prob = "";
    const v = validate(old);
    chart.migrated =
      v.version === 14 &&
      v.ideas.length === 0 &&
      v.actions[0].idea === "" &&
      v.actions[0].stream !== "improve";
    return chart;
  });
  expect(
    im0.n >= 5 &&
      im0.rows >= 3 &&
      im0.badge &&
      im0.late &&
      im1.by === "An operator" &&
      /^IM-\d{3}$/.test(im1.no) &&
      im1.quick &&
      im1.act === "improve:Fit the hook" &&
      im1.reopened &&
      im2.cells === 9 &&
      im2.quick >= 2 &&
      im2.printed > 5 &&
      im2.migrated,
    "improvement log is wrong: " + JSON.stringify({ im0, im1, im2 }),
  );
  await go("layout"); // the area tests below draw on the layout
  // areas: in the example, drawn with the real tool, designation, flags, print, old files
  const ar0 = await page.evaluate(() => {
    const sh = STD(),
      daily = P.sheets.filter((x) => x.kind === "daily").pop();
    return {
      n: areasOn(sh).length,
      empty: areasOn(sh).filter((a) => !areaItems(a, sh).length).length,
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
    [0.4, 0.4],
    [0.47, 0.4],
    [0.47, 0.47],
    [0.4, 0.47],
  ]) {
    await page.mouse.click(bb.x + bb.width * a, bb.y + bb.height * b);
    await page.waitForTimeout(450);
  }
  await page.mouse.click(bb.x + bb.width * 0.4, bb.y + bb.height * 0.4);
  await page.waitForTimeout(400);
  const ar1 = await page.evaluate(() => ({
    n: areasOn().length,
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
      left: areasOn().length,
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
  // setup: lines and zones, edited in place and drawn with the Area tool
  await go("lines");
  const lz = await page.evaluate(() => ({
    lines: document.querySelectorAll("#setupView [data-scard]").length,
    expected: linesOn(STD()).length,
  }));
  expect(
    lz.lines >= 2 && lz.lines === lz.expected,
    "Setup does not list the lines: " + JSON.stringify(lz),
  );
  await go("zones");
  const zz = await page.evaluate(() => ({
    cards: document.querySelectorAll("#setupView [data-scard]").length,
    groups: document.querySelectorAll("#setupView .sgroup").length,
    zones: areasOn(STD()).length,
    lined: areasOn(STD()).every((z) => z.parent),
  }));
  expect(
    zz.cards === zz.zones && zz.groups >= 2 && zz.lined,
    "Setup does not list the zones under their lines: " + JSON.stringify(zz),
  );
  await page.fill('#setupView [data-sf="name"]', "Renamed zone");
  await page.press('#setupView [data-sf="name"]', "Tab");
  expect(
    await page.evaluate(() =>
      areasOn(STD()).some((z) => z.name === "Renamed zone"),
    ),
    "renaming a zone on the Setup page did not save",
  );
  // draw a new line and a zone with the Area tool, from Setup, and come back
  await page.click('[data-su="newzone"]');
  const dr = await page.evaluate(() => ({
    view: ui.view,
    tool: ui.tool,
    level: ui.areaLevel,
    back: !document.getElementById("scopeBack")?.hidden,
  }));
  expect(
    dr.view === "layout" &&
      dr.tool === "area" &&
      dr.level === "zone" &&
      dr.back,
    "Draw a zone from Setup did not start the Area tool: " + JSON.stringify(dr),
  );
  const madeZ = await page.evaluate(() => {
    const line = linesOn(STD())[0],
      b = areaBox(line),
      c = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 },
      n = P.areas.length;
    finishArea({
      pts: [
        { x: c.x - 4, y: c.y - 4 },
        { x: c.x + 4, y: c.y - 4 },
        { x: c.x + 4, y: c.y + 4 },
      ],
    });
    const z = P.areas.at(-1);
    return {
      added: P.areas.length === n + 1,
      zone: !isLine(z),
      joined: z.parent === line.id,
      name: z.name,
    };
  });
  expect(
    madeZ.added && madeZ.zone && madeZ.joined,
    "a zone drawn inside a line did not join it: " + JSON.stringify(madeZ),
  );
  await page.click("#scopeBack");
  expect(
    (await page.evaluate(() => ui.view)) === "zones",
    "Back to Setup did not return to the zones page",
  );

  // operator tasks: the example has them, a new one is added through the real form and linked to items
  await go("tasks");
  const tk0 = await page.evaluate(() => ({
    n: P.tasks.length,
    rows: document.querySelectorAll("#taskView [data-taskid]").length,
    linked: P.tasks.every(
      (t) => t.items.length && taskItems(t).length === t.items.length,
    ),
    zones: new Set(P.tasks.map((t) => t.zone)).size,
    roundTrip:
      JSON.stringify(validate(JSON.parse(JSON.stringify(P))).tasks) ===
      JSON.stringify(P.tasks),
  }));
  expect(
    tk0.n >= 8 &&
      tk0.rows === tk0.n &&
      tk0.linked &&
      tk0.zones >= 4 &&
      tk0.roundTrip,
    "example operator tasks are missing or not linked to items: " +
      JSON.stringify(tk0),
  );
  await page.click("#tNew");
  await page.fill(
    '#dlgForm [name="name"], #dlgBody [name="name"]',
    "Smoke task",
  );
  await page.selectOption('#dlgBody [name="zone"]', {
    label: "Tooling and cleaning",
  });
  await page.selectOption('#dlgBody [name="freq"]', "Daily");
  await page.fill('#dlgBody [name="mins"]', "7");
  await page.click("#itZone");
  const ticked = await page.evaluate(
    () => document.querySelectorAll("#itPick input:checked").length,
  );
  await page.click("#dlgOk");
  await page.waitForTimeout(300);
  const tk1 = await page.evaluate(() => {
    const t = P.tasks.at(-1),
      z = areasOn(STD()).find((x) => x.name === "Tooling and cleaning");
    return {
      name: t.name,
      zone: t.zone === z.id,
      mins: t.mins,
      freq: t.freq,
      items: t.items.length,
      row: !!document.querySelector(`#taskView [data-taskid="${t.id}"]`),
    };
  });
  expect(
    tk1.name === "Smoke task" &&
      tk1.zone &&
      tk1.mins === 7 &&
      tk1.freq === "Daily" &&
      tk1.items === ticked &&
      ticked >= 4 &&
      tk1.row,
    "adding an operator task through the form did not work: " +
      JSON.stringify({ tk1, ticked }),
  );
  // the zone and the item panels list it, and Show selects its items on the layout
  await page.evaluate(() => {
    const z = areasOn(STD()).find((x) => x.name === "Tooling and cleaning");
    setView("layout");
    ui.sel = [z.id];
    ui.tab = "item";
    renderSide();
  });
  const tk2 = await page.evaluate(() => ({
    zone: document.querySelector("#pane")?.textContent.includes("Smoke task"),
  }));
  await page.evaluate(() => {
    const t = P.tasks.at(-1);
    ui.sel = [taskItems(t)[0].id];
    renderSide();
  });
  const tk3 = await page.evaluate(() => ({
    item: document.querySelector("#pane")?.textContent.includes("Smoke task"),
  }));
  expect(
    tk2.zone && tk3.item,
    "the zone or item panel does not list its operator tasks: " +
      JSON.stringify({ tk2, tk3 }),
  );
  await go("tasks");
  await page.click("[data-tshow]");
  const tk4 = await page.evaluate(() => ({
    view: ui.view,
    sel: ui.sel.length,
  }));
  expect(
    tk4.view === "layout" && tk4.sel >= 1,
    "Show on an operator task did not select its items: " + JSON.stringify(tk4),
  );
  // where a task is done and its walk: placed through the form and the canvas, walks round machines,
  // drawn on the spaghetti diagram, compared with a proposal, printed, and old projects migrate
  await go("tasks");
  await page.evaluate(() => editTask(P.tasks.at(-1).id));
  await page.waitForSelector("#taskPlace");
  await page.fill('#dlgBody [name="per"]', "3");
  await page.selectOption('#dlgBody [name="walk"]', "each");
  await page.click("#taskPlace");
  await page.waitForTimeout(300);
  const wk0 = await page.evaluate(() => ({ tool: ui.tool, view: ui.view }));
  const box = await page.locator("#svg").boundingBox();
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.62);
  await page.waitForTimeout(500);
  const wk1 = await page.evaluate(() => {
    const t = P.tasks.at(-1),
      sh = STD(),
      w = taskWalk(t, sh);
    let inside = 0;
    for (const l of w.legs)
      for (let i = 1; i < l.pts.length; i++)
        for (let s = 0; s <= 20; s++) {
          const a = l.pts[i - 1],
            b = l.pts[i],
            q = {
              x: a.x + ((b.x - a.x) * s) / 20,
              y: a.y + ((b.y - a.y) * s) / 20,
            };
          if (fxRects(sh).some((z) => ptInRect(q, z))) inside++;
        }
    return {
      view: ui.view,
      tab: ui.reg.tasks.tab,
      at: !!t.at && t.at.drawing === sh.drawing,
      per: t.per,
      walk: t.walk,
      len: w.len,
      items: w.items.length,
      legs: w.legs.length,
      ok: w.ok,
      shift: Math.round(w.shift) === Math.round(w.len * 3),
      inside,
      lines: document.querySelectorAll("#wkSvg polyline").length,
      rows: document.querySelectorAll("#taskView tr[data-wfocus]").length,
      placed: P.tasks.filter(taskInScope).filter((x) => x.at).length,
    };
  });
  expect(
    wk0.tool === "taskat" &&
      wk0.view === "layout" &&
      wk1.view === "tasks" &&
      wk1.tab === "walks" &&
      wk1.at &&
      wk1.per === 3 &&
      wk1.walk === "each" &&
      wk1.len > 0 &&
      wk1.items >= 4 &&
      wk1.legs === wk1.items * 2 &&
      wk1.ok &&
      wk1.shift &&
      wk1.inside === 0 &&
      wk1.lines > 0 &&
      wk1.rows === wk1.placed,
    "placing a task and drawing its walk did not work: " +
      JSON.stringify({ wk0, wk1 }),
  );
  const wk2 = await page.evaluate(() => {
    const prop = P.sheets.find((s) => s.kind === "proposal");
    Object.assign(ui.reg.tasks, { sheet: prop.id, cmp: STD().id });
    renderTasks();
    const V = walkData(),
      out = {
        compared: V.data.every((x) => x.c && Number.isFinite(x.c.len)),
        col: !!document.querySelector("#taskView th.n:nth-of-type(8)"),
      };
    printWalks();
    out.printed = {
      svg: document.querySelectorAll("#printDoc svg polyline").length,
      rows: document.querySelectorAll("#printDoc tr").length,
    };
    document.body.classList.remove("printing-doc");
    // a project from before version 14: tasks without a place, times a shift or walk
    const old = JSON.parse(JSON.stringify(P));
    old.version = 13;
    for (const t of old.tasks) {
      delete t.at;
      delete t.per;
      delete t.walk;
    }
    const v = validate(old);
    out.migrated =
      v.version === 14 &&
      v.tasks.every(
        (t) => t.at === null && t.per === null && t.walk === "round",
      );
    out.kept =
      JSON.stringify(validate(JSON.parse(JSON.stringify(P))).tasks) ===
      JSON.stringify(P.tasks);
    Object.assign(ui.reg.tasks, { tab: "list", sheet: "", cmp: "", focus: "" });
    renderTasks();
    return out;
  });
  expect(
    wk2.compared &&
      wk2.printed.svg > 0 &&
      wk2.printed.rows >= 2 &&
      wk2.migrated &&
      wk2.kept,
    "spaghetti diagram compare, print or version 14 migration is wrong: " +
      JSON.stringify(wk2),
  );
  // deleting a zone keeps the task, just not in a zone
  const tk5 = await page.evaluate(() => {
    const t = P.tasks.at(-1),
      z = areasOn(STD()).find((x) => x.id === t.zone);
    ui.sel = [z.id];
    act("del");
    const out = { kept: P.tasks.includes(t), zone: t.zone };
    restore(undoS, redoS);
    return out;
  });
  expect(
    tk5.kept && tk5.zone === "",
    "deleting a zone should keep its tasks: " + JSON.stringify(tk5),
  );
  await go("tasks");
  await page.evaluate(() => {
    window.__csv = 0;
    printTasks();
    document.body.classList.remove("printing-doc");
    document.getElementById("pageStyle")?.remove();
    document.getElementById("printDoc").className = "";
  });

  // bring items from another project: pick a project, tick items, they arrive with their tasks
  const imp = await page.evaluate(async () => {
    const srcName = P.projectName;
    await startNewProject("Smoke destination");
    return {
      srcName,
      items: STD().objects.filter((o) => o.kind === "item").length,
    };
  });
  await page.waitForTimeout(500);
  await go("layout");
  await page.click("#bFromProject");
  await page.selectOption("#bpPid", { label: imp.srcName });
  await page.waitForSelector("#bpList");
  await page.fill("#bpSearch", "rack");
  const vis = await page.evaluate(
    () =>
      [...document.querySelectorAll("#bpList [data-bplabel]")].filter(
        (l) => !l.hidden,
      ).length,
  );
  await page.fill("#bpSearch", "");
  await page.click("#bpAll");
  await page.click("#dlgOk");
  await page.waitForTimeout(400);
  const imp2 = await page.evaluate(() => ({
    items: STD().objects.filter((o) => o.kind === "item").length,
    tasks: P.tasks.length,
    linked: P.tasks.every(
      (t) =>
        t.items.length &&
        t.items.every((r) => STD().objects.some((o) => o.ref === r)),
    ),
    refsNew:
      new Set(STD().objects.map((o) => o.ref)).size === STD().objects.length,
    sel: ui.sel.length,
    undoable: undoS.length > 0,
  }));
  expect(
    vis >= 1 &&
      imp2.items > imp.items &&
      imp2.tasks >= 8 &&
      imp2.linked &&
      imp2.refsNew &&
      imp2.sel === imp2.items &&
      imp2.undoable,
    "bringing items from another project did not work: " +
      JSON.stringify({ vis, imp, imp2 }),
  );
  await page.evaluate(() => restore(undoS, redoS));
  const imp3 = await page.evaluate(() => ({
    items: STD().objects.filter((o) => o.kind === "item").length,
    tasks: P.tasks.length,
  }));
  expect(
    imp3.items === imp.items && imp3.tasks === 0,
    "Undo did not take the brought-in items back out: " + JSON.stringify(imp3),
  );
  // back to the example project for the rest of the test
  await page.evaluate(async () => {
    const e = IDX.list.find(
      (x) => x.name !== "Smoke destination" && /Example/.test(x.name),
    );
    await openProject(e.id);
    await deleteProject(
      IDX.list.find((x) => x.name === "Smoke destination").id,
    );
  });
  await page.waitForTimeout(600);
  // names on the drawing: every name whole (no "..."), tags for small items, a switch to turn them off
  await go("layout");
  await page.evaluate(() => renderAll());
  await page.waitForTimeout(300);
  const nm = await page.evaluate(() => ({
    n: [...document.querySelectorAll("#svg .names text")].length,
    cut: [...document.querySelectorAll("#svg .names text")].filter((t) =>
      /…|\.\.\./.test(t.textContent),
    ).length,
    tags: document.querySelectorAll("#svg .names rect").length,
  }));
  await page.evaluate(() => {
    ui.layers.labels = false;
    renderAll();
  });
  await page.waitForTimeout(300);
  nm.off = await page.evaluate(
    () => document.querySelectorAll("#svg .names text").length,
  );
  await page.evaluate(() => {
    ui.layers.labels = true;
    renderAll();
  });
  expect(
    nm.n > 15 && nm.cut === 0 && nm.tags > 3 && nm.off === 0,
    "names on the drawing are wrong: " + JSON.stringify(nm),
  );
  // presentation mode: the layout full screen, stepping through the factory, lines and zones
  await go("layout");
  await page.click("#bPresent");
  await page.waitForSelector("#prStage svg");
  const pm0 = await page.evaluate(() => ({
    steps: pr.steps.length,
    step: document.getElementById("prStep").textContent,
    shapes: document.querySelectorAll("#prStage svg [data-t]").length,
  }));
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const pm1 = await page.evaluate(() => ({
    i: pr.i,
    step: document.getElementById("prStep").textContent,
    scope: ui.scope,
    shapes: document.querySelectorAll("#prStage svg [data-t]").length,
  }));
  // zoom in: names get bigger and more of them fit; Fit and stepping go back to the whole step
  const textSize = () =>
    page.evaluate(() => {
      const t = [...document.querySelectorAll("#prStage svg .names text")][0];
      return t ? t.getBoundingClientRect().height : 0;
    });
  const pz0 = await textSize();
  await page.keyboard.press("+");
  await page.keyboard.press("+");
  await page.waitForTimeout(250);
  const pz1 = await page.evaluate(() => ({
    z: pr.z,
    h: [
      ...document.querySelectorAll("#prStage svg .names text"),
    ][0]?.getBoundingClientRect().height,
  }));
  await page.click("#prFit");
  const pz2 = await page.evaluate(() => pr.z);
  expect(
    pz1.z > 2 && pz1.h > pz0 && pz2 === 1,
    "zooming the presentation did not enlarge the names: " +
      JSON.stringify({ pz0, pz1, pz2 }),
  );
  await page.keyboard.press("Escape");
  const pm2 = await page.evaluate(() => ({
    hidden: document.getElementById("present").hidden,
    scope: ui.scope,
  }));
  expect(
    pm0.steps >= 8 &&
      pm0.shapes > 10 &&
      pm1.i === 2 &&
      pm1.step !== pm0.step &&
      pm1.scope === "" &&
      pm2.hidden &&
      pm2.scope === "",
    "presentation mode did not step through the layout: " +
      JSON.stringify({ pm0, pm1, pm2 }),
  );
  // lock a zone: it cannot be deleted or reshaped, and unlocking gives that back
  await go("layout");
  const lk = await page.evaluate(() => {
    const z = areasOn(STD())[0];
    ui.sel = [z.id];
    renderSide();
    const handles = () => document.querySelectorAll('#svg [data-t="v"]').length;
    drawNow();
    const open0 = handles();
    act("lock");
    drawNow();
    const locked = z.locked,
      open1 = handles();
    act("del");
    const kept = P.areas.includes(z);
    act("lock");
    drawNow();
    return {
      open0,
      open1,
      locked,
      kept,
      unlocked: !z.locked,
      open2: handles(),
      n: P.areas.length,
    };
  });
  expect(
    lk.open0 >= 3 &&
      lk.locked &&
      lk.open1 === 0 &&
      lk.kept &&
      lk.unlocked &&
      lk.open2 >= 3,
    "locking a zone did not protect it: " + JSON.stringify(lk),
  );
  await go("zones");
  await page.click('#setupView [data-su="lock"]');
  const lk2 = await page.evaluate(() => ({
    locked: areasOn(STD())[0].locked,
    delDisabled: document.querySelector('#setupView [data-su="del"]').disabled,
    roundTrip: validate(JSON.parse(JSON.stringify(P))).areas[0].locked,
  }));
  expect(
    lk2.locked && lk2.delDisabled && lk2.roundTrip,
    "the Lock button on a Setup card did not work: " + JSON.stringify(lk2),
  );
  await page.click('#setupView [data-su="lock"]');
  // audit fixes: Reshape on the map, the settings dialog, the red tag register under a scope
  await go("zones");
  await page.click('#setupView [data-su="edit"]');
  const rs = await page.evaluate(() => ({ view: ui.view, sel: ui.sel.length }));
  expect(
    rs.view === "layout" && rs.sel === 1,
    "Reshape on the map did not select the zone: " + JSON.stringify(rs),
  );
  await page.evaluate(() => setScope(areasOn(STD())[0].id));
  const tg = await page.evaluate(() => {
    const n = P.tags.length;
    P.tags.push({
      ...clone(P.tags[0]),
      id: uid(),
      no: ++P.counters.tag,
      x: null,
      y: null,
    });
    setView("tags");
    const rows = document.querySelectorAll("#regTbl tr[data-tag]").length;
    P.tags.pop();
    P.counters.tag--;
    setScope("");
    return { n, rows };
  });
  expect(
    tg.rows >= 1,
    "a red tag with no pin vanished under a zone scope: " + JSON.stringify(tg),
  );
  await page.click("#fileMenu summary");
  await page.click("#bSettings");
  await page.fill('#dlgBody [name="walk"]', "1.37");
  await page.click("#dlgOk");
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({
    open: document.getElementById("dlg").open,
    walk: P.settings.walk,
  }));
  expect(
    !st.open && st.walk === 1.37,
    "the settings dialog could not be saved: " + JSON.stringify(st),
  );
  await go("layout");
  // scope: the whole factory, one zone, then one line, through the Showing picker
  await go("layout");
  const sc0 = await page.evaluate(() => {
    const sh = STD(),
      z = areasOn(sh).find((x) => areaItems(x, sh).length > 1),
      line = P.areas.find((l) => l.id === z.parent);
    return {
      zone: z.id,
      line: line.id,
      all: document.querySelectorAll('#svg [data-t="obj"]').length,
      scope: ui.scope,
    };
  });
  expect(sc0.zone && sc0.scope === "", "scope test needs a zone with items");
  const count = () =>
    page.evaluate(() => ({
      sharp: [...document.querySelectorAll('#svg [data-t="obj"]')].filter(
        (e) => !e.closest("g[opacity]"),
      ).length,
      faded: document.querySelectorAll('#svg g[opacity=".4"] [data-t="obj"]')
        .length,
      scope: ui.scope,
      sel: document.getElementById("scopeSel")?.value,
      bar: !document.getElementById("scopeBar").hidden,
      hash: location.hash,
    }));
  await page.selectOption("#scopeSel", sc0.zone);
  await page.waitForTimeout(300);
  const sc1 = await count();
  expect(
    sc1.scope === sc0.zone &&
      sc1.sel === sc0.zone &&
      sc1.sharp > 0 &&
      sc1.sharp < sc0.all &&
      sc1.faded > 0 &&
      sc1.bar &&
      sc1.hash.includes(sc0.zone),
    "choosing a zone did not show it with some context: " +
      JSON.stringify({ sc0, sc1 }),
  );
  await page.selectOption("#scopeSel", sc0.line);
  await page.waitForTimeout(300);
  const sc1b = await count();
  expect(
    sc1b.scope === sc0.line && sc1b.sharp > sc1.sharp,
    "choosing a line did not show more than one of its zones: " +
      JSON.stringify({ sc1, sc1b }),
  );
  await page.selectOption("#scopeSel", sc0.zone);
  await page.waitForTimeout(200);
  // the choice follows into Documents and Improve
  await go("docmap");
  await page.waitForTimeout(300);
  const sc2 = await page.evaluate(() => ({
    sel: document.getElementById("scopeSel")?.value,
    listed: document.querySelectorAll(".dmlist [data-dmgo]").length,
    all: P.documents.filter((d) => d.status !== "Withdrawn").length,
    title: document.querySelector("#docView h2")?.textContent,
  }));
  expect(
    sc2.sel === sc0.zone &&
      sc2.listed < sc2.all &&
      /Document map/.test(sc2.title),
    "the document map ignores the chosen zone: " + JSON.stringify(sc2),
  );
  await go("docactions");
  await go("problems");
  const sc3 = await page.evaluate(() => ({
    sel: document.getElementById("scopeSel")?.value,
    rows: document.querySelectorAll("#problemView [data-ps-open]").length,
  }));
  expect(
    sc3.sel === sc0.zone,
    "the Improve section does not offer the chosen zone: " +
      JSON.stringify(sc3),
  );
  await go("layout");
  await page.click("#scopeAll");
  await page.waitForTimeout(300);
  const sc4 = await count();
  expect(
    sc4.scope === "" && sc4.sharp === sc0.all && sc4.faded === 0,
    "Show the whole factory did not bring everything back: " +
      JSON.stringify({ sc0, sc4 }),
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

  // what a link preview or a search engine reads: a title that says what it is, one description, a noscript text
  const head = await page.evaluate(() => {
    const m = (sel) => document.querySelector(sel)?.getAttribute("content");
    return {
      desc: m('meta[name="description"]'),
      og: m('meta[property="og:description"]'),
      ogTitle: m('meta[property="og:title"]'),
      noscript: document.querySelector("noscript")?.textContent || "",
      intro: document.querySelector(".authintro")?.textContent || "",
    };
  });
  expect(
    head.desc === head.og &&
      /fishbone/.test(head.desc) &&
      /5S layout/.test(head.ogTitle) &&
      /5S layouts/.test(head.noscript) &&
      /floor tape/.test(head.intro),
    "page title, descriptions or intro are out of step: " +
      JSON.stringify(head),
  );
  // File menu: the layout as a picture for people without the studio
  await page.click("#fileMenu summary");
  const [png] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    page.click("#bPng"),
  ]);
  expect(
    /\.png$/.test(png.suggestedFilename()),
    "Export layout as image did not give a PNG: " + png.suggestedFilename(),
  );
  // the rename is display only: team files with the old name still open
  const rb = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector(".brand h1").textContent,
    oldName: TEAM_FILE.test("5S-Studio__Sam__Line 1.json"),
    newName: TEAM_FILE.test("Lean-Studio__Sam__Line 1.json"),
  }));
  expect(
    /Lean Studio/.test(rb.title) &&
      rb.h1 === "Lean Studio" &&
      rb.oldName &&
      rb.newName,
    "the rename to Lean Studio is incomplete: " + JSON.stringify(rb),
  );
  // accounts and projects
  const acc = await page.evaluate(async () => {
    const users = await idb.get("auth/users");
    return {
      noPassword: users.every((u) => !u.hash && !u.salt),
      projects: IDX.list.length,
      active: P.projectName,
    };
  });
  expect(acc.noPassword, "a new person was stored with a password");
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
  // a reload opens the same person straight away
  await page.reload();
  await page.waitForFunction(() => document.getElementById("auth").hidden);
  expect(
    (await page.evaluate(() => CUR.name)) === "Tester",
    "a reload did not reopen the last person",
  );
  // Switch person shows the names; tapping one opens it with all its projects
  await page.evaluate(() => {
    signOut();
  });
  await page.waitForSelector("#authBody [data-u]", { timeout: 10000 });
  await page.click("#authBody [data-u]");
  await page.waitForFunction(() => document.getElementById("auth").hidden);
  await page.waitForSelector("#svg");
  expect(
    (await page.evaluate(() => IDX.list.length)) === 3,
    "the person lost their projects",
  );
  // a profile made when there were passwords opens without one, and keeps its work
  await page.evaluate(async () => {
    const users = await idb.get("auth/users");
    Object.assign(users[0], { salt: "c2FsdA==", iter: 210000, hash: "old" });
    await idb.write([["auth/users", users]]);
    signOut();
  });
  await page.waitForSelector("#authBody [data-u]", { timeout: 10000 });
  await page.click("#authBody [data-u]");
  await page.waitForFunction(() => document.getElementById("auth").hidden);
  await page.waitForSelector("#svg");
  await page.waitForTimeout(300);
  expect(
    (await page.evaluate(() => IDX.list.length)) === 3,
    "an old profile with a password did not open with its projects: " +
      JSON.stringify(await page.evaluate(() => [CUR, IDX.list.length])),
  );
  // someone new gets an empty list of their own
  await page.evaluate(() => {
    signOut();
  });
  await page.waitForSelector("#authBody [data-new]");
  await page.click("#authBody [data-new]");
  await page.fill("[name=user]", "Second");
  await page.press("[name=user]", "Enter");
  await page.waitForFunction(() => document.getElementById("auth").hidden);
  await page.waitForSelector("#svg");
  const other = await page.evaluate(() => ({
    name: CUR.name,
    projects: IDX.list.length,
    objects: P.sheets[0].objects.length,
  }));
  expect(
    other.name === "Second" && other.projects === 1 && other.objects === 0,
    "a second person can see another person's work: " + JSON.stringify(other),
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
      " views render, who is working, projects and team copies work, daily check and red tag forms work, example project loads and prints, old v7 backup opens, no console errors",
  );
})();
