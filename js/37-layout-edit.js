"use strict";
/* ============ layout editing: selection toolbar, align, guides, box select, copy and paste ============ */
// Called from the canvas (07) at runtime. Everything here works on the current selection
// (ui.sel) and the same find()/selected() shapes the rest of the editor uses.

/* ---------- boxes ---------- */
const boxOf = (pts) => {
  const xs = pts.map((p) => p.x),
    ys = pts.map((p) => p.y);
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
};
const bboxOf = (f) => boxOf(f.t === "obj" ? corners(f.x) : f.x.pts);
const unionBox = (bs) => ({
  x0: Math.min(...bs.map((b) => b.x0)),
  x1: Math.max(...bs.map((b) => b.x1)),
  y0: Math.min(...bs.map((b) => b.y0)),
  y1: Math.max(...bs.map((b) => b.y1)),
});
const visibleItem = (o) =>
  (o.kind !== "item" || !ui.hiddenCategories.has(itemCategoryId(o))) &&
  scopeObj(o);

/* ---------- the floating toolbar under the selection ---------- */
const ALIGN = [
  ["left", "Left edges"],
  ["hcenter", "Centres, across"],
  ["right", "Right edges"],
  ["top", "Top edges"],
  ["vcenter", "Middles, down"],
  ["bottom", "Bottom edges"],
  ["disth", "Space evenly across"],
  ["distv", "Space evenly down"],
];
function selbarHTML(sel) {
  const objs = sel.filter((f) => f.t === "obj"),
    one = sel.length === 1 ? sel[0] : null,
    b = (a, label, title, cls = "") =>
      `<button type="button" data-sb="${a}" title="${title}" class="${cls}">${label}</button>`;
  let h = `<span class="sbn">${sel.length > 1 ? sel.length + " selected" : esc(one.x.label || one.x.name || tapeOf(one.x.type)?.n || "")}</span>`;
  if (objs.length) h += b("rot90", "Rotate", "Rotate 90° (R)");
  h += b("dup", "Duplicate", "Duplicate (Ctrl+D)");
  const lockable = sel.filter((f) => f.t === "obj" || f.t === "area");
  if (lockable.length)
    h += b(
      "lock",
      lockable.every((f) => f.x.locked) ? "Unlock" : "Lock",
      "Lock so it cannot be moved, reshaped or deleted by accident",
    );
  if (objs.length >= 2)
    h += `<details class="menu sbmenu"><summary title="Line them up or space them evenly">Align</summary><div class="pop">${ALIGN.map(([k, l]) => `<button type="button" data-sb="al-${k}"${k.startsWith("dist") && objs.length < 3 ? " disabled" : ""}>${l}</button>`).join("")}</div></details>`;
  if (one && one.t === "obj" && one.x.kind === "item" && !one.fx)
    h += b("tagItem", "Red tag", "Red tag this item");
  h += b("zoomSel", "Zoom", "Zoom to the selection (F)");
  h += b("del", "Delete", "Delete (Del)", "danger");
  return h;
}
function dragReadout() {
  const d = ui.drag,
    f = d.id ? find(d.id) : selected()[0];
  if (!f) return "";
  if (d.mode === "rs")
    return `${fmtLen(f.x.w)} × ${fmtLen(f.x.h)}`.replace(/ m × /, " × ");
  if (d.mode === "rot") return Math.round(f.x.a) + "°";
  if (d.mode === "v")
    return f.t === "area" ? "Reshaping" : fmtLen(polyLen(f.x.pts));
  const o0 = d.orig[f.x.id];
  if (!o0) return "";
  const dx = f.t === "obj" ? f.x.x - o0.x : f.x.pts[0].x - o0.pts[0].x,
    dy = f.t === "obj" ? f.x.y - o0.y : f.x.pts[0].y - o0.pts[0].y;
  const part = (v, pos, neg) =>
    Math.abs(v) < 1e-6 ? "" : `${fmtLen(Math.abs(v))} ${v > 0 ? pos : neg}`;
  return (
    [part(dx, "right", "left"), part(dy, "down", "up")]
      .filter(Boolean)
      .join(", ") || "Not moved"
  );
}
function positionSelbar() {
  const el = $("#selbar");
  if (!el) return;
  const sel = ui.view === "layout" && !ui.printing ? selected() : [],
    d = ui.drag;
  if (
    !sel.length ||
    ui.tool !== "select" ||
    d?.mode === "pan" ||
    d?.mode === "marquee"
  ) {
    el.hidden = true;
    el.dataset.sig = "";
    return;
  }
  const dragging = d && d.moved && ["move", "rs", "rot", "v"].includes(d.mode);
  if (dragging) {
    if (el.dataset.sig !== "drag") {
      el.innerHTML = '<span class="sbread"></span>';
      el.dataset.sig = "drag";
    }
    el.querySelector(".sbread").textContent = dragReadout();
  } else {
    const sig =
      ui.sel.join(",") +
      "|" +
      sel.map((f) => (f.x.locked ? 1 : 0)).join("") +
      "|" +
      (sel[0].x.label || sel[0].x.name || "");
    if (el.dataset.sig !== sig) {
      el.innerHTML = selbarHTML(sel);
      el.dataset.sig = sig;
    }
  }
  el.hidden = false;
  const b = unionBox(sel.map(bboxOf)),
    r = svg.getBoundingClientRect(),
    cr = $("#canvas").getBoundingClientRect(),
    h = vbH(),
    sx = (wx) => ((wx - ui.vb.x) / ui.vb.w) * r.width + (r.left - cr.left),
    sy = (wy) => ((wy - ui.vb.y) / h) * r.height + (r.top - cr.top),
    w = el.offsetWidth,
    eh = el.offsetHeight;
  const bottom = sy(b.y1),
    top = sy(b.y0);
  if (bottom < 0 || top > cr.height || sx(b.x1) < 0 || sx(b.x0) > cr.width) {
    el.hidden = true;
    return;
  }
  let y = bottom + 16;
  if (y + eh > cr.height - 56) y = Math.max(8, top - eh - 40);
  const x = clamp(
    (sx(b.x0) + sx(b.x1)) / 2 - w / 2,
    8,
    Math.max(8, cr.width - w - 8),
  );
  el.style.left = Math.round(x) + "px";
  el.style.top = Math.round(y) + "px";
}
$("#selbar").addEventListener("click", (e) => {
  const b = e.target.closest("[data-sb]");
  if (!b || b.disabled) return;
  const a = b.dataset.sb;
  b.closest("details")?.removeAttribute("open");
  if (a.startsWith("al-")) alignSel(a.slice(3));
  else if (a === "zoomSel") zoomToSel();
  else act(a);
});

/* ---------- align and space evenly ---------- */
function alignSel(mode) {
  const objs = selected().filter((f) => f.t === "obj" && !f.x.locked);
  if (objs.length < 2) return toast("Select two or more unlocked items.");
  checkpoint();
  const bs = objs.map((f) => ({ f, b: bboxOf(f) })),
    U = unionBox(bs.map((x) => x.b));
  if (mode === "disth" || mode === "distv") {
    const h = mode === "disth",
      k0 = h ? "x0" : "y0",
      k1 = h ? "x1" : "y1";
    bs.sort((a, b) => a.b[k0] + a.b[k1] - (b.b[k0] + b.b[k1]));
    const span = bs.at(-1).b[k1] - bs[0].b[k0],
      sum = bs.reduce((n, x) => n + x.b[k1] - x.b[k0], 0),
      gap = (span - sum) / (bs.length - 1);
    let pos = bs[0].b[k0];
    for (const x of bs) {
      x.f.x[h ? "x" : "y"] += pos - x.b[k0];
      pos += x.b[k1] - x.b[k0] + gap;
    }
  } else
    for (const { f, b } of bs) {
      const d = {
        left: U.x0 - b.x0,
        right: U.x1 - b.x1,
        hcenter: (U.x0 + U.x1) / 2 - (b.x0 + b.x1) / 2,
        top: U.y0 - b.y0,
        bottom: U.y1 - b.y1,
        vcenter: (U.y0 + U.y1) / 2 - (b.y0 + b.y1) / 2,
      }[mode];
      if (mode === "left" || mode === "right" || mode === "hcenter") f.x.x += d;
      else f.x.y += d;
    }
  record(
    "Aligned",
    `${objs.length} items, ${ALIGN.find((x) => x[0] === mode)[1].toLowerCase()}`,
  );
  renderAll();
}

/* ---------- smart guides while moving ---------- */
// Edges and centres of other items and fixed objects, and the faces of straight walls.
function guideLines(ids) {
  const sh = S(),
    xs = [],
    ys = [];
  const add = (b) => {
    xs.push(b.x0, (b.x0 + b.x1) / 2, b.x1);
    ys.push(b.y0, (b.y0 + b.y1) / 2, b.y1);
  };
  if (ui.layers.objects)
    for (const o of sh.objects)
      if (!ids.has(o.id) && visibleItem(o)) add(boxOf(corners(o)));
  if (ui.layers.fixed)
    for (const f of DM(sh).fixed || []) {
      if (ids.has(f.id)) continue;
      if (f.t === "wall") {
        const pts = f.closed ? [...f.pts, f.pts[0]] : f.pts,
          t = (f.th || 0) / 2;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1],
            b = pts[i];
          if (Math.abs(a.y - b.y) < 1e-6) ys.push(a.y - t, a.y + t);
          else if (Math.abs(a.x - b.x) < 1e-6) xs.push(a.x - t, a.x + t);
        }
      } else if (f.t !== "text" && f.w && f.h) add(boxOf(corners(f)));
    }
  return { xs, ys };
}
function moveGuides(d, dx, dy, e) {
  ui.guides = [];
  const sel = selected().filter((f) => f.t === "obj" && d.orig[f.x.id]);
  if (!ui.layers.snap || e.altKey || !sel.length)
    return { dx, dy, gx: false, gy: false };
  if (!d.lines) d.lines = guideLines(new Set(ui.sel));
  const ob = unionBox(
      sel.map((f) =>
        boxOf(corners({ ...f.x, x: d.orig[f.x.id].x, y: d.orig[f.x.id].y })),
      ),
    ),
    m = { x0: ob.x0 + dx, x1: ob.x1 + dx, y0: ob.y0 + dy, y1: ob.y1 + dy },
    tol = 7 * kNow();
  const best = (lines, mine) => {
    let r = null;
    for (const t of lines)
      for (const s of mine) {
        const dd = t - s;
        if (Math.abs(dd) < tol && (!r || Math.abs(dd) < Math.abs(r.d)))
          r = { d: dd, at: t };
      }
    return r;
  };
  const bx = best(d.lines.xs, [m.x0, (m.x0 + m.x1) / 2, m.x1]),
    by = best(d.lines.ys, [m.y0, (m.y0 + m.y1) / 2, m.y1]);
  if (bx) ui.guides.push({ x: bx.at });
  if (by) ui.guides.push({ y: by.at });
  return {
    dx: dx + (bx ? bx.d : 0),
    dy: dy + (by ? by.d : 0),
    gx: !!bx,
    gy: !!by,
  };
}
function guidesSVG(k) {
  if (!ui.guides?.length || !ui.vb) return "";
  const x0 = ui.vb.x - ui.vb.w,
    x1 = ui.vb.x + ui.vb.w * 2,
    y0 = ui.vb.y - vbH(),
    y1 = ui.vb.y + vbH() * 2;
  return ui.guides
    .map((g) =>
      g.x != null
        ? `<line x1="${g.x}" y1="${y0}" x2="${g.x}" y2="${y1}" stroke="#D6198A" stroke-width="${1.2 * k}" stroke-dasharray="${5 * k} ${3 * k}" pointer-events="none"/>`
        : `<line x1="${x0}" y1="${g.y}" x2="${x1}" y2="${g.y}" stroke="#D6198A" stroke-width="${1.2 * k}" stroke-dasharray="${5 * k} ${3 * k}" pointer-events="none"/>`,
    )
    .join("");
}

/* ---------- box select (Shift-drag on empty floor) ---------- */
function startMarquee(e, p) {
  ui.drag = {
    mode: "marquee",
    p0: p,
    sx: e.clientX,
    sy: e.clientY,
    moved: false,
  };
}
function marqueeSVG(k) {
  const m = ui.marquee;
  if (!m) return "";
  return `<rect x="${m.x0}" y="${m.y0}" width="${m.x1 - m.x0}" height="${m.y1 - m.y0}" fill="#202C86" fill-opacity=".07" stroke="#202C86" stroke-width="${1.2 * k}" stroke-dasharray="${4 * k} ${3 * k}" pointer-events="none"/>`;
}
function selectInBox(m) {
  const sh = S(),
    inside = (b) =>
      b.x0 >= m.x0 && b.x1 <= m.x1 && b.y0 >= m.y0 && b.y1 <= m.y1,
    list = ui.editDrawing
      ? DM(sh).fixed || []
      : [
          ...(ui.layers.objects ? sh.objects.filter(visibleItem) : []),
          ...(ui.layers.marks ? sh.marks.filter((m) => scopeMark(m)) : []),
          ...(ui.layers.routes ? sh.routes.filter((r) => scopeMark(r)) : []),
        ],
    ids = list
      .map((x) => find(x.id))
      .filter((f) => f && inside(bboxOf(f)))
      .map((f) => f.x.id);
  ui.sel = [...new Set([...ui.sel, ...ids])];
  ui.tab = "item";
  if (!ids.length) toast("Nothing fully inside the box.");
}
function selectAll() {
  const sh = S();
  ui.sel = ui.editDrawing
    ? (DM(sh).fixed || []).map((f) => f.id)
    : sh.objects
        .filter((o) => o.kind === "item" && visibleItem(o))
        .map((o) => o.id);
  ui.tab = "item";
  draw();
  renderSide();
  toast(`${ui.sel.length} selected.`);
}
function zoomToSel() {
  const sel = selected();
  if (!sel.length) return;
  const b = unionBox(sel.map(bboxOf)),
    r = svg.getBoundingClientRect(),
    w = Math.max(
      b.x1 - b.x0,
      ((b.y1 - b.y0) * r.width) / Math.max(1, r.height),
    );
  // never closer than about 8 m across, so the item is seen in its surroundings
  const minW = mpu() ? 8 / mpu() : DM().w * 0.12;
  ui.vb.w = clamp(w * 1.8, Math.min(minW, DM().w * 4), DM().w * 4);
  centreOn((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, false);
}

/* ---------- copy and paste, also between sheets ---------- */
function copySel() {
  const sel = selected();
  if (!sel.length) return false;
  ui.clip = sel.map((f) => ({ t: f.t, fx: !!f.fx, x: clone(f.x) }));
  toast(`Copied ${sel.length}. Paste with Ctrl+V here or on another sheet.`);
  return true;
}
function pasteClip() {
  const clip = ui.clip;
  if (!clip?.length)
    return toast("Nothing copied yet. Select something and press Ctrl+C.");
  const sh = S(),
    dm = DM(sh),
    same = clip.some((it) => find(it.x.id)),
    off = same ? (mpu() ? 0.5 / mpu() : 4) : 0,
    snap = historySnapshot(),
    ids = [];
  for (const it of clip) {
    if (it.fx !== !!ui.editDrawing) continue; // the drawing and the sheet stay separate
    const n = clone(it.x);
    n.id = uid();
    if ("ref" in n) n.ref = n.id;
    n.locked = false;
    if (it.t === "obj") {
      n.x += off;
      n.y += off;
      if (sh.kind === "daily" && n.kind === "item") n.fp = false;
    } else n.pts = n.pts.map((q) => ({ x: q.x + off, y: q.y + off }));
    if (it.fx) (dm.fixed = dm.fixed || []).push(n);
    else if (it.t === "obj") sh.objects.push(n);
    else if (it.t === "mark") sh.marks.push(n);
    else if (it.t === "route") sh.routes.push(n);
    else if (it.t === "area") {
      n.drawing = sh.drawing;
      n.no = ++P.counters[isLine(n) ? "line" : "area"];
      P.areas.push(n);
    }
    ids.push(n.id);
  }
  if (!ids.length)
    return toast(
      ui.editDrawing
        ? "Those are layout items. Press Done editing to paste them."
        : "Those are walls or fixed objects. Use Edit drawing to paste them.",
    );
  undoS.push(snap);
  trimHistory(undoS);
  redoS = [];
  ui.sel = ids;
  ui.tab = "item";
  record("Pasted", ids.length + " item(s)");
  widenIfOutside(ids);
  renderAll();
}

/* ---------- full names on the map for items whose label does not fit ---------- */
function labelTagsSVG(sh, k) {
  const ids = new Set(
      [...(ui.sel.length <= 6 ? ui.sel : []), ui.hover].filter(Boolean),
    ),
    fs = 11 * k;
  let s = "";
  for (const id of ids) {
    const f = find(id, sh);
    if (!f || f.t !== "obj" || !f.x.label) continue;
    const o = f.x;
    if (LABEL.shown.has(id)) continue; // its whole name is already on the drawing
    const b = boxOf(corners(o)),
      w = (o.label.length * 6.3 + 14) * k,
      h = 18 * k,
      sel1 = ui.sel.length === 1 && ui.sel[0] === id && !o.locked,
      y = b.y0 - (sel1 ? 34 * k : 6 * k) - h,
      x = (b.x0 + b.x1) / 2 - w / 2;
    s += `<g pointer-events="none"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${4 * k}" fill="#1C2250" opacity=".92"/><text x="${x + w / 2}" y="${y + h / 2}" font-size="${fs}" font-family="Segoe UI,system-ui,sans-serif" font-weight="600" fill="#fff" text-anchor="middle" dominant-baseline="central">${esc(o.label)}</text></g>`;
  }
  return s;
}

/* ---------- keyboard shortcuts ---------- */
function shortcutsModal() {
  const rows = [
    [
      "Tools",
      "V select · T tape · Q area · W route · M measure · G red tag · A action",
    ],
    [
      "Select",
      "Click · Shift-click to add · Shift-drag on empty floor for a box · Ctrl+A all items · Esc clears",
    ],
    [
      "Move",
      "Drag (snaps to other items and walls; hold Alt to place freely) · Arrow keys nudge, Shift for 10×",
    ],
    [
      "Change",
      "R rotate 90° · Ctrl+D duplicate · Ctrl+C / Ctrl+V copy and paste, also onto another sheet · Delete",
    ],
    [
      "View",
      "Scroll to zoom · drag empty floor or hold Space to pan · F fits the drawing, or zooms to the selection",
    ],
    [
      "Drawing tape, walls, areas",
      "Click points · Shift keeps it straight · Enter or double-click finishes · click the first point to close · Backspace removes the last point · Esc cancels",
    ],
    ["Everywhere", "Ctrl+Z undo · Ctrl+Y redo · Ctrl+S save a backup file"],
  ];
  modal(
    "Keyboard and mouse",
    `<table class="tbl keys"><tbody>${rows.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join("")}</tbody></table>`,
    "",
    { cancel: "Close", cls: "mid" },
  );
}
