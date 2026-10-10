"use strict";
/* ============ labels: names that stay readable at any zoom ============
   Every name on the drawing (items, marked areas, fixed equipment, lines and zones) is placed here,
   in one pass, on top of everything else. All sizes are in screen pixels (world units / k), so the
   screen, Present mode and the A3 print behave the same way.

   For each item, in this order:
   1. Inside it: the whole name, wrapped onto up to three lines and turned along the long side,
      at the largest size that fits (never smaller than 8 px).
   2. Otherwise a callout: a small tag in free floor space close by, with a short leader line back to
      the item, in the item's colour. Tags never overlap each other or another name. A crowded area
      does not get tags strung across it: a tag only goes on empty floor within reach of its item
      (bigger items first), never over another item, and a name repeated on many items (bins,
      stools) only where it fits right beside one.
      The rest show when you zoom in, point at an item or select it; LABEL.hidden counts them and
      the note by the zoom buttons says so. Layers > "All names" places every tag, however far.
   Line and zone names pick a clear spot along their edge. Nothing is cut short with "...".
   The Layers menu has a "Names on the drawing" switch. */
const LABEL = { shown: new Set(), hidden: 0 }; // ids whose full name is on the drawing right now
const LAB_MIN = 8, // smallest text inside an item, px
  LAB_CALL = 11; // text size of a callout, px
const labW = (s, fs, bold = false) => s.length * fs * (bold ? 0.62 : 0.58);
const labOv = (a, b) => {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
    h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
};
const labBox = (cx, cy, w, h) => ({
  x0: cx - w / 2,
  x1: cx + w / 2,
  y0: cy - h / 2,
  y1: cy + h / 2,
});
// wrap on spaces into at most maxLines lines of maxChars; null if a word is too long
function labWrap(text, maxLines, maxChars) {
  if (maxChars < 2) return null;
  const words = String(text).trim().split(/\s+/),
    lines = [];
  let cur = "";
  for (const w of words) {
    if (w.length > maxChars) return null;
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length <= maxLines ? lines : null;
}
// the biggest text that fits a name inside a box of long x thick pixels: { fs, lines } or null
function labInside(text, long, thick, startFs, maxLines, minFs = LAB_MIN) {
  for (let fs = Math.round(startFs); fs >= minFs; fs--) {
    const lh = fs * 1.2,
      n = Math.min(maxLines, Math.max(1, Math.floor((thick - 2) / lh)));
    const lines = labWrap(text, n, Math.floor(long / (fs * 0.58)));
    if (lines) return { fs, lines, lh };
  }
  return null;
}
const labAngle = (a) => {
  let t = (((a % 360) + 540) % 360) - 180 + 0; // -180..180
  if (t > 90) t -= 180;
  else if (t <= -90) t += 180;
  return t;
};

function labelsSVG(sh, k, o) {
  LABEL.shown.clear();
  LABEL.hidden = 0;
  const L = ui.layers;
  if (L.labels === false) return "";
  const dm = DM(sh),
    boost = ui.textBoost || 1,
    W = dm.w / k,
    H = dm.h / k,
    // a drawing that is small on screen (a phone, zoomed right out) gets smaller names
    zs = ui.textBoost ? 1 : Math.min(1, Math.max(0.72, W / 1000)),
    minFs = Math.max(6, Math.round(LAB_MIN * zs)),
    base = LAB_CALL * boost * zs;
  const ents = [];
  if (L.objects)
    for (const z of sh.objects) {
      if (!z.label) continue;
      if (z.kind === "item" && ui.hiddenCategories.has(itemCategoryId(z)))
        continue;
      const bb = boxOf(corners(z));
      ents.push({
        id: z.id,
        text: z.label,
        o: z,
        item: z.kind === "item",
        col: z.c,
        bb: { x0: bb.x0 / k, x1: bb.x1 / k, y0: bb.y0 / k, y1: bb.y1 / k },
      });
    }
  if (L.fixed && !(ui.editDrawing && !o.export && !ui.printing))
    for (const f of dm.fixed || []) {
      if (f.t !== "block" || !f.label) continue;
      const bb = boxOf(corners(f));
      ents.push({
        id: f.id,
        text: f.label,
        o: f,
        item: true,
        fixed: true,
        col: f.c,
        bb: { x0: bb.x0 / k, x1: bb.x1 / k, y0: bb.y0 / k, y1: bb.y1 / k },
      });
    }
  const bodies = ents.filter((e) => e.item).map((e) => e.bb), // things a tag should not sit on
    placed = []; // names already on the drawing
  const hitsBody = (box, self) => {
    let a = 0;
    for (const b of bodies) if (b !== self) a += labOv(box, b);
    return a;
  };
  const hitsPlaced = (box) => placed.some((p) => labOv(box, p) > 0);
  let out = "";

  /* lines and zones: a clear spot along their edge, drawn first so items avoid them */
  if (L.areas) {
    const A = o.scoped ? scopeArea() : null;
    for (const a of areaListFor(sh, A)) {
      const line = isLine(a),
        text = areaLabelText(a, sh),
        fs = (line ? 14 : 12.5) * boost * zs,
        w = labW(text, fs, true) + 6,
        h = fs * 1.4,
        xs = a.pts.map((p) => p.x / k),
        ys = a.pts.map((p) => p.y / k),
        x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        y1 = Math.max(...ys),
        top = a.pts.reduce((b, p) => (p.y < b.y ? p : b), a.pts[0]),
        tx = top.x / k,
        ty = top.y / k;
      if (!line && x1 - x0 < w * 0.9) continue; // too small to carry its name; zoom in to see it
      // centres to try: where it always sat, then above its edge, the other corners, below
      const tries = line
        ? [
            [(x0 + x1) / 2, ty + 1],
            [(x0 + x1) / 2, ty - h / 2 - 4],
            [(x0 + x1) / 2, y1 - h / 2 - 4],
            [x0 + w / 2 + 8, ty + h],
            [x1 - w / 2 - 8, ty + h],
          ]
        : [
            [tx + 8 + w / 2, ty + 14],
            [tx + 8 + w / 2, ty - h / 2 - 3],
            [x1 - 8 - w / 2, ty + 14],
            [x0 + 8 + w / 2, y1 - 14],
            [x1 - 8 - w / 2, y1 - 14],
            [tx + 8 + w / 2, ty + 14 + h],
          ];
      let best = null;
      tries.forEach(([cx, cy], i) => {
        const box = labBox(cx, cy, w, h);
        if (box.x0 < 2 || box.x1 > W - 2 || box.y0 < 2 || box.y1 > H - 2)
          return;
        const cost = hitsBody(box, null) + (hitsPlaced(box) ? 1e6 : 0) + i * 30;
        if (!best || cost < best.cost) best = { cost, box, cx, cy, i };
      });
      if (!best) {
        const [cx, cy] = tries[0];
        best = { box: labBox(cx, cy, w, h), cx, cy };
      }
      placed.push(best.box);
      // a line's name sits on or by its dashed edge (as does a zone's moved above its edge):
      // a white backing breaks the edge so the name does not read as crossed out
      if (line || best.i === 1) {
        const b = best.box;
        out += `<rect x="${(b.x0 - 2) * k}" y="${b.y0 * k}" width="${(b.x1 - b.x0 + 4) * k}" height="${(b.y1 - b.y0) * k}" rx="${3 * k}" fill="#fff" fill-opacity=".92" pointer-events="none"/>`;
      }
      out += txt(best.cx * k, best.cy * k, text, fs * k, k, {
        fill: a.color,
        w: 700,
      });
    }
  }

  /* pass 1: names that fit inside their item */
  const callouts = [];
  for (const e of ents) {
    const z = e.o,
      wpx = z.w / k,
      hpx = z.h / k;
    if (e.item) {
      const tall = hpx > wpx * 1.25,
        long = (tall ? hpx : wpx) - 6,
        thick = (tall ? wpx : hpx) - 4,
        start = Math.min(14, Math.max(11, thick * 0.3)) * boost * zs,
        fit = labInside(e.text, long, thick, start, 3, minFs);
      if (fit) {
        const th = labAngle(z.a + (tall ? 90 : 0)),
          tw = Math.max(...fit.lines.map((l) => labW(l, fit.fs))),
          thh = fit.lines.length * fit.lh,
          r = (th * Math.PI) / 180,
          hx = (Math.abs(Math.cos(r)) * tw + Math.abs(Math.sin(r)) * thh) / 2,
          hy = (Math.abs(Math.sin(r)) * tw + Math.abs(Math.cos(r)) * thh) / 2;
        placed.push({
          x0: z.x / k - hx,
          x1: z.x / k + hx,
          y0: z.y / k - hy,
          y1: z.y / k + hy,
        });
        let g = "";
        fit.lines.forEach((ln, i) => {
          g += txt(
            0,
            (i - (fit.lines.length - 1) / 2) * fit.lh * k,
            ln,
            fit.fs * k,
            k,
          );
        });
        out += `<g transform="translate(${z.x} ${z.y}) rotate(${th})">${g}</g>`;
        LABEL.shown.add(e.id);
        continue;
      }
    } else {
      // a marked or keep-clear area: its name goes in the top left corner
      const fs0 = Math.min(13, LAB_CALL) * boost * zs;
      for (let fs = Math.round(fs0); fs >= minFs; fs--) {
        const w = labW(e.text, fs) + 6;
        if (w <= wpx - 8 && hpx > fs * 1.8) {
          const ox = -z.w / 2 + 4 * k,
            oy = -z.h / 2 + fs * 0.9 * k;
          let t = txt(ox, oy, e.text, fs * k, k, { anchor: "start" });
          if (angDiff(z.a, 180) < 89.9)
            t = `<g transform="rotate(180)">${t}</g>`;
          out += `<g transform="translate(${z.x} ${z.y}) rotate(${z.a})">${t}</g>`;
          placed.push(
            labBox(
              e.bb.x0 + 4 + labW(e.text, fs) / 2,
              e.bb.y0 + fs,
              labW(e.text, fs) + 6,
              fs * 1.4,
            ),
          );
          LABEL.shown.add(e.id);
          e.done = true;
          break;
        }
      }
      if (e.done) continue;
    }
    // fixed structure (columns, panels) only shows its name when it fits inside; no tags for it
    if (!e.fixed) callouts.push(e);
  }

  /* pass 2: callouts into the nearest free floor space: bigger items first, then reading order */
  const all = !!L.allNames,
    area = (e) => (e.bb.x1 - e.bb.x0) * (e.bb.y1 - e.bb.y0),
    seen = new Map();
  for (const e of callouts) seen.set(e.text, (seen.get(e.text) || 0) + 1);
  callouts.sort(
    (p, q) =>
      (all ? 0 : area(q) - area(p)) || p.bb.y0 - q.bb.y0 || p.bb.x0 - q.bb.x0,
  );
  const DIRS = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [1, -1],
    [-1, -1],
    [1, 1],
    [-1, 1],
  ];
  let tags = "",
    leaders = "";
  // tags would bury a drawing that is only a few hundred pixels wide: zoom in, or tap an item
  const held = W < 650 && !ui.textBoost;
  if (held) LABEL.hidden = callouts.length;
  for (const e of held ? [] : callouts) {
    // how far a tag may sit from its item: right beside it for a name on many items, near otherwise
    const reach = all ? 130 : seen.get(e.text) >= 4 ? 4 : 36;
    const fs = base,
      w = labW(e.text, fs) + 10,
      h = fs * 1.5 + 2,
      b = e.bb,
      cx = (b.x0 + b.x1) / 2,
      cy = (b.y0 + b.y1) / 2;
    let best = null;
    for (const d of [4, 18, 36, 60, 90, 130].filter((d) => d <= reach)) {
      for (let di = 0; di < DIRS.length; di++) {
        const [dx, dy] = DIRS[di],
          px = dx === 0 ? cx : dx > 0 ? b.x1 + d + w / 2 : b.x0 - d - w / 2,
          py = dy === 0 ? cy : dy > 0 ? b.y1 + d + h / 2 : b.y0 - d - h / 2,
          box = labBox(px, py, w, h);
        if (box.x0 < 2 || box.x1 > W - 2 || box.y0 < 2 || box.y1 > H - 2)
          continue;
        if (hitsPlaced(box)) continue;
        // a tag sits on empty floor, never over another item (it would hide what the layout is about)
        if (!all && hitsBody(box, b) > 0) continue;
        const cost = d * 1.2 + di * 3 + hitsBody(box, b) * 0.05;
        if (!best || cost < best.cost) best = { cost, box, px, py, d };
      }
      // the nearest ring with a clean spot wins; only look further out if it is crowded
      if (best && best.cost < d * 1.2 + 24) break;
    }
    if (!best) {
      LABEL.hidden++;
      continue;
    }
    placed.push(best.box);
    const col = e.col || "#202C86",
      bx = best.box;
    if (best.d > 4) {
      const ax = Math.min(Math.max(cx, bx.x0), bx.x1),
        ay = Math.min(Math.max(cy, bx.y0), bx.y1);
      leaders += `<line x1="${cx * k}" y1="${cy * k}" x2="${ax * k}" y2="${ay * k}" stroke="${col}" stroke-width="${1.4 * k}"/><circle cx="${cx * k}" cy="${cy * k}" r="${2.6 * k}" fill="${col}" stroke="#fff" stroke-width="${k}"/>`;
    }
    tags += `<rect x="${bx.x0 * k}" y="${bx.y0 * k}" width="${(bx.x1 - bx.x0) * k}" height="${(bx.y1 - bx.y0) * k}" rx="${3.5 * k}" fill="#fff" fill-opacity=".95" stroke="${col}" stroke-width="${1.4 * k}"/>${txt(best.px * k, best.py * k, e.text, fs * k, k).replace(/stroke="#fff" stroke-width="[^"]*"/, 'stroke="none"')}`;
    LABEL.shown.add(e.id);
  }
  return `<g class="names" pointer-events="none">${out}${leaders}${tags}</g>`;
}
