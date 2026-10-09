"use strict";
/* ============ problem solving: define, 5-Why, fishbone, countermeasures, review ============ */
// A problem is a record (P.problems) with its own analysis. Everything it decides to do is a
// normal action in the Actions register (a.prob = the problem's id), so there is still one
// list of what is owed. Fishbone, Pareto and the A3 report are in 36-problem-tools.js.

const PROB_ST = ["Open", "Analysing", "Countermeasures", "Verifying", "Closed"];
const PROB_CATS = [
  "Changeover",
  "Machine breakdown",
  "Quality",
  "Safety",
  "Material shortage",
  "Housekeeping / 5S",
  "Information",
  "Other",
];
const FISH = [
  ["people", "People", "Training, skills, shift patterns, fatigue"],
  ["method", "Method", "Procedure, standard work, sequence, set-up"],
  ["machine", "Machine", "Wear, settings, maintenance, tooling"],
  ["material", "Material", "Quality, supply, specification, storage"],
  ["measurement", "Measurement", "Gauges, data, checks, alarms"],
  ["environment", "Environment", "Layout, lighting, temperature, 5S"],
];
const PROB_RESULTS = [
  ["", "Not checked yet"],
  ["yes", "Effective: it has stopped"],
  ["part", "Partly effective"],
  ["no", "Not effective"],
];
const ROOT_CHECKS = [
  ["", "Not tested yet"],
  ["yes", "Yes: fixing it stops the problem"],
  ["unsure", "Not sure: needs a trial or more evidence"],
  ["no", "No: it is only part of the story"],
];
const MAX_WHYS = 8;
const actFin = (a) => ["Done", "Cancelled"].includes(a.status);
const probNo = (p) => "PS-" + String(p.no).padStart(3, "0");
const curProb = () => P.problems.find((p) => p.id === ui.prob.sel) || null;
const probActs = (p) => P.actions.filter((a) => a.prob === p.id);
const probOpen = (p) => p.status !== "Closed";
function probProgress(p) {
  const l = probActs(p).filter((a) => a.status !== "Cancelled");
  return {
    n: l.length,
    done: l.filter((a) => a.status === "Done").length,
    late: l.filter(actOverdue).length,
  };
}
const probLate = (p) =>
  probOpen(p) &&
  (probProgress(p).late > 0 || (!!p.checkOn && p.checkOn < today()));
const probArea = (p) => P.areas.find((a) => a.id === p.area) || null;
const probDays = (p) =>
  daysBetween(p.raised || today(), p.closed || today()) || 0;
const probCauseCount = (p) => FISH.reduce((n, [k]) => n + p.fish[k].length, 0);
const probLikely = (p) =>
  FISH.flatMap(([k, name]) =>
    p.fish[k].filter((c) => c.likely).map((c) => ({ ...c, cat: name })),
  );

function blankProblem(over = {}) {
  return normProblem({
    id: uid(),
    no: 0,
    raised: today(),
    created: today(),
    ...over,
  });
}
/* the normaliser used by validate(): tolerant of anything an old or edited file holds */
function normProblem(x) {
  const s = (v, d = "") => (v == null ? d : String(v)),
    n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0),
    rows = (a) =>
      (Array.isArray(a) ? a : []).filter((i) => i && typeof i === "object"),
    strs = (a) =>
      (Array.isArray(a) ? a : []).filter((i) => typeof i === "string");
  return {
    id: s(x.id, uid()),
    no: Number(x.no) || 0,
    title: s(x.title, "Problem"),
    status: PROB_ST.includes(x.status) ? x.status : "Open",
    owner: s(x.owner),
    team: s(x.team),
    raised: s(x.raised),
    created: s(x.created),
    category: s(x.category),
    area: s(x.area),
    count: n(x.count),
    mins: n(x.mins),
    background: s(x.background),
    current: s(x.current),
    target: s(x.target),
    containment: s(x.containment),
    whys: rows(x.whys)
      .slice(0, MAX_WHYS)
      .map((w) => ({
        id: s(w.id, uid()),
        text: s(w.text),
        evidence: s(w.evidence),
      })),
    root: s(x.root),
    rootCheck: ROOT_CHECKS.some((c) => c[0] === x.rootCheck) ? x.rootCheck : "",
    fish: Object.fromEntries(
      FISH.map(([k]) => [
        k,
        rows(x.fish && x.fish[k]).map((c) => ({
          id: s(c.id, uid()),
          text: s(c.text),
          likely: !!c.likely,
        })),
      ]),
    ),
    tag: s(x.tag),
    co: s(x.co),
    step: s(x.step),
    docs: strs(x.docs),
    items: strs(x.items),
    checkOn: s(x.checkOn),
    result: PROB_RESULTS.some((c) => c[0] === x.result) ? x.result : "",
    after: s(x.after),
    standard: s(x.standard),
    lessons: s(x.lessons),
    closed: s(x.closed),
    recur: strs(x.recur),
    photos: rows(x.photos)
      .filter((q) => q.id)
      .map((q) => ({ id: s(q.id), cap: s(q.cap) })),
  };
}

/* ---------- creating, closing, deleting ---------- */
async function newProblem(over = {}) {
  const r = await modal(
    "New problem",
    `<label class="f">What is the problem?<input name="title" required value="${esc(over.title || "")}" placeholder="e.g. Film jams at the infeed after a reel change"></label>
    <div class="row2"><label class="f">Kind of problem<input name="category" list="probCats" value="${esc(over.category || "")}" placeholder="Pick or type"></label><label class="f">Where<select name="area">${optsKV([["", "Not set"], ...P.areas.map((a) => [a.id, a.name])], over.area || "")}</select></label></div>
    <div class="row2"><label class="f">Owner<input name="owner" list="owners" value="${esc(over.owner || "")}"></label><label class="f">Raised<input name="raised" type="date" value="${esc(over.raised || today())}"></label></div>
    <datalist id="probCats">${PROB_CATS.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>${ownerList()}
    <p class="small muted">You fill in the rest, the 5-Why and the fishbone, on the next screen.</p>`,
    "Start",
  );
  if (!r || !r.title.trim()) return null;
  checkpoint();
  const p = blankProblem({
    ...over,
    title: r.title.trim(),
    category: r.category.trim(),
    area: r.area,
    owner: r.owner.trim(),
    raised: r.raised || today(),
  });
  p.no = ++P.counters.prob;
  P.problems.push(p);
  ui.prob.sel = p.id;
  ui.prob.tab = "list";
  ui.prob.sub = "define";
  record("Problem raised", probNo(p) + " " + p.title);
  renderAll();
  setView("problems");
  return p;
}
function problemFromChangeover(co) {
  const r = smedResult(co);
  newProblem({
    title: "Changeover takes too long: " + co.name,
    category: "Changeover",
    co: co.id,
    current: `Stopped ${fmtMS(r.now.downtime)} per changeover${co.target ? ` against a target of ${fmtMS(co.target)}` : ""}, ${co.perWeek} a week.`,
    target: co.target ? `Stopped time under ${fmtMS(co.target)}.` : "",
    count: 0,
  });
}
function problemFromTag(t) {
  const a = pinArea(t);
  newProblem({
    title: "Why is this here: " + t.title,
    category: "Housekeeping / 5S",
    tag: t.id,
    area: a ? a.id : "",
    owner: t.owner,
    background: t.reason,
  });
}
function problemFromArea(a) {
  newProblem({ area: a.id, category: "Housekeeping / 5S" });
}
async function closeProblem(p) {
  const pr = probProgress(p),
    warn = [];
  if (pr.n > pr.done)
    warn.push(`${pr.n - pr.done} countermeasure(s) are not done`);
  if (!p.result) warn.push("the effectiveness check has not been recorded");
  else if (p.result === "no") warn.push("the check says it was not effective");
  if (!p.root) warn.push("no root cause is written down");
  if (warn.length) {
    const q = await modal(
      "Close " + probNo(p) + " anyway?",
      `<p style="margin-top:0">Normally a problem closes once the fix is in and has been checked. Here: ${warn.map(esc).join("; ")}.</p>`,
      "Close it anyway",
    );
    if (!q) return;
  }
  checkpoint();
  p.status = "Closed";
  p.closed = today();
  record("Problem closed", probNo(p) + " " + p.title);
  renderAll();
}
function reopenProblem(p) {
  checkpoint();
  p.recur.push(today());
  p.status = "Analysing";
  p.closed = "";
  p.result = "";
  record("Problem reopened", probNo(p) + " " + p.title);
  renderAll();
  toast("Reopened. It is counted as a recurrence.");
}
async function deleteProblem(p) {
  const n = probActs(p).length,
    q = await modal(
      "Delete " + probNo(p) + "?",
      `<p style="margin-top:0">The problem, its 5-Why and fishbone and its photos will be removed. ${n ? `Its ${n} countermeasure${n > 1 ? "s stay" : " stays"} in the Actions register, no longer linked.` : ""} You can undo straight after.</p>`,
      "Delete",
    );
  if (!q) return;
  checkpoint();
  for (const a of probActs(p)) {
    a.prob = "";
    if (a.source === probNo(p)) a.source = "";
  }
  for (const ph of p.photos) delete PH[ph.id];
  P.problems = P.problems.filter((x) => x.id !== p.id);
  if (ui.prob.sel === p.id) ui.prob.sel = "";
  dirtyImg = true;
  record("Problem deleted", probNo(p) + " " + p.title);
  renderAll();
}

/* ---------- editing ---------- */
const PROB_REDRAW = new Set(["status", "co", "tag", "area", "result"]);
function setProb(f, v) {
  const p = curProb();
  if (!p) return;
  if (f === "count" || f === "mins") v = Math.max(0, Number(v) || 0);
  if (f === "title") v = String(v).trim() || p.title;
  checkpoint();
  p[f] = v;
  if (f === "status") p.closed = v === "Closed" ? p.closed || today() : "";
  if (f === "co") p.step = "";
  record("Problem updated", probNo(p) + " (" + f + ")");
  if (PROB_REDRAW.has(f)) renderAll();
  else {
    save();
    const t = $("#psTitle");
    if (t) t.textContent = probNo(p) + " · " + p.title;
    updateProbBadge();
  }
}
function lightEdit(what) {
  const p = curProb();
  if (!p) return;
  record("Problem updated", probNo(p) + " (" + what + ")");
  save();
}
function addWhy(p, text = "") {
  if (p.whys.length >= MAX_WHYS)
    return toast("Eight whys is plenty. Look at the last one.");
  checkpoint();
  p.whys.push({ id: uid(), text, evidence: "" });
  lightEdit("why");
  renderProblems();
  const ins = $$("#problemView [data-why$=':text']");
  ins.at(-1)?.focus();
}
function addCause(p, cat, text) {
  text = text.trim();
  if (!text) return;
  checkpoint();
  p.fish[cat].push({ id: uid(), text, likely: false });
  lightEdit("fishbone");
  renderProblems();
  $(`#problemView [data-fadd="${cat}"]`)?.focus();
}

/* ---------- the view ---------- */
function renderProblems(push = false) {
  drawProblems();
  if (ui.view === "problems") syncHash(push);
}
const updateProbBadge = updateNavBadges;
const probPill = (st) =>
  pill(
    st,
    st === "Closed"
      ? "done"
      : st === "Open"
        ? "open"
        : st === "Verifying"
          ? "hi"
          : "prog",
  );
function probFiltered() {
  const f = ui.prob,
    q = f.q.trim().toLowerCase();
  return P.problems
    .filter((p) => {
      if (f.st === "open" && !probOpen(p)) return false;
      if (f.st === "closed" && probOpen(p)) return false;
      if (f.st === "late" && !probLate(p)) return false;
      if (f.owner && p.owner !== f.owner) return false;
      if (f.area && p.area !== f.area) return false;
      if (
        q &&
        !(
          probNo(p) +
          " " +
          p.title +
          " " +
          p.owner +
          " " +
          p.category +
          " " +
          p.root +
          " " +
          p.team
        )
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    })
    .sort(
      (a, b) =>
        probOpen(b) - probOpen(a) ||
        (probOpen(a)
          ? b.no - a.no
          : (b.closed || "").localeCompare(a.closed || "")),
    );
}
function probRows() {
  const rows = probFiltered();
  if (!rows.length)
    return `<p class="empty" style="padding:14px 4px">Nothing matches these filters.</p>`;
  return `<table class="tbl" style="width:100%"><tr><th>No.</th><th>Problem</th><th>Kind</th><th>Owner</th><th>Where</th><th>Raised</th><th>Status</th><th>Root cause</th><th class="n">Actions</th><th>Check on</th><th class="n">Days</th></tr>${rows
    .map((p) => {
      const pr = probProgress(p),
        ar = probArea(p);
      return `<tr class="click" data-ps-open="${esc(p.id)}"><td><b>${esc(probNo(p))}</b></td><td class="t"><b>${esc(p.title)}</b>${p.recur.length ? `<span class="sub">Came back ${p.recur.length} time${p.recur.length > 1 ? "s" : ""}</span>` : ""}</td><td>${esc(p.category) || '<span class="muted">-</span>'}</td><td>${esc(p.owner) || '<span class="muted">none</span>'}</td><td>${esc(ar?.name || "") || '<span class="muted">-</span>'}</td><td>${esc(fmtD(p.raised))}</td><td>${probPill(p.status)}</td><td style="max-width:240px;font-size:12px">${esc(clipText(p.root, 80)) || '<span class="muted">not yet</span>'}</td><td class="n${pr.late ? " late-t" : ""}">${pr.n ? pr.done + "/" + pr.n : "-"}</td><td>${p.checkOn ? dueCell(p.checkOn, probOpen(p) && p.checkOn < today()) : '<span class="muted">-</span>'}</td><td class="n">${probDays(p)}</td></tr>`;
    })
    .join("")}</table>`;
}
function drawProblems() {
  const el = $("#problemView"),
    p = ui.prob.tab === "list" ? curProb() : null;
  const open = P.problems.filter(probOpen),
    late = open.filter(probLate),
    closed = P.problems.filter((x) => !probOpen(x)),
    recent = closed.filter(
      (x) => x.closed && daysBetween(x.closed, today()) <= 30,
    ).length,
    avg = closed.length
      ? Math.round(closed.reduce((n, x) => n + probDays(x), 0) / closed.length)
      : null;
  let h = `<header><div><h2>Problem solving</h2><p class="muted" style="margin:4px 0 0">Define the problem, find the root cause with a 5-Why and a fishbone, then fix it with actions that are owned and dated. Print the lot as an A3.</p></div>
    <div class="kpis"><div><b>${open.length}</b><span>Open</span></div><div><b class="${late.length ? "c-bad" : ""}">${late.length}</b><span>Overdue</span></div><div><b>${recent}</b><span>Closed in 30 days</span></div><div><b>${avg ?? "–"}</b><span>Average days to close</span></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pri" id="psNew">New problem</button><button id="psCsv"${P.problems.length ? "" : " disabled"}>Export CSV</button></div></header>`;
  if (!P.problems.length) {
    el.innerHTML =
      h +
      `<div class="emptybox"><b>No problems yet</b>Raise a problem for anything that keeps happening: a slow changeover, a jam, something that keeps coming back after a clean-up. You can also raise one from a changeover in SMED, from a red tag, or from an area on the layout. Open the example model line to see three worked problems.<div style="margin-top:14px"><button class="pri" id="psNew2">New problem</button> <button data-a="loadExample">Open the example model line</button></div></div>`;
    return;
  }
  if (p) {
    el.innerHTML = h + probDetailHTML(p);
    return;
  }
  const t = ui.prob.tab;
  h += `<div class="psmode"><button data-ps-tab="list" class="${t === "list" ? "on" : ""}">Problems</button><button data-ps-tab="pareto" class="${t === "pareto" ? "on" : ""}">Pareto: what to attack first</button></div>`;
  if (t === "pareto") h += paretoHTML();
  else {
    const owners = [
      ...new Set(P.problems.map((x) => x.owner).filter(Boolean)),
    ].sort();
    h += `<div class="filters"><label>Show<select data-pfilter="st">${optsKV(
      [
        ["open", "Open"],
        ["late", "Overdue"],
        ["closed", "Closed"],
        ["all", "All"],
      ],
      ui.prob.st,
    )}</select></label>
    <label>Owner<select data-pfilter="owner">${optsKV([["", "Anyone"], ...owners.map((o) => [o, o])], ui.prob.owner)}</select></label>
    ${P.areas.length ? `<label>Where<select data-pfilter="area">${optsKV([["", "Anywhere"], ...P.areas.map((a) => [a.id, a.name])], ui.prob.area)}</select></label>` : ""}
    <label>Search<input type="search" data-pfilter="q" value="${esc(ui.prob.q)}" placeholder="Problem, owner, root cause"></label></div>
    <div class="regtbl" id="psTbl">${probRows()}</div>`;
  }
  el.innerHTML = h;
}

function probDetailHTML(p) {
  const pr = probProgress(p),
    sub = ui.prob.sub,
    tabs = [
      ["define", "1 Define", ""],
      ["why", "2 5-Why", p.whys.length ? p.whys.length : ""],
      ["fish", "3 Fishbone", probCauseCount(p) || ""],
      ["act", "4 Countermeasures", pr.n ? pr.done + "/" + pr.n : ""],
      ["review", "5 Review and close", ""],
    ];
  const ar = probArea(p);
  let h = `<div class="smedhead"><div><button id="psBack">← All problems</button><div class="smtitle" style="margin-top:8px"><span id="psTitle">${esc(probNo(p))} · ${esc(p.title)}</span> ${probPill(p.status)}</div><p class="small muted" style="margin:2px 0 0">${[p.category, ar?.name, p.owner && "Owner " + p.owner, "Raised " + fmtD(p.raised), probDays(p) + " days" + (p.status === "Closed" ? " to close" : " open")].filter(Boolean).map(esc).join(" · ")}</p></div>
    <div class="btns" style="margin:0"><button class="pri" data-pa="print">Print A3 report</button>${ar ? '<button data-pa="area-show">Show the area</button>' : ""}<button class="danger" data-pa="del">Delete</button></div></div>
    <div class="psteps">${tabs.map(([k, l, b]) => `<button data-ps-sub="${k}" class="${sub === k ? "on" : ""}">${l}${b !== "" ? `<span class="count">${b}</span>` : ""}</button>`).join("")}</div>`;
  h += {
    define: probDefineHTML,
    why: probWhyHTML,
    fish: probFishHTML,
    act: probActHTML,
    review: probReviewHTML,
  }[sub](p);
  return h;
}
const pf = (p, k, label, attrs = "") =>
  `<label class="f">${label}<input data-pf="${k}" value="${esc(p[k])}"${attrs}></label>`;
const pt = (p, k, label, ph = "", rows = 3) =>
  `<label class="f">${label}<textarea data-pf="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(p[k])}</textarea></label>`;
function probChips(list, key, nameOf) {
  return list.length
    ? `<div class="pchips">${list.map((id) => `<span class="pchip">${esc(nameOf(id))}<button type="button" data-pa="rm-${key}" data-a1="${esc(id)}" aria-label="Remove">×</button></span>`).join("")}</div>`
    : "";
}
function probDefineHTML(p) {
  const co = P.smed.changeovers.find((c) => c.id === p.co),
    docs = P.documents.filter((d) => !p.docs.includes(d.id)),
    stdItems = STD().objects.filter(
      (o) => o.kind === "item" && !p.items.includes(o.ref),
    );
  return `<div class="psform">
  <div class="row2">${pf(p, "title", "What is the problem?")}<label class="f">Status<select data-pf="status">${opts(PROB_ST, p.status)}</select></label></div>
  <div class="row3">${pf(p, "owner", "Owner", ' list="owners"')}${pf(p, "team", "Team (who helps)")}<label class="f">Raised<input data-pf="raised" type="date" value="${esc(p.raised)}"></label></div>
  <div class="row3"><label class="f">Kind of problem (groups the Pareto)<input data-pf="category" list="probCats" value="${esc(p.category)}"></label><label class="f">Where<select data-pf="area">${optsKV([["", "Not set"], ...P.areas.map((a) => [a.id, a.name])], p.area)}</select></label><label class="f">Times it has happened<input data-pf="count" type="number" min="0" step="1" value="${esc(p.count || "")}"></label></div>
  <div class="row3"><label class="f">Minutes lost in total<input data-pf="mins" type="number" min="0" step="1" value="${esc(p.mins || "")}"></label><label class="f">Linked red tag<select data-pf="tag">${optsKV([["", "None"], ...P.tags.map((t) => [t.id, tagNo(t) + " " + t.title])], p.tag)}</select></label><label class="f">Linked changeover<select data-pf="co">${optsKV([["", "None"], ...P.smed.changeovers.map((c) => [c.id, coCode(c) + " " + c.name])], p.co)}</select></label></div>
  ${co ? `<label class="f">Step of that changeover<select data-pf="step">${optsKV([["", "The whole changeover"], ...co.steps.map((s, i) => [s.id, i + 1 + ". " + (s.name || "step")])], p.step)}</select></label>` : ""}
  <datalist id="probCats">${PROB_CATS.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>${ownerList()}
  <div class="tgrid">
    <section class="block"><h3>1 Background</h3>${pt(p, "background", "", "Why does this matter? Who is hurt: safety, quality, output, people?")}</section>
    <section class="block"><h3>2 Current state</h3>${pt(p, "current", "", "What is happening now, with numbers: how often, how long, how many.")}</section>
    <section class="block"><h3>3 Target</h3>${pt(p, "target", "", "What good looks like, measured, and by when.")}</section>
    <section class="block"><h3>Containment</h3>${pt(p, "containment", "", "What protects the line, the product and the people while we fix it?")}</section>
  </div>
  <section class="block wide"><h3>Also involved</h3>
    <div class="row2"><div><label class="f">Documents<select data-padd="docs"><option value="">Add a document…</option>${docs.map((d) => `<option value="${esc(d.id)}">${esc(docNo(d) + " " + d.title)}</option>`).join("")}</select></label>${probChips(p.docs, "docs", (id) => (P.documents.find((d) => d.id === id) ? docNo(P.documents.find((d) => d.id === id)) + " " + P.documents.find((d) => d.id === id).title : "(deleted)"))}</div>
    <div><label class="f">Items on the layout<select data-padd="items"><option value="">Add an item…</option>${stdItems.map((o) => `<option value="${esc(o.ref)}">${esc(o.label)}</option>`).join("")}</select></label>${probChips(p.items, "items", (ref) => STD().objects.find((o) => o.ref === ref)?.label || "(removed)")}</div></div>
  </section>
  <section class="block wide"><h3>Photos <span class="count">${p.photos.length}</span></h3>${p.photos.length ? `<div class="photos">${p.photos.map((ph) => (PH[ph.id] ? `<button type="button" data-pa="photo-view" data-a1="${esc(ph.id)}" title="${esc(ph.cap || "Photo")}"><img src="${esc(PH[ph.id])}" alt="${esc(ph.cap || "Photo")}"></button>` : "")).join("")}</div>` : '<p class="small muted" style="margin:0">Show what it looks like when it goes wrong.</p>'}<div class="btns"><button type="button" data-pa="photo-add">Add photos</button><input type="file" id="psPhIn" accept="image/*" multiple hidden></div></section>
  </div>`;
}

function probWhyHTML(p) {
  const w = p.whys,
    chain = [...w.map((x) => x.text.trim()).filter(Boolean)].reverse();
  let h = `<p class="small" style="margin:10px 0 4px">Ask <b>why</b> of each answer, not of the problem again. Stay with facts you can check, and write down the evidence. Stop when the answer is something you can fix that would stop it coming back. If an answer is "the operator forgot", ask why the process let that happen.</p>
  <div class="whys"><div class="why prob"><span class="wn">Problem</span><div><b>${esc(p.title)}</b></div></div>`;
  w.forEach((x, i) => {
    h += `<div class="why"><span class="wn">Why ${i + 1}?</span><div><div class="wq">${i === 0 ? "Why does this happen?" : "Why did that happen?"}</div><input data-why="${i}:text" value="${esc(x.text)}" placeholder="Because…" aria-label="Why ${i + 1}"><input data-why="${i}:evidence" value="${esc(x.evidence)}" placeholder="Evidence: what did you see, measure or check?" aria-label="Evidence for why ${i + 1}"></div><button type="button" data-pa="why-del" data-a1="${i}" aria-label="Remove why ${i + 1}">✕</button></div>`;
  });
  h += `</div><div class="btns"><button class="pri" data-pa="why-add"${w.length >= MAX_WHYS ? " disabled" : ""}>${w.length ? "Add another why" : "Ask the first why"}</button>${w.length ? '<button data-pa="why-root">The last answer is the root cause</button>' : ""}</div>`;
  h += `<section class="block wide root"><h3>Root cause</h3>${pt(p, "root", "", "The thing that, if it is fixed, stops the problem coming back. Write it as a cause, not as a solution.", 2)}
  <label class="f">Test: if we fix this, does the problem stop?<select data-pf="rootCheck">${optsKV(ROOT_CHECKS, p.rootCheck)}</select></label>
  ${chain.length > 1 ? `<p class="small muted" style="margin:6px 0 0">Read it back, from the root: ${chain.map((c) => `<b>${esc(c)}</b>`).join(" <span aria-hidden='true'>→</span> ")} <span aria-hidden="true">→</span> <b>${esc(p.title)}</b>. Does each step really cause the next?</p>` : ""}</section>`;
  const likely = probLikely(p);
  if (likely.length)
    h += `<section class="block wide"><h3>Likely causes from the fishbone</h3><p class="small muted" style="margin-top:0">Start a 5-Why from one of these${w.length ? " (this replaces the chain above)" : ""}.</p>${likely.map((c) => `<button class="irow" style="--c:#c3361a" data-pa="why-seed" data-a1="${esc(c.id)}"><span>${esc(c.text)}</span><span>${esc(c.cat)}</span></button>`).join("")}</section>`;
  return h;
}

function probActHTML(p) {
  const list = probActs(p).sort(
      (a, b) =>
        actFin(a) - actFin(b) ||
        (a.due || "9999").localeCompare(b.due || "9999"),
    ),
    pr = probProgress(p),
    free = P.actions.filter((a) => !a.prob && !actFin(a));
  let h = "";
  if (p.root)
    h += `<div class="status extra" style="margin-top:10px"><b>Root cause:</b> ${esc(p.root)}</div>`;
  else
    h += `<div class="status warn" style="margin-top:10px">No root cause written yet. <button data-ps-sub="why">Go to the 5-Why</button></div>`;
  h += `<p class="small" style="margin:8px 0">Each countermeasure should remove or reduce a cause. Prefer fixes that make the problem impossible (a guide, a gauge, a changed layout) over reminders and retraining. They are normal actions, so they also show in the Actions register.</p>`;
  if (pr.n)
    h += `<div class="meter"><i style="width:${Math.round((pr.done / pr.n) * 100)}%;background:var(--ok)"></i></div><p class="small muted" style="margin:4px 0 8px">${pr.done} of ${pr.n} done${pr.late ? `, <b class="late-t">${pr.late} overdue</b>` : ""}</p>`;
  if (pr.n && pr.done === pr.n && p.status === "Countermeasures")
    h += `<div class="status ok"><b>Everything is done.</b> Check the fix worked.<button data-pa="to-verify">Move to Verifying</button></div>`;
  h += list.length
    ? `<table class="tbl" style="width:100%"><tr><th>No.</th><th>Countermeasure</th><th>Owner</th><th>Due</th><th>Status</th><th></th></tr>${list
        .map((a) => {
          const fin = actFin(a);
          return `<tr class="click" data-pa="act-open" data-a1="${esc(a.id)}"><td><b>${esc(actNo(a))}</b></td><td class="t"><b>${esc(a.title)}</b>${a.note ? `<span class="sub">${esc(a.note)}</span>` : ""}</td><td>${esc(a.owner) || '<span class="muted">none</span>'}</td><td>${fin ? esc(fmtD(a.done)) : dueCell(a.due, actOverdue(a))}</td><td>${pill(a.status, a.status === "Done" ? "done" : a.status === "In progress" ? "prog" : a.status === "Cancelled" ? "" : "open")}</td><td><button data-pa="act-unlink" data-a1="${esc(a.id)}" title="Keep the action but take it off this problem">Unlink</button></td></tr>`;
        })
        .join("")}</table>`
    : `<p class="empty">No countermeasures yet.</p>`;
  h += `<div class="btns"><button class="pri" data-pa="act-add">Add a countermeasure</button>${free.length ? `<select id="psLink" aria-label="Link an existing action"><option value="">Link an existing action…</option>${free.map((a) => `<option value="${esc(a.id)}">${esc(actNo(a) + " " + a.title)}</option>`).join("")}</select>` : ""}</div>`;
  return h;
}

function probReviewHTML(p) {
  const pr = probProgress(p),
    closed = p.status === "Closed";
  return `<div class="psform">
  <div class="status ${pr.n && pr.done === pr.n ? "ok" : "extra"}" style="margin-top:10px">${pr.n ? `<b>${pr.done} of ${pr.n}</b> countermeasures done.` : "<b>No countermeasures yet.</b>"} Wait long enough after the last one to be sure: a fix that has only run for a day has not been tested.</div>
  <div class="row2"><label class="f">Effectiveness check on<input data-pf="checkOn" type="date" value="${esc(p.checkOn)}"></label><label class="f">Result<select data-pf="result">${optsKV(PROB_RESULTS, p.result)}</select></label></div>
  ${pt(p, "after", "What do the numbers say now?", "Same measure as the current state: how often, how long, how many. Compare with the target.")}
  ${pt(p, "standard", "What did we change so it stays fixed?", "Standard work, a document, a board, floor tape, a layout change. Link the document under Define.")}
  ${pt(p, "lessons", "What did we learn? Where else does it apply?", "Other lines, machines or areas with the same weakness.")}
  <div class="btns">${closed ? '<button data-pa="reopen">It came back: reopen</button>' : `${p.status !== "Verifying" ? '<button data-pa="to-verify">Move to Verifying</button>' : ""}<button class="pri" data-pa="close">Close this problem</button>`}</div>
  ${p.recur.length ? `<p class="small muted">Came back on: ${p.recur.map((d) => esc(fmtD(d))).join(", ")}.</p>` : ""}
  ${closed ? `<p class="small muted">Closed on ${esc(fmtD(p.closed))}, ${probDays(p)} days after it was raised.</p>` : ""}
  </div>`;
}

/* ---------- events ---------- */
async function addProbPhotos(files) {
  const p = curProb();
  if (!p || !files.length) return;
  checkpoint();
  let n = 0;
  for (const f of files) {
    try {
      const id = uid();
      PH[id] = await shrink(f);
      p.photos.push({ id, cap: "" });
      n++;
    } catch {}
  }
  dirtyImg = true;
  record("Problem photos added", probNo(p) + " " + n);
  renderAll();
}
async function viewProbPhoto(p, id) {
  const ph = p.photos.find((x) => x.id === id);
  if (!ph || !PH[id]) return;
  let del = false;
  const r = await modal(
    ph.cap || "Photo",
    `<img class="big" src="${esc(PH[id])}" alt=""><label class="f">Caption<input name="cap" value="${esc(ph.cap)}" placeholder="What does this show?"></label><button type="button" class="danger" id="phDel">Delete photo</button>`,
    "Save caption",
    {
      wide: true,
      onOpen: (d) => {
        $("#phDel").onclick = () => {
          del = true;
          d.close("cancel");
        };
      },
    },
  );
  if (del) {
    checkpoint();
    p.photos = p.photos.filter((x) => x.id !== id);
    delete PH[id];
    dirtyImg = true;
    record("Problem photo deleted", probNo(p));
    renderAll();
  } else if (r) {
    checkpoint();
    ph.cap = r.cap;
    renderAll();
  }
}
function probAction(name, a1, a2) {
  const p = curProb();
  switch (name) {
    case "print":
      return p && printProblem(p);
    case "del":
      return p && deleteProblem(p);
    case "close":
      return p && closeProblem(p);
    case "reopen":
      return p && reopenProblem(p);
    case "to-verify":
      return p && setProb("status", "Verifying");
    case "area-show": {
      const ar = p && probArea(p);
      if (!ar) return;
      setView("layout");
      const dr = P.sheets.find((s) => s.drawing === ar.drawing) || STD();
      if (dr.id !== P.active) openSheet(dr.id);
      drawNow();
      areaAct("areaOpen", { dataset: { id: ar.id } });
      return;
    }
    case "why-add":
      return p && addWhy(p);
    case "why-del":
      if (!p) return;
      checkpoint();
      p.whys.splice(+a1, 1);
      lightEdit("why");
      return renderProblems();
    case "why-root": {
      const last = p?.whys
        .map((x) => x.text.trim())
        .filter(Boolean)
        .at(-1);
      if (!last) return;
      checkpoint();
      p.root = last;
      lightEdit("root cause");
      return renderProblems();
    }
    case "why-seed": {
      const c = probLikely(p).find((x) => x.id === a1);
      if (!c) return;
      checkpoint();
      p.whys = [{ id: uid(), text: c.text, evidence: "" }];
      lightEdit("why");
      return renderProblems();
    }
    case "fish-add": {
      const inp = $(`#problemView [data-fadd="${a1}"]`);
      return p && addCause(p, a1, inp ? inp.value : "");
    }
    case "fish-del": {
      if (!p) return;
      checkpoint();
      p.fish[a1] = p.fish[a1].filter((c) => c.id !== a2);
      lightEdit("fishbone");
      return renderProblems();
    }
    case "fish-why": {
      const c = p?.fish[a1].find((x) => x.id === a2);
      if (!c) return;
      checkpoint();
      p.whys = [{ id: uid(), text: c.text, evidence: "" }];
      lightEdit("why");
      ui.prob.sub = "why";
      return renderProblems();
    }
    case "act-add":
      return (
        p &&
        newAction({
          prob: p.id,
          source: probNo(p),
          title: "",
          s5: "",
        })
      );
    case "act-open":
      return editAction(a1);
    case "act-unlink": {
      const a = P.actions.find((x) => x.id === a1);
      if (!a) return;
      checkpoint();
      a.prob = "";
      if (a.source === probNo(p)) a.source = "";
      record("Countermeasure unlinked", actNo(a));
      return renderAll();
    }
    case "rm-docs":
    case "rm-items": {
      if (!p) return;
      checkpoint();
      const k = name.slice(3);
      p[k] = p[k].filter((x) => x !== a1);
      lightEdit(k);
      return renderProblems();
    }
    case "photo-add":
      return $("#psPhIn")?.click();
    case "photo-view":
      return p && viewProbPhoto(p, a1);
  }
}
const psView = $("#problemView");
psView.addEventListener("click", (e) => {
  const t = e.target;
  let b;
  if (t.closest("select,input,textarea")) return;
  if ((b = t.closest("[data-ps-open]"))) {
    ui.prob.sel = b.dataset.psOpen;
    ui.prob.sub = "define";
    return renderProblems(true);
  }
  if (t.closest("#psBack")) {
    ui.prob.sel = "";
    return renderProblems(true);
  }
  if ((b = t.closest("[data-ps-tab]"))) {
    ui.prob.tab = b.dataset.psTab;
    ui.prob.sel = "";
    return renderProblems(true);
  }
  if ((b = t.closest("[data-ps-sub]"))) {
    ui.prob.sub = b.dataset.psSub;
    return renderProblems();
  }
  if (t.closest("#psNew,#psNew2")) return void newProblem();
  if (t.closest("#psCsv")) return void csvProblems();
  if (t.closest("[data-a=loadExample]")) return void loadExample();
  if ((b = t.closest("[data-pa]"))) {
    return void probAction(b.dataset.pa, b.dataset.a1, b.dataset.a2);
  }
  if ((b = t.closest("[data-pareto-print]")))
    return void printView($("#psPareto"), "size: A4 landscape; margin: 10mm");
});
psView.addEventListener("change", (e) => {
  const el = e.target,
    p = curProb();
  if (el.id === "psPhIn") {
    const fs = [...el.files];
    el.value = "";
    return void addProbPhotos(fs);
  }
  if (el.dataset.pfilter) {
    ui.prob[el.dataset.pfilter] = el.value;
    return renderProblems();
  }
  if (el.dataset.pare) {
    const k = el.dataset.pare;
    ui.prob[k] = el.type === "checkbox" ? el.checked : el.value;
    return renderProblems();
  }
  if (!p) return;
  if (el.dataset.pf) return setProb(el.dataset.pf, el.value);
  if (el.dataset.why !== undefined) {
    const [i, k] = el.dataset.why.split(":"),
      w = p.whys[+i];
    if (!w) return;
    checkpoint();
    w[k] = el.value;
    return lightEdit("why");
  }
  if (el.dataset.fc) {
    const [cat, id] = el.dataset.fc.split(":"),
      c = p.fish[cat]?.find((x) => x.id === id);
    if (!c) return;
    checkpoint();
    c.text = el.value;
    lightEdit("fishbone");
    return;
  }
  if (el.dataset.fl) {
    const [cat, id] = el.dataset.fl.split(":"),
      c = p.fish[cat]?.find((x) => x.id === id);
    if (!c) return;
    checkpoint();
    c.likely = el.checked;
    lightEdit("fishbone");
    return renderProblems();
  }
  if (el.dataset.padd) {
    if (!el.value) return;
    checkpoint();
    const k = el.dataset.padd;
    if (!p[k].includes(el.value)) p[k].push(el.value);
    lightEdit(k);
    return renderProblems();
  }
  if (el.id === "psLink") {
    const a = P.actions.find((x) => x.id === el.value);
    if (!a) return;
    checkpoint();
    a.prob = p.id;
    a.source = a.source || probNo(p);
    record("Countermeasure linked", actNo(a) + " to " + probNo(p));
    renderAll();
  }
});
psView.addEventListener("input", (e) => {
  if (e.target.dataset.pfilter === "q") {
    ui.prob.q = e.target.value;
    $("#psTbl").innerHTML = probRows();
  }
});
psView.addEventListener("keydown", (e) => {
  const el = e.target;
  if (e.key === "Enter" && el.dataset.fadd) {
    e.preventDefault();
    const p = curProb();
    if (p) addCause(p, el.dataset.fadd, el.value);
  }
});
