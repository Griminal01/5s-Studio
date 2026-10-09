"use strict";
/* ============ navigation: sections, views, badges, deep links ============ */
// One list drives every place the sections are shown: the header (wide screens), a menu
// (medium screens) and a tab bar at the bottom (phones). The address bar follows the view
// (#/problems/<id>/why), so reloading keeps your place and the browser Back button works.
const NAV = [
  {
    g: "Design",
    items: [
      ["layout", "Layout"],
      ["boards", "Boards"],
      ["documents", "Documents"],
    ],
  },
  {
    g: "Improve",
    items: [
      ["smed", "SMED"],
      ["problems", "Problems"],
    ],
  },
  {
    g: "Follow up",
    items: [
      ["tags", "Red tags"],
      ["actions", "Actions"],
      ["tracking", "Tracking"],
    ],
  },
];
const NAV_ITEMS = NAV.flatMap((g) => g.items);
const NAV_TABS = ["layout", "smed", "problems", "actions"]; // phone tab bar; the rest sit under More
const navLabel = (v) => NAV_ITEMS.find((i) => i[0] === v)?.[1] || "";
const navBtn = (v, l, cls = "") =>
  `<button data-view="${v}" class="${cls}"${ui.view === v ? ' aria-current="page"' : ""}><span>${l}</span><span class="bdg" data-badge="${v}" hidden></span></button>`;
function renderNav() {
  $("#gnav").innerHTML = NAV.map(
    (g) =>
      `<div class="ngrp"><span class="ncap">${g.g}</span><div class="nbtns">${g.items.map(([v, l]) => navBtn(v, l)).join("")}</div></div>`,
  ).join("");
  $("#navSheet").innerHTML = NAV.map(
    (g) =>
      `<div class="nsg"><h3>${g.g}</h3>${g.items.map(([v, l]) => navBtn(v, l, "nsi")).join("")}</div>`,
  ).join("");
  $("#tabbar").innerHTML =
    NAV_TABS.map((v) => navBtn(v, navLabel(v), "tab")).join("") +
    `<button id="tabMore" class="tab" aria-haspopup="true"><span>More</span><span class="bdg" data-badge="more" hidden></span></button>`;
  markNav();
  updateNavBadges();
}
function markNav() {
  $$("[data-view]").forEach((b) => {
    const on = b.dataset.view === ui.view;
    b.classList.toggle("on", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $("#navBtn").innerHTML =
    `<span>${esc(navLabel(ui.view))}</span><span aria-hidden="true"> ▾</span>`;
  $("#tabMore")?.classList.toggle("on", !NAV_TABS.includes(ui.view));
  document.title = "5S Studio · " + navLabel(ui.view);
}
/* counts on the section buttons: open and overdue things */
function updateNavBadges() {
  if (!P) return;
  const openT = P.tags.filter((t) => t.status !== "Closed"),
    openA = P.actions.filter((a) => !["Done", "Cancelled"].includes(a.status)),
    liveD = P.documents.filter((d) => d.status !== "Withdrawn"),
    openP = P.problems.filter(probOpen),
    map = {
      tags: [openT.length, openT.some(tagOverdue)],
      actions: [openA.length, openA.some(actOverdue)],
      documents: [liveD.length, liveD.some(docOverdue)],
      problems: [openP.length, openP.some(probLate)],
    };
  // More: overdue things in the sections that are not on the tab bar
  map.more = [0, NAV_ITEMS.some(([v]) => !NAV_TABS.includes(v) && map[v]?.[1])];
  $$("[data-badge]").forEach((el) => {
    const more = el.dataset.badge === "more",
      [n, late] = map[el.dataset.badge] || [0, false];
    el.hidden = more ? !late : !n;
    el.textContent = more ? "!" : n;
    el.classList.toggle("late", late);
  });
}

function setView(v, fromHash = false) {
  if (!NAV_ITEMS.some((i) => i[0] === v)) v = "layout";
  if (ui.editDrawing && v !== "layout") setEditDrawing(false);
  ui.view = v;
  if (!fromHash) syncHash(true);
  closeNavSheet();
  markNav();
  $("#layoutView").hidden = v !== "layout";
  const reg = v === "tags" || v === "actions";
  $("#regView").hidden = !reg;
  $("#docView").hidden = v !== "documents";
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
  else if (v === "documents") renderDocuments();
  else if (v === "problems") renderProblems();
  else {
    ui.vb = ui.vb || null;
    draw();
  }
  window.scrollTo(0, 0);
}

/* ---- menus ---- */
function closeNavSheet() {
  $("#navSheet").hidden = true;
  $("#navBtn").setAttribute("aria-expanded", "false");
}
function toggleNavSheet() {
  const open = $("#navSheet").hidden;
  $("#navSheet").hidden = !open;
  $("#navBtn").setAttribute("aria-expanded", String(open));
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (b && b.closest("#gnav,#navSheet,#tabbar")) {
    setView(b.dataset.view);
    return;
  }
  if (e.target.closest("#navBtn,#tabMore")) toggleNavSheet();
});
document.addEventListener("pointerdown", (e) => {
  if (!$("#navSheet").hidden && !e.target.closest("#navDrop,#tabbar"))
    closeNavSheet();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#navSheet").hidden) closeNavSheet();
});

/* ---- the address bar follows the view ---- */
function hashFor() {
  let h = "#/" + ui.view;
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
