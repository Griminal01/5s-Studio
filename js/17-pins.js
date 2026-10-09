"use strict";
/* ============ pins on the drawing: actions and documents ============ */
const PIN = {
  tag: { col: "#D3401D", txt: "#fff", tool: "tag", list: () => P.tags },
  act: {
    col: "#202C86",
    txt: "#FEC20F",
    tool: "action",
    list: () => P.actions,
  },
  doc: { col: "#0E7C86", txt: "#fff", tool: "doc", list: () => P.documents },
};
const pinObj = (pk, id) => PIN[pk].list().find((x) => x.id === id);
const pinLabel = (pk, o) =>
  pk === "doc" ? docNo(o) : pk === "tag" ? tagNo(o) : actNo(o);
function pinList(sh) {
  const did = sh.drawing,
    out = [];
  if (ui.layers.pins)
    for (const t of P.tags)
      if (t.x != null && t.drawing === did && t.status !== "Closed")
        out.push({ k: "tag", o: t });
  if (ui.layers.pins)
    for (const a of P.actions)
      if (
        a.x != null &&
        a.drawing === did &&
        !["Done", "Cancelled"].includes(a.status)
      )
        out.push({ k: "act", o: a });
  if (ui.layers.docs)
    for (const d of P.documents)
      if (d.x != null && d.drawing === did && d.status !== "Withdrawn")
        out.push({ k: "doc", o: d });
  return out;
}
function pinSVG(pn, k) {
  const o = pn.o,
    def = PIN[pn.k],
    label = pinLabel(pn.k, o),
    col = def.col,
    od =
      pn.k === "doc"
        ? docOverdue(o)
        : pn.k === "tag"
          ? tagOverdue(o)
          : actOverdue(o);
  const w = (label.length * 5.8 + 10) * k,
    h = 14 * k,
    bx = o.x + 6 * k,
    by = o.y - 8 * k - h;
  return `<g data-t="pin" data-pk="${esc(pn.k)}" data-id="${esc(o.id)}"><title>${esc(label + ": " + o.title)}</title><line x1="${o.x}" y1="${o.y}" x2="${bx}" y2="${by + h}" stroke="${col}" stroke-width="${1.6 * k}"/><circle cx="${o.x}" cy="${o.y}" r="${3.2 * k}" fill="${col}" stroke="#fff" stroke-width="${1.2 * k}"/><rect x="${bx}" y="${by}" width="${w}" height="${h}" rx="${3 * k}" fill="${col}" stroke="${od ? "#FEC20F" : "#fff"}" stroke-width="${od ? 2.4 * k : 1.2 * k}"/><text x="${bx + w / 2}" y="${by + h / 2}" font-size="${9.4 * k}" font-family="Segoe UI,system-ui,sans-serif" font-weight="700" fill="${def.txt}" text-anchor="middle" dominant-baseline="central" pointer-events="none">${label}</text></g>`;
}
function openPin(pk, id) {
  pk === "doc" ? editDocument(id) : pk === "tag" ? editTag(id) : editAction(id);
}
function placePin(p) {
  const kind = ui.tool === "doc" ? "doc" : ui.tool === "tag" ? "tag" : "act",
    sh = S();
  if (ui.placing) {
    const it = pinObj(ui.placing.kind, ui.placing.id);
    const k2 = ui.placing.kind;
    ui.placing = null;
    setTool("select");
    if (it) {
      checkpoint();
      Object.assign(it, {
        x: n2(p.x),
        y: n2(p.y),
        drawing: sh.drawing,
        sheet: it.sheet || sh.id,
      });
      record("Pinned", pinLabel(k2, it));
      renderAll();
    }
    return;
  }
  setTool("select");
  const at = {
    x: n2(p.x),
    y: n2(p.y),
    drawing: sh.drawing,
    sheet: sh.id,
  };
  kind === "doc"
    ? newDocument(at)
    : kind === "tag"
      ? newTag(at)
      : newAction(at);
}
function startPinning(kind, id) {
  if (kind === "doc") return startDocPin(id); // documents are pinned on their own map
  ui.placing = { kind, id };
  if (ui.view !== "layout") setView("layout");
  setTool(PIN[kind].tool);
  toast("Click the drawing to place the pin.");
}
function showOnLayout(o) {
  if (!o || o.x == null) return;
  const sh =
    P.sheets.find((s) => s.id === o.sheet && s.drawing === o.drawing) ||
    P.sheets.find((s) => s.drawing === o.drawing) ||
    STD();
  if (ui.view !== "layout") setView("layout");
  if (sh.id !== P.active) openSheet(sh.id);
  ensureVisible(o.x, o.y);
  drawNow();
  centreOn(o.x, o.y);
}
