"use strict";
/* ============ navigation: four sections, their pages, badges, deep links ============ */
// Setup (factory map, lines, zones) is done once; 5S, Documents and Improve are the working
// sections. Each has its pages in a bar under the header, and the Showing picker at its right
// chooses the whole factory, one line or one zone (setScope in 34-areas.js). The address bar
// follows the page (#/layout/<zone>, #/problems/<id>/board) so reload keeps your place and the
// browser Back button works.
const NAV = [
  {
    id: "setup",
    g: "Setup",
    short: "Setup",
    items: [
      ["setup", "1 Factory map"],
      ["lines", "2 Lines"],
      ["zones", "3 Zones"],
    ],
  },
  {
    id: "5s",
    g: "5S",
    short: "5S",
    items: [
      ["layout", "Layout"],
      ["tasks", "Operator tasks"],
      ["tracking", "Tracking"],
      ["tags", "Red tags"],
      ["actions", "5S actions"],
    ],
  },
  {
    id: "docs",
    g: "Documents",
    short: "Documents",
    items: [
      ["documents", "Document list"],
      ["docmap", "Document map"],
      ["docactions", "Document actions"],
    ],
  },
  {
    id: "improve",
    g: "Improve",
    short: "Improve",
    items: [
      ["ideas", "Improvement log"],
      ["problems", "Problem solving"],
    ],
  },
];
const NAV_ITEMS = NAV.flatMap((g) => g.items);
// pages that follow the Showing picker (Tracking is always the whole factory)
const SCOPED_VIEWS = [
  "layout",
  "tasks",
  "tags",
  "actions",
  "documents",
  "docmap",
  "docactions",
  "ideas",
  "problems",
];
const SETUP_VIEWS = ["setup", "lines", "zones"];
const sectionOf = (v) =>
  NAV.find((g) => g.items.some((i) => i[0] === v)) || NAV[0];
const navLabel = (v) => NAV_ITEMS.find((i) => i[0] === v)?.[1] || "";
const lastPage = {
  setup: "setup",
  "5s": "layout",
  docs: "docmap",
  improve: "problems",
};
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
/* the options of the Showing picker: the whole factory, then each line with its zones */
function scopeOptionsHTML() {
  const sh = S(),
    lines = linesOn(sh),
    zones = areasOn(sh),
    opt = (a, label) =>
      `<option value="${esc(a.id)}"${a.id === ui.scope ? " selected" : ""}>${esc(label || a.name)}</option>`;
  let h = `<option value="">Whole factory</option>`;
  for (const l of lines)
    h += `<optgroup label="${esc(l.name)}">${opt(l, "All of " + l.name)}${zones
      .filter((z) => z.parent === l.id)
      .map((z) => opt(z))
      .join("")}</optgroup>`;
  const loose = zones.filter((z) => !lines.some((l) => l.id === z.parent));
  if (loose.length)
    h += lines.length
      ? `<optgroup label="Not in a line">${loose.map((z) => opt(z)).join("")}</optgroup>`
      : loose.map((z) => opt(z)).join("");
  return h;
}
/* the pages of the current section, and the Showing picker */
function renderSubnav(force) {
  const cur = sectionOf(ui.view),
    sig = [
      cur.id,
      ui.view,
      ui.scope,
      P ? P.areas.map((a) => a.id + a.name + a.level + a.parent).join() : "",
    ].join("|");
  if (!force && sig === subnavSig) return;
  subnavSig = sig;
  if (P && ui.scope && !scopeArea()) ui.scope = "";
  const scoped = SCOPED_VIEWS.includes(ui.view);
  $("#subnav").innerHTML =
    `<div class="subpages" role="tablist">${cur.items
      .map(
        ([v, l]) =>
          `<button data-view="${v}" role="tab" class="${v === ui.view ? "on" : ""}"${v === ui.view ? ' aria-current="page"' : ""}><span>${l}</span><span class="bdg" data-badge="${v}" hidden></span></button>`,
      )
      .join("")}</div>` +
    (scoped && P
      ? `<label class="scopepick" title="Show the whole factory, or just one line or zone with a little around it"><span>Showing</span><select id="scopeSel" aria-label="Show the whole factory, one line or one zone">${scopeOptionsHTML()}</select></label>`
      : ui.view === "tracking"
        ? '<span class="subnote">Always the whole factory</span>'
        : "");
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
    newI = P.ideas.filter((x) => x.status === "New"),
    pages = {
      tags: [openT.length, openT.filter(tagOverdue).length],
      actions: [acts("5s").length, acts("5s").filter(actOverdue).length],
      documents: [liveD.length, liveD.filter(docOverdue).length],
      docactions: [acts("doc").length, acts("doc").filter(actOverdue).length],
      problems: [openP.length, openP.filter(probLate).length],
      ideas: [newI.length, newI.filter(ideaLate).length],
    };
  const late = (ids) => ids.reduce((n, v) => n + (pages[v]?.[1] || 0), 0),
    sections = {
      "5s": late(["tags", "actions"]),
      docs: late(["documents", "docactions"]),
      improve: late(["ideas", "problems"]),
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
  if (was !== v && document.body.classList.contains("drawfocus"))
    setDrawFocus(false);
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
  $("#setupView").hidden = !SETUP_VIEWS.includes(v);
  $("#taskView").hidden = v !== "tasks";
  if (v !== "layout") ui.fromSetup = "";
  $("#trackView").hidden = v !== "tracking";
  $("#ideaView").hidden = v !== "ideas";
  $("#problemView").hidden = v !== "problems";
  $("#days").hidden = v !== "layout";
  document.body.dataset.section = v;
  if (reg) renderRegister();
  else if (SETUP_VIEWS.includes(v)) renderSetup();
  else if (v === "tasks") renderTasks();
  else if (v === "tracking") renderTracking();
  else if (v === "documents" || v === "docmap") renderDocuments();
  else if (v === "ideas") renderIdeas();
  else if (v === "problems") renderProblems();
  else {
    // coming back to the layout: re-fit when the area being worked on changed meanwhile
    if (was !== "layout") ui.vb = null;
    draw();
  }
  if (was !== v) viewIn();
  window.scrollTo(0, 0);
}
// the page just opened eases in (a short fade and lift; none when motion is turned off)
function viewIn() {
  const el = [
    "#layoutView",
    "#regView",
    "#docView",
    "#setupView",
    "#taskView",
    "#trackView",
    "#ideaView",
    "#problemView",
  ]
    .map((s) => $(s))
    .find((x) => x && !x.hidden);
  if (!el) return;
  el.classList.remove("viewin");
  void el.offsetWidth; // restart the animation
  el.classList.add("viewin");
}

/* ---- navigation events ---- */
document.addEventListener("change", (e) => {
  if (e.target.id === "scopeSel") setScope(e.target.value);
});
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
/* ---- the address bar follows the page ---- */
function hashFor() {
  let h = "#/" + ui.view;
  if (SCOPED_VIEWS.includes(ui.view) && ui.view !== "problems" && ui.scope)
    h += "/" + ui.scope;
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
  if (SCOPED_VIEWS.includes(m[1]) && m[1] !== "problems") {
    const a = m[2] && P.areas.find((x) => x.id === m[2]);
    ui.scope = a ? a.id : "";
    ui.vb = null;
    dm.vb = null;
    ui.sel = ui.sel.filter(selectableInScope);
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
  renderSide();
  return true;
}
window.addEventListener("popstate", () => {
  if (P) applyHash();
});
renderNav();
