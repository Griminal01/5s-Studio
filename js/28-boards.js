"use strict";
/* ============ boards: shadow boards, cleaning stations, kanban racks ============ */
// A board is a place that holds a set of things (tools, cleaning kit, spares,
// changeover parts, kanban bins). Each board has numbered slots. The board code
// plus the slot number is the location code (e.g. SB-01-03). Boards print as a
// scaled layout, as 1:1 outlines to cut from, and as labels (see 29-labels.js).

const BOARD_TYPES = [
  "Shadow board",
  "Cleaning station",
  "Spares / kanban rack",
  "Changeover kit",
  "Tool store",
  "Other",
];
const BOARD_PREFIX = {
  "Shadow board": "SB",
  "Cleaning station": "CS",
  "Spares / kanban rack": "KB",
  "Changeover kit": "CO",
  "Tool store": "TS",
  Other: "BD",
};
// [type, default width mm, default height mm]
const SLOT_TYPES = [
  ["Tool", 160, 50],
  ["Cleaning tool", 220, 60],
  ["Spare part", 100, 70],
  ["Changeover part", 140, 90],
  ["Consumable", 100, 70],
  ["Kanban", 100, 70],
  ["Other", 100, 60],
];
const slotDefaults = (type) =>
  SLOT_TYPES.find((t) => t[0] === type) || SLOT_TYPES[0];
const isKanban = (s) => s.type === "Kanban" || s.min > 0 || s.max > 0;
const pad2 = (n) => String(n).padStart(2, "0");
const boardCode = (b) => b.code || "BD";
const slotCode = (b, i) => boardCode(b) + "-" + pad2(i + 1);

const blankSlot = (type = "Tool", name = "") => {
  const d = slotDefaults(type);
  return {
    id: uid(),
    name,
    type,
    pn: "",
    qty: 1,
    min: 0,
    max: 0,
    w: d[1],
    h: d[2],
    note: "",
  };
};
const nextBoardCode = (type) => {
  const pre = BOARD_PREFIX[type] || "BD",
    used = new Set(P.boards.map((b) => b.code));
  for (let n = 1; n < 100; n++)
    if (!used.has(pre + "-" + pad2(n))) return pre + "-" + pad2(n);
  return pre + "-" + uid().slice(-3);
};
const blankBoard = (type = BOARD_TYPES[0]) => ({
  id: uid(),
  no: 0,
  code: nextBoardCode(type),
  name: "",
  type,
  holder: "",
  owner: "",
  w: 1200,
  h: 800,
  note: "",
  slots: [],
});
const holderOf = (b) => STD().objects.find((o) => o.ref === b.holder);

/* ----- packing slots onto the board (rows, left to right, in order) ----- */
const BOARD_MARGIN = 20,
  BOARD_GAP = 14,
  BOARD_HEAD = 0;
function packBoard(b) {
  const out = [];
  let x = BOARD_MARGIN,
    y = BOARD_MARGIN + BOARD_HEAD,
    rowH = 0,
    maxX = 0;
  const inner = b.w - BOARD_MARGIN * 2;
  b.slots.forEach((s, i) => {
    const w = Math.min(s.w, inner);
    if (x > BOARD_MARGIN && x + w > b.w - BOARD_MARGIN) {
      x = BOARD_MARGIN;
      y += rowH + BOARD_GAP;
      rowH = 0;
    }
    out.push({ s, i, x, y, w, h: s.h, over: s.w > inner });
    x += w + BOARD_GAP;
    rowH = Math.max(rowH, s.h);
    maxX = Math.max(maxX, x - BOARD_GAP);
  });
  const needH = Math.round(y + rowH + BOARD_MARGIN);
  return { items: out, needH, fits: needH <= b.h, maxX };
}
function boardSVG(b, opt = {}) {
  const pk = packBoard(b),
    W = b.w,
    H = Math.max(b.h, pk.needH),
    fs = Math.max(8, Math.min(W, H) / 38);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="bsvg" role="img" aria-label="${esc(b.name)}">
    <rect x="0" y="0" width="${W}" height="${b.h}" fill="#fff" stroke="#1c2250" stroke-width="${fs / 5}"/>`;
  if (!pk.fits)
    s += `<rect x="0" y="${b.h}" width="${W}" height="${H - b.h}" fill="#fbe6e1" stroke="#c3361a" stroke-width="${fs / 8}" stroke-dasharray="${fs} ${fs / 2}"/><text x="${W / 2}" y="${b.h + fs * 1.4}" font-size="${fs}" text-anchor="middle" fill="#c3361a" font-family="Segoe UI,Arial,sans-serif" font-weight="700">Does not fit: board needs ${pk.needH} mm</text>`;
  for (const it of pk.items) {
    const round = it.s.type === "Kanban" || it.s.type === "Spare part";
    s += `<g><rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" rx="${round ? fs : fs / 3}" fill="${it.over ? "#fbe6e1" : "#eef0f6"}" stroke="#202c86" stroke-width="${fs / 6}" stroke-dasharray="${round ? "" : `${fs / 1.5} ${fs / 3}`}"/>
      <text x="${it.x + it.w / 2}" y="${it.y + it.h / 2 - fs * 0.25}" font-size="${fs * 1.5}" font-weight="700" text-anchor="middle" fill="#202c86" font-family="Segoe UI,Arial,sans-serif">${pad2(it.i + 1)}</text>
      <text x="${it.x + it.w / 2}" y="${it.y + it.h / 2 + fs * 1.1}" font-size="${fs * 0.9}" text-anchor="middle" fill="#1c2250" font-family="Segoe UI,Arial,sans-serif">${esc(clipText(it.s.name, Math.max(6, Math.floor(it.w / (fs * 0.52)))))}</text></g>`;
  }
  return s + "</svg>";
}
const clipText = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

/* ----- the Boards view ----- */
function renderBoards() {
  const el = $("#boardView"),
    slots = P.boards.reduce((n, b) => n + b.slots.length, 0),
    kb = P.boards.reduce((n, b) => n + b.slots.filter(isKanban).length, 0),
    nofit = P.boards.filter((b) => !packBoard(b).fits).length;
  let h = `<header><div><h2>Boards: shadow boards, cleaning stations and kanban racks</h2><p class="muted" style="margin:4px 0 0">What lives on each board, in numbered slots. Each slot gets a location code such as <b>SB-01-03</b>, ready to print on your label printer.</p></div>
    <div class="kpis"><div><b>${P.boards.length}</b><span>Boards</span></div><div><b>${slots}</b><span>Slots</span></div><div><b>${kb}</b><span>Kanban slots</span></div><div><b class="${nofit ? "c-bad" : ""}">${nofit}</b><span>Do not fit</span></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pri" id="bdNew">New board</button><button id="bdLabels">Print labels</button><button id="bdCsv">Export CSV</button></div></header>`;
  if (!P.boards.length)
    return void (el.innerHTML =
      h +
      `<div class="emptybox"><b>No boards yet</b>A board is anywhere a set of things has a place: a shadow board of changeover tools, a cleaning station, a kanban rack of spare parts. List the slots, check they fit, then print the labels. Open the example model line to see three finished boards.<div style="margin-top:14px"><button class="pri" id="bdNew2">New board</button> <button id="bdExample">Open the example model line</button></div></div>`);
  h += `<div class="bgrid">${P.boards
    .map((b) => {
      const pk = packBoard(b),
        ho = holderOf(b);
      return `<section class="block bcard" data-bid="${esc(b.id)}"><h3><span>${esc(boardCode(b))} · ${esc(b.name || "Board")}</span><span class="count">${b.slots.length} slots</span></h3>
      <div class="bprev">${boardSVG(b)}</div>
      <p class="small muted">${esc(b.type)} · ${b.w} × ${b.h} mm${pk.fits ? ` · slots use ${pk.needH} mm of the height` : ` · <b class="c-bad">needs ${pk.needH} mm high</b>`}${ho ? " · kept at " + esc(ho.label) : ""}${b.owner ? " · owner " + esc(b.owner) : ""}</p>
      <div class="btns"><button class="pri" data-bd="edit">Edit</button><button data-bd="labels">Labels</button><button data-bd="layout">Print layout</button><button data-bd="outlines">1:1 outlines (A4)</button><button data-bd="outlinesA3">(A3)</button>${ho ? '<button data-bd="show">Show on layout</button>' : ""}</div></section>`;
    })
    .join("")}</div>`;
  el.innerHTML = h;
}
$("#boardView").addEventListener("click", (e) => {
  if (e.target.closest("#bdNew,#bdNew2")) return void newBoard();
  if (e.target.closest("#bdExample")) return void loadExample();
  if (e.target.closest("#bdLabels")) return void labelDialog();
  if (e.target.closest("#bdCsv")) return void csvBoards();
  const card = e.target.closest("[data-bid]"),
    b = card && P.boards.find((x) => x.id === card.dataset.bid),
    a = e.target.closest("[data-bd]")?.dataset.bd;
  if (!b || !a) return;
  if (a === "edit") boardModal(b, false);
  else if (a === "labels") labelDialog(b.id);
  else if (a === "layout") printBoardLayout(b);
  else if (a === "outlines") printOutlines(b);
  else if (a === "outlinesA3") printOutlines(b, "A3");
  else if (a === "show") showBoardHolder(b);
});
function showBoardHolder(b) {
  const o = holderOf(b);
  if (!o) return;
  setView("layout");
  if (S().id !== STD().id) openSheet(STD().id);
  ui.sel = [o.id];
  ui.tab = "item";
  renderSide();
  drawNow();
  centreOn(o.x, o.y);
}
const newBoard = (type, holder) => {
  const b = blankBoard(type);
  if (holder) {
    b.holder = holder.ref;
    b.name = holder.label;
  }
  return boardModal(b, true);
};

/* ----- the board editor ----- */
async function boardModal(b, isNew) {
  const d = clone(b);
  let del = false;
  const holders = holderChoices();
  const slotRow = (s, i) =>
    `<tr data-i="${i}"><td class="n"><b>${pad2(i + 1)}</b></td><td><input data-k="name" value="${esc(s.name)}" placeholder="e.g. 10 mm spanner" aria-label="Name"></td><td><select data-k="type" aria-label="Type">${SLOT_TYPES.map((t) => `<option${t[0] === s.type ? " selected" : ""}>${esc(t[0])}</option>`).join("")}</select></td><td><input data-k="pn" value="${esc(s.pn)}" placeholder="part no." aria-label="Part number"></td><td><input data-k="qty" type="number" min="0" step="1" value="${esc(s.qty)}" aria-label="Quantity"></td><td><input data-k="min" type="number" min="0" step="1" value="${esc(s.min || "")}" aria-label="Minimum"></td><td><input data-k="max" type="number" min="0" step="1" value="${esc(s.max || "")}" aria-label="Maximum"></td><td><input data-k="w" type="number" min="10" step="5" value="${esc(s.w)}" aria-label="Width mm"></td><td><input data-k="h" type="number" min="10" step="5" value="${esc(s.h)}" aria-label="Height mm"></td><td class="bact"><button type="button" data-mv="-1" aria-label="Move up">↑</button><button type="button" data-mv="1" aria-label="Move down">↓</button><button type="button" data-rm="1" class="danger" aria-label="Remove">✕</button></td></tr>`;
  const html = `<div class="row3"><label class="f">Board name<input name="name" required value="${esc(d.name)}" placeholder="e.g. Changeover shadow board"></label><label class="f">Type<select name="type">${opts(BOARD_TYPES, d.type)}</select></label><label class="f">Board code<input name="code" required value="${esc(d.code)}" maxlength="8" placeholder="SB-01"></label></div>
    <div class="row3"><label class="f">Kept at (on the layout)<select name="holder">${optsKV([["", "Not linked"], ...holders], d.holder)}</select></label><label class="f">Owner<input name="owner" list="owners" value="${esc(d.owner)}"></label><div class="row2"><label class="f">Board width (mm)<input name="w" type="number" min="100" step="10" value="${esc(d.w)}"></label><label class="f">Board height (mm)<input name="h" type="number" min="100" step="10" value="${esc(d.h)}"></label></div></div>
    <div id="bdFit"></div>
    <h3 style="margin-bottom:0">Slots</h3><p class="small muted" style="margin:2px 0 6px">In board order: left to right, then down. The number is the position on the label.</p>
    <div class="bdtbl"><table class="tbl"><thead><tr><th class="n">No.</th><th>What goes here</th><th>Type</th><th>Part no.</th><th>Qty</th><th>Min</th><th>Max</th><th>W mm</th><th>H mm</th><th></th></tr></thead><tbody id="bdRows"></tbody></table></div>
    <div class="btns"><button type="button" id="bdAdd">Add slot</button><button type="button" id="bdAdd5">Add 5 slots</button></div>
    <div id="bdPrev" class="bprev"></div>
    <label class="f">Notes<textarea name="note" rows="2">${esc(d.note)}</textarea></label>
    ${isNew ? "" : '<div class="btns"><button type="button" class="danger" id="bdDel">Delete this board</button></div>'}${ownerList()}`;
  const refresh = (full) => {
    if (full)
      $("#bdRows").innerHTML = d.slots.map((s, i) => slotRow(s, i)).join("");
    const f = (n) => Number($("#dlgBody [name=" + n + "]")?.value) || 0;
    const tmp = {
      ...d,
      w: Math.max(100, f("w")),
      h: Math.max(100, f("h")),
      name: $("#dlgBody [name=name]")?.value || "",
    };
    const pk = packBoard(tmp);
    $("#bdFit").innerHTML = pk.fits
      ? `<p class="small muted" style="margin:0">${d.slots.length} slot${d.slots.length === 1 ? "" : "s"} fit on the board. They use ${pk.needH} of ${tmp.h} mm height.</p>`
      : `<div class="status bad"><b>Does not fit.</b> The slots need a board ${pk.needH} mm high (it is ${tmp.h} mm). Make the board taller, make the slots smaller or move some to another board.</div>`;
    $("#bdPrev").innerHTML = boardSVG(tmp);
  };
  const r = await modal(
    isNew ? "New board" : boardCode(b) + " " + b.name,
    html,
    isNew ? "Add board" : "Save",
    {
      cls: "xwide",
      onOpen: (dlg) => {
        refresh(true);
        const body = $("#dlgBody");
        body.addEventListener("input", (e) => {
          const tr = e.target.closest("tr[data-i]");
          if (tr && e.target.dataset.k) {
            const s = d.slots[+tr.dataset.i],
              k = e.target.dataset.k;
            s[k] = ["qty", "min", "max", "w", "h"].includes(k)
              ? Math.max(0, Number(e.target.value) || 0)
              : e.target.value;
          }
          refresh(false);
        });
        body.addEventListener("change", (e) => {
          const tr = e.target.closest("tr[data-i]");
          if (tr && e.target.dataset.k === "type") {
            const s = d.slots[+tr.dataset.i],
              df = slotDefaults(e.target.value);
            s.type = e.target.value;
            // a new type brings a sensible size, unless the size was changed by hand
            if (SLOT_TYPES.some((t) => t[1] === s.w && t[2] === s.h)) {
              s.w = df[1];
              s.h = df[2];
              refresh(true);
              return;
            }
          }
          refresh(false);
        });
        body.addEventListener("click", (e) => {
          const tr = e.target.closest("tr[data-i]"),
            i = tr ? +tr.dataset.i : -1;
          if (e.target.closest("#bdAdd") || e.target.closest("#bdAdd5")) {
            const n = e.target.closest("#bdAdd5") ? 5 : 1,
              last = d.slots.at(-1)?.type || "Tool";
            for (let k = 0; k < n; k++) d.slots.push(blankSlot(last));
            refresh(true);
            $("#bdRows tr:last-child [data-k=name]")?.focus();
          } else if (e.target.closest("[data-rm]") && i >= 0) {
            d.slots.splice(i, 1);
            refresh(true);
          } else if (e.target.closest("[data-mv]") && i >= 0) {
            const j = i + Number(e.target.closest("[data-mv]").dataset.mv);
            if (j >= 0 && j < d.slots.length) {
              [d.slots[i], d.slots[j]] = [d.slots[j], d.slots[i]];
              refresh(true);
            }
          } else if (e.target.closest("#bdDel")) {
            del = true;
            dlg.close("cancel");
          }
        });
        body.querySelector("[name=type]").addEventListener("change", (e) => {
          const c = body.querySelector("[name=code]");
          if (isNew && BOARD_PREFIX[d.type] === c.value.slice(0, 2))
            c.value = nextBoardCode(e.target.value);
          d.type = e.target.value;
        });
      },
    },
  );
  if (del) {
    const q = await modal(
      "Delete " + boardCode(b) + "?",
      '<p style="margin-top:0">The board and its slots will be removed. You can undo straight after.</p>',
      "Delete",
    );
    if (q) {
      checkpoint();
      P.boards = P.boards.filter((x) => x.id !== b.id);
      record("Board deleted", boardCode(b) + " " + b.name);
      renderAll();
    }
    return;
  }
  if (!r) return;
  checkpoint();
  const code = r.code.trim().toUpperCase().slice(0, 8) || d.code;
  if (P.boards.some((x) => x.id !== b.id && x.code === code))
    toast(
      `Another board already uses ${code}. Change one, or the location codes on the labels will clash.`,
      7000,
    );
  Object.assign(b, {
    name: r.name.trim() || "Board",
    type: r.type,
    code,
    holder: r.holder,
    owner: r.owner.trim(),
    w: Math.max(100, Number(r.w) || b.w),
    h: Math.max(100, Number(r.h) || b.h),
    note: r.note.trim(),
    slots: d.slots
      .filter((s) => s.name.trim() || s.pn.trim())
      .map((s) => {
        const df = slotDefaults(s.type);
        return {
          ...s,
          name: s.name.trim() || s.pn.trim(),
          w: s.w >= 10 ? s.w : df[1],
          h: s.h >= 10 ? s.h : df[2],
        };
      }),
  });
  if (isNew) {
    b.no = ++P.counters.board;
    P.boards.push(b);
  }
  record(isNew ? "Board added" : "Board updated", boardCode(b) + " " + b.name);
  renderAll();
}

/* ----- printing the board: scaled layout, and 1:1 outlines ----- */
function slotRowsHTML(b) {
  return b.slots
    .map(
      (s, i) =>
        `<tr><td><b>${esc(slotCode(b, i))}</b></td><td>${esc(s.name)}</td><td>${esc(s.type)}</td><td>${esc(s.pn)}</td><td class="n">${s.qty}</td><td class="n">${s.min || s.max ? s.min + " / " + s.max : ""}</td><td class="n">${s.w} × ${s.h}</td></tr>`,
    )
    .join("");
}
function printBoardLayout(b) {
  const pk = packBoard(b),
    ho = holderOf(b),
    big = Math.max(b.w, b.h),
    scale = Math.max(1, Math.ceil(big / 380));
  printWithPage(
    `<div class="pd"><h1>${esc(boardCode(b))} · ${esc(b.name)}</h1>
    <p class="pdm">${esc(b.type)}, ${b.w} × ${b.h} mm${ho ? ", kept at " + esc(ho.label) : ""}${b.owner ? ", owner " + esc(b.owner) : ""}. Printed ${esc(fmtD(today()))}. ${scale > 1 ? `Drawn to about 1:${scale}; use the 1:1 outlines to cut from.` : "Drawn at about 1:1."}${pk.fits ? "" : ` <b>Warning: the slots need ${pk.needH} mm of height.</b>`}</p>
    <div class="pdplan bpage">${boardSVG(b)}</div>
    <h2>Slots</h2><table class="fixed"><colgroup><col style="width:9%"><col style="width:33%"><col style="width:15%"><col style="width:15%"><col style="width:6%"><col style="width:10%"><col style="width:12%"></colgroup><tr><th>Location</th><th>What goes here</th><th>Type</th><th>Part no.</th><th class="n">Qty</th><th class="n">Min / max</th><th class="n">Size mm</th></tr>${slotRowsHTML(b)}</table>
    ${b.note ? `<p class="pdm">${esc(b.note)}</p>` : ""}</div>`,
    "",
    "",
  );
}
function printOutlines(b, paper = "A4") {
  if (!b.slots.length) return void toast("Add some slots first.");
  // printable area in mm, landscape, with 10 mm margins
  const [maxW, maxH] = paper === "A3" ? [400, 277] : [277, 190];
  const boxes = b.slots
    .map((s, i) => {
      const big = s.w > maxW || s.h > maxH,
        round = s.type === "Kanban" || s.type === "Spare part";
      return `<div class="ol${big ? " big" : ""}" style="width:${s.w}mm;height:${s.h}mm;border-radius:${round ? Math.min(s.w, s.h) / 6 : 1}mm"><b>${esc(slotCode(b, i))}</b><span>${esc(s.name)}</span>${big ? `<i>Larger than ${paper}: ${paper === "A3" ? "measure it" : "print on A3 or measure it"} instead.</i>` : ""}</div>`;
    })
    .join("");
  printWithPage(
    `<div class="pd"><h1>${esc(boardCode(b))} · ${esc(b.name)}: 1:1 outlines</h1>
    <p class="pdm">Printed at full size on ${paper} landscape (set the printer to 100%, no "fit to page"). Check one against a ruler before cutting. Lay each tool on its outline, or trace round it to make the shadow.</p>
    <div class="olflow">${boxes}</div></div>`,
    "",
    `size: ${paper} landscape; margin: 10mm`,
  );
}

/* ----- CSV for label software and spreadsheets ----- */
function boardRows() {
  const rows = [
    [
      "Location",
      "Board code",
      "Position",
      "Board",
      "Board type",
      "Name",
      "Type",
      "Part no.",
      "Qty",
      "Min",
      "Max",
      "Kept at",
      "Owner",
      "Width mm",
      "Height mm",
      "Notes",
    ],
  ];
  for (const b of P.boards)
    b.slots.forEach((s, i) =>
      rows.push([
        slotCode(b, i),
        boardCode(b),
        pad2(i + 1),
        b.name,
        b.type,
        s.name,
        s.type,
        s.pn,
        s.qty,
        s.min || "",
        s.max || "",
        holderOf(b)?.label || "",
        b.owner,
        s.w,
        s.h,
        s.note,
      ]),
    );
  return rows;
}
const csvBoards = () => csv(boardRows(), "LeanStudio_boards_and_slots.csv");
