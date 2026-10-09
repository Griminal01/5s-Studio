"use strict";
/* ============ document map: documents on their own map, so the layout stays about items and tape ============ */
// The layout no longer shows document pins by default (Layers can still turn them on). Documents
// are pinned, moved and opened here, over a faded copy of the standard layout, with a line from
// each pin to the item it is kept at.

const dm = { vb: null, focus: "", place: "", drag: null };
const dmSheet = () => STD();
const dmLive = () => P.documents.filter((d) => d.status !== "Withdrawn");

function docMapHTML() {
  const live = dmLive(),
    sh = dmSheet(),
    groups = new Map();
  for (const d of live.slice().sort((a, b) => a.no - b.no)) {
    const k = holderName(d) || "Not at a listed holder";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(d);
  }
  const placing = dm.place && P.documents.find((d) => d.id === dm.place);
  const elsewhere = live.filter(
    (d) => d.x != null && d.drawing !== sh.drawing,
  ).length;
  return `<div class="dmap">
    <div class="dmcv${placing ? " placing" : ""}">
      <svg id="dmSvg" xmlns="http://www.w3.org/2000/svg" aria-label="Document map"></svg>
      ${placing ? `<div class="hint"><span>Click the map where <b>${esc(docNo(placing))} ${esc(placing.title)}</b> is kept.</span><button id="dmCancel">Cancel</button></div>` : ""}
      <div class="zoom"><button data-dz="out" aria-label="Zoom out">−</button><button data-dz="in" aria-label="Zoom in">+</button><button data-dz="fit">Fit</button></div>
    </div>
    <aside class="dmlist">
      <p class="small muted" style="margin:0 0 8px">Click a document to find it. Drag a pin to move it, click a pin to open it. The layout is shown faded; the line runs to the item the document is kept at.${elsewhere ? ` ${elsewhere} document${elsewhere > 1 ? "s are" : " is"} pinned on another drawing.` : ""}</p>
      ${
        groups.size
          ? [...groups]
              .map(
                ([k, ds]) =>
                  `<h3><span>${esc(k)}</span><span class="count">${ds.length}</span></h3>${ds
                    .map(
                      (d) =>
                        `<div class="dmrow${dm.focus === d.id ? " on" : ""}${docOverdue(d) ? " late" : ""}"><button class="dmgo" data-dmgo="${esc(d.id)}"><b>${esc(docNo(d))}</b> ${esc(d.title)}<small>${esc(d.type)}${d.where ? " · " + esc(d.where) : ""}${docOverdue(d) ? " · review overdue" : ""}</small></button>${d.x == null || d.drawing !== sh.drawing ? `<button class="pri" data-dmpin="${esc(d.id)}">Pin</button>` : ""}</div>`,
                    )
                    .join("")}`,
              )
              .join("")
          : '<p class="empty">No documents in use.</p>'
      }
    </aside>
  </div>`;
}

/* ---------- drawing ---------- */
function dmFit() {
  const el = $("#dmSvg");
  if (!el) return;
  const r = el.getBoundingClientRect(),
    d = DM(dmSheet());
  if (!r.width || !r.height) return;
  const sc = Math.min(r.width / (d.w * 1.04), r.height / (d.h * 1.06));
  dm.vb = { w: r.width / sc, x: 0, y: 0 };
  dm.vb.x = d.w / 2 - dm.vb.w / 2;
  dm.vb.y = d.h / 2 - (dm.vb.w * r.height) / r.width / 2;
}
/* the layout drawn quietly: every layer that helps people find their way, no pins; also used by Setup */
function quietLayoutSVG(sh, k, withAreas = true) {
  const save = { ...ui.layers },
    hid = ui.hiddenCategories;
  Object.assign(ui.layers, {
    drawing: true,
    fixed: true,
    marks: true,
    objects: true,
    routes: false,
    pins: false,
    docs: false,
    overlay: false,
    dims: false,
    runs: false,
    grid: false,
    areas: withAreas,
  });
  ui.hiddenCategories = new Set();
  try {
    return buildSVG(sh, { k, cmp: null, export: true });
  } finally {
    Object.assign(ui.layers, save);
    ui.hiddenCategories = hid;
  }
}
function drawDocMap() {
  const el = $("#dmSvg");
  if (!el) return;
  if (!dm.vb) dmFit();
  if (!dm.vb) return;
  const r = el.getBoundingClientRect(),
    h = (dm.vb.w * r.height) / Math.max(1, r.width),
    k = dm.vb.w / Math.max(1, r.width),
    sh = dmSheet();
  el.setAttribute("viewBox", `${dm.vb.x} ${dm.vb.y} ${dm.vb.w} ${h}`);
  const base = quietLayoutSVG(sh, k);
  let s = `<g opacity=".42" pointer-events="none">${base}</g>`;
  const pins = dmLive().filter((d) => d.x != null && d.drawing === sh.drawing);
  for (const d of pins) {
    const holder = d.holder && sh.objects.find((o) => o.ref === d.holder);
    if (holder && Math.hypot(holder.x - d.x, holder.y - d.y) > 4 * k)
      s += `<line x1="${holder.x}" y1="${holder.y}" x2="${d.x}" y2="${d.y}" stroke="#0E7C86" stroke-width="${1.4 * k}" stroke-dasharray="${4 * k} ${3 * k}" pointer-events="none"/><circle cx="${holder.x}" cy="${holder.y}" r="${2.6 * k}" fill="#0E7C86" pointer-events="none"/>`;
  }
  for (const d of pins) {
    if (d.id === dm.focus)
      s += `<circle cx="${d.x}" cy="${d.y}" r="${16 * k}" fill="#FEC20F" fill-opacity=".35" stroke="#FEC20F" stroke-width="${2.5 * k}" pointer-events="none"/>`;
    s += pinSVG({ k: "doc", o: d }, k * 1.25);
  }
  el.innerHTML = s;
}
const dmWorld = (e) => {
  const el = $("#dmSvg"),
    r = el.getBoundingClientRect(),
    h = (dm.vb.w * r.height) / Math.max(1, r.width);
  return {
    x: dm.vb.x + ((e.clientX - r.left) * dm.vb.w) / r.width,
    y: dm.vb.y + ((e.clientY - r.top) * h) / r.height,
  };
};
function dmZoom(f, cx, cy) {
  const d = DM(dmSheet()),
    el = $("#dmSvg"),
    r = el.getBoundingClientRect(),
    h = (dm.vb.w * r.height) / Math.max(1, r.width),
    nw = clamp(dm.vb.w / f, d.w * 0.05, d.w * 3),
    q = nw / dm.vb.w;
  if (cx == null) {
    cx = dm.vb.x + dm.vb.w / 2;
    cy = dm.vb.y + h / 2;
  }
  dm.vb.x = cx - (cx - dm.vb.x) * q;
  dm.vb.y = cy - (cy - dm.vb.y) * q;
  dm.vb.w = nw;
  drawDocMap();
}
function renderDocMap() {
  // called after the view's HTML is in place
  requestAnimationFrame(drawDocMap);
}

/* ---------- finding, pinning, moving ---------- */
function showOnDocMap(d) {
  if (!d) return;
  dm.focus = d.id;
  if (ui.view !== "docmap") setView("docmap");
  else renderDocuments();
  requestAnimationFrame(() => {
    if (d.x == null || !dm.vb) return;
    const el = $("#dmSvg"),
      r = el.getBoundingClientRect(),
      h = (dm.vb.w * r.height) / Math.max(1, r.width);
    dm.vb.x = d.x - dm.vb.w / 2;
    dm.vb.y = d.y - h / 2;
    drawDocMap();
  });
}
function startDocPin(id) {
  dm.place = id;
  dm.focus = id;
  if (ui.view !== "docmap") setView("docmap");
  else renderDocuments();
}
function placeDoc(p) {
  const d = P.documents.find((x) => x.id === dm.place);
  dm.place = "";
  if (!d) return renderDocuments();
  checkpoint();
  const sh = dmSheet();
  Object.assign(d, {
    x: n2(p.x),
    y: n2(p.y),
    drawing: sh.drawing,
    sheet: d.sheet || sh.id,
  });
  record("Pinned", docNo(d));
  renderAll();
}
$("#docView").addEventListener("pointerdown", (e) => {
  const el = $("#dmSvg");
  if (!el || !el.contains(e.target) || e.button === 2) return;
  const p = dmWorld(e);
  if (dm.place) return placeDoc(p);
  el.setPointerCapture(e.pointerId);
  const pin = e.target.closest('[data-t="pin"]'),
    d = pin && P.documents.find((x) => x.id === pin.dataset.id);
  dm.drag = d
    ? {
        mode: "pin",
        d,
        p0: p,
        o0: { x: d.x, y: d.y },
        snap: historySnapshot(),
        moved: false,
        sx: e.clientX,
        sy: e.clientY,
      }
    : {
        mode: "pan",
        vb0: { ...dm.vb },
        sx: e.clientX,
        sy: e.clientY,
        moved: false,
      };
});
$("#docView").addEventListener("pointermove", (e) => {
  const g = dm.drag;
  if (!g) return;
  if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 3) return;
  if (!g.moved && g.mode === "pin") {
    undoS.push(g.snap);
    trimHistory(undoS);
    redoS = [];
  }
  g.moved = true;
  if (g.mode === "pan") {
    const r = $("#dmSvg").getBoundingClientRect(),
      k = g.vb0.w / r.width;
    dm.vb.x = g.vb0.x - (e.clientX - g.sx) * k;
    dm.vb.y = g.vb0.y - (e.clientY - g.sy) * k;
  } else {
    const p = dmWorld(e);
    g.d.x = n2(g.o0.x + p.x - g.p0.x);
    g.d.y = n2(g.o0.y + p.y - g.p0.y);
  }
  drawDocMap();
});
function dmEnd() {
  const g = dm.drag;
  dm.drag = null;
  if (!g || g.mode !== "pin") return;
  if (g.moved) {
    record("Moved pin", docNo(g.d));
    save();
  } else editDocument(g.d.id);
}
$("#docView").addEventListener("pointerup", dmEnd);
$("#docView").addEventListener("pointercancel", dmEnd);
$("#docView").addEventListener(
  "wheel",
  (e) => {
    if (!$("#dmSvg")?.contains(e.target)) return;
    e.preventDefault();
    const p = dmWorld(e);
    dmZoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  },
  { passive: false },
);
$("#docView").addEventListener("click", (e) => {
  let b;
  if ((b = e.target.closest("[data-dz]"))) {
    const z = b.dataset.dz;
    if (z === "fit") {
      dmFit();
      drawDocMap();
    } else dmZoom(z === "in" ? 1.3 : 1 / 1.3);
  } else if ((b = e.target.closest("[data-dmgo]"))) {
    const d = P.documents.find((x) => x.id === b.dataset.dmgo);
    if (d && d.x == null) return startDocPin(d.id);
    showOnDocMap(d);
  } else if ((b = e.target.closest("[data-dmpin]")))
    startDocPin(b.dataset.dmpin);
  else if (e.target.closest("#dmCancel")) {
    dm.place = "";
    renderDocuments();
  }
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    dm.place &&
    ui.view === "docmap" &&
    !$("#dlg").open
  ) {
    dm.place = "";
    renderDocuments();
  }
});
window.addEventListener("resize", () => {
  if (ui.view === "docmap") drawDocMap();
});
