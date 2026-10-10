"use strict";
/* ============ documents in the area ============ */
// A register of the documents that live in an area (SOPs, one-point lessons,
// checklists, changeover sheets...), where each one is kept, who owns it and
// when it is next reviewed. Documents can be pinned on the drawing.

const blankDoc = (i) => ({
  id: uid(),
  no: 0,
  title: i.title || "",
  type: i.type || DOC_TYPES[0],
  owner: "",
  rev: "",
  issued: "",
  review: "",
  format: DOC_FORMATS[0],
  qty: 1,
  holder: i.holder || "",
  where: "",
  status: "Current",
  ref: "",
  note: "",
  sheet: i.sheet || "",
  drawing: i.drawing || "",
  x: i.x ?? null,
  y: i.y ?? null,
});
const newDocument = (i) => docModal(blankDoc(i || {}), true),
  editDocument = (id) => {
    const d = P.documents.find((x) => x.id === id);
    if (d) docModal(d, false);
  };

/* things in the standard that can hold a document */
function holderChoices() {
  return STD()
    .objects.filter((o) => o.kind !== "keepclear")
    .map((o) => [o.ref, o.label])
    .sort((a, b) => a[1].localeCompare(b[1]));
}
const holderName = (d) =>
  STD().objects.find((o) => o.ref === d.holder)?.label || "";
const docWhere = (d) =>
  [holderName(d), d.where].filter(Boolean).join(", ") || "Not placed";
const addMonths = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};
const dueSoon = (d) =>
  !!d.review &&
  d.status !== "Withdrawn" &&
  !docOverdue(d) &&
  daysBetween(today(), d.review) <= 30;

async function docModal(d, isNew) {
  let after = "",
    del = false;
  const html = `<label class="f">Title<input name="title" required value="${esc(d.title)}" placeholder="e.g. Film reel change SOP"></label>
    <div class="row3"><label class="f">Type<select name="type">${opts(DOC_TYPES, d.type)}</select></label><label class="f">Document no. or reference<input name="ref" value="${esc(d.ref)}" placeholder="e.g. SOP-0123"></label><label class="f">Revision<input name="rev" value="${esc(d.rev)}" placeholder="e.g. 3"></label></div>
    <div class="row3"><label class="f">Owner<input name="owner" list="owners" value="${esc(d.owner)}"></label><label class="f">Issued<input name="issued" type="date" value="${esc(d.issued)}"></label><label class="f">Review by<input name="review" type="date" value="${esc(d.review)}"></label></div>
    <div class="btns" style="margin-top:-4px"><span class="small muted">Set the review date:</span><button type="button" data-rv="6">6 months</button><button type="button" data-rv="12">12 months</button><button type="button" data-rv="24">24 months</button></div>
    <div class="row3"><label class="f">Format<select name="format">${opts(DOC_FORMATS, d.format)}</select></label><label class="f">Copies in the zone<input name="qty" type="number" min="1" step="1" value="${esc(d.qty)}"></label><label class="f">Status<select name="status">${opts(DOC_ST, d.status)}</select></label></div>
    <div class="row2"><label class="f">Kept at<select name="holder">${optsKV([["", "Not at a listed holder"], ...holderChoices()], d.holder)}</select></label><label class="f">Exactly where<input name="where" value="${esc(d.where)}" placeholder="e.g. eye level, left of the HMI"></label></div>
    <label class="f">Notes<textarea name="note" rows="2">${esc(d.note)}</textarea></label>
    <p class="pinfo">${d.x != null ? `Pinned on the document map. Drag the pin there to move it. <button type="button" id="docShow">Show on the map</button>` : `Not pinned yet. <button type="button" id="docPin">Pin it on the document map</button>`}</p>
    ${isNew ? "" : '<div class="btns"><button type="button" class="danger" id="docDel">Delete this document</button></div>'}${ownerList()}`;
  const r = await modal(
    isNew ? "New document" : docNo(d) + " document",
    html,
    isNew ? "Add document" : "Save",
    {
      cls: "mid",
      onOpen: (dlg) => {
        dlg.querySelectorAll("[data-rv]").forEach(
          (b) =>
            (b.onclick = () => {
              dlg.querySelector('[name="review"]').value = addMonths(
                +b.dataset.rv,
              );
              if (!dlg.querySelector('[name="issued"]').value)
                dlg.querySelector('[name="issued"]').value = today();
            }),
        );
        $("#docPin") &&
          ($("#docPin").onclick = () => {
            after = "pin";
            $("#dlgOk").click();
            if ($("#dlg").open) after = ""; // blocked by validation: do not act later
          });
        $("#docShow") &&
          ($("#docShow").onclick = () => {
            after = "show";
            $("#dlgOk").click();
            if ($("#dlg").open) after = ""; // blocked by validation: do not act later
          });
        $("#docDel") &&
          ($("#docDel").onclick = () => {
            del = true;
            dlg.close("cancel");
          });
      },
    },
  );
  if (del) {
    const q = await modal(
      "Delete " + docNo(d) + "?",
      '<p style="margin-top:0">This document will be removed from the register. You can undo straight after.</p>',
      "Delete",
    );
    if (q) {
      checkpoint();
      P.documents = P.documents.filter((x) => x.id !== d.id);
      record("Document deleted", docNo(d) + " " + d.title);
      renderAll();
    }
    return;
  }
  if (!r) return;
  checkpoint();
  Object.assign(d, {
    title: r.title.trim() || d.title,
    type: r.type,
    ref: r.ref.trim(),
    rev: r.rev.trim(),
    owner: r.owner.trim(),
    issued: r.issued,
    review: r.review,
    format: r.format,
    qty: Math.max(1, Math.round(Number(r.qty)) || 1),
    status: r.status,
    holder: r.holder,
    where: r.where.trim(),
    note: r.note.trim(),
  });
  if (isNew) {
    d.no = ++P.counters.doc;
    P.documents.push(d);
  }
  record(
    isNew ? "Document added" : "Document updated",
    docNo(d) + " " + d.title,
  );
  renderAll();
  if (after === "pin") startDocPin(d.id);
  else if (after === "show") showOnDocMap(d);
}

/* ----- the register view ----- */
function docsFiltered() {
  const f = ui.reg.docs,
    q = f.q.trim().toLowerCase();
  return P.documents
    .filter((d) => {
      if (f.st === "live" && d.status === "Withdrawn") return false;
      if (f.st === "late" && !docOverdue(d)) return false;
      if (f.st === "soon" && !dueSoon(d) && !docOverdue(d)) return false;
      if (f.st === "unplaced" && d.x != null) return false;
      if (f.st === "withdrawn" && d.status !== "Withdrawn") return false;
      if (f.type && d.type !== f.type) return false;
      if (f.owner && d.owner !== f.owner) return false;
      if (!scopePass(d, true)) return false;
      if (
        q &&
        !(
          docNo(d) +
          " " +
          d.title +
          " " +
          d.ref +
          " " +
          d.owner +
          " " +
          docWhere(d) +
          " " +
          d.note
        )
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    })
    .sort(
      (a, b) =>
        (a.status === "Withdrawn") - (b.status === "Withdrawn") ||
        holderName(a).localeCompare(holderName(b)) ||
        a.no - b.no,
    );
}
function docRows(rows) {
  if (!rows.length)
    return `<p class="empty" style="padding:14px 4px">Nothing matches these filters.</p>`;
  return `<table class="tbl" style="width:100%"><tr><th>No.</th><th>Document</th><th>Type</th><th>Owner</th><th>Rev</th><th>Review by</th><th>Kept at</th><th>Zone</th><th>Format</th><th>Status</th><th></th></tr>${rows
    .map(
      (d) =>
        `<tr class="click" data-docid="${esc(d.id)}"><td><b class="nw">${docNo(d)}</b></td><td class="t"><b>${esc(d.title)}</b>${d.ref ? `<span class="sub">${esc(d.ref)}</span>` : ""}</td><td>${esc(d.type)}</td><td>${esc(d.owner) || '<span class="muted">none</span>'}</td><td>${esc(d.rev) || '<span class="muted">-</span>'}</td><td>${d.status === "Withdrawn" ? "" : d.review ? dueCell(d.review, docOverdue(d)) : '<span class="muted">not set</span>'}</td><td>${esc(docWhere(d))}</td>${areaCell(d)}<td>${esc(d.format)}${d.qty > 1 ? " x" + d.qty : ""}</td><td>${pill(d.status, d.status === "Current" ? "done" : d.status === "Withdrawn" ? "" : d.status === "Under review" ? "prog" : "open")}</td><td>${d.x != null && d.status !== "Withdrawn" ? `<button data-docshow="${esc(d.id)}">Show</button>` : d.status !== "Withdrawn" ? `<button data-docpin="${esc(d.id)}">Pin</button>` : ""}</td></tr>`,
    )
    .join("")}</table>`;
}
function documentsHTML() {
  const F = ui.reg.docs,
    live = P.documents.filter(
      (d) => d.status !== "Withdrawn" && scopePass(d, true),
    ),
    late = live.filter(docOverdue),
    soon = live.filter(dueSoon),
    unplaced = live.filter((d) => d.x == null),
    ownersD = [
      ...new Set(P.documents.map((d) => d.owner).filter(Boolean)),
    ].sort();
  let h = `<header><div><h2>${ui.view === "docmap" ? "Document map" : "Document list"}: ${esc(scopeArea()?.name || "the whole factory")}</h2><p class="muted" style="margin:4px 0 0">What information lives where: SOPs, one-point lessons, checklists and boards, with an owner and a review date.</p></div>
    <div class="kpis"><div><b>${live.length}</b><span>In use</span></div><div><b class="${late.length ? "c-bad" : ""}">${late.length}</b><span>Review overdue</span></div><div><b>${soon.length}</b><span>Due in 30 days</span></div><div><b>${unplaced.length}</b><span>Not pinned</span></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pri" id="dNew">New document</button><button id="dMap">Print document map</button><button id="dList">Print list</button><button id="dCsv">Export CSV</button></div></header>`;
  if (P.documents.length && ui.view === "docmap") return h + docMapHTML();
  if (!P.documents.length)
    return (
      h +
      `<div class="emptybox"><b>No documents yet</b>List the SOPs, checklists, one-point lessons and boards that belong in the factory, say where each is kept, and who reviews it. You can pin each one on the document map, then print it for the area.<div style="margin-top:14px"><button class="pri" id="dNew2">New document</button></div></div>`
    );
  h += `<div class="filters"><label>Show<select data-f="st">${optsKV(
    [
      ["all", "All"],
      ["live", "In use"],
      ["late", "Review overdue"],
      ["soon", "Review due soon"],
      ["unplaced", "Not pinned on the map"],
      ["withdrawn", "Withdrawn"],
    ],
    F.st,
  )}</select></label>
    <label>Type<select data-f="type">${optsKV([["", "All"], ...DOC_TYPES.map((o) => [o, o])], F.type)}</select></label>
    <label>Owner<select data-f="owner">${optsKV([["", "Anyone"], ...ownersD.map((o) => [o, o])], F.owner)}</select></label>
    <label>Search<input type="search" data-f="q" value="${esc(F.q)}" placeholder="Title, reference, place"></label></div>
    <div class="regtbl" id="docTbl">${docRows(docsFiltered())}</div>`;
  return h;
}
function renderDocuments() {
  const el = $("#docView");
  el.innerHTML = documentsHTML();
  if (ui.view === "docmap") renderDocMap();
  const R = ui.reg.docs;
  el.onclick = (e) => {
    let b;
    if ((b = e.target.closest("[data-docshow]"))) {
      showOnDocMap(pinObj("doc", b.dataset.docshow));
      return;
    }
    if ((b = e.target.closest("[data-docpin]"))) {
      startDocPin(b.dataset.docpin);
      return;
    }
    if ((b = e.target.closest("[data-docid]"))) {
      editDocument(b.dataset.docid);
      return;
    }
    if (e.target.closest("#dNew,#dNew2")) newDocument({});
    else if (e.target.closest("#dMap")) printDocumentMap();
    else if (e.target.closest("#dList")) printDocumentList();
    else if (e.target.closest("#dCsv")) csvDocuments();
  };
  el.onchange = (e) => {
    const k = e.target.dataset.f;
    if (!k || k === "q") return; // search is handled as you type; a rebuild here would eat the next click
    R[k] = e.target.value;
    renderDocuments();
  };
  el.oninput = (e) => {
    if (e.target.dataset.f === "q") {
      R.q = e.target.value;
      $("#docTbl").innerHTML = docRows(docsFiltered());
    }
  };
}

/* ----- exports and print ----- */
function csvDocuments() {
  csv(
    [
      [
        "No.",
        "Title",
        "Type",
        "Reference",
        "Revision",
        "Owner",
        "Issued",
        "Review by",
        "Review overdue",
        "Format",
        "Copies",
        "Kept at",
        "Exactly where",
        "Status",
        "Pinned",
        "Notes",
        "Zone",
      ],
      ...P.documents
        .filter((d) => scopePass(d, true))
        .map((d) => [
          docNo(d),
          d.title,
          d.type,
          d.ref,
          d.rev,
          d.owner,
          d.issued,
          d.review,
          docOverdue(d) ? "Yes" : "No",
          d.format,
          d.qty,
          holderName(d),
          d.where,
          d.status,
          d.x != null ? "Yes" : "No",
          d.note,
          pinAreaName(d),
        ]),
    ],
    "LeanStudio_documents.csv",
  );
}
function docKeyRows(rows, grouped, extra = "") {
  return rows
    .map(
      (d) =>
        `<tr><td><b class="nw">${docNo(d)}</b></td><td>${esc(d.title)}${d.ref ? ` <span class="pdm">${esc(d.ref)}</span>` : ""}</td><td>${esc(d.type)}</td><td>${esc(d.rev) || "-"}</td><td>${esc(d.owner)}</td><td>${d.review ? esc(fmtD(d.review)) : "-"}</td><td>${esc(d.format)}${d.qty > 1 ? " x" + d.qty : ""}</td><td>${esc(grouped ? d.where : docWhere(d))}</td>${extra}</tr>`,
    )
    .join("");
}
const DOC_COLS =
  '<colgroup><col style="width:6%"><col style="width:25%"><col style="width:12%"><col style="width:4%"><col style="width:7%"><col style="width:9%"><col style="width:11%"><col style="width:20%"><col style="width:6%"></colgroup>';
const DOC_HEAD = (last = "Kept at") =>
  `<th>No.</th><th>Document</th><th>Type</th><th>Rev</th><th>Owner</th><th>Review by</th><th>Format</th><th>${last}</th>`;
function printDocumentList() {
  const rows = P.documents
    .filter((d) => d.status !== "Withdrawn" && scopePass(d, true))
    .sort(
      (a, b) =>
        (holderName(a) || "\uffff").localeCompare(holderName(b) || "\uffff") ||
        a.no - b.no,
    );
  if (!rows.length) {
    toast("No documents to print yet.");
    return;
  }
  // grouped by where they are kept, with a tick box for walking the area
  const groups = new Map();
  for (const d of rows) {
    const k = holderName(d) || "Other locations";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }
  printWithPage(
    `<div class="pd"><h1>Documents: ${esc(scopeArea()?.name || "the whole factory")}</h1>
    <p class="pdm">${esc(P.projectName || "Lean Studio project")}, printed ${esc(fmtD(today()))}. ${rows.length} document${rows.length > 1 ? "s" : ""} in use. Tick when the right revision is in place.</p>
    ${[...groups]
      .map(
        ([k, ds]) =>
          `<div class="run"><h3>${esc(k)}</h3><table class="fixed">${DOC_COLS}<tr>${DOC_HEAD("Exactly where")}<th>Present</th></tr>${docKeyRows(ds, true, '<td><span class="box"></span></td>')}</table></div>`,
      )
      .join("")}</div>`,
    "",
    "",
  );
}
function printDocumentMap() {
  const sh = S(),
    dm = DM(sh),
    m = mpu(sh),
    pinned = P.documents.filter(
      (d) =>
        d.x != null && d.drawing === sh.drawing && d.status !== "Withdrawn",
    ),
    rows = P.documents
      .filter((d) => d.status !== "Withdrawn")
      .sort((a, b) => a.no - b.no);
  if (!rows.length) {
    toast("No documents to print yet.");
    return;
  }
  const save = { ...ui.layers };
  Object.assign(ui.layers, {
    objects: true,
    routes: false,
    pins: false,
    docs: true,
    overlay: false,
    marks: true,
    fixed: true,
    dims: false,
    runs: false,
    drawing: true,
    grid: false,
  });
  const xs = [],
    ys = [],
    add = (x, y) => {
      xs.push(x);
      ys.push(y);
    };
  for (const o of sh.objects) {
    add(o.x - o.w / 2, o.y - o.h / 2);
    add(o.x + o.w / 2, o.y + o.h / 2);
  }
  for (const mk of sh.marks) for (const q of mk.pts) add(q.x, q.y);
  for (const d of pinned) add(d.x, d.y);
  for (const f of dm.fixed || []) {
    if (f.t === "wall") for (const q of f.pts) add(q.x, q.y);
    else if (f.t === "block") {
      add(f.x - f.w / 2, f.y - f.h / 2);
      add(f.x + f.w / 2, f.y + f.h / 2);
    }
  }
  let vb = [0, 0, dm.w, dm.h];
  if (xs.length) {
    let x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      y0 = Math.min(...ys),
      y1 = Math.max(...ys);
    const pad = Math.max(x1 - x0, y1 - y0) * 0.03 + (m ? 0.6 / m : 8),
      asp = 1.75;
    x0 -= pad;
    x1 += pad;
    y0 -= pad;
    y1 += pad;
    let bw = x1 - x0,
      bh = y1 - y0;
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    if (bw / bh < asp) bw = bh * asp;
    else bh = bw / asp;
    vb = [cx - bw / 2, cy - bh / 2, bw, bh];
  }
  let plan;
  try {
    plan = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map((v) => Math.round(v * 100) / 100).join(" ")}">${buildSVG(sh, { k: vb[2] / 1500, cmp: null, export: true })}</svg>`;
  } finally {
    Object.assign(ui.layers, save);
  }
  const unpinned = rows.filter((d) => d.x == null);
  printWithPage(
    `<div class="pd"><h1>Document map</h1>
    <p class="pdm">${esc(sh.name)}, ${esc(fmtDate(sh.date))}. Numbers on the plan match the list below.${unpinned.length ? ` ${unpinned.length} document${unpinned.length > 1 ? "s are" : " is"} not pinned on the plan.` : ""}</p>
    <div class="pdplan">${plan}</div><div class="pdbreak"></div>
    <h2>Document key</h2><table class="fixed">${DOC_COLS}<tr>${DOC_HEAD()}<th></th></tr>${docKeyRows(rows, false, "<td></td>")}</table>
    <p class="pdm">Concept plan. Check revisions against the controlled document system before printing and issuing.</p></div>`,
    "",
    "",
  );
}
