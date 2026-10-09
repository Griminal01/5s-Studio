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
const LINE_COLS = [
  "#202C86",
  "#0E7C86",
  "#6B3FA0",
  "#C3361A",
  "#8A6D00",
  "#1F8A55",
];
/* a line is the outline of a production line (level "line"); a zone sits inside one (a.parent) */
const isLine = (a) => !!a && a.level === "line";
const areaCode = (a) => (isLine(a) ? "LN-" : "ZN-") + pad2(a.no);
const areasOn = (sh = S()) =>
  P.areas.filter((a) => !isLine(a) && a.drawing === sh.drawing);
const linesOn = (sh = S()) =>
  P.areas.filter((a) => isLine(a) && a.drawing === sh.drawing);
const zonesOfLine = (l) =>
  P.areas.filter((z) => !isLine(z) && z.parent === l.id);
/* the line a point sits in (smallest first), for suggesting a zone's line */
function lineAt(p, sh = S()) {
  let best = null,
    bs = Infinity;
  for (const a of linesOn(sh))
    if (ptInPoly(p, a.pts)) {
      const s = polySize(a.pts);
      if (s < bs) {
        bs = s;
        best = a;
      }
    }
  return best;
}

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
    if (!isLine(a) && a.drawing === p.drawing && ptInPoly(p, a.pts)) {
      const s = polySize(a.pts);
      if (s < bs) {
        bs = s;
        best = a;
      }
    }
  return best;
}
const pinAreaName = (p) => pinArea(p)?.name || "";
function areaPass(flt, p) {
  if (!flt) return true;
  if (flt === "none") return !pinArea(p);
  const a = P.areas.find((x) => x.id === flt);
  if (!a) return true;
  // a line holds everything inside its outline; a zone, the pins whose smallest zone it is
  if (isLine(a))
    return p.x != null && p.drawing === a.drawing && ptInPoly(p, a.pts);
  return pinArea(p)?.id === flt;
}
const areaCell = (p) =>
  `<td>${esc(pinAreaName(p)) || '<span class="muted">-</span>'}</td>`;

function areaStats(a, sh = S()) {
  const items = isLine(a)
      ? sh.objects.filter((o) => o.kind === "item" && scopeObj(o, a))
      : areaItems(a, sh),
    inside = (p) =>
      p.x != null && p.drawing === a.drawing && ptInPoly(p, a.pts),
    mid = (m) => ({
      x: m.pts.reduce((t, q) => t + q.x, 0) / m.pts.length,
      y: m.pts.reduce((t, q) => t + q.y, 0) / m.pts.length,
    }),
    marks = sh.marks.filter((m) => ptInPoly(mid(m), a.pts));
  return {
    items,
    designated: items.filter((o) => areaMode(o, sh) === "set"),
    marks,
    tape: marks.reduce((t, m) => t + markLen(m), 0),
    docs: P.documents.filter((d) => d.status !== "Withdrawn" && inside(d)),
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
    "Zone designated",
    `${items.length} item(s): ${a ? a.name : v === "-" ? "no zone" : "automatic"}`,
  );
  renderAll();
}
function areaSelectHTML(items) {
  const sh = S(),
    list = areasOn(sh);
  if (!items.length) return "";
  if (!list.length)
    return `<p class="small muted">Draw zones with the Zone tool (Q) to designate items to them.</p>`;
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
  return `<label class="f">Zone${items.length > 1 ? " (" + items.length + " items)" : ""}<select data-item-area aria-label="Zone">${same === null ? '<option value="" selected disabled>Mixed</option>' : ""}<option value=""${same === "" ? " selected" : ""}>Automatic${items.length === 1 ? (cur ? " (inside " + esc(cur.name) + ")" : " (not inside a zone)") : " (where it sits)"}</option><option value="-"${same === "-" ? " selected" : ""}>No zone</option>${list.map((a) => `<option value="${esc(a.id)}"${same === a.id ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>${out ? `<div class="status warn"><b>Outside its zone:</b> designated to ${esc(out.a.name)} but sitting outside it.<button data-a="areaBack">Move it back into ${esc(out.a.name)}</button></div>` : ""}`;
}
/* ---- drawing ---- */
function areaListFor(sh, only) {
  // a line scope draws the line and its zones; a zone scope draws just that zone
  const all = P.areas.filter((a) => a.drawing === sh.drawing),
    list = only
      ? all.filter(
          (a) => a.id === only.id || (isLine(only) && a.parent === only.id),
        )
      : all;
  return [...list.filter(isLine), ...list.filter((a) => !isLine(a))];
}
// the words on a line or zone: where it would like to sit, and what it says
function areaLabelText(a, sh) {
  const line = isLine(a),
    n = line ? zonesOfLine(a).length : areaItems(a, sh).length;
  return line
    ? `${a.name.toUpperCase()}${n ? " · " + n + " zone" + (n > 1 ? "s" : "") : ""}${a.locked ? " · locked" : ""}`
    : `${a.name}${n ? " · " + n : ""}${a.locked ? " · locked" : ""}`;
}
function areaSVG(sh, k, only, noText = false) {
  let s = "";
  for (const a of areaListFor(sh, only)) {
    const ps = a.pts.map((p) => p.x + "," + p.y).join(" "),
      line = isLine(a),
      top = a.pts.reduce((b, p) => (p.y < b.y ? p : b), a.pts[0]),
      xs0 = Math.min(...a.pts.map((p) => p.x)),
      xs1 = Math.max(...a.pts.map((p) => p.x)),
      fs = (line ? 14 : 12.5) * k * (ui.textBoost || 1);
    s +=
      `<g data-t="area" data-id="${esc(a.id)}"><title>${esc(areaCode(a) + " " + a.name)}</title>` +
      `<polygon points="${ps}" fill="${a.color}" fill-opacity="${line ? 0.04 : 0.08}" stroke="none" pointer-events="none"/>` +
      `<polygon points="${ps}" fill="none" stroke="${a.color}" stroke-width="${(line ? 3.6 : 2.4) * k}"${line ? "" : ` stroke-dasharray="${9 * k} ${5 * k}"`} stroke-linejoin="round" pointer-events="none"/>` +
      `<polygon points="${ps}" fill="none" stroke="transparent" stroke-width="${10 * k * TOUCH}" stroke-linejoin="round" pointer-events="stroke"/>` +
      (noText
        ? ""
        : txt(
            line ? (xs0 + xs1) / 2 : top.x + 8 * k,
            top.y + (line ? 1 : 14) * k,
            areaLabelText(a, sh),
            fs,
            k,
            { anchor: line ? "middle" : "start", fill: a.color, w: 700 },
          )) +
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

/* ---- the Zone tool ---- */
function finishArea(d) {
  const sh = S(),
    line = ui.areaLevel === "line",
    word = line ? "line" : "zone";
  if (d.pts.length < 3) {
    toast(`A ${word} needs at least three corners.`);
    updateHint();
    draw();
    return;
  }
  checkpoint();
  const key = line ? "line" : "area",
    no = ++P.counters[key],
    a = {
      id: uid(),
      no,
      level: line ? "line" : "zone",
      parent: "",
      name: (line ? "Line " : "Zone ") + no,
      color: (line ? LINE_COLS : AREA_COLS)[
        (no - 1) % (line ? LINE_COLS : AREA_COLS).length
      ],
      owner: "",
      note: "",
      drawing: sh.drawing,
      pts: d.pts,
      closed: true,
      created: today(),
    };
  if (!line) a.parent = lineAt(areaCentre(a), sh)?.id || "";
  P.areas.push(a);
  record(line ? "Line added" : "Zone added", a.name);
  ui.sel = [a.id];
  ui.tab = "item";
  setTool("select");
  renderAll();
  toast(`${line ? "Line" : "Zone"} drawn. Name it in the panel on the right.`);
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
  const line = isLine(a),
    word = line ? "line" : "zone",
    inLine = line ? zonesOfLine(a) : [];
  return `<h2>${line ? "Line" : "Zone"} ${esc(areaCode(a))}</h2>
<label class="f">Name<input data-f="name" value="${esc(a.name)}"></label>
<div class="row2"><label class="f">Owner<input data-f="owner" value="${esc(a.owner)}" placeholder="Who looks after it"></label><label class="f">Colour<input data-f="color" type="color" value="${esc(a.color)}"></label></div>
${
  line
    ? ""
    : `<label class="f">Line<select data-f="parent"><option value="">Not in a line</option>${linesOn(
        sh,
      )
        .map(
          (l) =>
            `<option value="${esc(l.id)}"${a.parent === l.id ? " selected" : ""}>${esc(l.name)}</option>`,
        )
        .join("")}</select></label>`
}
<label class="f">What this ${word} is for<textarea data-f="note" rows="2" placeholder="${line ? "e.g. The packing line, from infeed to palletiser." : "e.g. Staging for the next order. Nothing stays here over a shift."}">${esc(a.note)}</textarea></label>
${kv([
  ...(line ? [["Zones in it", inLine.length]] : []),
  ["Floor area", fmtM2(areaM2(a, sh))],
  [
    "Items",
    `${st.items.length}${st.designated.length ? ` (${st.designated.length} designated)` : ""}`,
  ],
  ["Floor tape", st.marks.length ? fmtLen(st.tape) : "None"],
  ["Documents", st.docs.length],
  ["Open red tags", st.tags.length],
  ["Open actions", st.acts.length],
])}
${out.length ? `<div class="status warn"><b>${out.length} item${out.length > 1 ? "s are" : " is"} outside this zone</b> but designated to it.</div>` : ""}
${
  line
    ? rowsHTML(
        "Zones in this line",
        a.color,
        inLine.map((z) => ({
          l: areaCode(z) + " " + z.name,
          v: "",
          x: areaCentre(z).x,
          y: areaCentre(z).y,
          id: z.id,
        })),
      )
    : ""
}
${rowsHTML(
  line ? "Items in this line" : "Items in this zone",
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
${zoneTasksHTML(a)}
${zoneIdeasHTML(a)}
${line ? "" : `<div class="btns"><button data-a="areaSelect">Select its items</button><button data-a="areaDesignate" title="Make every item sitting inside it belong to it, wherever it moves">Designate everything inside</button><button data-a="areaRelease">Release designations</button></div>`}
<div class="btns"><button class="pri" data-a="areaScope" title="Show only this ${word} on the 5S pages, so they are not cluttered">Work on this ${word}</button><button data-a="areaPrint">Print ${word} sheet</button>${line ? "" : '<button data-a="areaProblem">Raise a problem here</button>'}<button data-a="dup">Duplicate</button><button data-a="lock" title="Lock so it cannot be moved, reshaped or deleted by accident">${a.locked ? "Unlock" : "Lock"} ${word}</button><button data-a="del" class="danger"${a.locked ? " disabled" : ""}>Delete ${word}</button></div>
${a.locked ? `<p class="small muted">Locked: unlock it to move, reshape or delete it. You can still rename it and change its owner.</p>` : ""}
<p class="small muted">Drag the white dots to reshape it. Drag its edge to move it.${line ? " A zone drawn inside a line joins it automatically." : " Items belong to the zone they sit in unless you designate them; a designated item that leaves its zone is flagged in the Compare tab and on the daily checks."}</p>`;
}
function paneAreas() {
  const sh = S(),
    list = areasOn(sh),
    lines = linesOn(sh),
    items = sh.objects.filter((o) => o.kind === "item"),
    none = items.filter((o) => !areaOf(o, sh) && areaMode(o, sh) !== "none"),
    out = outOfArea(sh);
  let h = `<h2>Lines and zones</h2><p class="small muted" style="margin-top:0">Outline each production line, then the zones inside it. Say which items belong to which zone. Daily checks flag a designated item that has left its zone. Set them up on the Setup page.</p><div class="btns"><button class="pri" data-a="lineNew">Draw a line</button><button class="pri" data-a="areaNew">Draw a zone</button></div>`;
  if (!list.length && !lines.length)
    return (
      h +
      `<p class="empty">No lines or zones on this drawing yet. Choose Draw a line or Draw a zone, then click the corners and click the first corner (or double-click) to close it.</p>`
    );
  const row = (a, extra) =>
    `<button class="irow" style="--c:${esc(a.color)}" data-a="areaOpen" data-id="${esc(a.id)}"><span>${esc(areaCode(a))} ${esc(a.name)}</span><span>${extra}</span></button>`;
  for (const l of lines) {
    h += row(
      l,
      `${zonesOfLine(l).length} zone${zonesOfLine(l).length === 1 ? "" : "s"}${l.owner ? ", " + esc(l.owner) : ""}`,
    );
  }
  h += list
    .map((a) => {
      const st = areaStats(a, sh);
      return row(
        a,
        `${st.items.length} item${st.items.length === 1 ? "" : "s"}${a.owner ? ", " + esc(a.owner) : ""}`,
      );
    })
    .join("");
  h += kv([
    [
      "Items in a zone",
      items.length -
        none.length -
        items.filter((o) => areaMode(o, sh) === "none").length,
    ],
    ["Items in no zone", none.length],
  ]);
  h += rowsHTML(
    "Outside their designated zone",
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
    "Not in any zone",
    "#9AA1BC",
    none.map((o) => ({ l: o.label, v: "", x: o.x, y: o.y, id: o.id })),
  );
  h += `<div class="btns" style="margin-top:12px"><button data-a="areaPrintAll">Print all zones</button><button data-a="areaCsv">Items by zone (CSV)</button></div>`;
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
    case "lineNew":
      setTool("area", "line");
      break;
    case "areaOpen": {
      const x = P.areas.find((z) => z.id === el?.dataset.id);
      if (!x) return;
      ui.sel = [x.id];
      ui.tab = "item";
      const c = areaCentre(x),
        b = areaBox(x);
      ensureVisible(c.x, c.y);
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
        toast("No items sit inside this zone yet.");
        return;
      }
      checkpoint();
      setItemsArea(
        mine.map((o) => o.ref),
        ar.id,
      );
      record("Zone designated", `${mine.length} item(s): ${ar.name}`);
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
      record("Zone designations released", ar.name);
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
      record("Moved into zone", `${o.label}: ${z.a.name}`);
      renderAll();
      break;
    }
    case "areaPrint":
      if (ar) printAreas([ar]);
      break;
    case "areaScope":
      if (ar) {
        if (ui.view !== "layout") setView("layout");
        setScope(ar.id);
      }
      break;
    case "areaProblem":
      if (ar) problemFromArea(ar);
      break;
    case "areaIdea":
      if (ar) newIdea({ zone: ar.id });
      break;
    case "ideaOpen":
      editIdea(el?.dataset.id);
      break;
    case "taskOpen":
      editTask(el?.dataset.id);
      break;
    case "taskNew":
      if (ar && !isLine(ar)) newTask({ zone: ar.id });
      break;
    case "taskNewFor": {
      const o = f && f.t === "obj" ? f.x : null;
      if (o) newTask({ zone: areaOf(o, S())?.id || "", items: [o.ref] });
      break;
    }
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
      ["Zone", "Code", "Owner", "Item", "Category", "How it belongs", "Sheet"],
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
          areaMode(o, sh) === "none" ? "No zone" : "Not in a zone",
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
${tasksOfZone(a).length ? `<h2>Operator tasks (${tasksOfZone(a).length})</h2>${taskSheetHTML(tasksOfZone(a))}` : ""}
${st.docs.length ? `<h2>Documents (${st.docs.length})</h2><table class="fixed">${DOC_COLS}<tr>${DOC_HEAD()}<th>Present</th></tr>${docKeyRows(st.docs, false, '<td><span class="box"></span></td>')}</table>` : ""}
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
    toast("Draw a zone first.");
    return;
  }
  let html = "";
  if (list.length > 1) {
    const dm = DM(sh),
      plan = planCrop(sh, { x0: 0, y0: 0, x1: dm.w, y1: dm.h }, 2.2);
    html += `<div class="pd"><h1>Zones</h1><p class="pdm">${esc(P.projectName || "Lean Studio project")}, ${esc(sh.name)}, printed ${esc(fmtD(today()))}.</p><div class="pdplan">${plan}</div><table><tr><th>Zone</th><th>Owner</th><th class="n">Items</th><th class="n">Floor area</th><th>Floor tape</th><th class="n">Documents</th></tr>${list
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

/* ---------- scope: the whole factory, or one area at a time ---------- */
// Layout work happens one area at a time so it is not cluttered; the document map and the
// overview always show everything. The scope hides what is outside the area and fits the view to it.
const scopeArea = () =>
  ui.scope
    ? P.areas.find((a) => a.id === ui.scope && a.drawing === S().drawing) ||
      null
    : null;
const scopeMid = (m) => ({
  x: m.pts.reduce((t, q) => t + q.x, 0) / m.pts.length,
  y: m.pts.reduce((t, q) => t + q.y, 0) / m.pts.length,
});
const scopeObj = (o, a = scopeArea()) =>
  !a ||
  ptInPoly(o, a.pts) ||
  (o.kind === "item" &&
    (o.area === a.id ||
      (isLine(a) && P.areas.find((z) => z.id === o.area)?.parent === a.id)));
const scopeMark = (m, a = scopeArea()) =>
  !a || m.pts.some((p) => ptInPoly(p, a.pts)) || ptInPoly(scopeMid(m), a.pts);
/* the layout checks (blocked, walls, aisles...) kept to what touches the scope */
function scopeIssues(c, A) {
  const inO = (o) => scopeObj(o, A),
    inP = (p) => ptInPoly(p, A.pts),
    inM = (m) => scopeMark(m, A),
    f = (k, fn) => (c[k] ? { [k]: c[k].filter(fn) } : {});
  return {
    ...c,
    ...f("blocked", (z) => inO(z.o)),
    ...f("structure", (z) => inO(z.o)),
    ...f("walkBlock", (z) => inO(z.o)),
    ...f("outOfArea", (z) => inO(z.o)),
    ...f("wallHits", inP),
    ...f("aisleClash", inP),
    ...f("conflicts", inP),
    ...f("aisleNarrow", inM),
    ...f("damaged", inM),
  };
}
function scopeCmp(c, A) {
  const inO = (o) => scopeObj(o, A),
    inM = (m) => scopeMark(m, A);
  return {
    ...scopeIssues(c, A),
    ok: c.ok.filter(inO),
    // an item that has drifted out of the zone is exactly what a check is for: keep it
    moved: c.moved.filter((m) => inO(m.o) || inO(m.r)),
    extra: c.extra.filter(inO),
    missing: c.missing.filter(inO),
    tapeMissing: c.tapeMissing.filter(inM),
    tapeExtra: c.tapeExtra.filter(inM),
  };
}
/* a box round the area with a little room, in drawing units */
function scopeBox(a) {
  const b = areaBox(a),
    pad = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.28 + 6;
  return { x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad };
}
/* a selected thing that the scope hides must not stay selected: it could not be seen but could be deleted */
function selectableInScope(i) {
  const f = find(i),
    A = scopeArea();
  if (!f || !A) return true;
  if (f.t === "obj") return scopeObj(f.x, A);
  if (f.t === "mark" || f.t === "route") return scopeMark(f.x, A);
  if (f.t === "area")
    return f.x.id === A.id || (isLine(A) && f.x.parent === A.id);
  return true;
}
function setScope(id, fromHash = false) {
  const a = P.areas.find((x) => x.id === id && x.drawing === S().drawing);
  ui.scope = a ? a.id : "";
  ui.sel = ui.sel.filter(selectableInScope);
  ui.vb = null;
  dm.vb = null;
  if (!fromHash) syncHash(false);
  renderAll();
}
function scopeBarHTML() {
  const a = scopeArea(),
    back = ui.fromSetup && ui.view === "layout";
  if (!a && !back) return "";
  return (
    (a
      ? `<span class="swatch" style="background:${esc(a.color)}"></span>Working on <b>${esc(a.name)}</b><button id="scopeAll">Show the whole factory</button>`
      : "Drawing on the whole factory") +
    (back ? `<button id="scopeBack" class="pri">← Back to Setup</button>` : "")
  );
}
function updateScopeBar() {
  const el = $("#scopeBar");
  if (!el) return;
  const h = scopeBarHTML();
  el.hidden = !h;
  if (el.dataset.h !== h) {
    el.innerHTML = h;
    el.dataset.h = h;
  }
}
$("#canvas").addEventListener("click", (e) => {
  if (e.target.closest("#scopeAll")) setScope("");
  else if (e.target.closest("#scopeBack")) setView(ui.fromSetup || "setup");
});

/* ---- the scope applied to registers and lists (pins carry a position; documents may not) ---- */
const scopePass = (p, keepUnplaced = false) =>
  !ui.scope || (keepUnplaced && p.x == null) || areaPass(ui.scope, p);
/* a problem is "where" a zone: it passes when that zone is the scope or sits in the scoped line */
function scopeProblem(p) {
  const a = scopeArea();
  // a problem with no "where" shows everywhere, so a new one never vanishes from the list
  if (!a || !p.area) return true;
  if (p.area === a.id) return true;
  return isLine(a) && P.areas.find((z) => z.id === p.area)?.parent === a.id;
}

/* about to look at a point: widen the view to the whole factory if it is outside what is being shown */
function ensureVisible(x, y) {
  const A = scopeArea();
  if (A && !ptInPoly({ x, y }, A.pts)) setScope("");
  if (!ui.vb) fitView();
}

/* things just duplicated or pasted that fall outside the zone being shown: show the whole factory so they are not lost */
function widenIfOutside(ids) {
  const A = scopeArea();
  if (!A) return;
  if (ids.some((id) => !selectableInScope(id))) {
    ui.scope = "";
    ui.vb = null;
    syncHash(false);
    toast("Placed outside the zone, so the whole factory is showing.");
  }
}
