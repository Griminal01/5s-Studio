"use strict";
/* ============ navigation: three sections, their pages, badges, deep links ============ */
// Three sections (5S, Document mapping, Improve), each with its own pages in a bar under the header.
// 5S pages can be scoped to one area (see setScope in 34-areas.js); the document map and the
// overview always show the whole factory. The address bar follows the page (#/layout/<area>,
// #/problems/<id>/board) so reload keeps your place and the browser Back button works.
const NAV = [
  {
    id: "5s",
    g: "5S",
    short: "5S",
    items: [
      ["layout", "Layout"],
      ["boards", "Boards"],
      ["tracking", "Tracking"],
      ["tags", "Red tags"],
      ["actions", "5S actions"],
    ],
  },
  {
    id: "docs",
    g: "Document mapping",
    short: "Documents",
    items: [
      ["documents", "Document list"],
      ["docmap", "Factory map"],
      ["docactions", "Document actions"],
    ],
  },
  {
    id: "improve",
    g: "Improve",
    short: "Improve",
    items: [
      ["problems", "Problem solving"],
      ["smed", "SMED"],
    ],
  },
];
const NAV_ITEMS = NAV.flatMap((g) => g.items);
const SCOPED_VIEWS = ["layout", "boards", "tracking", "tags", "actions"];
const sectionOf = (v) =>
  NAV.find((g) => g.items.some((i) => i[0] === v)) || NAV[0];
const navLabel = (v) => NAV_ITEMS.find((i) => i[0] === v)?.[1] || "";
const lastPage = { "5s": "layout", docs: "docmap", improve: "problems" };
let subnavSig = "";

function renderNav() {
  const cur = sectionOf(ui.view);
  const sec = (cls) =>
    NAV.map(
      (g) =>
        `<button data-section="${g.id}" class="${cls}${g.id === cur.id ? " on" : ""}"${g.id === cur.id ? ' aria-current="true"' : ""}><span>${cls === "tab" ? g.short : g.g}</span><span class="bdg late" data-sbadge="${g.id}" hidden></span></button>`,
    ).join("");
  $("#gnav").innerHTML = sec("sec");
  $("#tabbar").innerHTML = sec("tab");
  renderSubnav(true);
  document.title = "Lean Studio · " + navLabel(ui.view);
}
/* the pages of the current section, and the area picker for 5S pages */
function renderSubnav(force) {
  const cur = sectionOf(ui.view),
    areas = P ? areasOn(S()) : [],
    sig = [
      cur.id,
      ui.view,
      ui.scope,
      areas.map((a) => a.id + a.name).join(),
    ].join("|");
  if (!force && sig === subnavSig) return;
  subnavSig = sig;
  $("#subnav").innerHTML =
    `<div class="subpages" role="tablist">${cur.items
      .map(
        ([v, l]) =>
          `<button data-view="${v}" role="tab" class="${v === ui.view ? "on" : ""}"${v === ui.view ? ' aria-current="page"' : ""}><span>${l}</span><span class="bdg" data-badge="${v}" hidden></span></button>`,
      )
      .join("")}</div>` +
    (cur.id === "5s"
      ? `<label class="scopepick" title="Work on one area at a time so the layout is not cluttered"><span>Area</span><select id="scopeSel" aria-label="Area to work on"><option value="">Whole factory</option>${areas.map((a) => `<option value="${esc(a.id)}"${a.id === ui.scope ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>`
      : `<span class="subnote">${cur.id === "docs" ? "Always the whole factory" : ""}</span>`);
  updateNavBadges();
}
/* counts on the page buttons (open things, red when something is late) and on the sections (late things) */
function updateNavBadges() {
  if (!P) return;
  const open = (a) => !["Done", "Cancelled"].includes(a.status),
    acts = (st) => P.actions.filter((a) => a.stream === st && open(a)),
    openT = P.tags.filter((t) => t.status !== "Closed"),
    liveD = P.documents.filter((d) => d.status !== "Withdrawn"),
    openP = P.problems.filter(probOpen),
    pages = {
      tags: [openT.length, openT.filter(tagOverdue).length],
      actions: [acts("5s").length, acts("5s").filter(actOverdue).length],
      documents: [liveD.length, liveD.filter(docOverdue).length],
      docactions: [acts("doc").length, acts("doc").filter(actOverdue).length],
      problems: [openP.length, openP.filter(probLate).length],
    };
  const late = (ids) => ids.reduce((n, v) => n + (pages[v]?.[1] || 0), 0),
    sections = {
      "5s": late(["tags", "actions"]),
      docs: late(["documents", "docactions"]),
      improve: late(["problems"]),
    };
  $$("[data-badge]").forEach((el) => {
    const [n, l] = pages[el.dataset.badge] || [0, 0];
    el.hidden = !n;
    el.textContent = n;
    el.classList.toggle("late", l > 0);
  });
  $$("[data-sbadge]").forEach((el) => {
    const n = sections[el.dataset.sbadge] || 0;
    el.hidden = !n;
    el.textContent = n;
    el.title = n + " overdue";
  });
  renderSubnav(false);
}

function setView(v, fromHash = false) {
  if (!NAV_ITEMS.some((i) => i[0] === v)) v = "layout";
  if (ui.editDrawing && v !== "layout") setEditDrawing(false);
  const was = ui.view;
  ui.view = v;
  lastPage[sectionOf(v).id] = v;
  // the action pages differ only in which section's actions they show
  if (v === "actions" || v === "docactions")
    ui.reg.acts.stream = v === "docactions" ? "doc" : "5s";
  if (!fromHash) syncHash(true);
  renderNav();
  $("#layoutView").hidden = v !== "layout";
  const reg = v === "tags" || v === "actions" || v === "docactions";
  $("#regView").hidden = !reg;
  $("#docView").hidden = v !== "documents" && v !== "docmap";
  $("#boardView").hidden = v !== "boards";
  $("#smedView").hidden = v !== "smed";
  $("#trackView").hidden = v !== "tracking";
  $("#problemView").hidden = v !== "problems";
  $("#days").hidden = v !== "layout";
  document.body.dataset.section = v;
  if (reg) renderRegister();
  else if (v === "tracking") renderTracking();
  else if (v === "boards") renderBoards();
  else if (v === "smed") renderSmed();
  else if (v === "documents" || v === "docmap") renderDocuments();
  else if (v === "problems") renderProblems();
  else {
    // coming back to the layout: re-fit when the area being worked on changed meanwhile
    if (was !== "layout") ui.vb = null;
    draw();
  }
  window.scrollTo(0, 0);
}

/* ---- navigation events ---- */
document.addEventListener("click", (e) => {
  const sec = e.target.closest("[data-section]");
  if (sec && sec.closest("#gnav,#tabbar")) {
    const g = NAV.find((x) => x.id === sec.dataset.section);
    // open the page last used in that section
    return void setView(
      sectionOf(ui.view).id === g.id ? g.items[0][0] : lastPage[g.id],
    );
  }
  const b = e.target.closest("[data-view]");
  if (b && b.closest("#subnav")) setView(b.dataset.view);
});
document.addEventListener("change", (e) => {
  if (e.target.id === "scopeSel") {
    if (ui.view !== "layout" && !SCOPED_VIEWS.includes(ui.view)) return;
    setScope(e.target.value);
  }
});

/* ---- the address bar follows the page ---- */
function hashFor() {
  let h = "#/" + ui.view;
  if (SCOPED_VIEWS.includes(ui.view) && ui.scope) h += "/" + ui.scope;
  if (ui.view === "problems") {
    if (ui.prob.tab === "pareto") h += "/pareto";
    else if (ui.prob.sel) h += "/" + ui.prob.sel + "/" + ui.prob.sub;
  }
  return h;
}
function syncHash(push) {
  if (!P) return;
  const h = hashFor();
  if (location.hash === h) return;
  try {
    history[push ? "pushState" : "replaceState"](null, "", h);
  } catch {}
}
function applyHash() {
  const m = location.hash.match(/^#\/(\w+)(?:\/([^/]+))?(?:\/([^/]+))?/);
  if (!m || !NAV_ITEMS.some((i) => i[0] === m[1])) return false;
  if (SCOPED_VIEWS.includes(m[1])) {
    const a = m[2] && P.areas.find((x) => x.id === m[2]);
    ui.scope = a ? a.id : "";
    ui.reg.tags.area = ui.reg.acts.area = ui.scope;
    ui.vb = null;
  }
  if (m[1] === "problems") {
    ui.prob.sel = "";
    ui.prob.tab = "list";
    if (m[2] === "pareto") ui.prob.tab = "pareto";
    else if (m[2] && P.problems.some((x) => x.id === m[2])) {
      ui.prob.sel = m[2];
      if (["board", "details"].includes(m[3])) ui.prob.sub = m[3];
    }
  }
  setView(m[1], true);
  return true;
}
window.addEventListener("popstate", () => {
  if (P) applyHash();
});
renderNav();
