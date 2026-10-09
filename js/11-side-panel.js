"use strict";
/* ============ side panel ============ */
$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) {
    ui.tab = b.dataset.tab;
    renderSide();
    draw();
  }
});
function renderSide() {
  $$("#tabs button").forEach((b) =>
    b.classList.toggle("on", b.dataset.tab === ui.tab),
  );
  const p = $("#pane");
  p.innerHTML = ui.editDrawing
    ? paneFixed()
    : {
        item: paneItem,
        check: paneCheck,
        move: paneMove,
        mark: paneMark,
        s5: paneS5,
        areas: paneAreas,
      }[ui.tab]();
  // the item list is for finding things; it stays out of the way while something is selected
  if (!ui.editDrawing && ui.tab === "item" && !ui.sel.length)
    p.insertAdjacentHTML("beforeend", categoryGroupsHTML(S()));
}
/* wording: daily checks say "out of place", proposals say "moved" */
const cmpWords = (sh) =>
  sh.kind === "daily"
    ? {
        moved: "Out of place",
        ok: "In place",
        okShort: "in place",
        missing: "Missing",
        missV: "not found",
        extra: "Not in the standard",
        extraV: "red tag?",
      }
    : {
        moved: "Moved",
        ok: "Unchanged",
        okShort: "unchanged",
        missing: "Removed from this sheet",
        missV: "removed",
        extra: "Added in this sheet",
        extraV: "new",
      };
const kv = (rows) =>
  `<div class="kv">${rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join("")}</div>`;
function sheetStats(sh) {
  const objs = sh.objects.filter((o) => scopeObj(o)),
    marks = sh.marks.filter((m) => scopeMark(m)),
    routes = sh.routes.filter((r) => scopeMark(r)),
    a = scopeArea();
  return (
    (a
      ? `<p class="small muted" style="margin:0 0 6px">Showing ${esc(a.name)} only. Counts are for this area.</p>`
      : "") +
    kv([
      ["Movable items", objs.filter((o) => o.kind === "item").length],
      ["Zones and keep-clear", objs.filter((o) => o.kind !== "item").length],
      [
        "Floor tape",
        marks.length
          ? fmtLen(marks.reduce((t, m) => t + markLen(m), 0))
          : "None",
      ],
      ["Routes", routes.length],
    ])
  );
}
function paneItem() {
  const sh = S(),
    sel = selected(),
    u = uName();
  if (!sel.length) {
    const blank = !sh.objects.length && !sh.marks.length && !sh.routes.length;
    if (blank && sh.kind === "standard")
      return `<h2>Build the standard first</h2><ol class="steps">
<li><b>Set the scale.</b> Use Measure on a distance you know so sizes, tolerances and walking are in metres.</li>
<li><b>Place every movable item</b> where it should live. Tick “home marked on the floor” for corner tape.</li>
<li><b>Plan the floor tape</b>: walkways, WIP, red tag area, keep-clear.</li>
<li><b>Trace the ideal routes</b> people and trucks should take.</li>
<li><b>Pin the documents</b> (SOPs, checklists, boards) where they will live, on the map in the Documents view.</li>
<li>Try a different design as a <b>proposal</b>; the Compare tab shows what changed.</li>
<li>Each day, <b>start a daily check</b>: it copies the standard, you move things to where they really are. The Tracking view shows where things actually sit.</li></ol><div class="btns"><button data-a="loadExample">Open the example model line</button></div>`;
    return `<p class="empty">Select something on the drawing to edit it, or add an item from the left.</p>${sheetStats(sh)}`;
  }
  const backBtn = `<button class="selback" data-a="clearSel">← All items</button>`;
  if (sel.length > 1) {
    const items = sel
        .filter((f) => !f.fx && f.t === "obj" && f.x.kind === "item")
        .map((f) => f.x),
      objs = sel.filter((f) => f.t === "obj").length;
    return `${backBtn}<h2>${sel.length} selected</h2>${categoryAssignmentHTML(items)}${areaSelectHTML(items)}
${objs >= 2 ? `<h3>Line them up</h3><div class="aligngrid">${ALIGN.map(([k, l]) => `<button data-a="align" data-id="${k}"${k.startsWith("dist") && objs < 3 ? " disabled" : ""}>${l}</button>`).join("")}</div>` : ""}
<p class="small muted">Drag any of them to move them together; they snap to the edges of other items and walls (hold Alt to place freely). Arrow keys nudge.</p><div class="btns"><button data-a="dup">Duplicate</button><button data-a="rot90">Rotate 90°</button><button data-a="lock">Lock or unlock</button><button data-a="del" class="danger">Delete</button></div>`;
  }
  const { t, x } = sel[0];
  if (t === "obj") {
    const c = cmpCache;
    let st = "";
    if (c && x.kind === "item") {
      const m = c.moved.find((z) => z.o.id === x.id);
      if (m)
        st = `<div class="status warn"><b>${cmpWords(sh).moved}</b> by ${fmtLen(m.d)}${m.da > P.settings.rotTol ? `, turned ${Math.round(m.da)}°` : ""} against ${esc(c.ref.name)}.<button data-a="back">Move it back to where it is in the standard</button></div>`;
      else if (c.extra.includes(x))
        st = `<div class="status extra"><b>Not in ${esc(c.ref.name)}.</b> ${sh.kind === "daily" ? "Red tag it" : "Remove it"}, or add it to the standard if it belongs.${sh.kind !== "standard" && c.ref.kind === "standard" ? '<button data-a="toStd">Add to the standard here</button>' : ""}</div>`;
      else if (c.ok.includes(x))
        st = `<div class="status ok"><b>${cmpWords(sh).ok}</b> (within ${mpu() ? P.settings.tolM + " m" : P.settings.tolU + " u"})</div>`;
    }
    const bl = (c ? c.blocked : issues(sh).blocked).find(
      (z) => z.o.id === x.id,
    );
    if (bl)
      st += `<div class="status bad"><b>Blocking a keep-clear area:</b> ${esc(bl.z.label)}</div>`;
    const sb = (c || issues(sh)).structure.find((z) => z.o.id === x.id);
    if (sb)
      st += `<div class="status bad"><b>${sb.door ? "Blocking" : "Overlapping"}:</b> ${esc(sb.z.label || "a wall")}</div>`;
    const inStd =
      sh.kind === "daily" &&
      x.kind === "item" &&
      stdFor(sh).objects.some((r) => r.ref === x.ref);
    const dt = DM(sh).datum,
      ox = dt ? dt.x : 0,
      oy = dt ? dt.y : 0,
      step = u === "m" ? 0.05 : 1,
      num = (f, label, v, st2 = step) =>
        `<label class="f">${label}<input data-f="${f}" type="number" step="${st2}" value="${v}"></label>`;
    return (
      backBtn +
      st +
      `<label class="f">Name<input data-f="label" value="${esc(x.label)}"></label>
${x.kind === "item" ? categoryAssignmentHTML([x]) + areaSelectHTML([x]) : ""}
<h3>Size and position</h3>
<div class="row3">${num("w", `Width (${u})`, toUser(x.w))}${num("h", `Depth (${u})`, toUser(x.h))}${num("a", "Turn (°)", Math.round(x.a), 15)}</div>
<div class="row2">${num("px", `Across (${u})`, toUser(x.x - ox))}${num("py", `Down (${u})`, toUser(x.y - oy))}</div>
<p class="small muted" style="margin:-4px 0 8px">Centre of the item, measured from ${dt ? "the datum" : 'the top-left corner of the drawing. <button class="linkbtn" data-a="setDatum">Set a datum</button> to measure from a column or door instead'}.</p>
<h3>Look and type</h3>
<div class="row2"><label class="f">Type<select data-f="kind"><option value="item"${x.kind === "item" ? " selected" : ""}>Movable item</option><option value="zone"${x.kind === "zone" ? " selected" : ""}>Marked zone</option><option value="keepclear"${x.kind === "keepclear" ? " selected" : ""}>Keep-clear zone</option></select></label><label class="f">Colour<input data-f="c" type="color" value="${esc(x.c)}"></label></div>
${x.kind === "item" ? (sh.kind === "daily" ? '<p class="small muted">Floor home marks come from the standard, so you can see when an item has drifted off its tape.</p>' : `<label class="f">Home marking on the floor<select data-f="home"><option value="none"${!x.fp ? " selected" : ""}>None</option><option value="corners"${x.fp && x.fpStyle !== "outline" ? " selected" : ""}>Corner marks</option><option value="outline"${x.fp && x.fpStyle === "outline" ? " selected" : ""}>Full outline</option></select></label>${x.fp ? `<label class="chk"><input type="checkbox" data-f="fpLaid"${x.fpLaid ? " checked" : ""}>Home tape is laid on the floor</label>` : ""}`) : ""}
<label class="f">Note<textarea data-f="note" rows="2" placeholder="e.g. Returns here after every changeover">${esc(x.note || "")}</textarea></label>
<div class="btns">${x.kind === "item" ? '<button data-a="tagItem">Red tag this</button>' : ""}<button data-a="del" class="danger">${inStd ? "Mark missing" : "Delete"}</button></div>
<p class="small muted">${x.locked ? "Locked: unlock it from the toolbar under it to move or resize it. " : ""}Catalogue type: ${esc(x.type)}. Rotate, duplicate and lock from the toolbar under the selection.</p>`
    );
  }
  if (t === "area") return paneArea(x);
  if (t === "mark") {
    const nar =
      x.kind === "aisle" &&
      mpu() &&
      x.width * mpu() < P.marking.minAisle - 1e-6;
    return `<h2>${x.kind === "aisle" ? "Walkway (aisle)" : x.kind === "arrow" ? "Floor arrow" : "Floor tape"}, run ${runNo(sh, x)}</h2><label class="f">Colour and use<select data-f="type">${Object.entries(
      TAPE,
    )
      .map(
        ([k, v]) =>
          `<option value="${esc(k)}"${x.type === k ? " selected" : ""}>${esc(v.n)}</option>`,
      )
      .join("")}</select></label>
<div class="row2"><label class="f">Status<select data-f="status">${[
      ["planned", "Planned"],
      ["laid", "Laid"],
      ["worn", "Worn, needs relaying"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${esc(v)}"${x.status === v ? " selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="f">Laid on<input data-f="laid" type="date" value="${esc(x.laid || "")}"></label></div>
${x.kind === "aisle" ? `<label class="f">Width, edge to edge (${u})<input data-f="width" type="number" min="0.1" step="${u === "m" ? 0.05 : 0.5}" value="${toUser(x.width)}"></label>${nar ? `<div class="status warn">Narrower than the ${P.marking.minAisle} m minimum set in the marking standard.</div>` : ""}` : ""}
${x.kind === "line" ? `<label class="chk"><input type="checkbox" data-f="closed"${x.closed ? " checked" : ""}>Closed shape</label>` : ""}
${kv([
  ["Length", fmtLen(markLen(x))],
  ["Tape needed", x.kind === "arrow" ? "1 arrow" : fmtLen(markTape(x))],
  ["Points", x.pts.length],
])}
<label class="f">Note<textarea data-f="note" rows="2" placeholder="e.g. Use hazard tape at the step">${esc(x.note || "")}</textarea></label>
<p class="small muted">Drag the white dots to reshape. Drag the line to move it. Set it to Laid once it is on the floor.</p><div class="btns"><button data-a="dup">Duplicate</button><button data-a="del" class="danger">Delete</button></div>`;
  }
  if (t === "route") {
    const L = polyLen(x.pts),
      tot = L * perShift(x),
      m = mpu();
    return `<h2>Route</h2><label class="f">Name<input data-f="name" value="${esc(x.name)}"></label>
<label class="f">Who<select data-f="who"><option value="walk"${x.who === "walk" ? " selected" : ""}>Person walking</option><option value="vehicle"${x.who === "vehicle" ? " selected" : ""}>Pallet truck or FLT</option></select></label>
<div class="row2"><label class="f">Trips<input data-f="trips" type="number" min="0.1" step="1" value="${esc(x.trips)}"></label><label class="f">Per<select data-f="per"><option value="shift"${x.per === "shift" ? " selected" : ""}>Shift</option><option value="hour"${x.per === "hour" ? " selected" : ""}>Hour</option></select></label></div>
${kv([["One trip", fmtLen(L)], ["Per shift", fmtLen(tot)], ...(m && x.who === "walk" ? [["Walking time per shift", fmtTime((tot * m) / P.settings.walk)]] : [])])}
<div class="btns"><button data-a="dup">Duplicate</button><button data-a="del" class="danger">Delete</button></div>`;
  }
  return "";
}

function rowsHTML(title, col, rows, extra = "") {
  if (!rows.length) return "";
  return `<h3><span>${title}</span><span class="count">${rows.length}</span></h3>${extra}${rows.map((r) => `<button class="irow" style="--c:${col}" data-go="${n2(r.x)},${n2(r.y)}"${r.id ? ` data-sel="${esc(r.id)}"` : ""}><span>${esc(r.l)}</span><span>${esc(r.v || "")}</span></button>`).join("")}`;
}
function paneCheck() {
  const sh = S(),
    c = cmpCache;
  let h = "";
  const iss = c || issues(sh);
  if (!c) {
    if (sh.kind === "standard")
      h += `<h2>This is the standard</h2><p class="small">Proposals and daily checks are compared against this layout.</p><p class="small muted">A daily check copies it. Move anything that is somewhere else, mark missing what is not there and add what should not be. This tab then scores it. A proposal lists what moved, what was removed and what is new.</p><div class="btns"><button class="pri" data-a="newDaily">Start today's check</button></div>`;
    else
      h += `<p class="empty">Pick a sheet in “Compare with” above the drawing to check this one against it.</p>`;
    h += sheetStats(sh);
  } else {
    const sc = c.score;
    if (
      sh.kind === "daily" &&
      c.ref._rev &&
      P.revisions[c.ref._rev] &&
      P.revisions[c.ref._rev].sig !== stdSig()
    )
      h += `<div class="status extra">Scored against the standard as it was on ${esc(fmtDate(c.ref._date))}. The standard has changed since, and this score stays as it was.<button data-a="rescore">Re-score against the current standard</button></div>`;
    h += `<div class="score"><b class="c-${scoreCls(sc)}">${sc == null ? "–" : sc + "%"}</b><span>${cmpWords(sh).okShort}<br>${c.inPlace} of ${c.items} movable items<br>against ${esc(c.ref.name)}</span></div>`;
    if (sc != null)
      h += `<div class="meter"><i style="width:${sc}%;background:${scoreCol(sc)}"></i></div>`;
    if (!c.issueCount && !c.conflicts.length)
      h += `<div class="status ok"><b>Nothing out of standard.</b> Everything is where it should be.</div>`;
    h += rowsHTML(
      cmpWords(sh).moved,
      "#F79622",
      c.moved
        .sort((a, b) => b.d - a.d)
        .map((m) => ({
          l: m.o.label,
          v:
            fmtLen(m.d) +
            (m.da > P.settings.rotTol ? ", " + Math.round(m.da) + "°" : ""),
          x: m.o.x,
          y: m.o.y,
          id: m.o.id,
        })),
    );
    h += rowsHTML(
      cmpWords(sh).missing,
      COL.bad,
      c.missing.map((r) => ({
        l: r.label,
        v: cmpWords(sh).missV,
        x: r.x,
        y: r.y,
      })),
      sh.kind !== "standard"
        ? `<div class="btns" style="margin-top:0"><button data-a="restoreAll">Put them all back</button></div>`
        : "",
    );
    h += rowsHTML(
      cmpWords(sh).extra,
      COL.extra,
      c.extra.map((o) => ({
        l: o.label,
        v: cmpWords(sh).extraV,
        x: o.x,
        y: o.y,
        id: o.id,
      })),
    );
    h += rowsHTML(
      "Tape missing from this sheet",
      COL.bad,
      c.tapeMissing.map((m) => ({
        l: tapeOf(m.type).n,
        v: fmtLen(markLen(m)),
        x: m.pts[0].x,
        y: m.pts[0].y,
      })),
    );
  }
  h += rowsHTML(
    "Blocking keep-clear areas",
    COL.bad,
    iss.blocked.map((b) => ({
      l: b.o.label,
      v: b.z.label,
      x: b.o.x,
      y: b.o.y,
      id: b.o.id,
    })),
  );
  h += rowsHTML(
    "Outside the area they are designated to",
    COL.warn,
    (iss.outOfArea || []).map((z) => ({
      l: z.o.label,
      v: z.a.name,
      x: z.o.x,
      y: z.o.y,
      id: z.o.id,
    })),
  );
  h += rowsHTML(
    "Overlapping walls or fixed objects",
    COL.bad,
    iss.structure.map((b) => ({
      l: b.o.label,
      v: (b.door ? "Blocking " : "") + (b.z.label || "Wall"),
      x: b.o.x,
      y: b.o.y,
      id: b.o.id,
    })),
  );
  h += rowsHTML(
    "Routes through walls or fixed objects",
    COL.bad,
    iss.wallHits.map((w) => ({
      l: w.r.name,
      v: w.z.label || "Wall",
      x: w.x,
      y: w.y,
    })),
  );
  h += rowsHTML(
    "Blocking a marked walkway",
    COL.bad,
    iss.walkBlock.map((b) => ({
      l: b.o.label,
      v: "Run " + runNo(sh, b.m),
      x: b.o.x,
      y: b.o.y,
      id: b.o.id,
    })),
  );
  h += rowsHTML(
    "Walkways running into structure",
    COL.bad,
    iss.aisleClash.map((b) => ({
      l: "Run " + runNo(sh, b.m),
      v: b.z.label || "Wall",
      x: b.x,
      y: b.y,
    })),
  );
  h += rowsHTML(
    "Walkways narrower than " + P.marking.minAisle + " m",
    "#F79622",
    iss.aisleNarrow.map((m) => ({
      l: "Run " + runNo(sh, m),
      v: fmtLen(m.width, sh),
      x: m.pts[0].x,
      y: m.pts[0].y,
      id: m.id,
    })),
  );
  h += rowsHTML(
    "Tape damaged",
    COL.bad,
    iss.damaged.map((m) => ({
      l: tapeOf(m.type).n,
      v: fmtLen(markLen(m)),
      x: m.pts[0].x,
      y: m.pts[0].y,
      id: m.id,
    })),
  );
  h += rowsHTML(
    "People and trucks crossing",
    COL.bad,
    iss.conflicts.map((x) => ({
      l: x.w.name,
      v: "× " + x.v.name,
      x: x.x,
      y: x.y,
    })),
  );
  if (c)
    h += `<div class="btns" style="margin-top:16px"><button data-a="csvDev">Export deviations (CSV)</button></div><p class="small muted">${cmpWords(sh).moved} means shifted more than ${mpu() ? P.settings.tolM + " m" : P.settings.tolU + " drawing units"} or turned more than ${P.settings.rotTol}°. Change this in Settings.</p>`;
  return h;
}
function paneMove() {
  const sh = S(),
    t = moveTotals(sh),
    m = mpu(),
    ref = cmpCache?.ref;
  let h = "";
  h += `<p class="small muted" style="margin-top:0">Trace how people and trucks move. Lines get thicker with more trips; red markers show where walking and vehicle routes cross.</p><div class="btns"><button class="pri" data-a="toolRoute">Trace a route</button></div>`;
  const mins = (v) => (m ? fmtTime((v * m) / P.settings.walk) : "set scale");
  h += kv([
    ["Walking per shift", fmtLen(t.walk)],
    ["Walking time per shift", mins(t.walk)],
    ["Vehicle travel per shift", fmtLen(t.vehicle)],
    ["Crossing points", conflicts(sh).length],
  ]);
  if (ref && ref.routes.length) {
    const rt = moveTotals(ref),
      d = t.walk - rt.walk,
      pc = rt.walk ? Math.round((d / rt.walk) * 100) : 0;
    h += `<div class="status ${d > 0 ? "warn" : "ok"}">Walking is <b>${fmtLen(Math.abs(d))} ${d > 0 ? "more" : "less"}</b> per shift than ${esc(ref.name)}${rt.walk ? ` (${d > 0 ? "+" : ""}${pc}%)` : ""}${m ? `, about ${fmtTime((Math.abs(d) * m) / P.settings.walk)}` : ""}.</div>`;
  } else if (sh.kind !== "standard")
    h += `<p class="small muted">Trace the ideal routes on the standard to compare walking here against it.</p>`;
  if (sh.routes.length)
    h += `<table class="rt"><tr><th>Route</th><th class="n">Trip</th><th class="n">Trips</th><th class="n">Per shift</th></tr>${sh.routes.map((r) => `<tr class="click" data-sel="${esc(r.id)}" data-go="${n2(r.pts[0].x)},${n2(r.pts[0].y)}"><td><span class="who" style="background:${COL[r.who]}"></span>${esc(r.name)}</td><td class="n">${fmtLen(polyLen(r.pts))}</td><td class="n">${r.trips}${r.per === "hour" ? "/h" : ""}</td><td class="n">${fmtLen(polyLen(r.pts) * perShift(r))}</td></tr>`).join("")}</table><div class="btns"><button data-a="csvRoutes">Export routes (CSV)</button></div>`;
  else h += `<p class="empty">No routes on this sheet yet.</p>`;
  h += `<h3>Assumptions</h3><div class="row2"><label class="f">Walking speed (m/s)<input data-set="walk" type="number" step="0.1" min="0.3" value="${esc(P.settings.walk)}"></label><label class="f">Shift length (h)<input data-set="shiftH" type="number" step="0.5" min="1" value="${esc(P.settings.shiftH)}"></label></div>`;
  return h;
}
function paneS5() {
  const sh = S(),
    tot = s5Total(sh);
  let h = "";
  if (sh.kind === "daily")
    h += `<div class="row2"><label class="f">Shift<input data-sf="shift" value="${esc(sh.shift)}"></label><label class="f">Checked by<input data-sf="checker" value="${esc(sh.checker)}"></label></div>`;
  h += `<h3><span>Quick 5S score, 0 to 5 per S</span><span class="count">${tot == null ? "Score all five" : tot + " / 25"}</span></h3>`;
  h += S5.map(
    ([k, n, d]) =>
      `<div class="s5"><div class="lbl"><span>${n}</span></div><p>${d}</p><div class="pts">${[0, 1, 2, 3, 4, 5].map((v) => `<button data-s5="${esc(k)}" data-v="${esc(v)}" class="${sh.s5?.[k] === v ? "on" : ""}">${v}</button>`).join("")}</div></div>`,
  ).join("");
  h += `<label class="f">What works, what gets in the way<textarea data-sf="notes" rows="4" placeholder="Team feedback, what works, open questions">${esc(sh.notes)}</textarea></label>`;
  const mine = P.actions
    .filter((a) => a.sheet === sh.id)
    .sort(
      (a, b) =>
        (a.status === "Done" || a.status === "Cancelled") -
          (b.status === "Done" || b.status === "Cancelled") ||
        (a.due || "9").localeCompare(b.due || "9"),
    );
  h += `<h3><span>Actions from this sheet</span><span class="count">${mine.length}</span></h3>${mine.map((a) => `<button class="irow" style="--c:${actOverdue(a) ? "var(--bad)" : a.status === "Done" ? "var(--ok)" : "#9AA1BC"}" data-act="${esc(a.id)}"><span>${actNo(a)} ${esc(a.title)}</span><span>${esc(a.owner || "no owner")}${a.due ? ", " + esc(fmtD(a.due)) : ""}</span></button>`).join("") || '<p class="empty">None yet.</p>'}<div class="btns"><button data-a="newAct">Add action</button></div>`;
  h += `<label class="f">Quick notes<textarea data-sf="actions" rows="3" placeholder="Jot things down here; turn them into logged actions when ready">${esc(sh.actions)}</textarea></label>${sh.actions.trim() ? '<div class="btns" style="margin-top:-4px"><button data-a="linesToActs">Turn each line into a logged action</button></div>' : ""}`;
  h += `<h3><span>Photos</span><span class="count">${sh.photos.length}</span></h3><div class="photos">${sh.photos.map((p) => (PH[p.id] ? `<button data-photo="${esc(p.id)}" title="${esc(p.cap || "Photo")}"><img src="${esc(PH[p.id])}" alt="${esc(p.cap || "Photo")}"></button>` : "")).join("")}</div><div class="btns"><button data-a="photo">Add photos</button></div><p class="small muted">Photos are shrunk and kept with the project file.</p>`;
  return h;
}

const pane = $("#pane");
pane.addEventListener("click", (e) => {
  if (e.target.closest("select,input,textarea")) return;
  const b = e.target.closest("button,tr");
  if (!b) return;
  if (b.hasAttribute("data-manage-categories")) {
    manageItemCategories();
    return;
  }
  if (b.dataset.categorySelect) {
    ui.hiddenCategories.delete(b.dataset.categorySelect);
    selectCategoryItems(b.dataset.categorySelect);
    return;
  }
  if (b.dataset.categoryApply) {
    const group = b.closest("[data-category-group]"),
      colour = group.querySelector("[data-category-colour]").value;
    applyCategoryColour(b.dataset.categoryApply, colour);
    return;
  }
  if (b.dataset.a) {
    act(b.dataset.a, b);
    return;
  }
  if (b.dataset.act) {
    editAction(b.dataset.act);
    return;
  }
  if (b.dataset.s5) {
    const sh = S(),
      k = b.dataset.s5,
      v = +b.dataset.v;
    checkpoint();
    sh.s5 = sh.s5 || {};
    sh.s5[k] = sh.s5[k] === v ? null : v;
    record("5S score", k + ": " + (sh.s5[k] ?? "cleared"));
    renderAll();
    return;
  }
  if (b.dataset.photo) {
    viewPhoto(b.dataset.photo);
    return;
  }
  if (b.dataset.go) {
    const [x, y] = b.dataset.go.split(",").map(Number);
    if (b.dataset.sel && find(b.dataset.sel)) {
      const f = find(b.dataset.sel);
      if (f.t === "obj" && f.x.kind === "item")
        ui.hiddenCategories.delete(itemCategoryId(f.x));
      ui.sel = [b.dataset.sel];
    }
    centreOn(x, y);
    renderSide();
  }
});
pane.addEventListener("change", (e) => {
  const el = e.target;
  if (el.hasAttribute("data-item-category")) {
    assignSelectedCategory(el.value);
    return;
  }
  if (el.dataset.categoryColour) {
    applyCategoryColour(el.dataset.categoryColour, el.value);
    return;
  }
  if (el.dataset.ms) {
    setMarkStatus(el.dataset.ms, el.value);
    return;
  }
  if (el.dataset.f) {
    setField(el.dataset.f, el.type === "checkbox" ? el.checked : el.value);
    return;
  }
  if (el.dataset.sf) {
    checkpoint();
    S()[el.dataset.sf] = el.value;
    record("Updated", el.dataset.sf);
    renderAll();
    return;
  }
  if (el.dataset.set) {
    const v = Number(el.value);
    if (v > 0) {
      checkpoint();
      P.settings[el.dataset.set] = v;
      renderAll();
    }
  }
});

pane.addEventListener(
  "toggle",
  (e) => {
    const group = e.target;
    if (!group.matches("[data-category-group]") || !pane.contains(group))
      return;
    if (group.open) ui.categoryClosed.delete(group.dataset.categoryGroup);
    else ui.categoryClosed.add(group.dataset.categoryGroup);
  },
  true,
);
