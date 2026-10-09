"use strict";
/* ============ setup: choose what the 5S pages show ============ */
// One place for "whole factory or one area": a plan of the factory with its areas, and a card for
// the whole factory and each area. Choosing one sets the scope (see setScope in 34-areas.js) and
// opens the layout. Areas are still drawn with the Area tool on the layout.

const su = { focus: "" };

function setupPlanSVG(sh) {
  const d = DM(sh),
    k = d.w / 900;
  let s = `<g opacity=".45" pointer-events="none">${quietLayoutSVG(sh, k, false)}</g>`;
  for (const a of areasOn(sh)) {
    const ps = a.pts.map((p) => p.x + "," + p.y).join(" "),
      on = a.id === ui.scope || a.id === su.focus,
      c = areaCentre(a);
    s +=
      `<g data-setup-area="${esc(a.id)}" style="cursor:pointer"><title>${esc(a.name)}</title>` +
      `<polygon points="${ps}" fill="${esc(a.color)}" fill-opacity="${on ? 0.34 : 0.14}" stroke="${esc(a.color)}" stroke-width="${(on ? 4 : 2.4) * k}" stroke-linejoin="round"/>` +
      txt(c.x, c.y, a.name, 13 * k, k, {
        fill: a.color,
        w: 700,
        anchor: "middle",
      }) +
      "</g>";
  }
  return `<svg id="setupSvg" viewBox="0 0 ${d.w} ${d.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Factory plan with its areas">${s}</svg>`;
}

function setupHTML() {
  const sh = STD(),
    list = areasOn(sh),
    items = sh.objects.filter((o) => o.kind === "item"),
    none = items.filter((o) => !areaOf(o, sh) && areaMode(o, sh) !== "none"),
    openT = P.tags.filter((t) => t.status !== "Closed").length,
    openA = P.actions.filter(
      (a) => a.stream === "5s" && !["Done", "Cancelled"].includes(a.status),
    ).length,
    tape = sh.marks.reduce((t, m) => t + markLen(m), 0),
    cur = scopeArea();
  const card = (o) =>
    `<div class="scard${o.on ? " on" : ""}${su.focus && su.focus === o.id ? " focus" : ""}" data-scard="${esc(o.id)}"${o.color ? ` style="--c:${esc(o.color)}"` : ""}>
      <h3>${o.color ? '<span class="swatch"></span>' : ""}${esc(o.name)}${o.on ? '<span class="pill">Showing now</span>' : ""}</h3>
      <p class="muted small">${esc(o.sub)}</p>
      <dl>${o.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      <div class="btns"><button class="pri" data-su="work" data-id="${esc(o.id)}">${o.id ? "Work on this area" : "Work on the whole factory"}</button>${o.id ? `<button data-su="edit" data-id="${esc(o.id)}">Edit shape and items</button>` : ""}</div>
    </div>`;
  return `<header><div><h2>Setup: factory and areas</h2><p class="muted" style="margin:4px 0 0">Choose what the 5S pages show: the <b>whole factory</b>, or <b>one area</b> at a time so the layout is not cluttered. The document pages always show the whole factory.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pri" id="suNew">Draw a new area</button>${list.length ? '<button id="suPrint">Print all areas</button>' : ""}</div></header>
    <div class="setup">
      <div class="splan">${setupPlanSVG(sh)}<p class="small muted" style="margin:6px 2px 0">${list.length ? "Click an area on the plan to pick it." : "No areas yet. Draw one for each zone of the line (for example Packing, Goods-in, Tooling), then choose which one to work on."}</p></div>
      <div class="scards">
        ${card({
          id: "",
          name: "Whole factory",
          sub: "Everything on the drawing. Use it to see the full picture, check the flow and place areas.",
          on: !cur,
          facts: [
            ["Areas", list.length],
            ["Items", items.length],
            ["Floor tape", sh.marks.length ? fmtLen(tape) : "None"],
            ["Open red tags", openT],
            ["Open 5S actions", openA],
          ],
        })}
        ${list
          .map((a) => {
            const st = areaStats(a, sh);
            return card({
              id: a.id,
              name: a.name,
              color: a.color,
              on: cur && cur.id === a.id,
              sub: areaCode(a) + (a.owner ? ", owner " + a.owner : ""),
              facts: [
                ["Items", st.items.length],
                ["Floor tape", st.marks.length ? fmtLen(st.tape) : "None"],
                ["Open red tags", st.tags.length],
                ["Open actions", st.acts.length],
                ["Documents", st.docs.length],
              ],
            });
          })
          .join("")}
        ${none.length ? `<p class="small muted">${none.length} item${none.length > 1 ? "s are" : " is"} in no area yet. They show only on the whole factory.</p>` : ""}
      </div>
    </div>`;
}

function renderSetup() {
  const el = $("#setupView");
  if (!el) return;
  el.innerHTML = setupHTML();
}

function setupWork(id) {
  setView("layout");
  setScope(id);
}
$("#setupView").addEventListener("click", (e) => {
  let b;
  if ((b = e.target.closest("[data-su]"))) {
    if (b.dataset.su === "work") setupWork(b.dataset.id);
    else {
      // editing the shape needs the whole drawing in view
      setupWork("");
      areaAct("areaOpen", { dataset: { id: b.dataset.id } });
    }
  } else if (e.target.closest("#suNew")) {
    setupWork("");
    areaAct("areaNew");
  } else if (e.target.closest("#suPrint")) printAreas(areasOn(STD()));
  else if ((b = e.target.closest("[data-setup-area]"))) {
    su.focus = b.dataset.setupArea;
    renderSetup();
    $(`[data-scard="${su.focus}"]`)?.scrollIntoView({ block: "nearest" });
  }
});
