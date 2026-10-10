"use strict";
/* ============ canvas: build SVG ============
   The layout drawing. buildSVG(sh, o) returns the SVG for a sheet (screen, prints, PNG, Present and the
   document map all call it); draw() puts it on screen. Also objSVG / markSVG / routeSVG per element, the
   viewbox (fitView, viewCentre, zoomAt, kNow) and pointer handling (drag, draw tools, pinch). */
const svg = $("#svg");
const COL = {
  walk: "#202C86",
  vehicle: "#E07B00",
  warn: "#E07B00",
  bad: "#C3361A",
  extra: "#6B3FA0",
  ok: "#1F8A55",
  sel: "#202C86",
};
function txt(x, y, s, fs, k, opt = {}) {
  return `<text x="${x}" y="${y}" font-size="${fs}" font-family="Segoe UI,system-ui,sans-serif" font-weight="${opt.w || 600}" fill="${opt.fill || "#1C2250"}" text-anchor="${opt.anchor || "middle"}" dominant-baseline="central" stroke="#fff" stroke-width="${3 * k}" stroke-linejoin="round" paint-order="stroke"${opt.rot ? ` transform="rotate(${opt.rot} ${x} ${y})"` : ""} pointer-events="none">${esc(s)}</text>`;
}
function fit(s, w, fs) {
  const max = Math.floor(w / (fs * 0.56));
  if (max < 3) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function objSVG(o, k, noLabel = false) {
  const hw = o.w / 2,
    hh = o.h / 2,
    boost = ui.textBoost || 1, // presentation mode makes item names bigger as it zooms in
    fs = 11 * k * boost;
  let body;
  if (o.kind === "keepclear")
    body = `<rect x="${-hw}" y="${-hh}" width="${o.w}" height="${o.h}" fill="url(#hz)" stroke="#D3401D" stroke-width="${1.6 * k}"/>`;
  else if (o.kind === "zone")
    body = `<rect x="${-hw}" y="${-hh}" width="${o.w}" height="${o.h}" fill="${o.c}" fill-opacity=".1" stroke="${o.c}" stroke-width="${1.6 * k}" stroke-dasharray="${6 * k} ${4 * k}"/>`;
  else
    body = `<rect x="${-hw}" y="${-hh}" width="${o.w}" height="${o.h}" rx="${Math.min(2 * k, hw / 3)}" fill="${o.c}" fill-opacity=".3" stroke="${o.c}" stroke-width="${2 * k}"/>`;
  const flip = angDiff(o.a, 180) < 89.9 ? 180 : 0;
  let label = "";
  if (noLabel) {
    // the names are placed together by labelsSVG (37-labels.js)
  } else if (o.kind === "item") {
    // presenting: shrink a long name to fit the item (down to a small size) before cutting it short
    const f2 = ui.textBoost
        ? Math.max(Math.min(fs, o.w / (0.56 * o.label.length)), 8 * k, fs * 0.6)
        : fs,
      t = fit(o.label, o.w, f2);
    if (t) label = txt(0, 0, t, f2, k);
  } else {
    const t = fit(o.label, o.w - 8 * k, fs);
    if (t && o.h > fs * 1.6)
      label = txt(-hw + 4 * k, -hh + fs * 0.9, t, fs, k, {
        anchor: "start",
      });
  }
  if (label && flip) label = `<g transform="rotate(180)">${label}</g>`;
  return `<g data-t="obj" data-id="${esc(o.id)}" transform="translate(${o.x} ${o.y}) rotate(${o.a})"${o.locked ? ' opacity=".92"' : ""}><title>${esc(o.label || "Item")}</title>${body}${label}</g>`;
}

const tapeW = (T, u, k, min) => Math.max(((T.w || 50) / 1000) * u, min * k);
function footSVG(o, k, u, T) {
  const w = tapeW(T, u, k, 2.5),
    pad = Math.max(w, 2 * k),
    hw = o.w / 2 + pad,
    hh = o.h / 2 + pad,
    L = Math.min(o.w, o.h) * 0.3 + pad,
    laid = !!o.fpLaid;
  const d =
    o.fpStyle === "outline"
      ? `M${-hw} ${-hh}H${hw}V${hh}H${-hw}Z`
      : [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]
          .map(
            ([sx, sy]) =>
              `M${sx * hw} ${sy * hh - sy * L}L${sx * hw} ${sy * hh}L${sx * hw - sx * L} ${sy * hh}`,
          )
          .join("");
  return `<g transform="translate(${o.x} ${o.y}) rotate(${o.a})" pointer-events="none" opacity="${laid ? 1 : 0.65}"><path d="${d}" fill="none" stroke="${T.edge}" stroke-width="${w + 1.2 * k}"/><path d="${d}" fill="none" stroke="${T.c}" stroke-width="${w}"/>${laid ? "" : `<path d="${d}" fill="none" stroke="#1C2250" stroke-width="${0.8 * k}" stroke-dasharray="${5 * k} ${4 * k}"/>`}</g>`;
}
function arrowSVG(m, T, k, u) {
  const [a, b] = m.pts,
    dx = b.x - a.x,
    dy = b.y - a.y,
    L = Math.hypot(dx, dy) || 1,
    ux = dx / L,
    uy = dy / L,
    nx = -uy,
    ny = ux,
    aw = Math.max(0.3 * u, 9 * k),
    sw = aw * 0.38,
    hl = Math.min(L * 0.45, aw * 1.1),
    sx = b.x - ux * hl,
    sy = b.y - uy * hl;
  const pts = [
    [a.x + (nx * sw) / 2, a.y + (ny * sw) / 2],
    [sx + (nx * sw) / 2, sy + (ny * sw) / 2],
    [sx + (nx * aw) / 2, sy + (ny * aw) / 2],
    [b.x, b.y],
    [sx - (nx * aw) / 2, sy - (ny * aw) / 2],
    [sx - (nx * sw) / 2, sy - (ny * sw) / 2],
    [a.x - (nx * sw) / 2, a.y - (ny * sw) / 2],
  ]
    .map((q) => q.join(","))
    .join(" ");
  return (
    `<polygon points="${pts}" fill="${T.c}" stroke="${T.edge}" stroke-width="${1.2 * k}" stroke-linejoin="round"/>` +
    (T.pattern === "stripe" && T.c2
      ? `<polygon points="${pts}" fill="none" stroke="${T.c2}" stroke-width="${1.2 * k}" stroke-dasharray="${3 * k} ${3 * k}"/>`
      : "")
  );
}
function markSVG(m, k, u) {
  const T = tapeOf(m.type),
    w = tapeW(T, u, k, 4),
    planned = m.status === "planned",
    worn = m.status === "worn",
    da = T.pattern === "dash" ? ` stroke-dasharray="${w * 3} ${w * 2}"` : "";
  const ln = (pts, closed) => {
    const ps = pts.map((p) => p.x + "," + p.y).join(" "),
      tag = closed ? "polygon" : "polyline";
    let s = `<${tag} points="${ps}" fill="none" stroke="${T.edge}" stroke-width="${w + 1.4 * k}" stroke-linejoin="miter"${da}/><${tag} points="${ps}" fill="none" stroke="${T.c}" stroke-width="${w}" stroke-linejoin="miter"${da}/>`;
    if (T.pattern === "stripe" && T.c2)
      s += `<${tag} points="${ps}" fill="none" stroke="${T.c2}" stroke-width="${w}" stroke-dasharray="${w * 1.3} ${w * 1.3}"/>`;
    return s;
  };
  const cl = m.closed && m.kind !== "aisle",
    ps = m.pts.map((p) => p.x + "," + p.y).join(" "),
    tag = cl ? "polygon" : "polyline";
  let body;
  if (m.kind === "aisle") {
    const E = aisleEdges(m);
    body =
      `<polygon points="${[...E.a, ...E.b.slice().reverse()].map((p) => p.x + "," + p.y).join(" ")}" fill="${T.c}" fill-opacity=".14" stroke="none"/>` +
      ln(E.a, false) +
      ln(E.b, false);
  } else if (m.kind === "arrow") body = arrowSVG(m, T, k, u);
  else body = ln(m.pts, cl);
  let s = `<g data-t="mark" data-id="${esc(m.id)}">`;
  if (worn)
    s += `<${tag} points="${ps}" fill="none" stroke="#C3361A" stroke-opacity=".35" stroke-width="${(m.kind === "aisle" ? m.width : w) + 10 * k}" stroke-linejoin="round"/>`;
  s += `<g opacity="${planned ? 0.6 : 1}">${body}</g>`;
  if (planned && m.kind !== "arrow")
    s += `<${tag} points="${ps}" fill="none" stroke="#1C2250" stroke-width="${0.9 * k}" stroke-dasharray="${5 * k} ${4 * k}" pointer-events="none"/>`;
  if (worn)
    s += `<${tag} points="${ps}" fill="none" stroke="#C3361A" stroke-width="${w * 0.45}" stroke-dasharray="${3 * k} ${5 * k}"/>`;
  s += `<${tag} points="${ps}" fill="none" stroke="transparent" stroke-width="${m.kind === "aisle" ? Math.max(m.width, 12 * k) : Math.max(w, 12 * k)}"/></g>`;
  return s;
}
function dimSVG(m, k, sh) {
  let s = "";
  const pts =
    m.kind === "arrow"
      ? m.pts
      : m.closed && m.kind !== "aisle"
        ? [...m.pts, m.pts[0]]
        : m.pts;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      L = Math.hypot(b.x - a.x, b.y - a.y);
    if (L < 26 * k) continue;
    const ang = Math.atan2(b.y - a.y, b.x - a.x),
      off = m.kind === "aisle" ? m.width / 2 + 9 * k : 9 * k;
    let deg = (ang * 180) / Math.PI;
    if (deg > 90 || deg < -90) deg += 180;
    s += txt(
      (a.x + b.x) / 2 - Math.sin(ang) * off,
      (a.y + b.y) / 2 + Math.cos(ang) * off,
      fmtLen(L, sh),
      10 * k,
      k,
      { fill: "#1C2250", rot: deg },
    );
  }
  if (m.kind === "aisle") {
    const a = m.pts[0];
    s += txt(
      a.x,
      a.y - (m.width / 2 + 14 * k),
      fmtLen(m.width, sh) + " wide",
      10 * k,
      k,
      { fill: "#6B3FA0" },
    );
  }
  return s;
}
const runNo = (sh, m) => (sh._all || sh).marks.indexOf(m) + 1;
function runSVG(m, sh, k) {
  const p = m.pts[0];
  return `<g pointer-events="none"><circle cx="${p.x}" cy="${p.y}" r="${7.5 * k}" fill="#1C2250" stroke="#fff" stroke-width="${1.2 * k}"/><text x="${p.x}" y="${p.y}" font-size="${9 * k}" font-family="Segoe UI,system-ui,sans-serif" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${runNo(sh, m)}</text></g>`;
}
function datumSVG(dm, k) {
  const d = dm.datum;
  if (!d) return "";
  return `<g pointer-events="none"><circle cx="${d.x}" cy="${d.y}" r="${6 * k}" fill="none" stroke="#6B3FA0" stroke-width="${2 * k}"/><path d="M${d.x - 12 * k} ${d.y}H${d.x + 12 * k}M${d.x} ${d.y - 12 * k}V${d.y + 12 * k}" stroke="#6B3FA0" stroke-width="${1.6 * k}"/>${txt(d.x + 10 * k, d.y - 10 * k, "Datum", 10.5 * k, k, { anchor: "start", fill: "#6B3FA0" })}</g>`;
}

function routeSVG(r, k) {
  const c = COL[r.who],
    w =
      (r.who === "vehicle" ? 4 : 2.6) *
      k *
      Math.min(2.4, 1 + Math.log2(Math.max(1, perShift(r))) * 0.22),
    pts = r.pts.map((p) => p.x + "," + p.y).join(" ");
  const p0 = r.pts[0];
  return (
    `<g data-t="route" data-id="${esc(r.id)}"><polyline points="${pts}" fill="none" stroke="${c}" stroke-opacity=".85" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" ${r.who === "vehicle" ? `stroke-dasharray="${w * 3} ${w * 1.6}"` : ""} marker-mid="url(#arw-${r.who})" marker-end="url(#arw-${r.who})"/>` +
    `<circle cx="${p0.x}" cy="${p0.y}" r="${4 * k}" fill="#fff" stroke="${c}" stroke-width="${2 * k}"/>` +
    `<polyline points="${pts}" fill="none" stroke="transparent" stroke-width="${12 * k}"/>` +
    txt(p0.x + 6 * k, p0.y - 9 * k, r.name, 10.5 * k, k, {
      anchor: "start",
      fill: c,
    }) +
    `</g>`
  );
}

function overlaySVG(c, k) {
  let s = "";
  const fs = 10.5 * k;
  for (const o of c.ok)
    s += `<g transform="translate(${o.x} ${o.y}) rotate(${o.a})" pointer-events="none"><rect x="${-o.w / 2 - 3 * k}" y="${-o.h / 2 - 3 * k}" width="${o.w + 6 * k}" height="${o.h + 6 * k}" fill="none" stroke="${COL.ok}" stroke-width="${1.5 * k}"/></g>`;
  for (const m of c.moved) {
    const { o, r } = m;
    s += `<g transform="translate(${r.x} ${r.y}) rotate(${r.a})" pointer-events="none"><rect x="${-r.w / 2}" y="${-r.h / 2}" width="${r.w}" height="${r.h}" fill="${COL.warn}" fill-opacity=".08" stroke="${COL.warn}" stroke-width="${1.6 * k}" stroke-dasharray="${5 * k} ${3 * k}"/></g>`;
    if (m.d > 1e-6)
      s +=
        `<line x1="${r.x}" y1="${r.y}" x2="${o.x}" y2="${o.y}" stroke="${COL.warn}" stroke-width="${2 * k}" marker-end="url(#arw-warn)" pointer-events="none"/>` +
        txt((r.x + o.x) / 2, (r.y + o.y) / 2 - 8 * k, fmtLen(m.d), fs, k, {
          fill: COL.warn,
        });
    s += `<g transform="translate(${o.x} ${o.y}) rotate(${o.a})" pointer-events="none"><rect x="${-o.w / 2 - 3 * k}" y="${-o.h / 2 - 3 * k}" width="${o.w + 6 * k}" height="${o.h + 6 * k}" fill="none" stroke="${COL.warn}" stroke-width="${2.2 * k}"/></g>`;
  }
  for (const r of c.missing)
    s += `<g data-t="ghost" data-ref="${esc(r.ref)}" transform="translate(${r.x} ${r.y}) rotate(${r.a})"><title>Missing: ${esc(r.label)}. Click to put it back on this sheet.</title><rect x="${-r.w / 2}" y="${-r.h / 2}" width="${r.w}" height="${r.h}" fill="${COL.bad}" fill-opacity=".1" stroke="${COL.bad}" stroke-width="${1.8 * k}" stroke-dasharray="${4 * k} ${3 * k}"/>${txt(0, 0, fit("Missing", r.w, fs) || "!", fs, k, { fill: COL.bad })}</g>`;
  for (const o of c.extra)
    s += `<g transform="translate(${o.x} ${o.y}) rotate(${o.a})" pointer-events="none"><rect x="${-o.w / 2 - 4 * k}" y="${-o.h / 2 - 4 * k}" width="${o.w + 8 * k}" height="${o.h + 8 * k}" fill="none" stroke="${COL.extra}" stroke-width="${2.2 * k}" stroke-dasharray="${3 * k} ${3 * k}"/></g>`;
  for (const m of c.tapeMissing)
    s += `<polyline points="${(m.closed ? [...m.pts, m.pts[0]] : m.pts).map((p) => p.x + "," + p.y).join(" ")}" fill="none" stroke="${COL.bad}" stroke-width="${2 * k}" stroke-dasharray="${2 * k} ${4 * k}" pointer-events="none"/>`;
  return s;
}

function buildSVG(sh, o) {
  // working on one line or zone: only what is inside it is drawn and checked
  const A = o.scoped ? scopeArea() : null;
  if (A) {
    sh = {
      ...sh,
      _all: sh,
      objects: sh.objects.filter((z) => scopeObj(z, A)),
      marks: sh.marks.filter((m) => scopeMark(m, A)),
      routes: sh.routes.filter((r) => scopeMark(r, A)),
    };
    if (o.cmp) o = { ...o, cmp: scopeCmp(o.cmp, A) };
  }
  const dm = DM(sh),
    W = dm.w,
    H = dm.h,
    k = o.k,
    L = ui.layers,
    u = upm(sh);
  // a little of what is around the scoped area, faded, so it can be placed in context
  let ctxS = "";
  if (A && !o.export) {
    const all = sh._all,
      bx = scopeBox(A),
      inBox = (p) =>
        p.x >= bx.x0 && p.x <= bx.x1 && p.y >= bx.y0 && p.y <= bx.y1;
    for (const z of all.objects)
      if (
        !scopeObj(z, A) &&
        inBox(z) &&
        !(z.kind === "item" && ui.hiddenCategories.has(itemCategoryId(z)))
      )
        ctxS += objSVG(z, k, true);
    for (const m of all.marks)
      if (!scopeMark(m, A) && m.pts.some(inBox)) ctxS += markSVG(m, k, u);
    for (const r of all.routes)
      if (!scopeMark(r, A) && r.pts.some(inBox)) ctxS += routeSVG(r, k);
    if (ctxS) ctxS = `<g opacity=".4" pointer-events="none">${ctxS}</g>`;
  }
  let s = `<defs><pattern id="hz" patternUnits="userSpaceOnUse" width="${10 * k}" height="${10 * k}" patternTransform="rotate(45)"><rect width="${10 * k}" height="${10 * k}" fill="#fff" fill-opacity=".6"/><rect width="${5 * k}" height="${10 * k}" fill="#D3401D" fill-opacity=".5"/></pattern>`;
  for (const [id, c] of [
    ["walk", COL.walk],
    ["vehicle", COL.vehicle],
    ["warn", COL.warn],
  ])
    s += `<marker id="arw-${id}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="${id === "warn" ? 5 : 3.2}" markerHeight="${id === "warn" ? 5 : 3.2}" orient="auto"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker>`;
  if (L.grid) {
    const g = gridStep(sh);
    s += `<pattern id="grid" patternUnits="userSpaceOnUse" width="${g}" height="${g}"><path d="M${g} 0H0V${g}" fill="none" stroke="#202C86" stroke-opacity=".16" stroke-width="${k}"/></pattern>`;
  }
  s += "</defs>";
  if (!o.noBg) {
    s += `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`;
    if (L.drawing && D[sh.drawing])
      s += `<image href="${esc(D[sh.drawing])}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" opacity="${L.fade ? 0.35 : 1}"/>`;
  }
  if (L.grid)
    s += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#grid)" pointer-events="none"/>`;
  if (L.areas) s += areaSVG(sh, k, A, true);
  const midPos = s.length;
  if (L.objects)
    for (const z of sh.objects) if (z.kind !== "item") s += objSVG(z, k, true);
  if (L.marks) {
    for (const m of sh.marks) s += markSVG(m, k, u);
    const src = sh.kind === "daily" ? stdFor(sh).objects : sh.objects,
      HT = tapeOf(P.marking.homeType);
    for (const f of A ? src.filter((z) => scopeObj(z, A)) : src)
      if (
        f.fp &&
        f.kind === "item" &&
        !ui.hiddenCategories.has(itemCategoryId(f))
      )
        s += footSVG(f, k, u, HT);
    for (const m of sh.marks) {
      if (L.dims || (!o.export && ui.sel.includes(m.id))) s += dimSVG(m, k, sh);
      if (L.runs || o.runNos) s += runSVG(m, sh, k);
    }
    if (L.dims || o.runNos || (!o.export && ui.tab === "mark"))
      s += datumSVG(dm, k);
  }
  if (L.objects)
    for (const it of sh.objects)
      if (it.kind === "item" && !ui.hiddenCategories.has(itemCategoryId(it)))
        s += objSVG(it, k, true);
  const cs = o.cmp;
  if (L.overlay && cs) {
    const visible = (x) => !ui.hiddenCategories.has(itemCategoryId(x));
    s += overlaySVG(
      {
        ...cs,
        ok: cs.ok.filter(visible),
        moved: cs.moved.filter((m) => visible(m.o)),
        extra: cs.extra.filter(visible),
        missing: cs.missing.filter(visible),
      },
      k,
    );
  }
  const IS =
    cs ||
    (L.objects || L.routes
      ? A
        ? scopeIssues(issues(sh._all), A) // checks run on the whole sheet, then kept to the scope
        : issues(sh)
      : {
          structure: [],
          walkBlock: [],
          blocked: [],
          wallHits: [],
          aisleClash: [],
          conflicts: [],
          outOfArea: [],
        });
  if (L.objects) {
    if (L.areas)
      s += outOfAreaSVG(
        (IS.outOfArea || []).filter(
          (z) => !ui.hiddenCategories.has(itemCategoryId(z.o)),
        ),
        k,
      );
    for (const b of [...IS.structure, ...IS.walkBlock]) {
      const x = b.o;
      if (x.kind === "item" && ui.hiddenCategories.has(itemCategoryId(x)))
        continue;
      s += `<g transform="translate(${x.x} ${x.y}) rotate(${x.a})" pointer-events="none"><rect x="${-x.w / 2 - 2 * k}" y="${-x.h / 2 - 2 * k}" width="${x.w + 4 * k}" height="${x.h + 4 * k}" fill="none" stroke="${COL.bad}" stroke-width="${3 * k}" stroke-dasharray="${5 * k} ${3 * k}"/></g>`;
    }
    const bl = IS.blocked;
    for (const b of bl) {
      const x = b.o;
      if (x.kind === "item" && ui.hiddenCategories.has(itemCategoryId(x)))
        continue;
      s += `<g transform="translate(${x.x} ${x.y}) rotate(${x.a})" pointer-events="none"><rect x="${-x.w / 2 - 2 * k}" y="${-x.h / 2 - 2 * k}" width="${x.w + 4 * k}" height="${x.h + 4 * k}" fill="none" stroke="${COL.bad}" stroke-width="${3 * k}"/></g>`;
    }
  }
  if (L.routes) {
    for (const r of sh.routes) s += routeSVG(r, k);
    for (const h of [...IS.wallHits, ...IS.aisleClash])
      s += `<g pointer-events="none"><title>Route passes through ${esc(h.z.label || "a wall")}</title><rect transform="translate(${h.x} ${h.y}) rotate(45)" x="${-5 * k}" y="${-5 * k}" width="${10 * k}" height="${10 * k}" fill="${COL.bad}" stroke="#fff" stroke-width="${1.4 * k}"/><path d="M${h.x - 2.5 * k} ${h.y - 2.5 * k}L${h.x + 2.5 * k} ${h.y + 2.5 * k}M${h.x + 2.5 * k} ${h.y - 2.5 * k}L${h.x - 2.5 * k} ${h.y + 2.5 * k}" stroke="#fff" stroke-width="${1.6 * k}"/></g>`;
    for (const c of IS.conflicts)
      s += `<g pointer-events="none"><circle cx="${c.x}" cy="${c.y}" r="${8 * k}" fill="${COL.bad}" stroke="#fff" stroke-width="${1.5 * k}"/>${txt(c.x, c.y, "!", 11 * k, k, { fill: "#fff" }).replace(/stroke="#fff"/, 'stroke="none"')}</g>`;
  }
  s += labelsSVG(sh, k, o);
  for (const pn of pinList(sh))
    if (!A || ptInPoly(pn.o, A.pts)) s += pinSVG(pn, k);
  {
    const editing = ui.editDrawing && !o.export && !ui.printing,
      // while the drawing is edited the fixed objects keep their own names, at full strength
      fx = fixedSVG(sh, k, editing, "fxh", !editing);
    s = editing
      ? s.slice(0, midPos) +
        '<g opacity=".35" pointer-events="none">' +
        s.slice(midPos) +
        "</g>" +
        fx
      : s.slice(0, midPos) +
        fx +
        (A
          ? `<path d="M-100000 -100000H100000V100000H-100000Z M${A.pts.map((p) => p.x + " " + p.y).join(" L")} Z" fill="#fff" fill-opacity=".72" fill-rule="evenodd" pointer-events="none"/>${ctxS}`
          : "") +
        s.slice(midPos);
  }
  if (!o.export && !ui.printing) {
    // selection
    for (const id of ui.sel) {
      const f = find(id, sh);
      if (!f) continue;
      const x = f.x;
      if (f.t === "obj") {
        const single = ui.sel.length === 1 && !x.locked,
          hw = x.w / 2,
          hh = x.h / 2,
          hs = 10 * k * TOUCH;
        s += `<g transform="translate(${x.x} ${x.y}) rotate(${x.a})"><rect x="${-hw - 4 * k}" y="${-hh - 4 * k}" width="${x.w + 8 * k}" height="${x.h + 8 * k}" fill="none" stroke="${COL.sel}" stroke-width="${1.5 * k}" stroke-dasharray="${4 * k} ${3 * k}" pointer-events="none"/>`;
        if (single)
          s += `<line x1="0" y1="${-hh - 4 * k}" x2="0" y2="${-hh - 22 * k}" stroke="${COL.sel}" stroke-width="${1.2 * k}"/><circle data-t="rot" data-id="${esc(x.id)}" cx="0" cy="${-hh - 24 * k}" r="${6 * k * TOUCH}" fill="#fff" stroke="${COL.sel}" stroke-width="${2 * k}"/><rect data-t="rs" data-id="${esc(x.id)}" x="${hw + 4 * k - hs / 2}" y="${hh + 4 * k - hs / 2}" width="${hs}" height="${hs}" fill="${COL.sel}" stroke="#fff" stroke-width="${1.5 * k}"/>`;
        s += "</g>";
      } else {
        const col = f.t === "route" ? COL[x.who] : COL.sel;
        s += `<polyline points="${(x.closed ? [...x.pts, x.pts[0]] : x.pts).map((p) => p.x + "," + p.y).join(" ")}" fill="none" stroke="${COL.sel}" stroke-width="${1.2 * k}" stroke-dasharray="${4 * k} ${3 * k}" pointer-events="none"/>`;
        // a locked line or zone has no reshape handles
        if (!x.locked)
          x.pts.forEach(
            (p, i) =>
              (s += `<circle data-t="v" data-k="${esc(f.t)}" data-id="${esc(x.id)}" data-i="${esc(i)}" cx="${p.x}" cy="${p.y}" r="${5.5 * k * TOUCH}" fill="#fff" stroke="${col}" stroke-width="${2 * k}"/>`),
          );
      }
    }
    s += labelTagsSVG(sh, k) + guidesSVG(k) + marqueeSVG(k);
    // draft
    const d = ui.draft;
    if (d && d.pts.length) {
      const pts = [...d.pts, ...(ui.cursor ? [ui.cursor] : [])],
        col =
          d.tool === "route"
            ? COL[ui.route.who]
            : d.tool === "tape"
              ? "#3A3F55"
              : d.tool === "area"
                ? COL.ok
                : COL.bad;
      if (d.tool === "tape") {
        const T = tapeOf(ui.tape),
          w = tapeW(T, u, k, 4),
          mode = ui.tapeMode,
          sp = (a, sw, c) =>
            `<polyline points="${a.map((p) => p.x + "," + p.y).join(" ")}" fill="none" stroke="${c}" stroke-width="${sw}" opacity=".9" stroke-linejoin="miter"/>`;
        if (mode === "rect" && pts.length >= 2) {
          const a = pts[0],
            b = pts.at(-1),
            q = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a];
          s += sp(q, w + 1.4 * k, T.edge) + sp(q, w, T.c);
        } else if (mode === "arrow" && pts.length >= 2)
          s += arrowSVG({ pts: [pts[0], pts.at(-1)] }, T, k, u);
        else if (mode === "aisle" && pts.length >= 2) {
          const E = aisleEdges({ pts, width: ui.aisleW * u });
          s +=
            sp(E.a, w + 1.4 * k, T.edge) +
            sp(E.a, w, T.c) +
            sp(E.b, w + 1.4 * k, T.edge) +
            sp(E.b, w, T.c) +
            sp(pts, 1.2 * k, "#1C2250");
        } else s += sp(pts, w + 1.4 * k, T.edge) + sp(pts, w, T.c);
      } else if (d.tool === "area")
        s += `<polygon points="${pts.map((p) => p.x + "," + p.y).join(" ")}" fill="${COL.ok}" fill-opacity=".1" stroke="${COL.ok}" stroke-width="${2.4 * k}" stroke-dasharray="${9 * k} ${5 * k}"/>`;
      else if (d.tool === "wall")
        s += `<polyline points="${pts.map((p) => p.x + "," + p.y).join(" ")}" fill="none" stroke="#4A4F66" stroke-opacity=".75" stroke-width="${ui.wall.th * upm(sh)}" stroke-linejoin="miter" stroke-linecap="square"/>`;
      else
        s += `<polyline points="${pts.map((p) => p.x + "," + p.y).join(" ")}" fill="none" stroke="${col}" stroke-width="${2.4 * k}" stroke-dasharray="${6 * k} ${4 * k}"/>`;
      d.pts.forEach(
        (p, i) =>
          (s += `<circle cx="${p.x}" cy="${p.y}" r="${(i === 0 ? 5 : 3.5) * k}" fill="#fff" stroke="${col}" stroke-width="${2 * k}"/>`),
      );
      if (ui.cursor) {
        const c = ui.cursor;
        s += txt(c.x + 10 * k, c.y + 14 * k, fmtLen(polyLen(pts)), 11 * k, k, {
          anchor: "start",
        });
      }
    }
  }
  return s;
}

/* ============ view / pan / zoom ============ */
function vbH() {
  const r = svg.getBoundingClientRect();
  return ui.vb.w * (r.height / Math.max(1, r.width));
}
// the middle of what is on screen; the middle of the drawing before the layout has been shown
function viewCentre() {
  if (!ui.vb) fitView();
  if (!ui.vb) {
    const dm = DM();
    return { x: dm.w / 2, y: dm.h / 2 };
  }
  return { x: ui.vb.x + ui.vb.w / 2, y: ui.vb.y + vbH() / 2 };
}
function kNow() {
  const r = svg.getBoundingClientRect();
  return ui.vb.w / Math.max(1, r.width);
}
function fitView() {
  const r = svg.getBoundingClientRect(),
    dm = DM(),
    A = scopeArea();
  if (!r.width || !r.height) return;
  // the whole drawing, or the area being worked on with a little round it (the faded context
  // reaches out to scopeBox, a step further, for panning)
  const b = A
    ? (() => {
        const z = areaBox(A),
          pad = Math.max(z.x1 - z.x0, z.y1 - z.y0) * 0.1 + 4;
        return {
          x0: z.x0 - pad,
          y0: z.y0 - pad,
          x1: z.x1 + pad,
          y1: z.y1 + pad,
        };
      })()
    : {
        x0: -dm.w * 0.015,
        y0: -dm.h * 0.025,
        x1: dm.w * 1.015,
        y1: dm.h * 1.025,
      };
  const bw = b.x1 - b.x0,
    bh = b.y1 - b.y0,
    sc = Math.min(r.width / bw, r.height / bh);
  ui.vb = { w: r.width / sc, x: 0, y: 0 };
  ui.vb.x = (b.x0 + b.x1) / 2 - ui.vb.w / 2;
  ui.vb.y = (b.y0 + b.y1) / 2 - vbH() / 2;
  if (A)
    Object.assign(
      ui.vb,
      viewInDrawing(ui.vb.x, ui.vb.y, ui.vb.w, vbH(), dm.w, dm.h),
    );
}
function world(e) {
  // a tap can land before the first draw after a project opens (ui.vb is reset then)
  if (!ui.vb) fitView();
  if (!ui.vb) return viewCentre();
  const r = svg.getBoundingClientRect(),
    h = vbH();
  return {
    x: ui.vb.x + ((e.clientX - r.left) * ui.vb.w) / r.width,
    y: ui.vb.y + ((e.clientY - r.top) * h) / r.height,
  };
}
function zoomAt(f, cx, cy) {
  const dm = DM(),
    nw = clamp(ui.vb.w / f, dm.w * 0.03, dm.w * 4),
    r = nw / ui.vb.w;
  if (cx == null) {
    cx = ui.vb.x + ui.vb.w / 2;
    cy = ui.vb.y + vbH() / 2;
  }
  ui.vb.x = cx - (cx - ui.vb.x) * r;
  ui.vb.y = cy - (cy - ui.vb.y) * r;
  ui.vb.w = nw;
  draw();
}
function centreOn(x, y, zoomIn = true) {
  const dm = DM();
  if (zoomIn) ui.vb.w = Math.min(ui.vb.w, dm.w * 0.4);
  ui.vb.x = x - ui.vb.w / 2;
  ui.vb.y = y - vbH() / 2;
  draw();
}
let rafP = 0;
function draw() {
  if (rafP) return;
  rafP = requestAnimationFrame(() => {
    rafP = 0;
    drawNow();
  });
}
let cmpCache = null;
// a new, empty standard with no plan: a start card in the middle of the canvas
function updateEmptyCanvas() {
  const sh = S(),
    blank =
      sh.kind === "standard" &&
      !sh.objects.length &&
      !sh.marks.length &&
      !sh.routes.length &&
      !D[sh.drawing] &&
      !(DM(sh)?.fixed || []).length &&
      !(P.areas || []).some((a) => a.drawing === sh.drawing);
  $("#emptyCv").hidden = !blank;
}
function drawNow() {
  if (ui.view !== "layout") return;
  updateEmptyCanvas();
  if (!ui.vb) fitView();
  if (!ui.vb) return;
  const sh = S(),
    ref = cmpSheet(),
    pm = DM(),
    k = ui.printing ? pm.w / 1500 : kNow();
  const panOnly =
    !ui.printing &&
    ui.drag?.mode === "pan" &&
    svg.dataset.renderSheet === sh.id &&
    Number(svg.dataset.renderScale) === k;
  const pbox = scopeArea() ? scopeBox(scopeArea()) : null;
  svg.setAttribute(
    "viewBox",
    ui.printing
      ? pbox
        ? `${pbox.x0} ${pbox.y0} ${pbox.x1 - pbox.x0} ${pbox.y1 - pbox.y0}`
        : `0 0 ${pm.w} ${pm.h}`
      : `${ui.vb.x} ${ui.vb.y} ${ui.vb.w} ${vbH()}`,
  );
  if (!panOnly) {
    cmpCache = ref ? compare(sh, ref) : null;
    svg.innerHTML = buildSVG(sh, { k, cmp: cmpCache, scoped: true });
    svg.dataset.renderSheet = sh.id;
    svg.dataset.renderScale = k;
  }
  const dm = DM(),
    r = svg.getBoundingClientRect(),
    fitW = Math.max(
      dm.w * 1.03,
      (dm.h * 1.05 * r.width) / Math.max(1, r.height),
    );
  $("#zlabel").textContent = Math.round((fitW / ui.vb.w) * 100) + "%";
  drawScale(k);
  positionSelbar();
  updateScopeBar();
}
function drawScale(k) {
  const el = $("#scale"),
    m = mpu();
  if (!m) {
    el.innerHTML = `<button id="bScale" title="Use the Measure tool on a known distance">Set scale for metres</button>`;
    $("#bScale").onclick = () => setTool("measure");
    return;
  }
  const pxPerM = 1 / (m * k);
  let L = [0.5, 1, 2, 5, 10, 20, 50, 100].find((v) => v * pxPerM >= 70) || 100;
  el.innerHTML = `<div class="bar" style="width:${Math.round(L * pxPerM)}px"></div>${L} m`;
}

/* ============ pointer interaction ============ */
function snapV(v, sh) {
  return ui.layers.snap ? Math.round(v / snapStep(sh)) * snapStep(sh) : v;
}
function snapPoint(p, e, last) {
  const k = kNow(),
    sh = S();
  let q = { ...p };
  if (
    ui.tool === "tape" ||
    ui.tool === "measure" ||
    ui.tool === "wall" ||
    ui.tool === "area"
  ) {
    let best = null,
      bd = 9 * k;
    for (const m of [
      ...sh.marks,
      ...(DM(sh).fixed || []).filter((f) => f.t === "wall"),
      ...(ui.tool === "area"
        ? P.areas.filter((a) => a.drawing === sh.drawing)
        : []),
    ])
      for (const v of m.pts) {
        const d = Math.hypot(v.x - p.x, v.y - p.y);
        if (d < bd) {
          bd = d;
          best = v;
        }
      }
    if (best) return { ...best };
  }
  if (e.shiftKey && last) {
    const dx = q.x - last.x,
      dy = q.y - last.y,
      L = Math.hypot(dx, dy),
      a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    q = { x: last.x + L * Math.cos(a), y: last.y + L * Math.sin(a) };
  } else {
    q.x = snapV(q.x, sh);
    q.y = snapV(q.y, sh);
  }
  return q;
}

const ptrs = new Map();
svg.addEventListener("pointerdown", (e) => {
  if (e.button === 2) return;
  svg.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) {
    ui.tap = null; // the first finger of a pinch is not a click
    const [a, b] = [...ptrs.values()];
    if (ui.drag?.moved && ui.drag.mode !== "pan") renderAll();
    ui.drag = null;
    $("#canvas").classList.remove("panning");
    ui.pinch = {
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      vb0: { ...ui.vb },
      m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
    return;
  }
  if (ptrs.size > 2) return;
  const p = world(e);
  if (e.button === 1 || ui.space) {
    startPan(e, false);
    return;
  }
  if (ui.tool !== "select" && e.pointerType === "touch") {
    // a finger: wait to see whether it is a tap or the start of a pinch or pan
    ui.tap = { id: e.pointerId, x: e.clientX, y: e.clientY, e, p };
    return;
  }
  if (ui.tool !== "select") {
    placeOrDraw(e, p);
    return;
  }
  const t = e.target.closest("[data-t]");
  if (!t) {
    if (e.shiftKey) startMarquee(e, p);
    else startPan(e, true);
    return;
  }
  const kind = t.dataset.t,
    id = t.dataset.id;
  // an area's edge is a thin target along the floor: Shift-drag there still draws a box
  if (kind === "area" && e.shiftKey) {
    startMarquee(e, p);
    return;
  }
  if (kind === "ghost") {
    restoreMissing(t.dataset.ref);
    return;
  }
  if (kind === "pin") {
    const it = pinObj(t.dataset.pk, id);
    if (it)
      ui.drag = {
        mode: "pin",
        pk: t.dataset.pk,
        id,
        p0: p,
        orig: { x: it.x, y: it.y },
        snap: historySnapshot(),
        moved: false,
        sx: e.clientX,
        sy: e.clientY,
      };
    return;
  }
  if (kind === "rs" || kind === "rot") {
    const f = find(id);
    ui.drag = {
      mode: kind,
      id,
      o0: clone(f.x),
      p0: p,
      snap: historySnapshot(),
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
    };
    return;
  }
  if (kind === "v") {
    if (find(id)?.x.locked) return toast("Locked. Unlock it to reshape it.");
    ui.drag = {
      mode: "v",
      id,
      i: +t.dataset.i,
      p0: p,
      snap: historySnapshot(),
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
    };
    return;
  }
  if (e.shiftKey) {
    ui.sel = ui.sel.includes(id)
      ? ui.sel.filter((x) => x !== id)
      : [...ui.sel, id];
  } else if (!ui.sel.includes(id)) ui.sel = [id];
  if (ui.tab !== "check" && ui.tab !== "move" && ui.tab !== "mark")
    ui.tab = "item";
  if (ui.tab === "move" && find(id)?.t !== "route") ui.tab = "item";
  if (find(id)?.t === "area") ui.tab = "item";
  // everything selected is locked: a drag pans the view instead of recording a move that cannot happen
  if (selected().every((f) => f.x.locked)) {
    startPan(e, false);
    draw();
    renderSide();
    return;
  }
  const orig = {};
  for (const f of selected()) orig[f.x.id] = clone(f.x);
  ui.drag = {
    mode: "move",
    p0: p,
    orig,
    snap: historySnapshot(),
    moved: false,
    sx: e.clientX,
    sy: e.clientY,
  };
  draw();
  renderSide();
});

function startPan(e, clickClears) {
  ui.drag = {
    mode: "pan",
    vb0: { ...ui.vb },
    sx: e.clientX,
    sy: e.clientY,
    clickClears,
    moved: false,
  };
  $("#canvas").classList.add("panning");
}

svg.addEventListener("pointermove", (e) => {
  if (ptrs.has(e.pointerId))
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ui.tap && Math.hypot(e.clientX - ui.tap.x, e.clientY - ui.tap.y) > 8)
    ui.tap = null; // it moved: not a tap
  if (ui.pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()],
      pi = ui.pinch,
      r = svg.getBoundingClientRect(),
      dm = DM(),
      k0 = pi.vb0.w / r.width;
    const wx = pi.vb0.x + (pi.m0.x - r.left) * k0,
      wy = pi.vb0.y + (pi.m0.y - r.top) * k0,
      w = clamp(
        (pi.vb0.w * pi.d0) / (Math.hypot(a.x - b.x, a.y - b.y) || 1),
        dm.w * 0.03,
        dm.w * 4,
      ),
      k1 = w / r.width,
      mx = (a.x + b.x) / 2,
      my = (a.y + b.y) / 2;
    ui.vb = { w, x: wx - (mx - r.left) * k1, y: wy - (my - r.top) * k1 };
    draw();
    return;
  }
  const d = ui.drag;
  if (!d) {
    if (ui.draft) {
      const last = ui.draft.pts.at(-1);
      ui.cursor = snapPoint(world(e), e, last);
      draw();
    } else if (ui.tool === "select" && e.pointerType === "mouse") {
      // full name of a small item when the pointer is over it
      const id = e.target.closest?.('[data-t="obj"]')?.dataset.id || null;
      if (id !== ui.hover) {
        ui.hover = id;
        draw();
      }
    }
    return;
  }
  // a finger wobbles more than a mouse: do not count a tap as a move
  if (
    !d.moved &&
    Math.hypot(e.clientX - d.sx, e.clientY - d.sy) <
      (e.pointerType === "mouse" ? 3 : 8)
  )
    return;
  if (d.mode === "pan") {
    d.moved = true;
    const r = svg.getBoundingClientRect(),
      k = ui.vb.w / r.width;
    ui.vb.x = d.vb0.x - (e.clientX - d.sx) * k;
    ui.vb.y = d.vb0.y - (e.clientY - d.sy) * k;
    draw();
    return;
  }
  if (d.mode === "marquee") {
    d.moved = true;
    const p = world(e);
    ui.marquee = {
      x0: Math.min(d.p0.x, p.x),
      x1: Math.max(d.p0.x, p.x),
      y0: Math.min(d.p0.y, p.y),
      y1: Math.max(d.p0.y, p.y),
    };
    draw();
    return;
  }
  if (!d.moved) {
    d.moved = true;
    undoS.push(d.snap);
    trimHistory(undoS);
    redoS = [];
  }
  const p = world(e),
    sh = S();
  if (d.mode === "move") {
    const dx = p.x - d.p0.x,
      dy = p.y - d.p0.y,
      g = moveGuides(d, dx, dy, e);
    for (const f of selected()) {
      const o0 = d.orig[f.x.id];
      if (!o0 || f.x.locked) continue;
      if (f.t === "obj") {
        f.x.x = g.gx ? o0.x + g.dx : snapV(o0.x + dx, sh);
        f.x.y = g.gy ? o0.y + g.dy : snapV(o0.y + dy, sh);
      } else {
        const sx = snapV(dx, sh),
          sy = snapV(dy, sh);
        f.x.pts = o0.pts.map((q) => ({ x: q.x + sx, y: q.y + sy }));
      }
    }
  } else if (d.mode === "rs") {
    const o = find(d.id)?.x;
    if (!o) return;
    if (o.t === "text") {
      const a = (o.a * Math.PI) / 180,
        dx = p.x - d.p0.x,
        dy = p.y - d.p0.y,
        ly = -dx * Math.sin(a) + dy * Math.cos(a);
      o.fs = Math.max(1, d.o0.fs * (1 + ly / Math.max(d.o0.h, 1)));
      o.h = o.fs * 1.3;
      o.w = Math.max(1, o.label.length) * o.fs * 0.6;
      draw();
      return;
    }
    const a = (o.a * Math.PI) / 180,
      c = Math.cos(a),
      s = Math.sin(a),
      dx = p.x - d.p0.x,
      dy = p.y - d.p0.y;
    const lx = dx * c + dy * s,
      ly = -dx * s + dy * c,
      min = 2 * kNow();
    const w = Math.max(min, snapV(d.o0.w + lx, sh)),
      h = Math.max(min, snapV(d.o0.h + ly, sh)),
      gw = (w - d.o0.w) / 2,
      gh = (h - d.o0.h) / 2;
    o.w = w;
    o.h = h;
    o.x = d.o0.x + gw * c - gh * s;
    o.y = d.o0.y + gw * s + gh * c;
  } else if (d.mode === "rot") {
    const o = find(d.id)?.x;
    if (!o) return;
    let a = (Math.atan2(p.y - o.y, p.x - o.x) * 180) / Math.PI + 90;
    if (!e.shiftKey) a = Math.round(a / 15) * 15;
    o.a = ((a % 360) + 360) % 360;
  } else if (d.mode === "v") {
    const f = find(d.id);
    if (!f) return;
    const others = f.x.pts.filter((_, i) => i !== d.i);
    f.x.pts[d.i] = snapPoint(
      p,
      e,
      others.length ? f.x.pts[d.i - 1] || f.x.pts[d.i + 1] : null,
    );
  } else if (d.mode === "pin") {
    const it = pinObj(d.pk, d.id);
    if (it) {
      it.x = d.orig.x + (p.x - d.p0.x);
      it.y = d.orig.y + (p.y - d.p0.y);
    }
  }
  draw();
});

function endDrag(e) {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) ui.pinch = null;
  if (ui.tap && ui.tap.id === e.pointerId) {
    const t = ui.tap;
    ui.tap = null;
    if (e.type === "pointerup" && !ptrs.size) placeOrDraw(t.e, t.p);
    return;
  }
  const d = ui.drag;
  if (!d) return;
  ui.drag = null;
  ui.guides = [];
  $("#canvas").classList.remove("panning");
  if (d.mode === "marquee") {
    const m = ui.marquee;
    ui.marquee = null;
    if (d.moved && m) selectInBox(m);
    draw();
    renderSide();
    return;
  }
  if (d.mode === "pin") {
    if (d.moved) {
      const it = pinObj(d.pk, d.id);
      record("Moved pin", it ? pinLabel(d.pk, it) : "");
      renderAll();
    } else if (e.type === "pointerup") openPin(d.pk, d.id);
    return;
  }
  if (d.mode === "pan") {
    if (!d.moved && d.clickClears && ui.sel.length) {
      ui.sel = [];
      draw();
      renderSide();
    }
    return;
  }
  if (d.moved) {
    const f = d.id ? find(d.id) : selected()[0];
    const what = f ? f.x.label || f.x.name || TAPE[f.x.type]?.n || "" : "";
    record(
      { move: "Moved", rs: "Resized", rot: "Rotated", v: "Reshaped" }[d.mode],
      ui.sel.length > 1 ? ui.sel.length + " items" : what,
    );
    renderAll();
  }
}
svg.addEventListener("pointerup", endDrag);
svg.addEventListener("pointercancel", endDrag);
svg.addEventListener("lostpointercapture", endDrag);
svg.addEventListener("pointerleave", () => {
  if (ui.hover && !ui.drag) {
    ui.hover = null;
    draw();
  }
  if (ui.draft && !ui.drag) {
    ui.cursor = null;
    draw();
  }
});
svg.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const p = world(e);
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  },
  { passive: false },
);
// right-click: js/37-context-menu.js (ends a line being drawn, else a menu)
svg.addEventListener("dragover", (e) => {
  if (e.dataTransfer.types.includes("text/x-lib")) e.preventDefault();
});
svg.addEventListener("drop", (e) => {
  const v = e.dataTransfer.getData("text/x-lib");
  if (!v) return;
  e.preventDefault();
  const p = world(e);
  addItem(JSON.parse(v), p);
});

/* ============ drawing tools ============ */
function setTool(t, level) {
  if (t === "select") ui.placing = null;
  if (t === "area") {
    ui.layers.areas = true;
    ui.areaLevel = level === "line" ? "line" : "zone";
  }
  if (ui.draft && ui.draft.tool !== t) ui.draft = null;
  ui.tool = t;
  ui.cursor = null;
  $("#canvas").dataset.tool = t;
  $$("#toolSeg button,#drawSeg button").forEach((b) =>
    b.classList.toggle("on", b.dataset.tool === t),
  );
  if (t !== "select") ui.sel = [];
  renderTools();
  renderDrawTools();
  updateHint();
  draw();
  renderSide();
}
function placeOrDraw(e, p) {
  if (ui.tool === "datum") setDatum(p);
  else if (ui.tool === "doc" || ui.tool === "action" || ui.tool === "tag")
    placePin(p);
  else if (ui.tool === "taskat") placeTaskAt(p);
  else addDraftPoint(e, p);
}
function addDraftPoint(e, p) {
  const now = Date.now(),
    k = kNow();
  if (!ui.draft) ui.draft = { tool: ui.tool, pts: [], t: 0 };
  const d = ui.draft,
    last = d.pts.at(-1),
    q = snapPoint(p, e, last);
  if (
    last &&
    now - d.t < 380 &&
    Math.hypot(q.x - last.x, q.y - last.y) < 10 * k
  ) {
    finishDraft();
    return;
  }
  if (
    ((d.tool === "tape" && ui.tapeMode === "line") ||
      d.tool === "wall" ||
      d.tool === "area") &&
    d.pts.length >= 3 &&
    Math.hypot(q.x - d.pts[0].x, q.y - d.pts[0].y) < 9 * k
  ) {
    d.closed = true;
    finishDraft();
    return;
  }
  if (last && Math.hypot(q.x - last.x, q.y - last.y) < 1e-6) {
    d.t = now;
    return;
  }
  d.pts.push(q);
  d.t = now;
  if (
    (d.tool === "measure" ||
      (d.tool === "tape" &&
        (ui.tapeMode === "rect" || ui.tapeMode === "arrow"))) &&
    d.pts.length === 2
  ) {
    finishDraft();
    return;
  }
  updateHint();
  draw();
}
async function finishDraft() {
  const d = ui.draft;
  if (!d) return;
  ui.draft = null;
  ui.cursor = null;
  const sh = S();
  if (d.tool === "area") {
    finishArea(d);
    return;
  }
  if (d.pts.length < 2) {
    updateHint();
    draw();
    return;
  }
  if (d.tool === "tape") {
    const mode = ui.tapeMode,
      id = uid();
    let mk = {
      id,
      ref: id,
      type: ui.tape,
      pts: d.pts,
      closed: !!d.closed,
      kind: "line",
      status: sh.kind === "daily" ? "laid" : "planned",
      damaged: false,
      laid: sh.kind === "daily" ? today() : "",
      note: "",
    };
    if (mode === "rect") {
      const [a, b] = d.pts;
      if (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6) {
        updateHint();
        draw();
        return;
      }
      mk.pts = [
        { x: a.x, y: a.y },
        { x: b.x, y: a.y },
        { x: b.x, y: b.y },
        { x: a.x, y: b.y },
      ];
      mk.closed = true;
    } else if (mode === "aisle") {
      mk.kind = "aisle";
      mk.width = ui.aisleW * upm(sh);
      mk.closed = false;
    } else if (mode === "arrow") {
      mk.kind = "arrow";
      mk.pts = d.pts.slice(0, 2);
      mk.closed = false;
    }
    checkpoint();
    sh.marks.push(mk);
    ui.sel = [];
    record(
      "Tape added",
      tapeOf(mk.type).n +
        ", " +
        (mode === "arrow" ? "arrow" : fmtLen(markTape(mk))),
    );
    renderAll();
    return;
  }
  if (d.tool === "wall") {
    checkpoint();
    const id = uid(),
      dm = DM(sh);
    dm.fixed = dm.fixed || [];
    dm.fixed.push({
      id,
      t: "wall",
      label: "Wall",
      pts: d.pts,
      closed: !!d.closed,
      th: ui.wall.th * upm(sh),
      c: "#4A4F66",
      locked: false,
    });
    ui.sel = [];
    record("Drawing: wall added", fmtLen(polyLen(d.pts)));
    renderAll();
    return;
  }
  if (d.tool === "route") {
    checkpoint();
    const id = uid(),
      R = ui.route;
    const n =
      R.name.trim() ||
      (R.who === "walk" ? "Walking route " : "Vehicle route ") +
        (sh.routes.length + 1);
    sh.routes.push({
      id,
      ref: id,
      name: n,
      who: R.who,
      trips: Math.max(0.1, Number(R.trips) || 1),
      per: R.per,
      pts: d.pts,
    });
    record("Route traced", n + ", " + fmtLen(polyLen(d.pts)));
    ui.tab = "move";
    renderAll();
    return;
  }
  if (d.tool === "measure") {
    const L = polyLen(d.pts),
      m = mpu();
    draw();
    const r = await modal(
      "Measured distance",
      `<p style="margin-top:0">${m ? `This line is <b>${fmtLen(L)}</b> at the current scale.` : `This line is <b>${Math.round(L)} drawing units</b>. No scale is set yet.`}</p>
<label class="f">To set the scale, enter the real length of this line in metres<input name="m" type="number" min="0.01" step="0.01" placeholder="e.g. 12.5"></label>
<p class="small muted">Pick something you know: a building column grid, a conveyor length, a door width. Scale applies to every sheet that uses this drawing.</p>`,
      "Set scale",
      { cancel: "Close" },
    );
    const v = Number(r?.m);
    if (r && v > 0) {
      checkpoint();
      const did = S().drawing,
        prev = DM().mpu;
      DM().mpu = v / L;
      record("Scale set", `${v} m over a measured line`);
      const sheets = P.sheets.filter((s) => s.drawing === did),
        n =
          sheets.reduce((a, s) => a + s.objects.length, 0) +
          (DM().fixed || []).length;
      if (n) {
        const q = await modal(
          "Resize items to match the new scale?",
          `<p style="margin-top:0">${n} item${n > 1 ? "s and marked areas are" : " or marked area is"} already on this drawing (walls and fixed objects count too). Resize ${n > 1 ? "them" : "it"} so sizes are true metres?</p><p class="small muted">${prev ? "Sizes stay as real metres at the new scale." : "Items placed before a scale was set were drawn at an assumed size, so this is usually what you want."} Positions do not move.</p>`,
          "Resize",
          { cancel: "Leave sizes alone" },
        );
        if (q) {
          const f = (prev || 1 / 8) / DM().mpu;
          for (const s of sheets)
            for (const o of s.objects) {
              o.w *= f;
              o.h *= f;
            }
          // aisle widths are drawing units too: they scale with the items
          for (const s of sheets)
            for (const m of s.marks) if (m.kind === "aisle") m.width *= f;
          for (const o of DM().fixed || []) {
            if (o.t === "wall") o.th *= f;
            else {
              o.w *= f;
              o.h *= f;
              if (o.t === "text") o.fs *= f;
            }
          }
          if (STD().drawing === did)
            for (const rv of Object.values(P.revisions)) {
              for (const o of rv.objects) {
                o.w *= f;
                o.h *= f;
              }
              for (const m of rv.marks || [])
                if (m.kind === "aisle") m.width *= f;
            }
          record("Items resized to scale", "x" + n2(f));
        }
      }
      toast(`Scale set: ${fmtLen(L)} on the drawing.`);
      renderAll();
    } else draw();
  }
}
function cancelDraft() {
  ui.draft = null;
  ui.cursor = null;
  updateHint();
  draw();
}
function updateHint() {
  const h = $("#hint"),
    d = ui.draft,
    t = ui.tool;
  if (t === "select") {
    h.hidden = true;
    return;
  }
  h.hidden = false;
  const msg = {
    tape: {
      line: "Click to lay tape. Double-click, Enter or right-click to finish. Click the first point to close a shape. Shift keeps lines straight.",
      rect: "Click two opposite corners of the box.",
      aisle:
        "Click along the centre of the aisle. Double-click or press Enter to finish. Both edge lines are drawn at the width you set.",
      arrow: "Click the tail, then the point of the arrow.",
    }[ui.tapeMode],
    datum:
      "Click the point all marking dimensions are measured from, such as a column or a door frame.",
    route:
      "Click along the path taken. Double-click, Enter or right-click to finish. Shift keeps lines straight.",
    wall: "Click along the wall. Double-click, Enter or right-click to finish. Click the first point to close a room. Shift keeps it straight.",
    measure: "Click two points of a distance you know.",
    area: "Click each corner of the zone or line. Click the first corner, double-click or press Enter to close it. Shift keeps edges straight.",
    doc: "Click the drawing where the document lives.",
    tag: "Click the drawing where the red tag belongs.",
    action: "Click the drawing where the action belongs.",
    taskat:
      "Click where the task is done. Its walk to the items it uses starts and ends here.",
  }[t];
  h.innerHTML = `<span>${msg}</span>${d && d.pts.length > 1 && t !== "measure" ? '<button class="pri" id="hFin">Finish</button>' : ""}${d && d.pts.length ? '<button id="hCan">Cancel</button>' : ""}<button id="hDone">Done</button>`;
  $("#hFin") && ($("#hFin").onclick = finishDraft);
  $("#hCan") && ($("#hCan").onclick = cancelDraft);
  $("#hDone").onclick = () => setTool("select");
}
