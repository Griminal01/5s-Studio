"use strict";
/* ============ improvement log ============
   Ideas anyone can raise (P.ideas), taken from New to Done: who raised it, the zone, what it would improve,
   benefit and effort (which place it on the quick-win chart), an owner, and links to a layout proposal to
   try it, a problem it helps or a red tag it came from. The work it needs is ordinary actions (a.idea is the
   idea's id), so there is still one list of what is owed. Page #ideaView, form ideaModal(), print, CSV. */
// { id, no, title, by, raised, zone, what, benefit, gain 0-3, effort 0-3, status, owner, sheet, prob, tag,
//   note, result, closed }. gain and effort: 0 not rated yet, 1 low, 2 medium, 3 high.
const IDEA_ST = ["New", "Assessed", "Trial", "Done", "Not now"];
const IDEA_OPEN = ["New", "Assessed", "Trial"];
const IDEA_LEVEL = ["Not rated", "Low", "Medium", "High"];
const IDEA_WAIT = 14; // days an idea may sit as New before it shows as late
const ideaNo = (x) => "IM-" + String(x.no).padStart(3, "0");
const ideaOpen = (x) => IDEA_OPEN.includes(x.status);
const ideaLate = (x) =>
  x.status === "New" && x.raised && daysBetween(x.raised, today()) > IDEA_WAIT;
const ideaQuick = (x) => x.gain >= 2 && x.effort === 1;
const ideaActs = (x) => P.actions.filter((a) => a.idea === x.id);
const ideaInScope = (x) => {
  const a = scopeArea();
  if (!a) return true;
  if (x.zone === a.id) return true;
  return isLine(a) && P.areas.find((z) => z.id === x.zone)?.parent === a.id;
};
const blankIdea = (i = {}) => ({
  id: uid(),
  no: 0,
  title: i.title || "",
  by: i.by ?? (CUR ? CUR.name : ""),
  raised: today(),
  zone: i.zone || "",
  what: i.what || "",
  benefit: "",
  gain: 0,
  effort: 0,
  status: "New",
  owner: "",
  sheet: i.sheet || "",
  prob: i.prob || "",
  tag: i.tag || "",
  note: "",
  result: "",
  closed: "",
});
// the normaliser used by validate(): links that no longer exist are dropped
function normIdeas(p) {
  const str = (v) => (v == null ? "" : String(v)),
    lvl = (v) => Math.min(3, Math.max(0, Math.round(Number(v) || 0))),
    has = (list, id) => list.some((x) => x.id === id),
    zones = p.areas.filter((a) => a.level !== "line");
  const out = (Array.isArray(p.ideas) ? p.ideas : [])
    .filter((x) => x && typeof x === "object")
    .map((x) => ({
      id: str(x.id) || uid(),
      no: Number(x.no) || 0,
      title: str(x.title) || "Idea",
      by: str(x.by),
      raised: str(x.raised),
      zone: has(zones, x.zone) ? x.zone : "",
      what: str(x.what),
      benefit: str(x.benefit),
      gain: lvl(x.gain),
      effort: lvl(x.effort),
      status: IDEA_ST.includes(x.status) ? x.status : "New",
      owner: str(x.owner),
      sheet: has(p.sheets, x.sheet) ? x.sheet : "",
      prob: has(p.problems, x.prob) ? x.prob : "",
      tag: has(p.tags, x.tag) ? x.tag : "",
      note: str(x.note),
      result: str(x.result),
      closed: str(x.closed),
    }));
  const seen = new Set();
  for (const x of out) {
    while (seen.has(x.id)) x.id = uid();
    seen.add(x.id);
  }
  p.counters.idea = Math.max(
    Number(p.counters.idea) || 0,
    ...out.map((x) => x.no),
  );
  for (const x of out) if (x.no <= 0) x.no = ++p.counters.idea;
  return out;
}

/* ---------- the page ---------- */
function ideaPill(x) {
  const cls = ideaLate(x)
    ? "late"
    : x.status === "Done"
      ? "done"
      : x.status === "Not now"
        ? ""
        : x.status === "New"
          ? "open"
          : "prog";
  return `<span class="pill ${cls}">${esc(x.status)}${ideaLate(x) ? ", waiting" : ""}</span>`;
}
function ideasFiltered() {
  const f = ui.reg.ideas,
    q = f.q.trim().toLowerCase();
  return P.ideas
    .filter((x) => {
      if (!ideaInScope(x)) return false;
      if (f.st === "open" && !ideaOpen(x)) return false;
      if (f.st === "quick" && !(ideaOpen(x) && ideaQuick(x))) return false;
      if (IDEA_ST.includes(f.st) && x.status !== f.st) return false;
      if (
        q &&
        !(
          ideaNo(x) +
          " " +
          [x.title, x.by, x.owner, x.what, x.benefit, zoneName(x.zone)].join(
            " ",
          )
        )
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    })
    .sort(
      (a, b) =>
        IDEA_ST.indexOf(a.status) - IDEA_ST.indexOf(b.status) || b.no - a.no,
    );
}
const lvlCell = (v) =>
  v ? esc(IDEA_LEVEL[v]) : '<span class="muted">not rated</span>';
function ideaRows(rows) {
  if (!rows.length)
    return `<p class="empty" style="padding:14px 4px">Nothing matches these filters.</p>`;
  return `<table class="tbl" style="width:100%"><tr><th>No.</th><th>Idea</th><th>Raised by</th><th>Zone</th><th>Benefit</th><th>Effort</th><th>Status</th><th>Owner</th><th class="n">Actions</th></tr>${rows
    .map((x) => {
      const acts = ideaActs(x),
        done = acts.filter((a) => ["Done", "Cancelled"].includes(a.status));
      return `<tr class="click" data-ideaid="${esc(x.id)}"><td><b class="nw">${esc(ideaNo(x))}</b></td><td class="t"><b>${esc(x.title)}</b>${ideaQuick(x) && ideaOpen(x) ? ' <span class="pill done">Quick win</span>' : ""}${x.what ? `<span class="sub">${esc(clipText(x.what.split("\n")[0], 120))}</span>` : ""}<span class="sub imob">${esc(x.by || "Someone")}, ${esc(fmtD(x.raised))} ${ideaPill(x)}</span></td><td>${esc(x.by || "-")}<span class="sub">${esc(fmtD(x.raised))}</span></td><td>${esc(zoneName(x.zone) || "-")}</td><td>${lvlCell(x.gain)}</td><td>${lvlCell(x.effort)}</td><td>${ideaPill(x)}</td><td>${esc(x.owner || "-")}</td><td class="n">${acts.length ? done.length + "/" + acts.length : "-"}</td></tr>`;
    })
    .join("")}</table>`;
}
// benefit up, effort across: quick wins top left; ideas not rated yet are listed under it
function ideaChartHTML(list, print = false) {
  const cell = (g, e) =>
      list
        .filter((x) => x.gain === g && x.effort === e)
        .map(
          (x) =>
            `<${print ? "span" : "button"} class="ichip${ideaQuick(x) ? " q" : ""}" ${print ? "" : `data-ideaid="${esc(x.id)}" `}title="${esc(x.title)}">${esc(ideaNo(x))} ${esc(clipText(x.title, 28))}</${print ? "span" : "button"}>`,
        )
        .join(""),
    zone = (g, e) =>
      g >= 2 && e === 1
        ? "q"
        : g >= 2 && e >= 2
          ? "b"
          : g === 1 && e === 1
            ? "f"
            : "t",
    names = {
      q: "Quick wins: do these now",
      b: "Worth planning",
      f: "Fill-ins",
      t: "Think again",
    };
  let h = `<div class="ichart"><div class="iy">Benefit</div><div class="igrid">`;
  for (const g of [3, 2, 1])
    for (const e of [1, 2, 3]) {
      const z = zone(g, e),
        first =
          (z === "q" && g === 3 && e === 1) ||
          (z === "b" && g === 3 && e === 2) ||
          (z === "f" && g === 1 && e === 1) ||
          (z === "t" && g === 1 && e === 2);
      h += `<div class="icell z-${z}"><span class="ilv">${IDEA_LEVEL[g]} benefit, ${IDEA_LEVEL[e].toLowerCase()} effort</span>${first ? `<b class="izn">${names[z]}</b>` : ""}${cell(g, e)}</div>`;
    }
  h += `</div><div class="ix">Effort</div></div>`;
  const unrated = list.filter((x) => !x.gain || !x.effort);
  if (unrated.length)
    h += `<p class="small muted" style="margin:8px 0 0">Not rated yet, so not on the chart: ${unrated.map((x) => esc(ideaNo(x))).join(", ")}. Open one and set its benefit and effort.</p>`;
  return h;
}
function ideasHTML() {
  const F = ui.reg.ideas,
    a = scopeArea(),
    mine = P.ideas.filter(ideaInScope),
    open = mine.filter(ideaOpen),
    waiting = mine.filter(ideaLate),
    quick = open.filter(ideaQuick),
    done90 = mine.filter(
      (x) =>
        x.status === "Done" && x.closed && daysBetween(x.closed, today()) <= 90,
    );
  let h = `<header><div><h2>Improvement log: ${esc(a?.name || "the whole factory")}</h2><p class="muted" style="margin:4px 0 0">Ideas from anyone, for anything that would make the work safer, easier or quicker. Each one is looked at, rated for benefit and effort, tried and either done or parked, and every idea gets an answer.</p></div>
    <div class="kpis"><div><b>${mine.filter((x) => x.status === "New").length}</b><span>New, to look at</span></div><div><b class="${waiting.length ? "c-bad" : ""}">${waiting.length}</b><span>Waiting over ${IDEA_WAIT} days</span></div><div><b>${quick.length}</b><span>Open quick wins</span></div><div><b>${done90.length}</b><span>Done in 90 days</span></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pri" id="imNew">New idea</button><button id="imPrint"${mine.length ? "" : " disabled"}>Print</button><button id="imCsv"${mine.length ? "" : " disabled"}>Export CSV</button></div></header>`;
  if (!P.ideas.length)
    return (
      h +
      `<div class="emptybox"><b>No ideas yet</b>Anyone can raise one: a better place for a tool, a step that could go, a guard that gets in the way, a label nobody can read. Write it in a sentence and say what it would improve. Someone then rates it for benefit and effort and takes it forward.<div style="margin-top:14px"><button class="pri" id="imNew2">New idea</button> <button data-a="loadExample">Open the example model line</button></div></div>`
    );
  const t = F.tab;
  h += `<div class="psmode"><button data-im-tab="log" class="${t === "log" ? "on" : ""}">Ideas</button><button data-im-tab="chart" class="${t === "chart" ? "on" : ""}">Quick-win chart</button></div>`;
  if (t === "chart")
    return (
      h +
      `<p class="small muted" style="margin:0 0 8px">Open ideas by benefit and effort. Start top left.</p>` +
      ideaChartHTML(open)
    );
  h += `<div class="filters"><label>Show<select data-f="st">${optsKV(
    [
      ["open", "Open"],
      ["quick", "Open quick wins"],
      ...IDEA_ST.map((x) => [x, x]),
      ["all", "All"],
    ],
    F.st,
  )}</select></label>
    <label>Search<input type="search" data-f="q" value="${esc(F.q)}" placeholder="Idea, who, zone"></label></div>
    <div class="regtbl" id="ideaTbl">${ideaRows(ideasFiltered())}</div>`;
  return h;
}
function renderIdeas() {
  const el = $("#ideaView");
  if (el) el.innerHTML = ideasHTML();
}

/* ---------- the form ---------- */
async function ideaModal(x, isNew) {
  let del = false,
    after = "";
  const zones = P.areas.filter(
      (a) => !isLine(a) && (a.drawing === STD().drawing || a.id === x.zone),
    ),
    props = P.sheets.filter((s) => s.kind === "proposal" || s.id === x.sheet),
    acts = ideaActs(x),
    lv = (name, v) =>
      `<select name="${name}">${optsKV(
        IDEA_LEVEL.map((l, i) => [String(i), l]),
        String(v),
      )}</select>`;
  const html = `<label class="f">The idea<input name="title" required value="${esc(x.title)}" placeholder="e.g. Keep the spare film reel on a trolley next to the packer"></label>
    <div class="row3"><label class="f">Raised by<input name="by" list="ideaby" value="${esc(x.by)}" placeholder="Name"></label><label class="f">Zone<select name="zone"><option value="">Not in a zone</option>${zones.map((z) => `<option value="${esc(z.id)}"${x.zone === z.id ? " selected" : ""}>${esc(z.name)}</option>`).join("")}</select></label><label class="f">Raised on<input name="raised" type="date" value="${esc(x.raised)}"></label></div>
    <label class="f">What happens now, and what would change<textarea name="what" rows="3" placeholder="The spare reel is fetched from the store at every reel change.">${esc(x.what)}</textarea></label>
    <label class="f">What it would improve<input name="benefit" value="${esc(x.benefit)}" placeholder="e.g. Saves about 5 minutes and a 40 m walk per reel change"></label>
    <details class="idet"${isNew ? "" : " open"}><summary>Taking it forward</summary>
    <div class="row3"><label class="f">Benefit${lv("gain", x.gain)}</label><label class="f">Effort${lv("effort", x.effort)}</label><label class="f">Status<select name="status">${opts(IDEA_ST, x.status)}</select></label></div>
    <div class="row3"><label class="f">Owner<input name="owner" list="owners" value="${esc(x.owner)}" placeholder="Who takes it forward"></label><label class="f">Tried on proposal<select name="sheet">${optsKV([["", "None"], ...props.map((s) => [s.id, s.name])], x.sheet)}</select></label><label class="f">Helps problem<select name="prob">${optsKV([["", "None"], ...P.problems.map((p) => [p.id, probNo(p) + " " + p.title])], x.prob)}</select></label></div>
    <div class="row2"><label class="f">Came from red tag<select name="tag">${optsKV([["", "None"], ...P.tags.map((t) => [t.id, tagNo(t) + " " + t.title])], x.tag)}</select></label><label class="f">Notes<input name="note" value="${esc(x.note)}"></label></div>
    <label class="f">Result, once done or parked<textarea name="result" rows="2" placeholder="What changed, what it saved, or why it is not being done now">${esc(x.result)}</textarea></label>
    <div class="f"><span>Actions <small class="muted">${acts.length ? acts.length + " linked" : "none yet"}</small></span>${acts
      .map(
        (a) =>
          `<button type="button" class="irow" data-iact="${esc(a.id)}"><span>${esc(actNo(a))} ${esc(a.title)}</span><span>${esc(a.owner || "no owner")}, ${esc(a.status)}</span></button>`,
      )
      .join(
        "",
      )}<div class="btns" style="margin-top:4px"><button type="button" id="imAct">${isNew ? "Save and add an action" : "Add an action"}</button></div></div>
    </details>
    ${isNew ? "" : '<div class="btns"><button type="button" class="danger" id="imDel">Delete this idea</button></div>'}
    <datalist id="ideaby">${[...new Set(P.ideas.map((i) => i.by))]
      .filter(Boolean)
      .map((w) => `<option value="${esc(w)}">`)
      .join("")}</datalist>${ownerList()}`;
  const r = await modal(
    isNew ? "New idea" : ideaNo(x) + " idea",
    html,
    isNew ? "Add idea" : "Save",
    {
      cls: "mid",
      onOpen: (d) => {
        // the action form needs the dialog: save this one first, then open it
        const leaveFor = (what) => {
          after = what;
          $("#dlgOk").click();
          if ($("#dlg").open) after = ""; // blocked by validation: do not act later
        };
        $("#imAct").onclick = () => leaveFor("act");
        d.querySelectorAll("[data-iact]").forEach(
          (b) => (b.onclick = () => leaveFor("edit:" + b.dataset.iact)),
        );
        $("#imDel") &&
          ($("#imDel").onclick = () => {
            del = true;
            d.close("cancel");
          });
      },
    },
  );
  if (del) return deleteIdea(x);
  if (!r) return;
  checkpoint();
  const status = IDEA_ST.includes(r.status) ? r.status : x.status,
    fin = !ideaOpen({ status });
  Object.assign(x, {
    title: r.title.trim() || x.title || "Idea",
    by: r.by.trim(),
    zone: r.zone,
    raised: r.raised || x.raised || today(),
    what: r.what.trim(),
    benefit: r.benefit.trim(),
    gain: Number(r.gain) || 0,
    effort: Number(r.effort) || 0,
    status,
    owner: r.owner.trim(),
    sheet: r.sheet,
    prob: r.prob,
    tag: r.tag,
    note: r.note.trim(),
    result: r.result.trim(),
    closed: fin ? x.closed || today() : "",
  });
  if (isNew) {
    x.no = ++P.counters.idea;
    P.ideas.push(x);
  }
  record(isNew ? "Idea raised" : "Idea updated", ideaNo(x) + " " + x.title);
  renderAll();
  if (after === "act") {
    await newAction({ idea: x.id, sheet: x.sheet, tag: x.tag });
    ideaModal(x, false);
  } else if (after.startsWith("edit:")) {
    await actionModal(
      P.actions.find((a) => a.id === after.slice(5)),
      false,
    );
    ideaModal(x, false);
  } else if (isNew && ui.view === "ideas" && !ideaInScope(x))
    toast(
      "Saved. It is not in the zone being shown, so it is hidden here.",
      5000,
    );
}
async function deleteIdea(x) {
  const acts = ideaActs(x);
  const q = await modal(
    "Delete " + ideaNo(x) + "?",
    `<p style="margin-top:0">This idea will be removed. You can undo straight after.${acts.length ? ` Its ${acts.length} action${acts.length > 1 ? "s stay" : " stays"} in the 5S actions.` : ""} To keep a record that it was looked at, set it to Not now instead.</p>`,
    "Delete",
  );
  if (!q) return;
  checkpoint();
  for (const a of acts) {
    a.idea = "";
    if (!a.prob) a.stream = a.doc ? "doc" : "5s";
  }
  P.ideas = P.ideas.filter((i) => i.id !== x.id);
  record("Idea deleted", ideaNo(x) + " " + x.title);
  renderAll();
}
// a red tag often points at a better way: the idea starts with the tag's zone and words
function ideaFromTag(t) {
  if (!t) return;
  const z =
    t.x != null
      ? P.areas.find(
          (a) => !isLine(a) && a.drawing === t.drawing && ptInPoly(t, a.pts),
        )
      : null;
  newIdea({
    tag: t.id,
    zone: z?.id || "",
    what: `From red tag ${tagNo(t)}: ${t.title}${t.reason ? ". " + t.reason : ""}`,
  });
}
// the zone side panel: its open ideas and a button to raise one
const zoneIdeasHTML = (a) => {
  const list = P.ideas.filter(
    (x) =>
      ideaOpen(x) &&
      (x.zone === a.id ||
        (isLine(a) && P.areas.find((z) => z.id === x.zone)?.parent === a.id)),
  );
  return `<h3><span>Open ideas</span><span class="count">${list.length}</span></h3>${
    list
      .map(
        (x) =>
          `<button class="irow" style="--c:#1F8A55" data-a="ideaOpen" data-id="${esc(x.id)}"><span>${esc(ideaNo(x))} ${esc(x.title)}</span><span>${esc(x.status)}</span></button>`,
      )
      .join("") ||
    `<p class="small muted">${isLine(a) ? "No open ideas in this line's zones." : "No open ideas for this zone. Anyone can raise one."}</p>`
  }${isLine(a) ? "" : '<div class="btns"><button data-a="areaIdea">Raise an idea here</button></div>'}`;
};
const newIdea = (i) => ideaModal(blankIdea(i || {}), true),
  editIdea = (id) => {
    const x = P.ideas.find((i) => i.id === id);
    if (x) ideaModal(x, false);
  };

/* ---------- output ---------- */
function csvIdeas() {
  csv(
    [
      [
        "No.",
        "Idea",
        "Raised by",
        "Raised on",
        "Zone",
        "What happens now and what would change",
        "What it would improve",
        "Benefit",
        "Effort",
        "Quick win",
        "Status",
        "Owner",
        "Proposal",
        "Problem",
        "Red tag",
        "Actions done",
        "Actions",
        "Result",
        "Closed",
        "Notes",
      ],
      ...P.ideas.filter(ideaInScope).map((x) => {
        const acts = ideaActs(x),
          p = P.problems.find((y) => y.id === x.prob),
          t = P.tags.find((y) => y.id === x.tag);
        return [
          ideaNo(x),
          x.title,
          x.by,
          x.raised,
          zoneName(x.zone),
          x.what,
          x.benefit,
          IDEA_LEVEL[x.gain],
          IDEA_LEVEL[x.effort],
          ideaQuick(x) ? "Yes" : "",
          x.status,
          x.owner,
          sheetLabel(x.sheet),
          p ? probNo(p) + " " + p.title : "",
          t ? tagNo(t) + " " + t.title : "",
          acts.filter((a) => ["Done", "Cancelled"].includes(a.status)).length,
          acts.length,
          x.result,
          x.closed,
          x.note,
        ];
      }),
    ],
    "LeanStudio_improvement_log.csv",
  );
}
function printIdeas() {
  const mine = P.ideas.filter(ideaInScope);
  if (!mine.length) return toast("No ideas to print yet.");
  const open = mine.filter(ideaOpen),
    rows = (list) =>
      `<table class="fixed"><colgroup><col style="width:7%"><col style="width:33%"><col style="width:12%"><col style="width:12%"><col style="width:8%"><col style="width:8%"><col style="width:10%"><col style="width:10%"></colgroup><tr><th>No.</th><th>Idea</th><th>Raised by</th><th>Zone</th><th>Benefit</th><th>Effort</th><th>Status</th><th>Owner</th></tr>${list
        .map(
          (x) =>
            `<tr><td><b class="nw">${esc(ideaNo(x))}</b></td><td><b>${esc(x.title)}</b>${x.benefit ? `<br><span class="pdm">${esc(x.benefit)}</span>` : ""}${x.result && !ideaOpen(x) ? `<br><span class="pdm">Result: ${esc(x.result)}</span>` : ""}</td><td>${esc(x.by)}<br><span class="pdm">${esc(fmtD(x.raised))}</span></td><td>${esc(zoneName(x.zone))}</td><td>${esc(x.gain ? IDEA_LEVEL[x.gain] : "-")}</td><td>${esc(x.effort ? IDEA_LEVEL[x.effort] : "-")}</td><td>${esc(x.status)}</td><td>${esc(x.owner)}</td></tr>`,
        )
        .join("")}</table>`,
    closed = mine.filter((x) => !ideaOpen(x));
  printWithPage(
    `<div class="pd"><h1>Improvement log: ${esc(scopeArea()?.name || "the whole factory")}</h1>
    <p class="pdm">${esc(P.projectName || "Lean Studio project")}, printed ${esc(fmtD(today()))}. ${open.length} open, ${closed.length} done or parked.</p>
    <h2>Quick-win chart</h2>${ideaChartHTML(open, true)}
    <h2>Open ideas</h2>${open.length ? rows(open) : '<p class="pdm">None open.</p>'}
    ${closed.length ? `<h2>Done and parked</h2>${rows(closed)}` : ""}</div>`,
    "",
    "size: A4 landscape; margin: 10mm",
  );
}

/* ---------- events ---------- */
const imView = $("#ideaView");
imView.addEventListener("click", (e) => {
  let b;
  if ((b = e.target.closest("[data-im-tab]"))) {
    ui.reg.ideas.tab = b.dataset.imTab;
    return renderIdeas();
  }
  if ((b = e.target.closest("[data-ideaid]")))
    return editIdea(b.dataset.ideaid);
  if (e.target.closest("[data-a=loadExample]")) return void loadExample();
  if (e.target.closest("#imNew,#imNew2")) {
    const a = scopeArea(),
      only =
        a && isLine(a) && zonesOfLine(a).length === 1
          ? zonesOfLine(a)[0]
          : null;
    newIdea({ zone: a ? (isLine(a) ? only?.id || "" : a.id) : "" });
  } else if (e.target.closest("#imPrint")) printIdeas();
  else if (e.target.closest("#imCsv")) csvIdeas();
});
imView.addEventListener("change", (e) => {
  const k = e.target.dataset.f;
  if (!k || k === "q") return;
  ui.reg.ideas[k] = e.target.value;
  renderIdeas();
});
imView.addEventListener("input", (e) => {
  if (e.target.dataset.f === "q") {
    ui.reg.ideas.q = e.target.value;
    $("#ideaTbl").innerHTML = ideaRows(ideasFiltered());
  }
});
