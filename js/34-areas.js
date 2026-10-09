"use strict";
/* ============ areas: named zones on the drawing, with items designated to them ============ */
/* An area is a polygon on a drawing (P.areas). An item belongs to the area it sits in,
   or, when someone designates it, to a chosen area (o.area = the area id; "-" = no area).
   Designation follows the item (its ref) on every sheet, so daily checks can see when it
   has drifted out of its area. */
const AREA_COLS = [
  "#1F8A55",
  "#202C86",
  "#E07B00",
  "#6B3FA0",
  "#0E7C86",
  "#C3361A",
  "#8A6D00",
  "#4A4F66",
];
const areaCode = (a) => "AR-" + pad2(a.no);
const areasOn = (sh = S()) => P.areas.filter((a) => a.drawing === sh.drawing);

/* ---- geometry ---- */
function ptInPoly(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i],
      b = pts[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
function polySize(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}
const areaM2 = (a, sh) => {
  const m = mpu(sh);
  return m ? polySize(a.pts) * m * m : null;
};
const fmtM2 = (v) => (v == null ? "set scale" : n2(v) + " m²");
function areaCentre(a) {
  let x = 0,
    y = 0,
    s = 0;
  for (let i = 0; i < a.pts.length; i++) {
    const p = a.pts[i],
      q = a.pts[(i + 1) % a.pts.length],
      c = p.x * q.y - q.x * p.y;
    s += c;
    x += (p.x + q.x) * c;
    y += (p.y + q.y) * c;
  }
  if (Math.abs(s) < 1e-9)
    return {
      x: a.pts.reduce((t, p) => t + p.x, 0) / a.pts.length,
      y: a.pts.reduce((t, p) => t + p.y, 0) / a.pts.length,
    };
  const c = { x: x / (3 * s), y: y / (3 * s) };
  // a bent shape can put its centre outside itself: fall back to the vertex average
  return ptInPoly(c, a.pts)
    ? c
    : {
        x: a.pts.reduce((t, p) => t + p.x, 0) / a.pts.length,
        y: a.pts.reduce((t, p) => t + p.y, 0) / a.pts.length,
      };
}
function areaBox(a) {
  const xs = a.pts.map((p) => p.x),
    ys = a.pts.map((p) => p.y);
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
}

/* ---- which area is a thing in ---- */
function areaAt(p, sh = S()) {
  let best = null,
    bs = Infinity;
  for (const a of areasOn(sh))
    if (ptInPoly(p, a.pts)) {
      const s = polySize(a.pts);
      if (s < bs) {
        bs = s;
        best = a;
      }
    }
  return best;
}
/* "" = automatic (where it sits), "-" = deliberately no area, an id = designated */
function areaMode(o, sh = S()) {
  if (o.area === "-") return "none";
  return o.area && areasOn(sh).some((a) => a.id === o.area) ? "set" : "auto";
}
function areaOf(o, sh = S()) {
  const mode = areaMode(o, sh);
  if (mode === "none") return null;
  if (mode === "set") return P.areas.find((a) => a.id === o.area);
  return areaAt(o, sh);
}
const areaItems = (a, sh = S()) =>
  sh.objects.filter((o) => o.kind === "item" && areaOf(o, sh) === a);
/* designated to an area but sitting outside it */
function outOfArea(sh) {
  const out = [];
  for (const o of sh.objects)
    if (o.kind === "item" && areaMode(o, sh) === "set") {
      const a = P.areas.find((x) => x.id === o.area);
      if (a && !ptInPoly(o, a.pts)) out.push({ o, a });
    }
  return out;
}
/* the area a pin (tag, action, document) sits in */
function pinArea(p) {
  if (p.x == null || !p.drawing) return null;
  let best = null,
    bs = Infinity;
  for (const a of P.areas)
    if (a.drawing === p.drawing && ptInPoly(p, a.pts)) {
      const s = polySize(a.pts);
      if (s < bs) {
        bs = s;
        best = a;
      }
    }
  return best;
}
const pinAreaName = (p) => pinArea(p)?.name || "";
const areaPass = (flt, p) =>
  !flt || (flt === "none" ? !pinArea(p) : pinArea(p)?.id === flt);
const areaCell = (p) =>
  `<td>${esc(pinAreaName(p)) || '<span class="muted">-</span>'}</td>`;
const areaFilterHTML = (v) =>
  P.areas.length
    ? `<label>Area<select data-f="area">${optsKV([["", "All"], ...P.areas.map((a) => [a.id, a.name]), ["none", "No area"]], v)}</select></label>`
    : "";

function areaStats(a, sh = S()) {
  const items = areaItems(a, sh),
    inside = (p) =>
      p.x != null && p.drawing === a.drawing && ptInPoly(p, a.pts),
    mid = (m) => ({
      x: m.pts.reduce((t, q) => t + q.x, 0) / m.pts.length,
      y: m.pts.reduce((t, q) => t + q.y, 0) / m.pts.length,
    }),
    marks = sh.marks.filter((m) => ptInPoly(mid(m), a.pts)),
    refs = new Set(items.map((o) => o.ref));
  return {
    items,
    designated: items.filter((o) => areaMode(o, sh) === "set"),
    marks,
    tape: marks.reduce((t, m) => t + markLen(m), 0),
    docs: P.documents.filter((d) => d.status !== "Withdrawn" && inside(d)),
    boards: P.boards.filter((b) => refs.has(b.holder)),
    tags: P.tags.filter((t) => t.status !== "Closed" && inside(t)),
    acts: P.actions.filter(
      (x) => !["Done", "Cancelled"].includes(x.status) && inside(x),
    ),
  };
}

/* ---- designation ---- */
function setItemsArea(refs, v) {
  const set = new Set(refs);
  for (const s of P.sheets)
    for (const o of s.objects)
      if (o.kind === "item" && set.has(o.ref)) o.area = v;
}
function releaseArea(id) {
  for (const s of P.sheets)
    for (const o of s.objects) if (o.area === id) o.area = "";
}
function assignArea(v) {
  const items = selected()
    .filter((f) => !f.fx && f.t === "obj" && f.x.kind === "item")
    .map((f) => f.x);
  if (!items.length) return;
  const a = P.areas.find((x) => x.id === v);
  checkpoint();
  setItemsArea(
    items.map((o) => o.ref),
    v === "-" || a ? v : "",
  );
  record(
    "Area designated",
    `${items.length} item(s): ${a ? a.name : v === "-" ? "no area" : "automatic"}`,
  );
  renderAll();
}
function areaSelectHTML(items) {
  const sh = S(),
    list = areasOn(sh);
  if (!items.length) return "";
  if (!list.length)
    return `<p class="small muted">Draw areas with the Area tool (Q) to designate items to them.</p>`;
  const modes = items.map((o) =>
      areaMode(o, sh) === "set"
        ? o.area
        : areaMode(o, sh) === "none"
          ? "-"
          : "",
    ),
    same = new Set(modes).size === 1 ? modes[0] : null,
    cur = items.length === 1 ? areaAt(items[0], sh) : null,
    out = items.length === 1 && outOfArea(sh).find((z) => z.o === items[0]);
  return `<label class="f">Area${items.length > 1 ? " (" + items.length + " items)" : ""}<select data-item-area aria-label="Area">${same === null ? '<option value="" selected disabled>Mixed</option>' : ""}<option value=""${same === "" ? " selected" : ""}>Automatic${items.length === 1 ? (cur ? " (inside " + esc(cur.name) + ")" : " (not inside an area)") : " (where it sits)"}</option><option value="-"${same === "-" ? " selected" : ""}>No area</option>${list.map((a) => `<option value="${esc(a.id)}"${same === a.id ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>${out ? `<div class="status warn"><b>Outside its area:</b> designated to ${esc(out.a.name)} but sitting outside it.<button data-a="areaBack">Move it back into ${esc(out.a.name)}</button></div>` : ""}`;
}
/* ---- drawing ---- */
function areaSVG(sh, k) {
  let s = "";
  for (const a of areasOn(sh)) {
    const ps = a.pts.map((p) => p.x + "," + p.y).join(" "),
      n = areaItems(a, sh).length,
      top = a.pts.reduce((b, p) => (p.y < b.y ? p : b), a.pts[0]),
      fs = 12.5 * k;
    s +=
      `<g data-t="area" data-id="${esc(a.id)}"><title>${esc(areaCode(a) + " " + a.name)}</title>` +
      `<polygon points="${ps}" fill="${a.color}" fill-opacity=".08" stroke="none" pointer-events="none"/>` +
      `<polygon points="${ps}" fill="none" stroke="${a.color}" stroke-width="${2.4 * k}" stroke-dasharray="${9 * k} ${5 * k}" stroke-linejoin="round" pointer-events="none"/>` +
      `<polygon points="${ps}" fill="none" stroke="transparent" stroke-width="${10 * k * TOUCH}" stroke-linejoin="round" pointer-events="stroke"/>` +
      txt(
        top.x + 8 * k,
        top.y + 14 * k,
        `${a.name}${n ? " · " + n : ""}`,
        fs,
        k,
        { anchor: "start", fill: a.color, w: 700 },
      ) +
      "</g>";
  }
  return s;
}
function outOfAreaSVG(list, k) {
  let s = "";
  for (const { o, a } of list)
    s += `<g pointer-events="none"><title>Outside ${esc(a.name)}: ${esc(o.label)}</title><g transform="translate(${o.x} ${o.y}) rotate(${o.a})"><rect x="${-o.w / 2 - 3 * k}" y="${-o.h / 2 - 3 * k}" width="${o.w + 6 * k}" height="${o.h + 6 * k}" fill="none" stroke="${COL.warn}" stroke-width="${2.6 * k}" stroke-dasharray="${2 * k} ${3 * k}"/></g></g>`;
  return s;
}

/* ---- the Area tool ---- */
function finishArea(d) {
  const sh = S();
  if (d.pts.length < 3) {
    toast("An area needs at least three corners.");
    updateHint();
    draw();
    return;
  }
  checkpoint();
  const no = ++P.counters.area,
    a = {
      id: uid(),
      no,
      name: "Area " + no,
      color: AREA_COLS[(no - 1) % AREA_COLS.length],
      owner: "",
      note: "",
      drawing: sh.drawing,
      pts: d.pts,
      closed: true,
      created: today(),
    };
  P.areas.push(a);
  record("Area added", a.name);
  ui.sel = [a.id];
  ui.tab = "item";
  setTool("select");
  renderAll();
  toast("Area drawn. Name it in the panel on the right.");
}

/* ---- side panel ---- */
function paneArea(a) {
  const sh = S(),
    st = areaStats(a, sh),
    out = outOfArea(sh).filter((z) => z.a === a);
  const rowsFor = (title, col, list, f) =>
    rowsHTML(
      title,
      col,
      list.map((x) => ({ ...f(x), x: f(x).x ?? x.x, y: f(x).y ?? x.y })),
    );
  return `<h2>${esc(areaCode(a))}</h2>
<label class="f">Name<input data-f="name" value="${esc(a.name)}"></label>
<div class="row2"><label class="f">Owner<input data-f="owner" value="${esc(a.owner)}" placeholder="Who looks after it"></label><label class="f">Colour<input data-f="color" type="color" value="${esc(a.color)}"></label></div>
<label class="f">What this area is for<textarea data-f="note" rows="2" placeholder="e.g. Staging for the next order. Nothing stays here over a shift.">${esc(a.note)}</textarea></label>
${kv([
  ["Floor area", fmtM2(areaM2(a, sh))],
  [
    "Items",
    `${st.items.length}${st.designated.length ? ` (${st.designated.length} designated)` : ""}`,
  ],
  ["Floor tape", st.marks.length ? fmtLen(st.tape) : "None"],
  ["Documents", st.docs.length],
  ["Boards", st.boards.length],
  ["Open red tags", st.tags.length],
  ["Open actions", st.acts.length],
])}
${out.length ? `<div class="status warn"><b>${out.length} item${out.length > 1 ? "s are" : " is"} outside this area</b> but designated to it.</div>` : ""}
${rowsHTML(
  "Items in this area",
  a.color,
  st.items
    .slice()
    .sort((p, q) => p.label.localeCompare(q.label))
    .map((o) => ({
      l: o.label,
      v: areaMode(o, sh) === "set" ? "designated" : "",
      x: o.x,
      y: o.y,
      id: o.id,
    })),
)}
${rowsFor("Documents here", "#0E7C86", st.docs, (d) => ({ l: docNo(d) + " " + d.title, v: d.type }))}
${rowsFor("Open red tags here", "#D3401D", st.tags, (t) => ({ l: tagNo(t) + " " + t.title, v: t.status }))}
${rowsFor("Open actions here", "#202C86", st.acts, (x) => ({ l: actNo(x) + " " + x.title, v: x.owner }))}
<div class="btns"><button data-a="areaSelect">Select its items</button><button data-a="areaDesignate" title="Make every item sitting inside it belong to it, wherever it moves">Designate everything inside</button><button data-a="areaRelease">Release designations</button></div>
<div class="btns"><button class="pri" data-a="areaPrint">Print area sheet</button><button data-a="areaProblem">Raise a problem here</button><button data-a="dup">Duplicate</button><button data-a="del" class="danger">Delete area</button></div>
<p class="small muted">Drag the white dots to reshape it. Drag its dashed edge to move it. Items belong to the area they sit in unless you designate them; a designated item that leaves its area is flagged in the Compare tab and on the daily checks.</p>`;
}
function paneAreas() {
  const sh = S(),
    list = areasOn(sh),
    items = sh.objects.filter((o) => o.kind === "item"),
    none = items.filter((o) => !areaOf(o, sh) && areaMode(o, sh) !== "none"),
    out = outOfArea(sh);
  let h = `<h2>Areas</h2><p class="small muted" style="margin-top:0">Name the zones of the line, then say which items belong where. Daily checks flag a designated item that has left its area.</p><div class="btns"><button class="pri" data-a="areaNew">Draw a new area</button></div>`;
  if (!list.length)
    return (
      h +
      `<p class="empty">No areas on this drawing yet. Choose Draw a new area, then click the corners and click the first corner (or double-click) to close it.</p>`
    );
  h += list
    .map((a) => {
      const st = areaStats(a, sh);
      return `<button class="irow" style="--c:${esc(a.color)}" data-a="areaOpen" data-id="${esc(a.id)}"><span>${esc(areaCode(a))} ${esc(a.name)}</span><span>${st.items.length} item${st.items.length === 1 ? "" : "s"}${a.owner ? ", " + esc(a.owner) : ""}</span></button>`;
    })
    .join("");
  h += kv([
    [
      "Items in an area",
      items.length -
        none.length -
        items.filter((o) => areaMode(o, sh) === "none").length,
    ],
    ["Items in no area", none.length],
  ]);
  h += rowsHTML(
    "Outside their designated area",
    COL.warn,
    out.map((z) => ({
      l: z.o.label,
      v: z.a.name,
      x: z.o.x,
      y: z.o.y,
      id: z.o.id,
    })),
  );
  h += rowsHTML(
    "Not in any area",
    "#9AA1BC",
    none.map((o) => ({ l: o.label, v: "", x: o.x, y: o.y, id: o.id })),
  );
  h += `<div class="btns" style="margin-top:12px"><button data-a="areaPrintAll">Print all areas</button><button data-a="areaCsv">Items by area (CSV)</button></div>`;
  return h;
}

/* ---- actions from buttons ---- */
function areaAct(a, el) {
  const f = selected()[0],
    ar = f && f.t === "area" ? f.x : null;
  switch (a) {
    case "areaNew":
      setTool("area");
      break;
    case "areaOpen": {
      const x = P.areas.find((z) => z.id === el?.dataset.id);
      if (!x) return;
      ui.sel = [x.id];
      ui.tab = "item";
      const c = areaCentre(x),
        b = areaBox(x);
      ui.vb.w = Math.max((b.x1 - b.x0) * 1.5, DM().w * 0.1);
      centreOn(c.x, c.y, false);
      renderSide();
      break;
    }
    case "areaSelect":
      if (!ar) return;
      ui.sel = areaItems(ar).map((o) => o.id);
      draw();
      renderSide();
      break;
    case "areaDesignate": {
      if (!ar) return;
      const sh = S(),
        mine = sh.objects.filter(
          (o) => o.kind === "item" && ptInPoly(o, ar.pts),
        );
      if (!mine.length) {
        toast("No items sit inside this area yet.");
        return;
      }
      checkpoint();
      setItemsArea(
        mine.map((o) => o.ref),
        ar.id,
      );
      record("Area designated", `${mine.length} item(s): ${ar.name}`);
      toast(
        `${mine.length} item${mine.length > 1 ? "s" : ""} designated to ${ar.name}.`,
      );
      renderAll();
      break;
    }
    case "areaRelease": {
      if (!ar) return;
      checkpoint();
      releaseArea(ar.id);
      record("Area designations released", ar.name);
      renderAll();
      break;
    }
    case "areaBack": {
      const o = f && f.t === "obj" ? f.x : null,
        z = o && outOfArea(S()).find((q) => q.o === o);
      if (!z) return;
      checkpoint();
      const c = areaCentre(z.a);
      o.x = c.x;
      o.y = c.y;
      record("Moved into area", `${o.label}: ${z.a.name}`);
      renderAll();
      break;
    }
    case "areaPrint":
      if (ar) printAreas([ar]);
      break;
    case "areaProblem":
      if (ar) problemFromArea(ar);
      break;
    case "areaPrintAll":
      printAreas(areasOn());
      break;
    case "areaCsv":
      csvAreas();
      break;
  }
}
pane.addEventListener("change", (e) => {
  if (e.target.hasAttribute("data-item-area")) assignArea(e.target.value);
  if (e.target.id === "itemArea") {
    ui.itemArea = e.target.value;
    renderSide();
  }
});

/* ---- output ---- */
function csvAreas() {
  const sh = S();
  csv(
    [
      ["Area", "Code", "Owner", "Item", "Category", "How it belongs", "Sheet"],
      ...areasOn(sh).flatMap((a) =>
        areaItems(a, sh).map((o) => [
          a.name,
          areaCode(a),
          a.owner,
          o.label,
          P.itemCategories.find((c) => c.id === itemCategoryId(o))?.name || "",
          areaMode(o, sh) === "set" ? "Designated" : "By position",
          sh.name,
        ]),
      ),
      ...sh.objects
        .filter((o) => o.kind === "item" && !areaOf(o, sh))
        .map((o) => [
          "(none)",
          "",
          "",
          o.label,
          P.itemCategories.find((c) => c.id === itemCategoryId(o))?.name || "",
          areaMode(o, sh) === "none" ? "No area" : "Not in an area",
          sh.name,
        ]),
    ],
    `LeanStudio_items_by_area_${fileSafe(P.projectName || "project")}_${today()}.csv`,
  );
}
/* a plan of the sheet cropped to a box, with every layer that helps people find their way */
function planCrop(sh, box, asp) {
  const save = { ...ui.layers },
    hid = ui.hiddenCategories;
  Object.assign(ui.layers, {
    objects: true,
    routes: false,
    pins: true,
    docs: true,
    overlay: false,
    marks: true,
    fixed: true,
    dims: false,
    runs: false,
    drawing: true,
    grid: false,
    areas: true,
  });
  ui.hiddenCategories = new Set();
  try {
    let bw = box.x1 - box.x0,
      bh = box.y1 - box.y0;
    const cx = (box.x0 + box.x1) / 2,
      cy = (box.y0 + box.y1) / 2;
    if (bw / bh < asp) bw = bh * asp;
    else bh = bw / asp;
    const vb = [cx - bw / 2, cy - bh / 2, bw, bh];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map((v) => Math.round(v * 100) / 100).join(" ")}">${buildSVG(sh, { k: vb[2] / 1500, cmp: null, export: true })}</svg>`;
  } finally {
    Object.assign(ui.layers, save);
    ui.hiddenCategories = hid;
  }
}
function areaSheetHTML(a, sh) {
  const st = areaStats(a, sh),
    m = mpu(sh),
    b = areaBox(a),
    pad = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.12 + (m ? 0.6 / m : 8),
    plan = planCrop(
      sh,
      { x0: b.x0 - pad, x1: b.x1 + pad, y0: b.y0 - pad, y1: b.y1 + pad },
      2.6,
    ),
    size = (o) =>
      m
        ? `${n2(o.w * m)} × ${n2(o.h * m)} m`
        : `${Math.round(o.w)} × ${Math.round(o.h)} u`,
    cat = (o) =>
      P.itemCategories.find((c) => c.id === itemCategoryId(o))?.name || "",
    items = st.items.slice().sort((p, q) => p.label.localeCompare(q.label));
  const tbl = (head, rows, empty) =>
    rows.length
      ? `<table><tr>${head.map((x) => `<th>${x}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`
      : `<p class="pdm">${empty}</p>`;
  return `<div class="areapage"><h1><span class="sw" style="background:${esc(a.color)}"></span>${esc(areaCode(a))} ${esc(a.name)}</h1>
<p class="pdm">${esc(P.projectName || "Lean Studio project")}, ${esc(sh.name)}, printed ${esc(fmtD(today()))}. Owner: <b>${esc(a.owner || "not set")}</b>. Floor area ${esc(fmtM2(areaM2(a, sh)))}.${a.note ? " " + esc(a.note) : ""}</p>
<div class="pdplan">${plan}</div>
<h2>Items that belong here (${items.length})</h2>
${tbl(
  ["Item", "Category", "Size", "Home marking", "How it belongs", "In place"],
  items.map((o) => [
    esc(o.label),
    esc(cat(o)),
    esc(size(o)),
    o.fp ? (o.fpStyle === "outline" ? "Outline" : "Corners") : "None",
    areaMode(o, sh) === "set" ? "Designated" : "By position",
    '<span class="box"></span>',
  ]),
  "No items yet.",
)}
${
  st.marks.length
    ? `<h2>Floor tape (${fmtLen(st.tape)})</h2>${tbl(
        ["Tape", "Kind", "Length", "Status"],
        st.marks.map((mk) => [
          esc(tapeOf(mk.type).n),
          esc(mk.kind),
          esc(fmtLen(markLen(mk))),
          esc(mk.status),
        ]),
        "",
      )}`
    : ""
}
${st.docs.length ? `<h2>Documents (${st.docs.length})</h2><table class="fixed">${DOC_COLS}<tr>${DOC_HEAD()}<th>Present</th></tr>${docKeyRows(st.docs, false, '<td><span class="box"></span></td>')}</table>` : ""}
${
  st.boards.length
    ? `<h2>Boards</h2>${tbl(
        ["Code", "Board", "Type", "Slots"],
        st.boards.map((bd) => [
          esc(boardCode(bd)),
          esc(bd.name),
          esc(bd.type),
          bd.slots.length,
        ]),
        "",
      )}`
    : ""
}
${
  st.tags.length
    ? `<h2>Open red tags</h2>${tbl(
        ["No.", "Tag", "Owner", "Due", "Status"],
        st.tags.map((t) => [
          tagNo(t),
          esc(t.title),
          esc(t.owner),
          esc(fmtD(t.due)),
          esc(t.status),
        ]),
        "",
      )}`
    : ""
}
${
  st.acts.length
    ? `<h2>Open actions</h2>${tbl(
        ["No.", "Action", "Owner", "Due", "Status"],
        st.acts.map((x) => [
          actNo(x),
          esc(x.title),
          esc(x.owner),
          esc(fmtD(x.due)),
          esc(x.status),
        ]),
        "",
      )}`
    : ""
}
</div>`;
}
function printAreas(list) {
  const sh = S();
  if (!list.length) {
    toast("Draw an area first.");
    return;
  }
  let html = "";
  if (list.length > 1) {
    const dm = DM(sh),
      plan = planCrop(sh, { x0: 0, y0: 0, x1: dm.w, y1: dm.h }, 2.2);
    html += `<div class="pd"><h1>Areas</h1><p class="pdm">${esc(P.projectName || "Lean Studio project")}, ${esc(sh.name)}, printed ${esc(fmtD(today()))}.</p><div class="pdplan">${plan}</div><table><tr><th>Area</th><th>Owner</th><th class="n">Items</th><th class="n">Floor area</th><th>Floor tape</th><th class="n">Documents</th></tr>${list
      .map((a) => {
        const st = areaStats(a, sh);
        return `<tr><td><span class="sw" style="background:${esc(a.color)}"></span>${esc(areaCode(a))} ${esc(a.name)}</td><td>${esc(a.owner)}</td><td class="n">${st.items.length}</td><td class="n">${esc(fmtM2(areaM2(a, sh)))}</td><td>${st.marks.length ? esc(fmtLen(st.tape)) : "-"}</td><td class="n">${st.docs.length}</td></tr>`;
      })
      .join(
        "",
      )}</table></div><div class="pd"><div class="pdbreak"></div></div>`;
  }
  html += list
    .map((a) => `<div class="pd">${areaSheetHTML(a, sh)}</div>`)
    .join('<div class="pd"><div class="pdbreak"></div></div>');
  printWithPage(html, "", "size: A3 landscape; margin: 10mm");
}
