"use strict";
/* ============ right-click menus ============
   One small menu (#ctxMenu) for a right-click on the drawing and on register rows. On the drawing: on an item, tape, route or zone, the actions of the toolbar under a
   selection plus Copy, with their shortcuts; on a zone also "Show only this zone" and "Raise an idea
   here"; on empty floor Paste, Red tag here, Action here, Select all and Fit. On a register row: Open
   and the row's own buttons (Show, Problem, Idea, Pin). Arrow keys move, Enter picks, Esc closes. */

// show the menu at a screen point with [label, run, { key, danger, disabled }] entries ("-" = a rule)
function openCtx(x, y, items) {
  const m = $("#ctxMenu");
  m.innerHTML = items
    .map((it, i) =>
      it === "-"
        ? '<hr role="separator">'
        : `<button type="button" role="menuitem" data-ci="${i}"${it[2]?.danger ? ' class="danger"' : ""}${it[2]?.disabled ? " disabled" : ""}><span>${esc(it[0])}</span>${it[2]?.key ? `<kbd>${esc(it[2].key)}</kbd>` : ""}</button>`,
    )
    .join("");
  ctxItems = items;
  m.hidden = false;
  // keep it on screen
  const w = m.offsetWidth,
    h = m.offsetHeight;
  m.style.left = Math.round(Math.min(x, innerWidth - w - 8)) + "px";
  m.style.top =
    Math.round(y + h > innerHeight - 8 ? Math.max(8, y - h) : y) + "px";
  m.querySelector("button:not(:disabled)")?.focus();
}
let ctxItems = [];
function closeCtx() {
  const m = $("#ctxMenu");
  if (m.hidden) return;
  m.hidden = true;
  ctxItems = [];
}

// what a right-click on the drawing offers
function drawingCtx(e) {
  const p = world(e),
    t = e.target.closest("[data-t]"),
    kind = t?.dataset.t,
    hit = ["obj", "mark", "route", "area"].includes(kind)
      ? find(t.dataset.id)
      : null;
  if (hit) {
    // right-click on something not already selected selects just it, as file managers do
    if (!ui.sel.includes(hit.x.id)) {
      ui.sel = [hit.x.id];
      ui.tab = "item";
      renderAll();
    }
    const sel = selected(),
      objs = sel.filter((f) => f.t === "obj"),
      one = sel.length === 1 ? sel[0] : null,
      lockable = sel.filter((f) => f.t === "obj" || f.t === "area"),
      zone = one && one.t === "area" ? one.x : null,
      items = [];
    if (objs.length) items.push(["Rotate", () => act("rot90"), { key: "R" }]);
    items.push(["Duplicate", () => act("dup"), { key: "Ctrl+D" }]);
    items.push(["Copy", () => copySel(), { key: "Ctrl+C" }]);
    if (lockable.length)
      items.push([
        lockable.every((f) => f.x.locked) ? "Unlock" : "Lock",
        () => act("lock"),
      ]);
    if (one && one.t === "obj" && one.x.kind === "item" && !one.fx)
      items.push(["Red tag", () => act("tagItem")]);
    if (zone && !ui.editDrawing) {
      items.push("-");
      if (ui.scope !== zone.id)
        items.push([
          isLine(zone) ? "Show only this line" : "Show only this zone",
          () => setScope(zone.id),
        ]);
      if (!isLine(zone))
        items.push(["Raise an idea here", () => newIdea({ zone: zone.id })]);
    }
    items.push("-", ["Zoom to it", () => zoomToSel(), { key: "F" }]);
    items.push("-", ["Delete", () => act("del"), { key: "Del", danger: true }]);
    return items;
  }
  // empty floor
  const at = (tool) => () => {
    ui.placing = null;
    ui.tool = tool;
    placePin(p);
  };
  const items = [
    ["Paste", () => pasteClip(), { key: "Ctrl+V", disabled: !ui.clip?.length }],
  ];
  if (!ui.editDrawing && S().kind !== "daily")
    items.push("-", ["Red tag here", at("tag")], ["Action here", at("action")]);
  items.push(
    "-",
    ["Select all", () => selectAll(), { key: "Ctrl+A" }],
    ["Fit the drawing", () => (fitView(), draw()), { key: "F" }],
  );
  if (ui.scope) items.push(["Show the whole factory", () => setScope("")]);
  return items;
}

// what a right-click on a register row offers: Open, then the row's own buttons
function rowCtx(row) {
  const items = [["Open", () => row.click()]],
    btns = [...row.querySelectorAll("td button:not(:disabled)")];
  if (btns.length) items.push("-");
  for (const b of btns) items.push([b.textContent.trim(), () => b.click()]);
  return items;
}

svg.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (ui.draft) return finishDraft(); // right-click ends the line being drawn, as before
  if (ui.tool !== "select") return setTool("select"); // and leaves a drawing tool
  openCtx(e.clientX, e.clientY, drawingCtx(e));
});
document.addEventListener("contextmenu", (e) => {
  const row = e.target.closest("main:not([hidden]) .tbl tr.click");
  if (!row || e.target.closest("input,textarea,select")) return;
  e.preventDefault();
  openCtx(e.clientX, e.clientY, rowCtx(row));
});
$("#ctxMenu").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ci]");
  if (!b || b.disabled) return;
  const run = ctxItems[+b.dataset.ci]?.[1];
  closeCtx();
  run?.();
});
$("#ctxMenu").addEventListener("keydown", (e) => {
  const bs = [...$$("#ctxMenu button:not(:disabled)")],
    i = bs.indexOf(document.activeElement);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const n = bs.length;
    bs[(i + (e.key === "ArrowDown" ? 1 : n - 1)) % n]?.focus();
  } else if (e.key === "Escape" || e.key === "Tab") {
    e.preventDefault();
    e.stopPropagation();
    closeCtx();
  }
});
// Esc closes it wherever the focus is
document.addEventListener(
  "keydown",
  (e) => {
    if (e.key !== "Escape" || $("#ctxMenu").hidden) return;
    e.preventDefault();
    e.stopPropagation();
    closeCtx();
  },
  true,
);
// anything else closes it: a press elsewhere, scrolling, the window losing focus
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest("#ctxMenu")) closeCtx();
});
window.addEventListener("blur", closeCtx);
window.addEventListener("resize", closeCtx);
document.addEventListener("scroll", closeCtx, true);
