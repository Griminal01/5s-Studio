"use strict";
/* ============ task walks and spaghetti diagrams ============
   Each operator task can be placed where it is done (t.at, a point on a drawing). Its walk goes from
   there to the items it uses and back: one round in the shortest order (walkOrder), or there and back
   for each (t.walk).
   Paths are found on a grid over the drawing (walkGrid), around walls and fixed equipment (with a
   little clearance) and other items, through doors; then straightened (walkPath). Items are found by
   ref on the sheet being measured, so a proposal that moves a rack shows the shorter walk.
   taskPerShift() says how often a task happens; the Operator tasks page has a Spaghetti diagram tab
   (walksHTML / drawWalkMap) that follows the Showing picker and the page's filters, can compare two
   sheets, and prints on A3 (printWalks). */

const WALK = { sig: "", grid: null, legs: new Map(), view: null };
const WALK_COL = [
  "#202C86",
  "#D3401D",
  "#1F8A55",
  "#B07C3A",
  "#6B3FA0",
  "#0E7C86",
  "#D99A00",
  "#2F6FD6",
];

// how many times a shift a task happens: typed on the task, or from how often (null = not known)
function taskPerShift(t) {
  if (t.per != null) return t.per;
  if (SHIFT_FREQ.includes(t.freq)) return 1;
  if (t.freq === "Hourly") return P.settings.shiftH || 8;
  return null;
}
const taskPerAuto = (t) => taskPerShift({ ...t, per: null });

/* ---------- the grid: what can be walked through ---------- */
// changes when anything that blocks or is walked to moves
function walkSig(sh) {
  const r = (v) => Math.round(v * 10);
  return (
    sh.id +
    "|" +
    sh.drawing +
    "|" +
    sh.objects
      .filter((o) => o.kind === "item")
      .map((o) => [o.ref, r(o.x), r(o.y), r(o.w), r(o.h), r(o.a)].join(","))
      .join(";") +
    "|" +
    JSON.stringify(DM(sh)?.fixed || []).length +
    ":" +
    fxRects(sh)
      .map((z) => [r(z.x), r(z.y), r(z.w), r(z.a)].join(","))
      .join(";")
  );
}
function walkGrid(sh) {
  const sig = walkSig(sh);
  if (WALK.grid && WALK.sig === sig) return WALK.grid;
  const d = DM(sh),
    u = upm(sh),
    // a fifth of a metre, coarser on a very big drawing so the grid stays quick
    cell = Math.max(0.2 * u, Math.sqrt((d.w * d.h) / 160000)),
    W = Math.max(1, Math.ceil(d.w / cell)),
    H = Math.max(1, Math.ceil(d.h / cell)),
    solid = new Uint8Array(W * H),
    item = new Int16Array(W * H).fill(-1),
    items = sh.objects.filter((o) => o.kind === "item");
  // every cell whose middle lies in the rectangle z grown by pad
  const paint = (z, pad, fn) => {
    const r = {
        x: z.x,
        y: z.y,
        w: z.w + 2 * pad,
        h: z.h + 2 * pad,
        a: z.a || 0,
      },
      c = corners(r),
      x0 = clamp(Math.floor(Math.min(...c.map((p) => p.x)) / cell), 0, W - 1),
      x1 = clamp(Math.floor(Math.max(...c.map((p) => p.x)) / cell), 0, W - 1),
      y0 = clamp(Math.floor(Math.min(...c.map((p) => p.y)) / cell), 0, H - 1),
      y1 = clamp(Math.floor(Math.max(...c.map((p) => p.y)) / cell), 0, H - 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (ptInRect({ x: (x + 0.5) * cell, y: (y + 0.5) * cell }, r))
          fn(y * W + x);
  };
  // walls and fixed equipment, with room for a person's shoulders; doors open the wall again
  for (const z of fxRects(sh)) paint(z, 0.25 * u, (i) => (solid[i] = 1));
  for (const z of fxDoors(sh)) paint(z, 0.3 * u, (i) => (solid[i] = 0));
  items.forEach((o, n) =>
    paint(o, 0.05 * u, (i) => {
      if (item[i] < 0) item[i] = n;
    }),
  );
  WALK.sig = sig;
  WALK.legs.clear();
  WALK.grid = { W, H, cell, solid, item, items, u };
  return WALK.grid;
}

/* ---------- one leg of a walk ---------- */
const SQ2 = Math.SQRT2;
// shortest way on the grid from cell si to any cell where goal[i] is set (A*, 8 ways, no corner cutting)
function gridSearch(G, si, goal, tx, ty, rad, allow) {
  const { W, H, solid, item } = G,
    N = W * H,
    free = (i) => !solid[i] && (item[i] < 0 || item[i] === allow),
    g = new Float32Array(N).fill(Infinity),
    from = new Int32Array(N).fill(-1),
    done = new Uint8Array(N),
    heap = [],
    fs = [];
  const h = (i) => {
    const dx = Math.abs((i % W) - tx),
      dy = Math.abs(((i / W) | 0) - ty);
    return Math.max(0, Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy) - rad);
  };
  const push = (i, f) => {
    heap.push(i);
    fs.push(f);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (fs[p] <= fs[k]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      [fs[p], fs[k]] = [fs[k], fs[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      li = heap.pop(),
      lf = fs.pop();
    if (heap.length) {
      heap[0] = li;
      fs[0] = lf;
      let k = 0;
      for (;;) {
        const a = 2 * k + 1,
          b = a + 1;
        let m = k;
        if (a < heap.length && fs[a] < fs[m]) m = a;
        if (b < heap.length && fs[b] < fs[m]) m = b;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        [fs[m], fs[k]] = [fs[k], fs[m]];
        k = m;
      }
    }
    return top;
  };
  g[si] = 0;
  push(si, h(si));
  while (heap.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    if (goal[i]) {
      const path = [i];
      for (let j = from[i]; j >= 0; j = from[j]) path.push(j);
      return path.reverse();
    }
    const x = i % W,
      y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (done[j] || !free(j)) continue;
        if (dx && dy && (!free(y * W + nx) || !free(ny * W + x))) continue;
        const ng = g[i] + (dx && dy ? SQ2 : 1);
        if (ng < g[j]) {
          g[j] = ng;
          from[j] = i;
          push(j, ng + h(j));
        }
      }
  }
  return null;
}
// the walkable cell nearest a point (the point itself may be on a machine or an item)
function nearFree(G, p, allow = -1) {
  const { W, H, cell, solid, item } = G,
    cx = clamp(Math.floor(p.x / cell), 0, W - 1),
    cy = clamp(Math.floor(p.y / cell), 0, H - 1),
    free = (i) => !solid[i] && (item[i] < 0 || item[i] === allow);
  for (let r = 0; r < Math.max(W, H); r++)
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (free(y * W + x)) return y * W + x;
      }
  return -1;
}
// straighten a grid path: keep a corner only where the straight line would cross something
function pullPath(G, path, start) {
  const { W, cell, solid, item } = G,
    mid = (i) => ({
      x: ((i % W) + 0.5) * cell,
      y: (((i / W) | 0) + 0.5) * cell,
    }),
    clear = (a, b) => {
      const n = Math.ceil((Math.hypot(b.x - a.x, b.y - a.y) / cell) * 2);
      for (let s = 1; s < n; s++) {
        const x = Math.floor((a.x + ((b.x - a.x) * s) / n) / cell),
          y = Math.floor((a.y + ((b.y - a.y) * s) / n) / cell),
          i = y * W + x;
        if (solid[i] || item[i] >= 0) return false;
      }
      return true;
    };
  const pts = [start];
  let a = mid(path[0]);
  for (let k = 2; k < path.length; k++)
    if (!clear(a, mid(path[k]))) {
      a = mid(path[k - 1]);
      pts.push(a);
    }
  if (path.length > 1) pts.push(mid(path[path.length - 1]));
  return pts;
}
// the walk from a point to an item (to = an item) or to a point (to = {x, y}): { pts, len, ok }
function walkPath(sh, from, to) {
  const G = walkGrid(sh),
    isItem = !!to.kind,
    key =
      Math.round(from.x * 10) +
      "," +
      Math.round(from.y * 10) +
      "|" +
      (isItem
        ? "i:" + to.id
        : Math.round(to.x * 10) + "," + Math.round(to.y * 10));
  if (WALK.legs.has(key)) return WALK.legs.get(key);
  const { W, H, cell, solid, item, items, u } = G,
    goal = new Uint8Array(W * H);
  let tx,
    ty,
    rad,
    allow = -1;
  if (isItem) {
    // stand within arm's reach of the item, beside it rather than on it
    const n = items.indexOf(to),
      reach = 0.45 * u + cell,
      r = {
        x: to.x,
        y: to.y,
        w: to.w + 2 * reach,
        h: to.h + 2 * reach,
        a: to.a || 0,
      };
    let any = false;
    const c = corners(r),
      x0 = clamp(Math.floor(Math.min(...c.map((p) => p.x)) / cell), 0, W - 1),
      x1 = clamp(Math.floor(Math.max(...c.map((p) => p.x)) / cell), 0, W - 1),
      y0 = clamp(Math.floor(Math.min(...c.map((p) => p.y)) / cell), 0, H - 1),
      y1 = clamp(Math.floor(Math.max(...c.map((p) => p.y)) / cell), 0, H - 1);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (
          !solid[i] &&
          item[i] < 0 &&
          ptInRect({ x: (x + 0.5) * cell, y: (y + 0.5) * cell }, r)
        ) {
          goal[i] = 1;
          any = true;
        }
      }
    // boxed in on every side: walk onto it instead
    if (!any) {
      allow = n;
      for (let i = 0; i < goal.length; i++)
        if (item[i] === n && !solid[i]) goal[i] = 1;
    }
    tx = to.x / cell;
    ty = to.y / cell;
    rad = Math.hypot(r.w, r.h) / 2 / cell;
  } else {
    const gi = nearFree(G, to);
    if (gi >= 0) goal[gi] = 1;
    tx = to.x / cell;
    ty = to.y / cell;
    rad = 0;
  }
  const si = nearFree(G, from, allow),
    path = si >= 0 ? gridSearch(G, si, goal, tx, ty, rad, allow) : null;
  let res;
  if (path) {
    const pts = pullPath(G, path, from);
    if (!isItem) pts.push({ x: to.x, y: to.y });
    res = { pts, len: polyLen(pts), ok: true };
  } else {
    // no way through: a straight line, shown as blocked
    const pts = [from, { x: to.x, y: to.y }];
    res = { pts, len: polyLen(pts), ok: false };
  }
  WALK.legs.set(key, res);
  return res;
}

/* ---------- a task's walk ---------- */
// the order to visit items in one round: up to 5 items every order is walked; up to 7 every order is
// tried on distances from where each item is reached; more than that, the nearest item next
function walkOrder(sh, at, objs) {
  const n = objs.length;
  if (n < 2) return objs;
  // up to 5 items: every order walked for real, each leg starting where the last one ended
  if (n <= 5) {
    let best = objs,
      bestLen = Infinity;
    const seq = [],
      go = (cur, len, left) => {
        if (len >= bestLen) return;
        if (!left.length) {
          const total = len + walkPath(sh, cur, at).len;
          if (total < bestLen) {
            bestLen = total;
            best = seq.slice();
          }
          return;
        }
        for (let i = 0; i < left.length; i++) {
          const leg = walkPath(sh, cur, left[i]);
          seq.push(left[i]);
          go(
            leg.pts.at(-1),
            len + leg.len,
            left.filter((_, j) => j !== i),
          );
          seq.pop();
        }
      };
    go(at, 0, objs);
    return best;
  }
  const stand = objs.map((o) => walkPath(sh, at, o)),
    from0 = stand.map((l) => l.len),
    back = stand.map((l) => walkPath(sh, l.pts.at(-1), at).len),
    D = objs.map((_, i) =>
      objs.map((o, j) =>
        i === j ? 0 : walkPath(sh, stand[i].pts.at(-1), o).len,
      ),
    );
  if (n > 7) {
    const left = objs.map((_, i) => i),
      out = [];
    let cur = -1;
    while (left.length) {
      let bi = 0;
      for (let k = 1; k < left.length; k++)
        if (
          (cur < 0 ? from0 : D[cur])[left[k]] <
          (cur < 0 ? from0 : D[cur])[left[bi]]
        )
          bi = k;
      cur = left.splice(bi, 1)[0];
      out.push(objs[cur]);
    }
    return out;
  }
  let best = null,
    bestLen = Infinity;
  const used = new Array(n).fill(false),
    seq = [];
  const go = (len) => {
    if (len >= bestLen) return;
    if (seq.length === n) {
      const total = len + back[seq[n - 1]];
      if (total < bestLen) {
        bestLen = total;
        best = seq.slice();
      }
      return;
    }
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      used[j] = true;
      seq.push(j);
      go(len + (seq.length === 1 ? from0[j] : D[seq[seq.length - 2]][j]));
      seq.pop();
      used[j] = false;
    }
  };
  go(0);
  return best.map((i) => objs[i]);
}
// on sheet sh: { items: [{ o, leg }] (one way from where the task is done), legs, len (each time),
// per (times a shift or null), shift (distance a shift or null), ok } or null when not placed there
function taskWalk(t, sh) {
  if (!t.at || t.at.drawing !== sh.drawing) return null;
  const at = { x: t.at.x, y: t.at.y },
    objs = t.items
      .map((r) => sh.objects.find((o) => o.ref === r && o.kind === "item"))
      .filter(Boolean),
    items = objs.map((o) => ({ o, leg: walkPath(sh, at, o) })),
    legs = [];
  if (t.walk === "each")
    for (const { leg } of items)
      legs.push(leg, { ...leg, pts: leg.pts.slice().reverse() });
  else if (objs.length) {
    // one round in the shortest order, then the legs walked in that order
    let cur = at;
    for (const o of walkOrder(sh, at, objs)) {
      const leg = walkPath(sh, cur, o);
      legs.push(leg);
      cur = leg.pts.at(-1);
    }
    legs.push(walkPath(sh, cur, at));
  }
  const len = legs.reduce((n, l) => n + l.len, 0),
    per = taskPerShift(t);
  return {
    items,
    legs,
    len,
    per,
    shift: per == null ? null : len * per,
    ok: legs.every((l) => l.ok),
  };
}
// seconds to walk a distance at the walking speed in Settings (null without a scale)
const walkSecs = (len, sh) =>
  mpu(sh) ? (len * mpu(sh)) / (P.settings.walk || 1.2) : null;

/* ---------- placing a task where it is done ---------- */
function startTaskPlace(id) {
  const t = P.tasks.find((x) => x.id === id);
  if (!t) return;
  if (ui.view !== "layout") setView("layout");
  if (S().drawing !== STD().drawing) openSheet(STD().id);
  ui.placeTask = id;
  setTool("taskat");
}
function placeTaskAt(p) {
  const t = P.tasks.find((x) => x.id === ui.placeTask),
    sh = S();
  ui.placeTask = "";
  setTool("select");
  if (!t) return;
  checkpoint();
  t.at = { x: n2(p.x), y: n2(p.y), drawing: sh.drawing };
  record("Task placed", taskNo(t) + " " + t.name);
  Object.assign(ui.reg.tasks, { tab: "walks", focus: t.id, sheet: sh.id });
  setView("tasks");
  renderAll();
  toast(`${taskNo(t)} placed. Its walk is drawn on the spaghetti diagram.`);
}

/* ---------- the spaghetti diagram (a tab on the Operator tasks page) ---------- */
// sheets on the standard's drawing that a walk can be measured on
const walkSheets = () => P.sheets.filter((s) => s.drawing === STD().drawing);
const walkSheet = () =>
  walkSheets().find((s) => s.id === ui.reg.tasks.sheet) || STD();
const walkCmp = () => {
  const c = walkSheets().find((s) => s.id === ui.reg.tasks.cmp);
  return c && c.id !== walkSheet().id ? c : null;
};
const walkSheetName = (s) =>
  (s.kind === "standard"
    ? "Standard: "
    : s.kind === "proposal"
      ? "Proposal: "
      : "Daily check: ") + s.name;
// work out every walk shown: the rows of the page that are placed, measured on the chosen sheet
function walkData() {
  const sh = walkSheet(),
    ref = walkCmp(),
    rows = tasksFiltered(),
    placed = rows.filter((t) => t.at && t.at.drawing === sh.drawing),
    data = placed.map((t, n) => ({
      t,
      w: taskWalk(t, sh),
      c: ref ? taskWalk(t, ref) : null,
      col: WALK_COL[n % WALK_COL.length],
    }));
  return {
    sh,
    ref,
    data,
    unplaced: rows.filter((t) => !t.at || t.at.drawing !== sh.drawing),
  };
}
const sumShift = (list, key) =>
  list.reduce((n, x) => n + (x[key]?.shift ?? 0), 0);
// the part of the drawing to show: the zone or line being shown, grown to take in every walk
function walkBox(V) {
  const d = DM(V.sh),
    A = scopeArea();
  let b = A ? scopeBox(A) : { x0: 0, y0: 0, x1: d.w, y1: d.h };
  const pts = V.data.flatMap((x) => [
    x.t.at,
    ...x.w.legs.flatMap((l) => l.pts),
    ...(x.c?.legs.flatMap((l) => l.pts) || []),
  ]);
  if (A && pts.length) {
    const m = upm(V.sh) * 1.5;
    b = {
      x0: Math.min(b.x0, ...pts.map((p) => p.x - m)),
      y0: Math.min(b.y0, ...pts.map((p) => p.y - m)),
      x1: Math.max(b.x1, ...pts.map((p) => p.x + m)),
      y1: Math.max(b.y1, ...pts.map((p) => p.y + m)),
    };
  }
  const pad = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.02;
  return { x0: b.x0 - pad, y0: b.y0 - pad, x1: b.x1 + pad, y1: b.y1 + pad };
}
// the walks drawn over a sheet: one colour per task, thicker for more trips a shift
function walkLinesSVG(V, k) {
  const focus = ui.reg.tasks.focus;
  let lines = "",
    marks = "";
  for (const x of V.data) {
    const dim = focus && focus !== x.t.id,
      op = dim ? 0.16 : 0.85,
      wd = (1.6 + Math.min(x.w.per ?? 1, 10) * 0.45) * k;
    for (const l of x.w.legs)
      lines += `<polyline points="${l.pts.map((p) => p.x + "," + p.y).join(" ")}" fill="none" stroke="${l.ok ? x.col : "#C3361A"}" stroke-width="${wd}" stroke-opacity="${op}" stroke-linejoin="round" stroke-linecap="round"${l.ok ? "" : ` stroke-dasharray="${6 * k} ${4 * k}"`}/>`;
    for (const { leg } of x.w.items) {
      const e = leg.pts.at(-1);
      marks += `<circle cx="${e.x}" cy="${e.y}" r="${3.2 * k}" fill="#fff" stroke="${x.col}" stroke-width="${1.6 * k}" opacity="${dim ? 0.3 : 1}"/>`;
    }
  }
  // where each task is done, on top, with its number
  for (const x of V.data) {
    const dim = focus && focus !== x.t.id,
      { x: px, y: py } = x.t.at,
      lab = taskNo(x.t);
    marks += `<g opacity="${dim ? 0.35 : 1}"><circle cx="${px}" cy="${py}" r="${7 * k}" fill="${x.col}" stroke="#fff" stroke-width="${2 * k}"/><text x="${px + 10 * k}" y="${py - 9 * k}" font-size="${11 * k}" font-weight="700" font-family="Segoe UI,system-ui,sans-serif" fill="${x.col}" stroke="#fff" stroke-width="${3 * k}" paint-order="stroke">${esc(lab)}</text></g>`;
  }
  return lines + marks;
}
function walkMapSVG(V, k) {
  const A = scopeArea();
  let s = `<g opacity=".42" pointer-events="none">${quietLayoutSVG(V.sh, k)}</g>`;
  if (A)
    s += `<path d="M-100000 -100000H100000V100000H-100000Z M${A.pts.map((p) => p.x + " " + p.y).join(" L")} Z" fill="#fff" fill-opacity=".5" fill-rule="evenodd" pointer-events="none"/>`;
  return s + walkLinesSVG(V, k);
}
function drawWalkMap() {
  const el = $("#wkSvg"),
    V = WALK.view;
  if (!el || !V) return;
  const b = walkBox(V),
    bw = b.x1 - b.x0,
    bh = b.y1 - b.y0,
    k = Math.max(
      bw / Math.max(1, el.clientWidth),
      bh / Math.max(1, el.clientHeight),
    );
  el.setAttribute("viewBox", `${b.x0} ${b.y0} ${bw} ${bh}`);
  el.innerHTML = walkMapSVG(V, k);
}
function walkItemsCell(x, sh) {
  if (!x.t.items.length) return '<span class="muted">no items linked</span>';
  if (!x.w.items.length)
    return '<span class="muted">its items are not on this sheet</span>';
  return x.w.items
    .map(
      ({ o, leg }) =>
        `<span class="nw">${esc(o.label)} <b>${leg.ok ? esc(fmtLen(leg.len, sh)) : '<span class="late-t">no clear way</span>'}</b></span>`,
    )
    .join(" · ");
}
function walksHTML() {
  const V = walkData(),
    { sh, ref, data } = V,
    F = ui.reg.tasks;
  WALK.view = V;
  const shift = sumShift(data, "w"),
    secs = walkSecs(shift, sh),
    counted = data.filter((x) => x.w.shift != null),
    longest = data.reduce((m, x) => (x.w.len > (m?.w.len ?? -1) ? x : m), null),
    blocked = data.filter((x) => !x.w.ok).length,
    cShift = ref ? sumShift(data, "c") : 0,
    delta = shift - cShift,
    sheets = walkSheets();
  let h = `<div class="filters wkctl"><label>Measured on<select data-w="sheet">${optsKV(
    sheets.map((s) => [s.id, walkSheetName(s)]),
    sh.id,
  )}</select></label><label>Compare with<select data-w="cmp">${optsKV(
    [
      ["", "Nothing"],
      ...sheets
        .filter((s) => s.id !== sh.id)
        .map((s) => [s.id, walkSheetName(s)]),
    ],
    ref?.id || "",
  )}</select></label><span class="grow"></span><button id="wPrint">Print spaghetti diagram</button><button id="wCsv">Export walks (CSV)</button></div>`;
  h += `<div class="kpis wkkpis"><div><b>${esc(fmtLen(shift, sh))}</b><span>Walked a shift${counted.length < data.length ? ` (${counted.length} of ${data.length} tasks)` : ""}</span></div><div><b>${secs == null ? "-" : esc(fmtTime(secs))}</b><span>Walking time a shift</span></div><div><b>${data.length}</b><span>Tasks placed</span></div><div><b>${longest ? esc(fmtLen(longest.w.len, sh)) : "-"}</b><span>Longest walk${longest ? " (" + esc(taskNo(longest.t)) + ")" : ""}</span></div>${
    ref
      ? `<div><b class="${delta < 0 ? "good-t" : delta > 0 ? "late-t" : ""}">${delta > 0 ? "+" : ""}${esc(fmtLen(delta, sh))}</b><span>a shift against ${esc(ref.name)}${cShift ? ` (${delta > 0 ? "+" : ""}${Math.round((delta / cShift) * 100)}%)` : ""}</span></div>`
      : ""
  }</div>`;
  if (!data.length && !V.unplaced.length)
    return (
      h +
      `<p class="empty" style="padding:14px 4px">Nothing matches these filters.</p>`
    );
  h += `<div class="wkmap"><svg id="wkSvg" xmlns="http://www.w3.org/2000/svg" aria-label="Spaghetti diagram" preserveAspectRatio="xMidYMid meet"></svg>${
    data.length
      ? ""
      : '<div class="emptycv"><h3>No task is placed yet</h3><p>Open a task and press Place on the layout, then click where it is done. Its walk to the items it uses is drawn here.</p></div>'
  }</div>`;
  if (blocked)
    h += `<p class="small late-t">${blocked} walk${blocked > 1 ? "s have" : " has"} no clear way through (shown dashed): an item or the place a task is done is shut in by walls or equipment.</p>`;
  if (data.length) {
    h += `<div class="regtbl"><table class="tbl wktbl" style="width:100%"><tr><th>No.</th><th>Task</th><th>Who</th><th>When</th><th class="n">Times a shift</th><th class="n">Each time</th><th class="n">A shift</th>${ref ? `<th class="n">${esc(ref.name)}</th>` : ""}<th>Items it uses, how far</th><th></th></tr>`;
    for (const x of data) {
      const z = zoneName(x.t.zone),
        diff =
          ref && x.c?.shift != null && x.w.shift != null
            ? x.w.shift - x.c.shift
            : null;
      h += `<tr class="click${F.focus === x.t.id ? " wkon" : ""}" data-wfocus="${esc(x.t.id)}"><td><span class="wksw" style="background:${x.col}"></span><b class="nw">${esc(taskNo(x.t))}</b></td><td class="t"><b>${esc(x.t.name)}</b>${z ? `<span class="sub">${esc(z)}</span>` : ""}</td><td>${esc(x.t.who)}</td><td>${esc(x.t.freq)}</td><td class="n">${x.w.per == null ? '<span class="muted">set it</span>' : esc(n2(x.w.per))}</td><td class="n">${esc(fmtLen(x.w.len, sh))}</td><td class="n"><b>${x.w.shift == null ? "-" : esc(fmtLen(x.w.shift, sh))}</b></td>${ref ? `<td class="n">${x.c?.shift == null ? "-" : esc(fmtLen(x.c.shift, sh))}${diff ? `<span class="sub ${diff < 0 ? "good-t" : "late-t"}">${diff > 0 ? "+" : ""}${esc(fmtLen(diff, sh))}</span>` : ""}</td>` : ""}<td>${walkItemsCell(x, sh)}</td><td><button data-taskid="${esc(x.t.id)}">Edit</button></td></tr>`;
    }
    h += "</table></div>";
  }
  if (V.unplaced.length)
    h += `<div class="wkun"><b>Not placed on this drawing yet</b>${V.unplaced
      .map(
        (t) =>
          `<span><span class="nw">${esc(taskNo(t))}</span> ${esc(t.name)} <button data-tplace="${esc(t.id)}">Place on the layout</button></span>`,
      )
      .join("")}</div>`;
  h += `<p class="small muted">Walks go round walls, fixed equipment and other items, through doors, to within reach of each item. Thicker lines are walked more often. "Times a shift" comes from When (every shift is 1, hourly is ${esc(P.settings.shiftH || 8)}); set it on a task that is done as needed, at a changeover or less often than every shift. Walking time uses ${esc(P.settings.walk || 1.2)} m/s from Settings.</p>`;
  return h;
}
// a short summary for the task form: how far each item is from where the task is done
function walkSummaryHTML(t) {
  const sh = STD(),
    w = t.at ? taskWalk(t, sh) : null;
  if (!w || !w.items.length) return "";
  const x = { t, w };
  return `<p class="small wksum"><b>Walk on the standard:</b> ${esc(fmtLen(w.len, sh))} each time${w.shift != null ? `, ${esc(fmtLen(w.shift, sh))} a shift` : ""}. ${walkItemsCell(x, sh)}</p>`;
}

/* ---------- output ---------- */
function printWalks() {
  const V = walkData();
  if (!V.data.length) return toast("Place a task on the layout first.");
  WALK.view = V;
  const b = walkBox(V),
    bw = b.x1 - b.x0,
    bh = b.y1 - b.y0,
    k = Math.max(bw / 1500, bh / 620),
    { sh, ref } = V,
    shift = sumShift(V.data, "w"),
    secs = walkSecs(shift, sh);
  printWithPage(
    `<div class="pd wkprint"><h1>Spaghetti diagram: ${esc(scopeArea()?.name || "the whole factory")}</h1>
    <p class="pdm">${esc(P.projectName || "Lean Studio project")}, ${esc(walkSheetName(sh))}, printed ${esc(fmtD(today()))}. Walked a shift: <b>${esc(fmtLen(shift, sh))}</b>${secs == null ? "" : ` (${esc(fmtTime(secs))})`}${ref ? `; ${esc(ref.name)}: ${esc(fmtLen(sumShift(V.data, "c"), sh))}` : ""}.</p>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x0} ${b.y0} ${bw} ${bh}" preserveAspectRatio="xMidYMid meet">${walkMapSVG(V, k)}</svg>
    <table class="fixed wktbl"><tr><th style="width:7%">No.</th><th style="width:28%">Task</th><th style="width:11%">When</th><th class="n" style="width:7%">Times a shift</th><th class="n" style="width:8%">Each time</th><th class="n" style="width:8%">A shift</th><th>Items it uses, how far</th></tr>${V.data
      .map(
        (x) =>
          `<tr><td><span class="wksw" style="background:${x.col}"></span><b class="nw">${esc(taskNo(x.t))}</b></td><td>${esc(x.t.name)}</td><td>${esc(x.t.freq)}</td><td class="n">${x.w.per == null ? "-" : esc(n2(x.w.per))}</td><td class="n">${esc(fmtLen(x.w.len, sh))}</td><td class="n">${x.w.shift == null ? "-" : esc(fmtLen(x.w.shift, sh))}</td><td>${walkItemsCell(x, sh)}</td></tr>`,
      )
      .join("")}</table></div>`,
    "",
    "size: A3 landscape; margin: 10mm",
  );
}
function csvWalks() {
  const V = walkData(),
    m = (u) => (mpu(V.sh) ? n2(u * mpu(V.sh)) : Math.round(u));
  csv(
    [
      [
        "No.",
        "Task",
        "Zone",
        "Who",
        "When",
        "Times a shift",
        `Each time (${uName(V.sh)})`,
        `A shift (${uName(V.sh)})`,
        "Items and how far",
        "Measured on",
      ],
      ...V.data.map((x) => [
        taskNo(x.t),
        x.t.name,
        zoneName(x.t.zone),
        x.t.who,
        x.t.freq,
        x.w.per ?? "",
        m(x.w.len),
        x.w.shift == null ? "" : m(x.w.shift),
        x.w.items.map(({ o, leg }) => `${o.label} ${m(leg.len)}`).join("; "),
        walkSheetName(V.sh),
      ]),
    ],
    "LeanStudio_task_walks.csv",
  );
}
