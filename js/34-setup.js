"use strict";
/* ============ setup: the factory map, then its lines, then the zones in each line ============ */
// Three pages in the Setup section. 1 Factory map: the plan image, its scale, walls and fixed
// equipment. 2 Lines: the outline of each production line. 3 Zones: the zones inside each line.
// Lines and zones are drawn with the Area tool on the layout (P.areas, level "line" / "zone");
// everything else on these pages is edited in place. The other sections choose what to show with
// the Showing picker (see setScope in 34-areas.js).

const su = { focus: "" };

/* ---------- the plan ---------- */
function setupPlanSVG(sh, mode) {
  const d = DM(sh),
    k = d.w / 900;
  let s = `<g opacity=".5" pointer-events="none">${quietLayoutSVG(sh, k, false)}</g>`;
  const all = P.areas.filter((a) => a.drawing === sh.drawing),
    shown = mode === "lines" ? all.filter(isLine) : all,
    // the page's own level is drawn strongly, the other one is a quiet outline
    strong = (a) =>
      mode === "map" ? false : mode === "lines" ? isLine(a) : !isLine(a);
  for (const a of [
    ...shown.filter(isLine),
    ...shown.filter((x) => !isLine(x)),
  ]) {
    const ps = a.pts.map((p) => p.x + "," + p.y).join(" "),
      on = a.id === su.focus,
      c = areaCentre(a),
      st = strong(a);
    s +=
      `<g data-setup-area="${esc(a.id)}"${st ? ' style="cursor:pointer"' : ' pointer-events="none"'}><title>${esc(a.name)}</title>` +
      `<polygon points="${ps}" fill="${esc(a.color)}" fill-opacity="${st ? (on ? 0.34 : 0.14) : 0.03}" stroke="${esc(a.color)}" stroke-opacity="${st ? 1 : 0.45}" stroke-width="${(on ? 4.5 : st ? 2.8 : 1.6) * k}"${isLine(a) ? "" : ` stroke-dasharray="${8 * k} ${4 * k}"`} stroke-linejoin="round"/>` +
      (st
        ? txt(c.x, c.y, a.name, (isLine(a) ? 16 : 13) * k, k, {
            fill: a.color,
            w: 700,
            anchor: "middle",
          })
        : "") +
      "</g>";
  }
  return `<svg id="setupSvg" viewBox="0 0 ${d.w} ${d.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Factory plan">${s}</svg>`;
}
const planBox = (sh, mode, note) =>
  `<div class="splan">${setupPlanSVG(sh, mode)}<p class="small muted" style="margin:6px 2px 0">${note}</p></div>`;

/* ---------- page 1: the factory map ---------- */
function setupMapHTML(sh) {
  const d = DM(sh),
    m = mpu(sh),
    fixed = (d.fixed || []).length,
    hasImg = !!D[sh.drawing],
    steps = [
      [
        hasImg,
        "Plan image",
        hasImg
          ? "A plan of the factory is loaded."
          : "Add a picture of the factory floor plan (PNG, JPG or WebP), or skip this and draw the walls yourself.",
        `<button data-su="img">${hasImg ? "Replace the plan image" : "Add a plan image"}</button>`,
      ],
      [
        !!m,
        "Scale",
        m
          ? `Set: the drawing is ${esc(fmtLen(d.w))} across.`
          : "Measure something you know the real length of (a door, a column grid, a conveyor) to set the scale in metres. Tape lengths and floor areas need it.",
        `<button data-su="scale">${m ? "Set the scale again" : "Set the scale"}</button>`,
      ],
      [
        fixed > 0,
        "Walls and fixed equipment",
        fixed
          ? `${fixed} wall${fixed === 1 ? "" : "s"}, columns and fixed objects drawn.`
          : "Draw the outer walls, doors, columns and machines that never move. They show on every layout.",
        `<button data-su="walls">${fixed ? "Edit walls and fixed equipment" : "Draw walls and fixed equipment"}</button>`,
      ],
    ];
  return `<header><div><h2>1. Factory map</h2><p class="muted" style="margin:4px 0 0">Start with the whole factory: the plan image, its scale, and the walls and fixed equipment. Next you outline the production lines on it, then the zones in each line.</p></div>
    <div style="display:flex;gap:8px"><button class="pri" data-su="next" data-to="lines">Next: lines →</button></div></header>
    <div class="setup">
      ${planBox(sh, "map", "This is the whole factory. Layouts, document maps and the problem board all start from it.")}
      <div class="scards">${steps
        .map(
          ([ok, name, text, btn]) =>
            `<div class="scard${ok ? " done" : ""}"><h3><span class="tick" aria-hidden="true">${ok ? "✓" : "○"}</span>${esc(name)}</h3><p class="muted small">${text}</p><div class="btns">${btn}</div></div>`,
        )
        .join("")}</div>
    </div>`;
}

/* ---------- cards for lines and zones, edited in place ---------- */
function setupCard(a, sh) {
  const line = isLine(a),
    st = areaStats(a, sh),
    word = line ? "line" : "zone",
    lines = linesOn(sh),
    facts = line
      ? [
          ["Zones", zonesOfLine(a).length],
          ["Items", st.items.length],
          ["Tasks", tasksOfZone(a).length],
          ["Floor tape", st.marks.length ? fmtLen(st.tape) : "None"],
          ["Open red tags", st.tags.length],
          ["Open actions", st.acts.length],
        ]
      : [
          ["Items", st.items.length],
          ["Tasks", tasksOfZone(a).length],
          ["Floor tape", st.marks.length ? fmtLen(st.tape) : "None"],
          ["Open red tags", st.tags.length],
          ["Open actions", st.acts.length],
          ["Documents", st.docs.length],
        ];
  return `<div class="scard${su.focus === a.id ? " focus" : ""}" data-scard="${esc(a.id)}" style="--c:${esc(a.color)}">
    <div class="sfields">
      <label>Name<input data-sf="name" data-id="${esc(a.id)}" value="${esc(a.name)}"></label>
      <label>Owner<input data-sf="owner" data-id="${esc(a.id)}" value="${esc(a.owner)}" list="owners" placeholder="Who looks after it"></label>
      ${line ? "" : `<label>Line<select data-sf="parent" data-id="${esc(a.id)}"><option value="">Not in a line</option>${lines.map((l) => `<option value="${esc(l.id)}"${a.parent === l.id ? " selected" : ""}>${esc(l.name)}</option>`).join("")}</select></label>`}
      <label class="scol">Colour<input type="color" data-sf="color" data-id="${esc(a.id)}" value="${esc(a.color)}"></label>
    </div>
    <dl>${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    <div class="btns"><button data-su="work" data-id="${esc(a.id)}" title="Open the 5S pages showing only this ${word}">Show in 5S</button><button data-su="edit" data-id="${esc(a.id)}">Reshape on the map</button><button data-su="del" data-id="${esc(a.id)}" class="danger">Delete</button></div>
  </div>`;
}

/* ---------- page 2: lines ---------- */
function setupLinesHTML(sh) {
  const lines = linesOn(sh);
  return `<header><div><h2>2. Lines</h2><p class="muted" style="margin:4px 0 0">Outline each production line on the factory map (packing line, goods-in, tooling). A line is the big picture of one flow; zones come next.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pri" data-su="newline">Draw a line</button><button data-su="next" data-to="zones">Next: zones →</button></div></header>
    <div class="setup">
      ${planBox(sh, "lines", lines.length ? "Click a line on the plan to find its card." : "No lines yet. Press Draw a line, then click each corner on the map and click the first corner to close it.")}
      <div class="scards">${lines.length ? lines.map((a) => setupCard(a, sh)).join("") : `<div class="emptybox"><b>No lines yet</b>Draw one for each production line. You can skip lines and go straight to zones if the factory is just one line.</div>`}</div>
    </div>`;
}

/* ---------- page 3: zones, grouped by line ---------- */
function setupZonesHTML(sh) {
  const lines = linesOn(sh),
    zones = areasOn(sh),
    groups = [
      ...lines.map((l) => [
        l.name,
        l.color,
        zones.filter((z) => z.parent === l.id),
      ]),
      [
        "Not in a line",
        "#9AA1BC",
        zones.filter((z) => !lines.some((l) => l.id === z.parent)),
      ],
    ].filter(([, , zs], i) => zs.length || i < lines.length),
    items = sh.objects.filter((o) => o.kind === "item"),
    none = items.filter((o) => !areaOf(o, sh) && areaMode(o, sh) !== "none");
  return `<header><div><h2>3. Zones</h2><p class="muted" style="margin:4px 0 0">Zones are the places 5S is done: a work cell, a tool station, a staging area. A zone drawn inside a line joins it. Items belong to the zone they sit in, or you designate them from the layout.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pri" data-su="newzone">Draw a zone</button>${zones.length ? '<button data-su="print">Print all zones</button>' : ""}</div></header>
    <div class="setup">
      ${planBox(sh, "zones", zones.length ? "Click a zone on the plan to find its card." : "No zones yet. Press Draw a zone, then click each corner on the map and click the first corner to close it.")}
      <div class="scards">${
        zones.length
          ? groups
              .map(
                ([name, col, zs]) =>
                  `<h3 class="sgroup" style="--c:${esc(col)}"><span class="swatch"></span>${esc(name)}<span class="count">${zs.length}</span></h3>${zs.length ? zs.map((a) => setupCard(a, sh)).join("") : '<p class="small muted" style="margin:0 0 8px">No zones in this line yet.</p>'}`,
              )
              .join("") +
            (none.length
              ? `<p class="small muted">${none.length} item${none.length > 1 ? "s are" : " is"} in no zone yet. They only show on the whole factory.</p>`
              : "")
          : `<div class="emptybox"><b>No zones yet</b>Draw a zone for each place you will do 5S. Then the 5S, Documents and Improve sections can show one zone at a time.</div>`
      }</div>
    </div>`;
}

function renderSetup() {
  const el = $("#setupView");
  if (!el) return;
  const sh = STD();
  el.innerHTML =
    ui.view === "lines"
      ? setupLinesHTML(sh)
      : ui.view === "zones"
        ? setupZonesHTML(sh)
        : setupMapHTML(sh);
}

/* ---------- actions ---------- */
function setupToLayout(then) {
  ui.fromSetup = ui.view;
  setView("layout");
  setScope("");
  then?.();
}
function setupWork(id) {
  ui.fromSetup = "";
  setView("layout");
  setScope(id);
}
$("#setupView").addEventListener("click", (e) => {
  const b = e.target.closest("[data-su]");
  if (b) {
    const id = b.dataset.id;
    switch (b.dataset.su) {
      case "next":
        return setView(b.dataset.to);
      case "img":
        return $("#fImage").click();
      case "scale":
        return setupToLayout(() => setTool("measure"));
      case "walls":
        return setupToLayout(() => setEditDrawing(true));
      case "newline":
        return setupToLayout(() => areaAct("lineNew"));
      case "newzone":
        return setupToLayout(() => areaAct("areaNew"));
      case "work":
        return setupWork(id);
      case "edit":
        return setupToLayout(() => areaAct("areaOpen", { dataset: { id } }));
      case "print":
        return printAreas(areasOn(STD()));
      case "del":
        return setupDelete(id);
    }
  }
  const g = e.target.closest("[data-setup-area]");
  if (g) {
    su.focus = g.dataset.setupArea;
    renderSetup();
    $(`[data-scard="${su.focus}"]`)?.scrollIntoView({ block: "nearest" });
  }
});
$("#setupView").addEventListener("change", (e) => {
  const f = e.target.dataset.sf,
    a = P.areas.find((x) => x.id === e.target.dataset.id);
  if (!f || !a) return;
  let v = e.target.value;
  if (f === "name") v = v.trim() || a.name;
  if (a[f] === v) return;
  checkpoint();
  a[f] = v;
  record(isLine(a) ? "Line changed" : "Zone changed", a.name);
  if (f === "name" || f === "owner") {
    // keep the cards as they are, so the next click or Tab is not lost to a rebuild
    $("#setupView .splan svg")?.replaceWith(
      Object.assign(document.createElement("div"), {
        innerHTML: setupPlanSVG(
          STD(),
          ui.view === "lines" ? "lines" : ui.view === "zones" ? "zones" : "map",
        ),
      }).firstChild,
    );
    renderSubnav(true);
    save();
  } else renderAll();
});
async function setupDelete(id) {
  const a = P.areas.find((x) => x.id === id);
  if (!a) return;
  const line = isLine(a),
    n = line ? zonesOfLine(a).length : 0,
    ok = await modal(
      `Delete ${line ? "line" : "zone"} ${a.name}?`,
      `<p style="margin-top:0">${line ? `Its ${n} zone${n === 1 ? "" : "s"} stay${n === 1 ? "s" : ""} and ${n === 1 ? "becomes" : "become"} "not in a line".` : "Items designated to it become automatic."} Items, tape and documents are not deleted. You can undo this.</p>`,
      "Delete",
    );
  if (!ok) return;
  checkpoint();
  if (line) for (const z of P.areas) if (z.parent === a.id) z.parent = "";
  releaseArea(a.id);
  for (const pr of P.problems) if (pr.area === a.id) pr.area = "";
  for (const t of P.tasks) if (t.zone === a.id) t.zone = "";
  P.areas.splice(P.areas.indexOf(a), 1);
  if (ui.scope === a.id) ui.scope = "";
  record(line ? "Line deleted" : "Zone deleted", a.name);
  renderAll();
}
