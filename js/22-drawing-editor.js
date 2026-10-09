"use strict";
/* ============ drawing editor: walls, fixed objects, cover-ups, labels ============ */
function fixedSVG(sh, k, edit, pid = "fxh") {
  const fx = DM(sh)?.fixed || [];
  if (!fx.length || !ui.layers.fixed) return "";
  const pe = edit ? "" : ' pointer-events="none"',
    fs = 11 * k * (ui.textBoost || 1); // bigger names when presenting zoomed in
  let s = `<g${pe}><defs><pattern id="${esc(pid)}" patternUnits="userSpaceOnUse" width="${6 * k}" height="${6 * k}" patternTransform="rotate(45)"><rect width="${1.6 * k}" height="${6 * k}" fill="#4A4F66" fill-opacity=".5"/></pattern></defs>`;
  for (const f of fx)
    if (f.t === "mask")
      s += `<g data-t="fx" data-id="${esc(f.id)}" transform="translate(${f.x} ${f.y}) rotate(${f.a})"><rect x="${-f.w / 2}" y="${-f.h / 2}" width="${f.w}" height="${f.h}" fill="#fff"${edit ? ` stroke="#9AA1BC" stroke-dasharray="${4 * k} ${3 * k}" stroke-width="${k}"` : ""}/></g>`;
  for (const f of fx)
    if (f.t === "wall") {
      const pts = f.pts.map((p) => p.x + "," + p.y).join(" "),
        tag = f.closed ? "polygon" : "polyline";
      s += `<g data-t="fx" data-id="${esc(f.id)}"><${tag} points="${pts}" fill="none" stroke="${f.c}" stroke-width="${f.th}" stroke-linejoin="miter" stroke-linecap="square"/>${edit ? `<${tag} points="${pts}" fill="none" stroke="transparent" stroke-width="${Math.max(f.th, 12 * k)}"/>` : ""}</g>`;
    }
  for (const f of fx)
    if (f.t === "block") {
      const hw = f.w / 2,
        hh = f.h / 2,
        flip = angDiff(f.a, 180) < 89.9;
      let lab = fit(f.label, f.w, fs);
      lab = lab ? txt(0, 0, lab, fs, k) : "";
      if (lab && flip) lab = `<g transform="rotate(180)">${lab}</g>`;
      s +=
        `<g data-t="fx" data-id="${esc(f.id)}" transform="translate(${f.x} ${f.y}) rotate(${f.a})">` +
        (f.passable
          ? `<rect x="${-hw}" y="${-hh}" width="${f.w}" height="${f.h}" fill="#fff" fill-opacity=".85" stroke="${f.c}" stroke-width="${1.6 * k}" stroke-dasharray="${4 * k} ${3 * k}"/>`
          : `<rect x="${-hw}" y="${-hh}" width="${f.w}" height="${f.h}" fill="${f.c}" fill-opacity=".3" stroke="${f.c}" stroke-width="${2 * k}"/><rect x="${-hw}" y="${-hh}" width="${f.w}" height="${f.h}" fill="url(#${pid})" pointer-events="none"/>`) +
        lab +
        `</g>`;
    }
  for (const f of fx)
    if (f.t === "text")
      s += `<g data-t="fx" data-id="${esc(f.id)}" transform="translate(${f.x} ${f.y}) rotate(${f.a})"><text x="0" y="0" font-size="${f.fs}" font-family="Segoe UI,system-ui,sans-serif" font-weight="600" fill="${f.c}" text-anchor="middle" dominant-baseline="central" stroke="#fff" stroke-width="${f.fs * 0.18}" stroke-linejoin="round" paint-order="stroke">${esc(f.label)}</text>${edit ? `<rect x="${-f.w / 2}" y="${-f.h / 2}" width="${f.w}" height="${f.h}" fill="transparent"/>` : ""}</g>`;
  return s + "</g>";
}

const FIXED_LIB = [
  [
    "Structure",
    [
      ["Column", 0.4, 0.4, "#4A4F66", "block"],
      ["Door opening", 1, 0.3, "#1F8A55", "door"],
      ["Pit or drain", 1, 1, "#4A4F66", "block"],
    ],
  ],
  [
    "Fixed equipment",
    [
      ["Fixed machine", 3, 2, "#4A4F66", "block"],
      ["Electrical cabinet", 0.8, 0.4, "#4A4F66", "block"],
      ["Fixed bench or racking", 2, 0.8, "#4A4F66", "block"],
    ],
  ],
  [
    "Tidy and label",
    [
      ["Cover up (hides the drawing)", 3, 2, "#FFFFFF", "mask"],
      ["Text label", 0, 0, "#1C2250", "text"],
    ],
  ],
];
function renderFixLib() {
  $("#fixLib").innerHTML = FIXED_LIB.map(
    ([g, items]) =>
      `<details open><summary>${g}</summary>${items
        .map(([n, w, h, c, k]) => {
          const def = JSON.stringify({ n, w, h, c, k });
          return `<button class="libitem" data-fdef='${esc(def)}'><span class="sw ${k === "door" ? "zone" : ""}" style="--c:${c === "#FFFFFF" ? "#9AA1BC" : c}"></span>${esc(n)}<span class="dim">${k === "text" ? "" : w + "×" + h + " m"}</span></button>`;
        })
        .join("")}</details>`,
  ).join("");
}
$("#fixLib").addEventListener("click", (e) => {
  const b = e.target.closest("[data-fdef]");
  if (b) addFixed(JSON.parse(b.dataset.fdef));
});
function addFixed(def) {
  if (ui.tool !== "select") setTool("select");
  const sh = S(),
    dm = DM(sh),
    u = upm(sh),
    id = uid();
  dm.fixed = dm.fixed || [];
  let x = snapV(ui.vb.x + ui.vb.w / 2, sh),
    y = snapV(ui.vb.y + vbH() / 2, sh);
  const step = Math.max(def.w, def.h, 1) * u * 0.7;
  for (
    let n = 0;
    n < 30 &&
    dm.fixed.some(
      (o) => o.t !== "wall" && Math.hypot(o.x - x, o.y - y) < step * 0.5,
    );
    n++
  ) {
    x = snapV(x + step, sh);
    y = snapV(y + step * 0.4, sh);
  }
  let f;
  if (def.k === "text") {
    const fs = mpu(sh) ? 0.8 / mpu(sh) : 10;
    f = {
      id,
      t: "text",
      label: "Label",
      x,
      y,
      fs,
      w: 5 * fs * 0.6,
      h: fs * 1.3,
      a: 0,
      c: def.c,
      locked: false,
    };
  } else if (def.k === "mask")
    f = {
      id,
      t: "mask",
      label: "Cover up",
      x,
      y,
      w: def.w * u,
      h: def.h * u,
      a: 0,
      c: "#FFFFFF",
      locked: false,
    };
  else
    f = {
      id,
      t: "block",
      label: def.n,
      x,
      y,
      w: def.w * u,
      h: def.h * u,
      a: 0,
      c: def.c,
      passable: def.k === "door",
      locked: false,
    };
  checkpoint();
  dm.fixed.push(f);
  ui.sel = [id];
  record("Drawing: added", def.n);
  renderAll();
}
$("#bCustomFix").onclick = async () => {
  const r = await modal(
    "Add custom fixed object",
    `<label class="f">Name<input name="n" required placeholder="e.g. Baler"></label>
  <div class="row2"><label class="f">Width (m)<input name="w" type="number" step="0.05" value="2"></label><label class="f">Depth (m)<input name="h" type="number" step="0.05" value="1"></label></div>
  <div class="row2"><label class="f">Type<select name="k"><option value="block">Fixed object</option><option value="door">Door or opening (people can pass)</option></select></label><label class="f">Colour<input name="c" type="color" value="#4A4F66"></label></div>
  ${mpu() ? "" : '<p class="small muted">No scale set yet, so sizes are approximate until you set one with Measure.</p>'}`,
    "Add",
  );
  if (!r || !r.n.trim()) return;
  addFixed({
    n: r.n.trim(),
    w: Math.max(0.05, Number(r.w) || 1),
    h: Math.max(0.05, Number(r.h) || 1),
    c: r.c,
    k: r.k,
  });
};

function renderDrawTools() {
  const el = $("#drawOpts");
  if (!el) return;
  const t = ui.tool;
  let h = "";
  if (t === "wall")
    h = `<div class="toolopts"><label>Thickness<select data-wth>${[
      [0.1, "Thin partition, 0.1 m"],
      [0.2, "Wall, 0.2 m"],
      [0.3, "Thick wall, 0.3 m"],
      [0.5, "Heavy wall, 0.5 m"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${esc(v)}"${ui.wall.th === v ? " selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><p class="small muted" style="margin:0">Click along the wall. Double-click to finish, or click the first point to close a room. Shift keeps it straight.</p></div>`;
  else if (t === "measure")
    h = `<div class="toolopts small">Click two points of something you know the length of (a column grid, a door, a conveyor) and enter its real length to set the scale.${mpu() ? `<p style="margin:6px 0 0"><b>Current scale:</b> 10 m = ${Math.round(10 / mpu())} drawing units.</p>` : ""}</div>`;
  else
    h = `<p class="small muted" style="margin:10px 0 0">Drag empty space to pan, scroll to zoom. Click a wall or object to edit it. Delete removes, R rotates, Ctrl+D duplicates.</p>`;
  if (!mpu() && t !== "measure")
    h += `<div class="status warn" style="margin-top:10px">No scale yet, so sizes are approximate. Set it first with Measure; you can resize what you have drawn afterwards.</div>`;
  el.innerHTML = h;
}
$("#drawOpts").addEventListener("change", (e) => {
  if (e.target.dataset.wth !== undefined) ui.wall.th = Number(e.target.value);
});
$("#drawSeg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tool]");
  if (b) setTool(b.dataset.tool);
});

function updateEditBan() {
  const ban = $("#editBan");
  if (!ban) return;
  ban.hidden = !ui.editDrawing;
  if (ui.editDrawing)
    ban.querySelector("span").textContent =
      `Editing the drawing “${DM().name || "Drawing"}”. Walls and fixed objects show on every sheet that uses it.`;
}
function setEditDrawing(on) {
  ui.editDrawing = !!on;
  ui.sel = [];
  ui.draft = null;
  ui.tool = "select";
  ui.cursor = null;
  if (on) ui.layers.fixed = true;
  $("#canvas").dataset.tool = "select";
  $("#canvas").classList.toggle("editing", !!on);
  $$("#toolSeg button,#drawSeg button").forEach((b) =>
    b.classList.toggle("on", b.dataset.tool === "select"),
  );
  $("#normalTools").hidden = !!on;
  $("#drawTools").hidden = !on;
  $("#tabs").hidden = !!on;
  const b = $("#bEditDraw");
  b.textContent = on ? "Done editing" : "Edit drawing";
  b.classList.toggle("pri", !!on);
  renderDrawTools();
  renderSheetBar();
  updateEditBan();
  updateHint();
  renderSide();
  draw();
}
$("#bEditDraw").onclick = () => setEditDrawing(!ui.editDrawing);
$("#editBanDone").onclick = () => setEditDrawing(false);

function paneFixed() {
  const sh = S(),
    fx = DM(sh)?.fixed || [],
    sel = selected(),
    u = uName();
  const typeName = (f) =>
    f.t === "wall"
      ? "wall"
      : f.t === "mask"
        ? "cover-up"
        : f.t === "text"
          ? "label"
          : f.passable
            ? "door or opening"
            : "fixed object";
  const centre = (f) => (f.t === "wall" ? f.pts[0] : { x: f.x, y: f.y });
  if (!sel.length) {
    const walls = fx.filter((f) => f.t === "wall"),
      len = walls.reduce((a, w) => a + markLen(w), 0);
    let h = `<h2>Editing the drawing</h2><p class="small muted">Draw walls, drop in columns, doors and fixed equipment, or cover up parts of the picture that are out of date. These belong to the building, not to a layout: they show on every sheet that uses this drawing and are never part of the standard or a check.</p>`;
    h += kv([
      ["Walls", walls.length],
      ["Wall length", walls.length ? fmtLen(len) : "None"],
      ["Fixed objects and doors", fx.filter((f) => f.t === "block").length],
      [
        "Cover-ups and labels",
        fx.filter((f) => f.t === "mask" || f.t === "text").length,
      ],
    ]);
    h += rowsHTML(
      "On this drawing",
      "#4A4F66",
      fx.map((f) => ({
        l: f.label,
        v: typeName(f),
        x: centre(f).x,
        y: centre(f).y,
        id: f.id,
      })),
    );
    h += `<p class="small muted" style="margin-top:14px">Items that overlap a wall or fixed object are flagged on the Check tab. Routes that cut through a wall are marked on the drawing, so leave a Door opening wherever people should pass.</p>`;
    return h;
  }
  if (sel.length > 1)
    return `<h2>${sel.length} selected</h2><p class="small muted">Drag any of them to move them together. Arrow keys nudge.</p><div class="btns"><button data-a="dup">Duplicate</button><button data-a="rot90">Rotate 90°</button><button data-a="lock">Lock or unlock</button><button data-a="del" class="danger">Delete</button></div>`;
  const x = sel[0].x,
    step = u === "m" ? 0.05 : 1,
    lockNote = x.locked
      ? '<p class="small muted">Locked. Unlock it to change or move it.</p>'
      : "";
  if (x.t === "wall")
    return `<h2>Wall</h2><label class="f">Name<input data-f="label" value="${esc(x.label)}"></label>
    <div class="row2"><label class="f">Thickness (${u})<input data-f="th" type="number" min="0.01" step="${u === "m" ? 0.05 : 0.5}" value="${toUser(x.th)}"></label><label class="f">Colour<input data-f="c" type="color" value="${esc(x.c)}"></label></div>
    <label class="chk"><input type="checkbox" data-f="closed"${x.closed ? " checked" : ""}>Closed shape (a room)</label>
    ${kv([
      ["Length", fmtLen(markLen(x))],
      ["Corners", x.pts.length],
    ])}
    <p class="small muted">Drag the white dots to reshape. Drag the wall to move it.</p><div class="btns"><button data-a="dup">Duplicate</button><button data-a="del" class="danger">Delete</button></div>`;
  if (x.t === "text")
    return `<h2>Text label</h2><label class="f">Text<input data-f="label" value="${esc(x.label)}"></label>
    <div class="row2"><label class="f">Size (${u})<input data-f="fs" type="number" min="0.05" step="${step}" value="${toUser(x.fs)}"></label><label class="f">Rotation (°)<input data-f="a" type="number" step="15" value="${Math.round(x.a)}"></label></div>
    <label class="f">Colour<input data-f="c" type="color" value="${esc(x.c)}"></label>${lockNote}
    <div class="btns"><button data-a="rot90">Rotate 90°</button><button data-a="dup">Duplicate</button><button data-a="lock">${x.locked ? "Unlock" : "Lock"}</button><button data-a="del" class="danger">Delete</button></div>`;
  if (x.t === "mask")
    return `<h2>Cover-up</h2><p class="small muted">Hides whatever is under it in the original drawing, for example equipment that has been removed.</p>
    <div class="row2"><label class="f">Width (${u})<input data-f="w" type="number" min="0.05" step="${step}" value="${toUser(x.w)}"></label><label class="f">Depth (${u})<input data-f="h" type="number" min="0.05" step="${step}" value="${toUser(x.h)}"></label></div>
    <label class="f">Rotation (°)<input data-f="a" type="number" step="15" value="${Math.round(x.a)}"></label>${lockNote}
    <div class="btns"><button data-a="rot90">Rotate 90°</button><button data-a="dup">Duplicate</button><button data-a="lock">${x.locked ? "Unlock" : "Lock"}</button><button data-a="del" class="danger">Delete</button></div>`;
  return `<h2>${x.passable ? "Door or opening" : "Fixed object"}</h2><label class="f">Name<input data-f="label" value="${esc(x.label)}"></label>
    <div class="row2"><label class="f">Width (${u})<input data-f="w" type="number" min="0.05" step="${step}" value="${toUser(x.w)}"></label><label class="f">Depth (${u})<input data-f="h" type="number" min="0.05" step="${step}" value="${toUser(x.h)}"></label></div>
    <div class="row2"><label class="f">Rotation (°)<input data-f="a" type="number" step="15" value="${Math.round(x.a)}"></label><label class="f">Colour<input data-f="c" type="color" value="${esc(x.c)}"></label></div>
    <label class="chk"><input type="checkbox" data-f="passable"${x.passable ? " checked" : ""}>People can pass through (door or opening)</label>${lockNote}
    <div class="btns"><button data-a="rot90">Rotate 90°</button><button data-a="dup">Duplicate</button><button data-a="lock">${x.locked ? "Unlock" : "Lock"}</button><button data-a="del" class="danger">Delete</button></div>`;
}
