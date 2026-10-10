"use strict";
/* ============ state ============
   Global state: the open project P and the UI state ui (view, selection ui.sel, viewbox ui.vb, layers,
   scope). Sheet shortcuts S() current sheet, STD() standard, DM(sh) its drawing, stdFor(daily). Units:
   mpu/upm, toUser/fromUser, fmtLen. newProject(), record() journal, undo: checkpoint() / restore(), find(id). */
let P = null,
  D = {},
  PH = {};
const ui = {
  categoryClosed: new Set(),
  itemQuery: "",
  itemFilter: "",
  itemArea: "",
  scope: "", // "" = the whole factory, or the id of the area being worked on
  hiddenCategories: new Set(),
  editDrawing: false,
  wall: { th: 0.2 },
  tapeMode: "line",
  aisleW: 1.5,
  view: "layout",
  tool: "select",
  areaLevel: "zone",
  fromSetup: "",
  tap: null,
  sel: [],
  tab: "item",
  cmp: "auto",
  drift: {
    n: 0,
    view: "fit",
    moved: false,
    extras: true,
    focus: "",
    all: false,
  },
  prob: {
    sel: "",
    tab: "list",
    sub: "board",
    newCause: "",
    st: "open",
    owner: "",
    area: "",
    q: "",
    by: "category",
    measure: "mins",
    range: "all",
    closed: true,
  },
  reg: {
    tags: { st: "open", owner: "", cat: "", area: "", q: "" },
    acts: { st: "open", owner: "", s5: "", area: "", stream: "5s", q: "" },
    docs: { tab: "map", st: "all", type: "", owner: "", area: "", q: "" },
    tasks: {
      freq: "",
      who: "",
      q: "",
      tab: "list",
      sheet: "",
      cmp: "",
      focus: "",
    },
    ideas: { tab: "log", st: "open", q: "" },
  },
  layers: {
    drawing: true,
    fixed: true,
    dims: false,
    runs: false,
    fade: false,
    grid: false,
    marks: true,
    objects: true,
    routes: true,
    overlay: true,
    snap: true,
    pins: true,
    docs: false, // documents have their own map in the Documents view
    areas: true,
    labels: true,
  },
  vb: null,
  draft: null,
  drag: null,
  cursor: null,
  space: false,
  tape: "walkway",
  route: { name: "", who: "walk", trips: 1, per: "shift" },
};
let undoS = [],
  redoS = [],
  dirtyImg = false;

const S = () => P.sheets.find((s) => s.id === P.active) || P.sheets[0];
const STD = () => P.sheets.find((s) => s.kind === "standard");
const DM = (sh) => P.drawings[(sh || S()).drawing];
const mpu = (sh) => DM(sh)?.mpu || null;
const upm = (sh) => {
  const m = mpu(sh);
  return m ? 1 / m : 8;
};
const uName = (sh) => (mpu(sh) ? "m" : "u");
const toUser = (u, sh) => {
  const m = mpu(sh);
  return m ? n2(u * m) : Math.round(u * 10) / 10;
};
const fromUser = (v, sh) => {
  const m = mpu(sh);
  return m ? v / m : v;
};
function fmtLen(u, sh) {
  const m = mpu(sh);
  if (!m) return Math.round(u) + " u";
  const v = u * m;
  return (
    (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v)) + " m"
  );
}
const fmtTime = (s) =>
  s < 60
    ? Math.round(s) + " s"
    : s < 3600
      ? Math.round(s / 60) + " min"
      : Math.floor(s / 3600) + " h " + Math.round((s % 3600) / 60) + " min";
const tolU = (sh) => (mpu(sh) ? P.settings.tolM / mpu(sh) : P.settings.tolU);
const snapStep = (sh) => (mpu(sh) ? 0.1 / mpu(sh) : 1);
const gridStep = (sh) => (mpu(sh) ? 1 / mpu(sh) : 10);

function blankSheet(kind, name, drawing) {
  return {
    id: uid(),
    kind,
    name,
    date: today(),
    drawing,
    objects: [],
    marks: [],
    routes: [],
    notes: "",
    actions: "",
    s5: {},
    photos: [],
    shift: "",
    checker: "",
  };
}
const stdOf = (p) => p.sheets.find((s) => s.kind === "standard");
function stdSig(p = P) {
  const s = stdOf(p);
  return JSON.stringify([
    s.objects.map((o) => [
      o.ref,
      o.kind,
      o.label,
      o.x,
      o.y,
      o.w,
      o.h,
      o.a,
      o.fp ? 1 : 0,
      o.fpStyle,
      o.fpLaid ? 1 : 0,
    ]),
    s.marks.map((m) => [
      m.ref,
      m.type,
      m.closed ? 1 : 0,
      m.pts,
      m.status,
      m.kind,
      m.width,
    ]),
    s.routes.map((r) => [r.ref, r.who, r.trips, r.per, r.pts]),
  ]);
}
function stdRev(p = P) {
  const sig = stdSig(p);
  for (const [id, r] of Object.entries(p.revisions))
    if (r.sig === sig) return id;
  const s = stdOf(p),
    id = uid();
  p.revisions[id] = {
    sig,
    date: today(),
    objects: clone(s.objects),
    marks: clone(s.marks),
    routes: clone(s.routes),
  };
  return id;
}
/* only daily checks use revisions: drop the ones no check points at any more */
function pruneRevisions(p = P) {
  const used = new Set(
    p.sheets.filter((s) => s.kind === "daily").map((s) => s.rev),
  );
  for (const id of Object.keys(p.revisions))
    if (!used.has(id)) delete p.revisions[id];
}
/* what a daily check is scored against: the standard as it was when the check started */
function stdFor(sh) {
  const std = STD();
  if (!sh || sh.kind !== "daily" || !sh.rev) return std;
  const r = P.revisions[sh.rev];
  if (!r) return std;
  return {
    ...std,
    drawing: sh.drawing,
    objects: r.objects,
    marks: r.marks,
    routes: r.routes,
    _rev: sh.rev,
    _date: r.date,
  };
}
function newProject() {
  D = {};
  const std = blankSheet("standard", "Standard layout", "d1");
  P = {
    version: 14,
    app: "5s-studio",
    itemCategories: clone(DEFAULT_ITEM_CATEGORIES),
    marking: {
      types: clone(DEFAULT_TYPES),
      roll: 33,
      waste: 10,
      minAisle: 1.2,
      homeType: "walkway",
      std: { no: "", rev: "", owner: "" },
    },
    revisions: {},
    tags: [],
    actions: [],
    areas: [],
    problems: [],
    ideas: [],
    documents: [],
    tasks: [],
    counters: {
      tag: 0,
      act: 0,
      doc: 0,
      board: 0,
      smed: 0,
      area: 0,
      line: 0,
      prob: 0,
      task: 0,
      idea: 0,
    },
    drawings: {
      d1: {
        w: 1000,
        h: 1000 / RATIO0,
        mpu: null,
        name: "Area drawing",
        fixed: [],
      },
    },
    sheets: [std],
    active: std.id,
    logo: "",
    settings: {
      tolM: 0.5,
      tolU: 4,
      rotTol: 20,
      walk: 1.2,
      shiftH: 8,
      target: 90,
    },
    journal: [],
  };
}
function record(action, detail) {
  P.journal.push({
    at: new Date().toISOString(),
    sheet: S()?.name || "",
    action,
    detail: detail || "",
  });
  if (P.journal.length > 3000) P.journal.splice(0, P.journal.length - 3000);
  if (UNDO_AFTER.test(action)) offerUndo(action, detail);
}
// Images are immutable strings: keep references rather than stringify them per edit.
function historySnapshot() {
  return {
    project: JSON.stringify(P),
    drawings: { ...D },
    photos: { ...PH },
  };
}
function trimHistory(stack) {
  let bytes = 0;
  for (let i = stack.length - 1; i >= 0; i--) {
    bytes += stack[i].project.length * 2;
    if (
      (bytes > 24 * 1024 * 1024 || stack.length - i > 80) &&
      i < stack.length - 1
    ) {
      stack.splice(0, i + 1);
      break;
    }
  }
}
function checkpoint() {
  undoS.push(historySnapshot());
  trimHistory(undoS);
  redoS = [];
}
function restore(from, to) {
  if (!from.length) return;
  to.push(historySnapshot());
  trimHistory(to);
  const snapshot = from.pop();
  P = JSON.parse(snapshot.project);
  D = snapshot.drawings;
  PH = snapshot.photos;
  dirtyImg = true;
  // keep the zoom and pan: undo should not throw the view back to the whole factory
  if (ui.scope && !scopeArea()) {
    ui.scope = "";
    ui.vb = null;
  }
  ui.sel = ui.sel.filter((id) => find(id));
  ui.draft = null;
  renderAll();
}

/* find element by id in active sheet */
function find(id, sh = S()) {
  for (const [t, arr] of [
    ["obj", sh.objects],
    ["mark", sh.marks],
    ["route", sh.routes],
  ]) {
    const x = arr.find((o) => o.id === id);
    if (x) return { t, x, arr };
  }
  const ar = (P.areas || []).find(
    (a) => a.id === id && a.drawing === sh.drawing,
  );
  if (ar) return { t: "area", x: ar, arr: P.areas };
  const fx = DM(sh)?.fixed || [],
    x = fx.find((o) => o.id === id);
  if (x) return { t: x.t === "wall" ? "mark" : "obj", x, arr: fx, fx: true };
  return null;
}
const selected = () => ui.sel.map((id) => find(id)).filter(Boolean);
