"use strict";
/* ============ render: strip, sheet bar, tools ============ */
function renderDays() {
  const std = STD(),
    props = P.sheets.filter((s) => s.kind === "proposal"),
    days = dailies();
  const chip = (s, cls, b, sm, sc, bar) =>
    `<button class="chip ${cls}${s.id === P.active ? " on" : ""}" data-sheet="${esc(s.id)}"${bar ? ` style="--bar:${bar}"` : ""} title="${esc(s.name)}"><b>${esc(b)}</b><small>${esc(sm)}</small>${sc != null ? `<span class="sc c-${scoreCls(sc)}">${sc}%</span>` : ""}</button>`;
  let h = `<div class="grp"><span>Standard</span><div class="chips">${chip(std, "std", std.name, "The agreed design")}</div></div>`;
  h += `<div class="grp"><span>Proposals and trials</span><div class="chips">${props.map((s) => chip(s, "prop", s.name, fmtDate(s.date))).join("")}<button class="add pri" data-add="proposal">New proposal</button></div></div>`;
  h += `<div class="grp"><span>Daily checks: what it actually looks like${days.length > 14 ? ` (latest 14 of ${days.length}, all in Tracking)` : ""}</span><div class="chips">${days
    .slice(-14)
    .map((d) => {
      const c = compare(d, stdFor(d));
      return chip(
        d,
        "",
        fmtDate(d.date),
        [d.shift, d.checker].filter(Boolean).join(", ") || "Daily check",
        c.score,
        c.score == null ? null : scoreCol(c.score),
      );
    })
    .join(
      "",
    )}<button class="add pri" data-add="daily">Start today's check</button></div></div>`;
  $("#days").innerHTML = h;
}
$("#days").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.sheet) {
    if (ui.view !== "layout") setView("layout");
    openSheet(b.dataset.sheet);
  } else if (b.dataset.add === "daily") newDaily();
  else if (b.dataset.add === "proposal") newProposal();
});

const LAYERS = [
  ["drawing", "Drawing"],
  ["fixed", "Walls and fixed objects"],
  ["fade", "Fade the drawing"],
  ["grid", "Grid (1 m when scaled)"],
  ["marks", "Floor tape and home marks"],
  ["areas", "Areas"],
  ["objects", "Items and zones"],
  ["routes", "Routes"],
  ["dims", "Tape dimensions and datum"],
  ["runs", "Run numbers on tape"],
  ["pins", "Action and red tag pins"],
  ["docs", "Document pins"],
  ["overlay", "Comparison overlay"],
  ["snap", "Snap to grid"],
];
function renderSheetBar() {
  const s = S();
  $("#kind").textContent = {
    standard: "Standard",
    proposal: "Proposal",
    daily: "Daily check",
  }[s.kind];
  $("#kind").className = "kind " + s.kind;
  $("#sName").value = s.name;
  $("#sDate").value = s.date || "";
  const others = P.sheets.filter((x) => x.id !== s.id);
  $("#cmpSel").innerHTML =
    `<option value="auto">${s.kind === "standard" ? "Nothing" : "The standard"}</option>${s.kind !== "standard" ? '<option value="">Nothing</option>' : ""}` +
    others
      .filter((x) => x.kind !== "standard")
      .map(
        (x) =>
          `<option value="${esc(x.id)}">${esc(x.kind === "daily" ? fmtDate(x.date) + (x.shift ? " " + x.shift : "") : x.name)}</option>`,
      )
      .join("");
  $("#cmpSel").value = others.some((x) => x.id === ui.cmp)
    ? ui.cmp
    : ui.cmp === "" && s.kind !== "standard"
      ? ""
      : "auto";
  $("#layersPop").innerHTML = LAYERS.map(
    ([k, n]) =>
      `<label><input type="checkbox" data-layer="${esc(k)}"${ui.layers[k] ? " checked" : ""}>${n}</label>`,
  ).join("");
  $("#sheetPop").innerHTML =
    `<button data-sa="prop">New proposal from here</button>${s.kind === "proposal" ? '<button data-sa="std">Make this the standard</button>' : ""}${s.kind !== "standard" ? '<button data-sa="daily">Start today\'s check</button>' : ""}<hr><button data-sa="csv">Export deviations (CSV)</button><button data-sa="img">${D[s.drawing] ? "Replace the drawing" : "Add a drawing image"}</button><hr><button data-sa="del" class="danger"${s.kind === "standard" ? " disabled" : ""}>Delete this sheet</button>`;
}
$("#sName").onchange = () => {
  checkpoint();
  S().name = $("#sName").value.trim() || "Untitled";
  record("Renamed", S().name);
  renderAll();
};
$("#sDate").onchange = () => {
  checkpoint();
  S().date = $("#sDate").value;
  record("Date changed", S().date);
  renderAll();
};
$("#cmpSel").onchange = () => {
  ui.cmp = $("#cmpSel").value;
  renderAll();
};
$("#layersPop").addEventListener("change", (e) => {
  const k = e.target.dataset.layer;
  if (k) {
    ui.layers[k] = e.target.checked;
    draw();
  }
});
$("#sheetPop").addEventListener("click", (e) => {
  const a = e.target.closest("[data-sa]")?.dataset.sa;
  if (!a) return;
  $("#sheetMenu").open = false;
  ({
    prop: newProposal,
    std: makeStandard,
    daily: newDaily,
    csv: csvDeviations,
    img: () => $("#fImage").click(),
    del: deleteSheet,
  })[a]();
});
document.addEventListener("pointerdown", (e) => {
  for (const d of $$("details.menu[open]"))
    if (!d.contains(e.target)) d.open = false;
});

function renderTools() {
  const el = $("#toolOpts"),
    t = ui.tool;
  let h = "";
  if (t === "select")
    h = `<p class="small muted" style="margin:10px 0 0">Drag empty space to pan, scroll to zoom. Shift-click selects several. Arrow keys nudge, R rotates, Delete removes, Ctrl+D duplicates.</p>`;
  if (t === "tape")
    h = `<div class="toolopts"><div class="seg4">${[
      ["line", "Line"],
      ["rect", "Box"],
      ["aisle", "Aisle"],
      ["arrow", "Arrow"],
    ]
      .map(
        ([k, l]) =>
          `<button data-tmode="${esc(k)}" class="${ui.tapeMode === k ? "on" : ""}">${l}</button>`,
      )
      .join("")}</div>
    ${ui.tapeMode === "aisle" ? `<label style="margin-top:8px">Aisle width, edge to edge (m)<input data-aw type="number" min="0.3" step="0.1" value="${esc(ui.aisleW)}"></label>` : ""}
    <div class="tapes" style="margin-top:8px">${Object.entries(TAPE)
      .map(
        ([k, v], i) =>
          `<button data-tape="${esc(k)}" class="${ui.tape === k ? "on" : ""}" title="${esc(v.use || "")}"><span class="tsw" style="background:${v.pattern === "stripe" && v.c2 ? `repeating-linear-gradient(90deg,${v.c} 0 5px,${v.c2} 5px 10px)` : v.pattern === "dash" ? `repeating-linear-gradient(90deg,${v.c} 0 6px,transparent 6px 10px)` : v.c}"></span>${esc(v.n)}<span class="dim">${i < 9 ? i + 1 + " | " : ""}${v.w} mm</span></button>`,
      )
      .join("")}</div>
    <button data-edit-marking style="margin-top:8px;width:100%">Marking standard</button>
    <p class="small muted" style="margin:8px 0 0">New tape starts as Planned. Press 1 to 9 to pick a colour.</p></div>`;
  if (t === "route")
    h = `<div class="toolopts"><label>Who<select data-r="who"><option value="walk"${ui.route.who === "walk" ? " selected" : ""}>Person walking</option><option value="vehicle"${ui.route.who === "vehicle" ? " selected" : ""}>Pallet truck or FLT</option></select></label>
    <label>Name<input data-r="name" value="${esc(ui.route.name)}" placeholder="e.g. Film reel change"></label>
    <div class="row2"><label>Trips<input data-r="trips" type="number" min="0.1" step="1" value="${esc(ui.route.trips)}"></label><label>Per<select data-r="per"><option value="shift"${ui.route.per === "shift" ? " selected" : ""}>Shift</option><option value="hour"${ui.route.per === "hour" ? " selected" : ""}>Hour</option></select></label></div></div>`;
  if (t === "tag")
    h = `<div class="toolopts small">Click the drawing where the item is. You fill in what it is, who owns it and what happens to it. Pins can be dragged afterwards.</div>`;
  if (t === "action")
    h = `<div class="toolopts small">Click the drawing where the job is. Actions are tracked with an owner and due date in the Actions view.</div>`;
  if (t === "doc")
    h = `<div class="toolopts small">Click the drawing where a document lives, such as an SOP holder, board or noticeboard. Fill in what it is, who owns it and when it is reviewed. Pins can be dragged afterwards.</div>`;
  if (t === "area")
    h = `<div class="toolopts small">Outline a named zone of the line: click each corner and close it. Items sitting inside belong to it, and you can designate an item to an area from the Item tab so daily checks flag it when it strays.</div>`;
  if (t === "measure")
    h = `<div class="toolopts small">Click two points. Measure something you know (column grid, conveyor length, a door) and enter its real length to set the scale in metres.${mpu() ? `<p style="margin:6px 0 0"><b>Current scale:</b> 10 m = ${Math.round(10 / mpu())} drawing units.</p>` : ""}</div>`;
  el.innerHTML = h;
}
$("#toolSeg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tool]");
  if (b) setTool(b.dataset.tool);
});
$("#toolOpts").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tape]");
  if (b) {
    ui.tape = b.dataset.tape;
    renderTools();
    draw();
  }
  const m = e.target.closest("[data-tmode]");
  if (m) {
    ui.tapeMode = m.dataset.tmode;
    ui.draft = null;
    renderTools();
    updateHint();
    draw();
  }
  if (e.target.closest("[data-edit-marking]")) markingModal();
});
$("#toolOpts").addEventListener("change", (e) => {
  const k = e.target.dataset.r;
  if (k) {
    ui.route[k] = e.target.value;
    if (k === "who") draw();
  }
  if (e.target.dataset.aw !== undefined)
    ui.aisleW = Math.max(0.3, Number(e.target.value) || 1.5);
});

function renderLib() {
  const q = $("#libSearch").value.trim().toLowerCase();
  $("#lib").innerHTML =
    LIB.map(([g, items]) => {
      const its = items.filter((i) => !q || i[0].toLowerCase().includes(q));
      if (!its.length) return "";
      return `<details open><summary>${g}</summary>${its
        .map(([n, w, h, c, k]) => {
          const def = JSON.stringify({ n, w, h, c, k: k || "item" });
          return `<button class="libitem" draggable="true" data-def='${esc(def)}'><span class="sw ${k || ""}" style="--c:${c}"></span>${esc(n)}<span class="dim">${w}×${h} m</span></button>`;
        })
        .join("")}</details>`;
    }).join("") || '<p class="empty">Nothing matches. Use Add custom item.</p>';
}
$("#libSearch").oninput = renderLib;
$("#lib").addEventListener("click", (e) => {
  const b = e.target.closest("[data-def]");
  if (b) addItem(JSON.parse(b.dataset.def));
});
$("#lib").addEventListener("dragstart", (e) => {
  const b = e.target.closest("[data-def]");
  if (b) {
    e.dataTransfer.setData("text/x-lib", b.dataset.def);
    e.dataTransfer.effectAllowed = "copy";
  }
});
$("#bCustom").onclick = async () => {
  const u = uName();
  const r = await modal(
    "Add custom item",
    `<label class="f">Name<input name="n" required placeholder="e.g. Glue pot trolley"></label>
  <div class="row2"><label class="f">Width (m)<input name="w" type="number" step="0.05" value="1"></label><label class="f">Depth (m)<input name="h" type="number" step="0.05" value="0.8"></label></div>
  <div class="row2"><label class="f">Type<select name="k"><option value="item">Movable item</option><option value="zone">Area</option><option value="keepclear">Keep-clear area</option></select></label><label class="f">Colour<input name="c" type="color" value="#202C86"></label></div>
  ${u === "u" ? '<p class="small muted">No scale set yet, so sizes are approximate until you set one with Measure.</p>' : ""}`,
    "Add",
  );
  if (!r || !r.n.trim()) return;
  addItem({
    n: r.n.trim(),
    w: Math.max(0.05, Number(r.w) || 1),
    h: Math.max(0.05, Number(r.h) || 1),
    c: r.c,
    k: r.k,
  });
};
