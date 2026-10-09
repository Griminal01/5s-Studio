"use strict";
/* ============ labels for a label printer ============ */
// Each label is its own page, sized to the label, so a label printer driver
// (Brother P-touch, Dymo, Zebra...) cuts or feeds one label per page. The size
// is the label as it comes out: length along the tape x width across the tape.
// For software that does its own layout, export the CSV instead.

const LABEL_PRESETS = [
  ["tze12", "Brother TZe 12 mm tape, 40 mm long", 40, 12],
  ["tze18", "Brother TZe 18 mm tape, 50 mm long", 50, 18],
  ["tze24", "Brother TZe 24 mm tape, 70 mm long", 70, 24],
  ["tze36", "Brother TZe 36 mm tape, 90 mm long", 90, 36],
  ["dymo99010", "Dymo LabelWriter 99010, 89 x 28 mm", 89, 28],
  ["dymo99012", "Dymo LabelWriter 99012, 89 x 36 mm", 89, 36],
  ["dymo11354", "Dymo LabelWriter 11354, 57 x 32 mm", 57, 32],
  ["zebra100x50", "Zebra 100 x 50 mm", 100, 50],
  ["custom", "Custom size", 0, 0],
];
const LABEL_KINDS = [
  ["slot", "Slot labels (one per position)"],
  ["board", "Board header labels"],
  ["kanban", "Kanban labels (slots with a min / max)"],
];
const labelSize = (L) => {
  const p = LABEL_PRESETS.find((x) => x[0] === L.size);
  return p && p[0] !== "custom"
    ? { w: p[2], h: p[3] }
    : { w: Math.max(10, L.w), h: Math.max(8, L.h) };
};

/* split words into n lines of similar length */
function splitLines(words, n) {
  if (n <= 1 || words.length < 2) return [words.join(" ")];
  const total = words.join(" ").length,
    target = total / n,
    lines = [];
  let cur = "";
  for (const w of words) {
    if (
      cur &&
      cur.length + 1 + w.length > target * 1.15 &&
      lines.length < n - 1
    ) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  lines.push(cur);
  return lines;
}
/* the largest font (in mm) that fits the text in a w x h mm box */
function fitText(text, w, h, maxFs, maxLines = 2) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  let best = { fs: 0, lines: [String(text)] };
  for (let n = 1; n <= Math.min(maxLines, Math.max(1, words.length)); n++) {
    const lines = splitLines(words, n),
      longest = Math.max(...lines.map((l) => l.length), 1),
      fs = Math.min(maxFs, h / (lines.length * 1.12), w / (longest * 0.65));
    if (fs > best.fs + 0.01) best = { fs, lines };
  }
  best.fs = Math.max(1.5, best.fs);
  return best;
}
const mm = (v) => Math.round(v * 100) / 100 + "mm";
const lines = (f) => f.lines.map(esc).join("<br>");

function labelHTML(item, W, H, opt) {
  const { kind, b, s, i } = item,
    pad = Math.max(0.8, Math.min(2, H * 0.07)),
    iw = W - pad * 2,
    ih = H - pad * 2,
    compact = H < 16,
    gap = 1.2;
  const box = (inner) =>
    `<div class="lbl" style="width:${mm(W)};height:${mm(H)};padding:${mm(pad)}">${inner}</div>`;
  const fs = (f) => `font-size:${mm(f.fs)}`;
  const extras = [];
  if (s && opt.showQty && s.qty) extras.push(s.qty + " off");
  if (s && opt.showType) extras.push(s.type);
  if (s && s.pn) extras.push(s.pn);
  if (kind === "board") {
    const cw = iw * 0.4,
      code = fitText(boardCode(b), cw, ih, ih * 0.62, 1),
      nm = fitText(
        b.name,
        iw - cw - gap,
        ih * (compact ? 0.95 : 0.66),
        ih * 0.5,
        H >= 24 ? 3 : 2,
      ),
      sub = [b.type, b.owner && "Owner " + b.owner].filter(Boolean).join(" · "),
      sf = fitText(sub, iw - cw - gap, ih * 0.2, 3, 1);
    return box(
      `<div class="lc" style="width:${mm(cw)}"><span style="${fs(code)}">${esc(boardCode(b))}</span></div><div class="lr" style="width:${mm(iw - cw - gap)}"><span class="ln" style="${fs(nm)}">${lines(nm)}</span>${compact ? "" : `<span class="lx" style="${fs(sf)}">${esc(sub)}</span>`}</div>`,
    );
  }
  const code = slotCode(b, i),
    num = pad2(i + 1);
  if (kind === "kanban") {
    const cw = iw * 0.34,
      nameW = iw - cw - gap,
      nm = fitText(
        s.name,
        nameW,
        ih * (compact ? 0.95 : 0.6),
        ih * 0.42,
        H >= 24 ? 3 : 2,
      ),
      mn = s.min ? "MIN " + s.min : "",
      mx = s.max ? "MAX " + s.max : "",
      ex = [s.pn, b.name].filter(Boolean).join(" · ");
    const cf = fitText(code, cw, compact ? ih * 0.45 : ih * 0.3, ih * 0.3, 1),
      mf = Math.min(ih * 0.22, cw / 6.5);
    return box(
      `<div class="lr" style="width:${mm(nameW)}"><span class="ln" style="${fs(nm)}">${lines(nm)}</span>${compact || !ex ? "" : `<span class="lx" style="font-size:${mm(Math.min(ih * 0.15, 2.6))}">${esc(clipText(ex, Math.floor(nameW / (Math.min(ih * 0.15, 2.6) * 0.5))))}</span>`}</div><div class="lc kb" style="width:${mm(cw)}"><span style="${fs(cf)}">${esc(code)}</span>${compact ? "" : `<span class="mm" style="font-size:${mm(mf)}">${esc(mn)}</span><span class="mm" style="font-size:${mm(mf)}">${esc(mx)}</span>`}</div>`,
    );
  }
  // slot label: the position number is big, the name sits beside it
  const cw = compact ? iw * 0.36 : iw * 0.3,
    nameW = iw - cw - gap,
    hasX = extras.length > 0 && !compact,
    nm = fitText(
      s.name,
      nameW,
      ih * (hasX ? 0.68 : 0.95),
      ih * 0.5,
      H >= 24 ? 3 : 2,
    );
  let left;
  if (compact) {
    const cf = fitText(code, cw, ih, ih * 0.6, 1);
    left = `<span style="${fs(cf)}">${esc(code)}</span>`;
  } else {
    const top = fitText(boardCode(b), cw, ih * 0.26, ih * 0.22, 1),
      big = fitText(num, cw, ih * 0.66, ih * 0.62, 1);
    left = `<span class="l1" style="${fs(top)}">${esc(boardCode(b))}</span><span class="l2" style="${fs(big)}">${esc(num)}</span>`;
  }
  const xf = Math.min(ih * 0.17, 3);
  return box(
    `<div class="lc" style="width:${mm(cw)}">${left}</div><div class="lr" style="width:${mm(nameW)}"><span class="ln" style="${fs(nm)}">${lines(nm)}</span>${hasX ? `<span class="lx" style="font-size:${mm(xf)}">${esc(clipText(extras.join(" · "), Math.floor(nameW / (xf * 0.5))))}</span>` : ""}</div>`,
  );
}

/* which labels to make */
function labelItems(boardId, kinds) {
  const out = [],
    boards = boardId ? P.boards.filter((b) => b.id === boardId) : P.boards;
  for (const b of boards) {
    if (kinds.board) out.push({ kind: "board", b });
    b.slots.forEach((s, i) => {
      if (kinds.slot) out.push({ kind: "slot", b, s, i });
      if (kinds.kanban && isKanban(s)) out.push({ kind: "kanban", b, s, i });
    });
  }
  return out;
}
function labelsHTML(items, L) {
  const { w, h } = labelSize(L),
    copies = Math.max(1, Math.min(20, Math.round(L.copies) || 1));
  let html = "";
  for (const it of items) {
    const one = labelHTML(it, w, h, L);
    for (let c = 0; c < copies; c++) html += one;
  }
  return html;
}

/* the "Print labels" dialog, with a live preview */
async function labelDialog(boardId) {
  if (!P.boards.length) return void toast("Add a board first.");
  // work on a copy: the project's label settings only change when you print
  const L = clone(P.labels),
    kinds = { slot: true, board: false, kanban: true };
  let bid = boardId || "";
  const html = `<div class="row3"><label class="f">Boards<select name="board">${optsKV([["", "All boards"], ...P.boards.map((b) => [b.id, boardCode(b) + " " + b.name])], bid)}</select></label><label class="f">Label size<select name="size">${LABEL_PRESETS.map((p) => `<option value="${esc(p[0])}"${p[0] === L.size ? " selected" : ""}>${esc(p[1])}</option>`).join("")}</select></label><label class="f">Copies of each<input name="copies" type="number" min="1" max="20" step="1" value="${esc(L.copies)}"></label></div>
    <div class="row2" id="lblCustom"><label class="f">Label length (mm)<input name="w" type="number" min="10" step="1" value="${esc(L.w)}"></label><label class="f">Label height or tape width (mm)<input name="h" type="number" min="8" step="1" value="${esc(L.h)}"></label></div>
    <div class="chkrow">${LABEL_KINDS.map(([k, n]) => `<label class="chk"><input type="checkbox" name="k_${k}"${kinds[k] ? " checked" : ""}>${esc(n)}</label>`).join("")}<label class="chk"><input type="checkbox" name="showQty"${L.showQty ? " checked" : ""}>Show quantity</label><label class="chk"><input type="checkbox" name="showType"${L.showType ? " checked" : ""}>Show type</label></div>
    <p class="small muted" id="lblInfo"></p><div id="lblPrev" class="lblprev"></div>
    <div class="btns"><button type="button" id="lblCsv">Export CSV for label software</button><button type="button" id="lblTest">Print one test label</button></div>
    <p class="small muted">Set your label printer as the printer, and the paper to the same size as the label (a custom size for continuous tape). Print one test label first. If the printer shrinks the label, turn off "Fit to page" in the print dialog and set scale to 100%.</p>`;
  const read = () => {
    const f = (n) => $("#dlgBody [name=" + n + "]");
    L.size = f("size").value;
    L.w = Number(f("w").value) || L.w;
    L.h = Number(f("h").value) || L.h;
    L.copies = Math.max(1, Math.round(Number(f("copies").value)) || 1);
    L.showQty = f("showQty").checked;
    L.showType = f("showType").checked;
    bid = f("board").value;
    for (const [k] of LABEL_KINDS) kinds[k] = f("k_" + k).checked;
  };
  const draw = () => {
    read();
    $("#lblCustom").hidden = L.size !== "custom";
    const items = labelItems(bid, kinds),
      { w, h } = labelSize(L),
      shown = items.slice(0, 24);
    $("#lblInfo").textContent =
      `${items.length} label${items.length === 1 ? "" : "s"}${L.copies > 1 ? " x " + L.copies : ""} at ${w} x ${h} mm.${items.length > 24 ? " Showing the first 24." : ""}`;
    $("#lblPrev").innerHTML = shown
      .map((it) => labelHTML(it, w, h, L))
      .join("");
    return items;
  };
  const r = await modal("Print labels", html, "Print", {
    cls: "xwide",
    onOpen: () => {
      draw();
      const body = $("#dlgBody");
      body.addEventListener("input", draw);
      body.addEventListener("change", draw);
      body.addEventListener("click", (e) => {
        if (e.target.closest("#lblCsv")) csvBoards();
        if (e.target.closest("#lblTest")) {
          const items = draw();
          if (items.length) printLabels(items.slice(0, 1), L);
        }
      });
    },
  });
  if (!r) return;
  if (JSON.stringify(L) !== JSON.stringify(P.labels)) {
    checkpoint();
    P.labels = L;
    record("Label settings", labelSize(L).w + " x " + labelSize(L).h + " mm");
    save();
  }
  const items = labelItems(bid, kinds);
  if (!items.length)
    return void toast("No labels to print. Tick a label type.");
  printLabels(items);
}
function printLabels(items, L = P.labels) {
  const { w, h } = labelSize(L);
  printWithPage(
    labelsHTML(items, L),
    "labels",
    `size: ${w}mm ${h}mm; margin: 0`,
  );
}
