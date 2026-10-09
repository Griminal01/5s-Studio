"use strict";
/* ============ action register ============ */
function renderRegister() {
  const el = $("#regView");
  el.innerHTML = ui.view === "tags" ? tagsHTML() : actionsHTML();
  wireRegister(el);
}
const pill = (txt, cls) => `<span class="pill ${cls}">${esc(txt)}</span>`;
const dueCell = (d, late) =>
  d
    ? `<span class="${late ? "late-t" : ""}">${esc(fmtD(d))}${late ? " (overdue)" : ""}</span>`
    : '<span class="muted">none</span>';
function tagFiltered() {
  const f = ui.reg.tags,
    q = f.q.trim().toLowerCase();
  return P.tags
    .filter((t) => {
      if (f.st === "open" && t.status === "Closed") return false;
      if (f.st === "closed" && t.status !== "Closed") return false;
      if (f.st === "late" && !tagOverdue(t)) return false;
      if (f.owner && t.owner !== f.owner) return false;
      if (f.cat && t.cat !== f.cat) return false;
      if (!areaPass(f.area, t)) return false;
      if (
        q &&
        !(
          tagNo(t) +
          " " +
          t.title +
          " " +
          t.reason +
          " " +
          t.owner +
          " " +
          t.note +
          " " +
          t.disp
        )
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    })
    .sort(
      (x, y) =>
        (x.status === "Closed") - (y.status === "Closed") ||
        (x.status === "Closed"
          ? (y.closed || "").localeCompare(x.closed || "")
          : (x.due || "9999").localeCompare(y.due || "9999") || y.no - x.no),
    );
}
function tagRows() {
  const rows = tagFiltered();
  if (!rows.length)
    return `<p class="empty" style="padding:14px 4px">Nothing matches these filters.</p>`;
  return `<table class="tbl" style="width:100%"><tr><th>Tag</th><th>Raised</th><th>What is it</th><th>Category</th><th>What happens to it</th><th>Owner</th><th>Area</th><th>Decide by</th><th>Status</th><th class="n">Days</th><th></th></tr>${rows
    .map((t) => {
      const days =
        t.status === "Closed"
          ? daysBetween(t.raised || t.closed, t.closed || today())
          : daysBetween(t.raised || today(), today());
      return `<tr class="click" data-tag="${esc(t.id)}"><td><b>${tagNo(t)}</b></td><td>${esc(fmtD(t.raised))}</td><td class="t"><b>${esc(t.title)}</b>${t.reason ? `<span class="sub">${esc(t.reason)}</span>` : ""}</td><td>${esc(t.cat)}</td><td>${esc(t.disp)}</td><td>${esc(t.owner) || '<span class="muted">none</span>'}</td>${areaCell(t)}<td>${t.status === "Closed" ? esc(fmtD(t.due)) : dueCell(t.due, tagOverdue(t))}</td><td>${pill(t.status, t.status === "Closed" ? "done" : t.status === "In red tag area" ? "prog" : "open")}</td><td class="n">${days}</td><td>${t.x != null ? `<button data-show="tag:${t.id}">Show</button> ` : ""}${t.status !== "Closed" ? `<button data-tagprob="${esc(t.id)}" title="Raise a problem to find out why this keeps happening">Problem</button>` : ""}</td></tr>`;
    })
    .join("")}</table>`;
}
function tagsHTML() {
  const F = ui.reg.tags,
    open = P.tags.filter((t) => t.status !== "Closed"),
    late = open.filter(tagOverdue),
    closed = P.tags.filter((t) => t.status === "Closed"),
    rec = closed.filter(
      (t) => t.closed && daysBetween(t.closed, today()) <= 30,
    ).length,
    dated = closed.filter((t) => t.closed && (t.raised || t.closed)),
    avg = dated.length
      ? Math.round(
          dated.reduce(
            (a, t) =>
              a + Math.max(0, daysBetween(t.raised || t.closed, t.closed) || 0),
            0,
          ) / dated.length,
        )
      : null;
  const ownersT = [
    ...new Set(P.tags.map((t) => t.owner).filter(Boolean)),
  ].sort();
  let h = `<header><div><h2>Red tag register</h2><p class="muted" style="margin:4px 0 0">Everything tagged as not needed or in the wrong place, who owns it and what happens to it.</p></div>
    <div class="kpis"><div><b>${open.length}</b><span>Open</span></div><div><b class="${late.length ? "c-bad" : ""}">${late.length}</b><span>Overdue</span></div><div><b>${rec}</b><span>Closed in 30 days</span></div><div><b>${avg ?? "–"}</b><span>Average days to close</span></div></div>
    <div style="display:flex;gap:8px"><button class="pri" id="rNew">New red tag</button><button id="rCsv">Export CSV</button><button id="rPrint">Print</button></div></header>`;
  if (!P.tags.length)
    return (
      h +
      `<div class="emptybox"><b>No red tags yet</b>Red tag anything that is not needed, in the wrong place or unsafe. On the layout press G and click the drawing, or use Red tag this on a selected item. You can also add one here and pin it later.<div style="margin-top:14px"><button class="pri" id="rNew2">New red tag</button></div></div>`
    );
  h += `<div class="filters"><label>Show<select data-f="st">${optsKV(
    [
      ["open", "Open"],
      ["late", "Overdue"],
      ["closed", "Closed"],
      ["all", "All"],
    ],
    F.st,
  )}</select></label>
    <label>Owner<select data-f="owner">${optsKV([["", "Anyone"], ...ownersT.map((o) => [o, o])], F.owner)}</select></label>
    <label>Category<select data-f="cat">${optsKV([["", "All"], ...TAG_CATS.map((o) => [o, o])], F.cat)}</select></label>${areaFilterHTML(F.area)}
    <label>Search<input type="search" data-f="q" value="${esc(F.q)}" placeholder="Tag, item, owner"></label></div>
    <div class="regtbl" id="regTbl">${tagRows()}</div>`;
  return h;
}
function actFiltered() {
  const f = ui.reg.acts,
    q = f.q.trim().toLowerCase();
  return P.actions
    .filter((a) => {
      const fin = ["Done", "Cancelled"].includes(a.status);
      if (f.st === "open" && fin) return false;
      if (f.st === "done" && !fin) return false;
      if (f.st === "late" && !actOverdue(a)) return false;
      if (f.owner && a.owner !== f.owner) return false;
      if (f.s5 && a.s5 !== f.s5) return false;
      if (!areaPass(f.area, a)) return false;
      if (
        q &&
        !(actNo(a) + " " + a.title + " " + a.owner + " " + a.note)
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    })
    .sort(
      (x, y) =>
        ["Done", "Cancelled"].includes(x.status) -
          ["Done", "Cancelled"].includes(y.status) ||
        (["Done", "Cancelled"].includes(x.status)
          ? (y.done || "").localeCompare(x.done || "")
          : (x.due || "9999").localeCompare(y.due || "9999") ||
            ACT_PRI.indexOf(y.pri) - ACT_PRI.indexOf(x.pri) ||
            y.no - x.no),
    );
}
const s5name = (k) => S5.find((x) => x[0] === k)?.[1] || "";
function actRows() {
  const rows = actFiltered();
  if (!rows.length)
    return `<p class="empty" style="padding:14px 4px">Nothing matches these filters.</p>`;
  return `<table class="tbl" style="width:100%"><tr><th>Action</th><th>What needs doing</th><th>5S step</th><th>Owner</th><th>Area</th><th>Due</th><th>Priority</th><th>Status</th><th>From</th><th></th></tr>${rows
    .map((a) => {
      const fin = ["Done", "Cancelled"].includes(a.status),
        tg = P.tags.find((t) => t.id === a.tag),
        from = [sheetLabel(a.sheet), tg ? tagNo(tg) : "", a.source || ""]
          .filter(Boolean)
          .join(", ");
      return `<tr class="click" data-actid="${esc(a.id)}"><td><b>${actNo(a)}</b></td><td class="t"><b>${esc(a.title)}</b>${a.note ? `<span class="sub">${esc(a.note)}</span>` : ""}</td><td>${esc(s5name(a.s5))}</td><td>${esc(a.owner) || '<span class="muted">none</span>'}</td>${areaCell(a)}<td>${fin ? esc(fmtD(a.done)) : dueCell(a.due, actOverdue(a))}</td><td>${pill(a.pri, a.pri === "High" && !fin ? "hi" : "")}</td><td>${pill(a.status, a.status === "Done" ? "done" : a.status === "In progress" ? "prog" : a.status === "Cancelled" ? "" : "open")}</td><td style="max-width:200px;font-size:12px;color:var(--muted)">${esc(from)}</td><td>${a.x != null && !fin ? `<button data-show="act:${a.id}">Show</button>` : ""}</td></tr>`;
    })
    .join("")}</table>`;
}
function actionsHTML() {
  const F = ui.reg.acts,
    open = P.actions.filter((a) => !["Done", "Cancelled"].includes(a.status)),
    late = open.filter(actOverdue),
    done = P.actions.filter((a) => a.status === "Done"),
    rec = done.filter(
      (a) => a.done && daysBetween(a.done, today()) <= 30,
    ).length,
    withDue = done.filter((a) => a.due && a.done),
    ontime = withDue.length
      ? Math.round(
          (withDue.filter((a) => a.done <= a.due).length / withDue.length) *
            100,
        )
      : null;
  const ownersA = [
    ...new Set(P.actions.map((a) => a.owner).filter(Boolean)),
  ].sort();
  let h = `<header><div><h2>Action log</h2><p class="muted" style="margin:4px 0 0">Jobs from your designs, checks and red tags, with an owner and a due date.</p></div>
    <div class="kpis"><div><b>${open.length}</b><span>Open</span></div><div><b class="${late.length ? "c-bad" : ""}">${late.length}</b><span>Overdue</span></div><div><b>${rec}</b><span>Done in 30 days</span></div><div><b>${ontime == null ? "–" : ontime + "%"}</b><span>Done on time</span></div></div>
    <div style="display:flex;gap:8px"><button class="pri" id="rNew">New action</button><button id="rCsv">Export CSV</button><button id="rPrint">Print</button></div></header>`;
  if (!P.actions.length)
    return (
      h +
      `<div class="emptybox"><b>No actions logged yet</b>Add actions from the 5S and notes tab on any sheet, or press A and click the drawing where the job is. Each gets an owner and a due date.<div style="margin-top:14px"><button class="pri" id="rNew2">New action</button></div></div>`
    );
  h += `<div class="filters"><label>Show<select data-f="st">${optsKV(
    [
      ["open", "Open"],
      ["late", "Overdue"],
      ["done", "Done or cancelled"],
      ["all", "All"],
    ],
    F.st,
  )}</select></label>
    <label>Owner<select data-f="owner">${optsKV([["", "Anyone"], ...ownersA.map((o) => [o, o])], F.owner)}</select></label>
    <label>5S step<select data-f="s5">${optsKV([["", "All"], ...S5.map((x) => [x[0], x[1]])], F.s5)}</select></label>${areaFilterHTML(F.area)}
    <label>Search<input type="search" data-f="q" value="${esc(F.q)}" placeholder="Action, owner"></label></div>
    <div class="regtbl" id="regTbl">${actRows()}</div>`;
  return h;
}
function wireRegister(el) {
  const isT = ui.view === "tags",
    R = isT ? ui.reg.tags : ui.reg.acts;
  el.onclick = (e) => {
    let b;
    if ((b = e.target.closest("[data-show]"))) {
      const [k, id] = b.dataset.show.split(":");
      showOnLayout(pinObj(k, id));
      return;
    }
    if ((b = e.target.closest("[data-tagprob]"))) {
      problemFromTag(P.tags.find((t) => t.id === b.dataset.tagprob));
      return;
    }
    if ((b = e.target.closest("[data-tag]"))) {
      editTag(b.dataset.tag);
      return;
    }
    if ((b = e.target.closest("[data-actid]"))) {
      editAction(b.dataset.actid);
      return;
    }
    if (e.target.closest("#rNew,#rNew2")) {
      isT ? newTag({}) : newAction({});
      return;
    }
    if (e.target.closest("#rCsv")) isT ? csvTags() : csvActions();
    if (e.target.closest("#rPrint")) printView(el);
  };
  el.onchange = (e) => {
    const k = e.target.dataset.f;
    if (!k) return;
    R[k] = e.target.value;
    renderRegister();
  };
  el.oninput = (e) => {
    if (e.target.dataset.f === "q") {
      R.q = e.target.value;
      $("#regTbl").innerHTML = isT ? tagRows() : actRows();
    }
  };
}
function csvTags() {
  csv(
    [
      [
        "Tag",
        "Raised",
        "Raised by",
        "Item",
        "Category",
        "Reason",
        "What happens to it",
        "Owner",
        "Decide by",
        "Status",
        "Closed",
        "Days open",
        "Pinned",
        "Notes",
        "Area",
      ],
      ...P.tags.map((t) => [
        tagNo(t),
        t.raised,
        t.by,
        t.title,
        t.cat,
        t.reason,
        t.disp,
        t.owner,
        t.due,
        t.status,
        t.closed,
        t.status === "Closed"
          ? daysBetween(t.raised || t.closed, t.closed || today())
          : daysBetween(t.raised || today(), today()),
        t.x != null ? "Yes" : "No",
        t.note,
        pinAreaName(t),
      ]),
    ],
    "5S_red_tag_register.csv",
  );
}
function csvActions() {
  csv(
    [
      [
        "Action",
        "Raised",
        "What needs doing",
        "5S step",
        "Priority",
        "Owner",
        "Due",
        "Status",
        "Done",
        "From sheet",
        "Red tag",
        "Overdue",
        "Notes",
        "Area",
      ],
      ...P.actions.map((a) => [
        actNo(a),
        a.raised,
        a.title,
        s5name(a.s5),
        a.pri,
        a.owner,
        a.due,
        a.status,
        a.done,
        sheetLabel(a.sheet),
        P.tags.find((t) => t.id === a.tag)
          ? tagNo(P.tags.find((t) => t.id === a.tag))
          : "",
        actOverdue(a) ? "Yes" : "No",
        a.note,
        pinAreaName(a),
      ]),
    ],
    "5S_action_log.csv",
  );
}

/* ============ follow-up block on Trends ============ */
function followUpHTML() {
  const lateA = P.actions
      .filter(actOverdue)
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 5),
    oldT = P.tags
      .filter((t) => t.status !== "Closed")
      .sort((a, b) => (a.raised || "").localeCompare(b.raised || ""))
      .slice(0, 5);
  const rowA = (a) =>
    `<button class="irow" style="--c:var(--bad)" data-fu-act="${esc(a.id)}"><span>${actNo(a)} ${esc(a.title)}</span><span>${esc(a.owner || "no owner")}, due ${esc(fmtD(a.due))}</span></button>`;
  const rowT = (t) =>
    `<button class="irow" style="--c:${tagOverdue(t) ? "var(--bad)" : "#F79622"}" data-fu-tag="${esc(t.id)}"><span>${tagNo(t)} ${esc(t.title)}</span><span>${esc(t.owner || "no owner")}, ${daysBetween(t.raised || today(), today())} days</span></button>`;
  return `<section class="block"><h3>Follow-up</h3><p>Overdue actions, and the red tags that have been open longest.</p><div class="fu">${lateA.length ? lateA.map(rowA).join("") : '<p class="empty" style="margin:0">No overdue actions.</p>'}</div><div class="fu">${oldT.length ? oldT.map(rowT).join("") : '<p class="empty" style="margin:0">No open red tags.</p>'}</div>
    <div class="btns"><button data-go-view="actions">Open the action log</button><button data-go-view="tags">Open the red tag register</button></div></section>`;
}
function wireFollowUp(el) {
  el.querySelectorAll("[data-fu-act]").forEach(
    (b) => (b.onclick = () => editAction(b.dataset.fuAct)),
  );
  el.querySelectorAll("[data-fu-tag]").forEach(
    (b) => (b.onclick = () => editTag(b.dataset.fuTag)),
  );
  el.querySelectorAll("[data-go-view]").forEach(
    (b) => (b.onclick = () => setView(b.dataset.goView)),
  );
}
