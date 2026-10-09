"use strict";
/* ============ SMED: reduce the time a line is stopped for a changeover ============ */
// A changeover is a list of steps. Each step is either INTERNAL (the machine
// has to be stopped), or EXTERNAL (done while it runs: before the stop, or
// after the restart). The "stopped time" is what SMED reduces. For every step
// you can plan an improvement (move to external, shorten, do in parallel,
// eliminate) and the module recomputes the timeline, the saving per changeover
// and per year. Data lives in P.smed so it stays separate from the 5S code.

const SMED_TYPES = [
  ["internal", "Stopped (internal)"],
  ["before", "Before the stop (external)"],
  ["after", "After the restart (external)"],
];
const SMED_PLANS = [
  ["keep", "Keep as it is"],
  ["external", "Move to external"],
  ["shorten", "Shorten"],
  ["parallel", "Do in parallel"],
  ["eliminate", "Eliminate"],
];
const SMED_TARGET_DEFAULT = 600; // 10 minutes: the "single minute" in SMED

const fmtMS = (s) => {
  const neg = s < 0,
    a = Math.round(Math.abs(s)),
    m = Math.floor(a / 60);
  return (neg ? "-" : "") + m + ":" + String(a % 60).padStart(2, "0");
};
function parseDur(v) {
  v = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!v) return null;
  let m = v.match(/^(\d+):(\d{1,2})$/);
  if (m) return +m[1] * 60 + +m[2];
  m = v.match(/^(\d+(?:\.\d+)?)\s*(?:m|min|mins)$/);
  if (m) return Math.round(+m[1] * 60);
  m = v.match(/^(\d+(?:\.\d+)?)\s*(?:s|sec|secs)?$/);
  return m ? Math.round(+m[1]) : null;
}

/* A step's kit is the id of a board slot, so it follows the slot when slots are
   renumbered or a board code changes. Anything typed that is not a slot code is
   kept as plain text. */
function kitSlot(v) {
  for (const b of P.boards) {
    const i = b.slots.findIndex((s) => s.id === v);
    if (i >= 0) return { b, i, s: b.slots[i] };
  }
  return null;
}
const kitShow = (v) => {
  const k = kitSlot(v);
  return k ? slotCode(k.b, k.i) : v;
};
const kitName = (v) => {
  const k = kitSlot(v);
  return k ? slotCode(k.b, k.i) + " " + k.s.name : v;
};
function kitStoreIn(boards, v) {
  v = String(v ?? "").trim();
  if (!v) return "";
  for (const b of boards)
    for (const [i, sl] of b.slots.entries()) {
      if (sl.id === v) return v;
      if (slotCode(b, i).toUpperCase() === v.toUpperCase()) return sl.id;
    }
  return v;
}
function blankStep(over = {}) {
  return {
    id: uid(),
    name: "",
    who: "Operator 1",
    dur: 60,
    at: null,
    type: "internal",
    after: "",
    plan: "keep",
    newDur: null,
    newWho: "",
    extWhere: "before",
    idea: "",
    kit: "",
    ...over,
  };
}
function blankChangeover(over = {}) {
  return {
    id: uid(),
    no: 0,
    name: "",
    series: "",
    trial: 1,
    line: "",
    from: "",
    to: "",
    date: today(),
    crew: 2,
    target: SMED_TARGET_DEFAULT,
    perWeek: 5,
    valuePerMin: 0,
    notes: "",
    walkRefs: [],
    steps: [],
    ...over,
  };
}
/* tolerant loader used by validate() */
function normChangeover(c) {
  const str = (v, d = "") => (v == null ? d : String(v)),
    nn = (v, d) =>
      Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d;
  const steps = (Array.isArray(c.steps) ? c.steps : [])
    .filter((s) => s && typeof s === "object")
    .map((s) => ({
      id: str(s.id, uid()),
      name: str(s.name, "Step"),
      who: str(s.who, "Operator 1"),
      dur: nn(s.dur, 0),
      at:
        Number.isFinite(Number(s.at)) && s.at !== null && s.at !== ""
          ? Number(s.at)
          : null,
      type: SMED_TYPES.some((t) => t[0] === s.type) ? s.type : "internal",
      after: str(s.after),
      plan: SMED_PLANS.some((t) => t[0] === s.plan) ? s.plan : "keep",
      newDur:
        s.newDur === null || s.newDur === "" || s.newDur === undefined
          ? null
          : nn(s.newDur, null),
      newWho: str(s.newWho),
      extWhere: s.extWhere === "after" ? "after" : "before",
      idea: str(s.idea),
      kit: str(s.kit),
    }));
  const ids = new Set();
  for (const s of steps) {
    if (!s.after || !ids.has(s.after)) s.after = ""; // may only wait for an earlier step
    ids.add(s.id);
  }
  return {
    id: str(c.id, uid()),
    no: Number(c.no) || 0,
    name: str(c.name, "Changeover"),
    series: str(c.series),
    trial: Math.max(1, Math.round(Number(c.trial)) || 1),
    line: str(c.line),
    from: str(c.from),
    to: str(c.to),
    date: str(c.date, today()),
    crew: Math.max(1, Math.round(Number(c.crew)) || 1),
    target: nn(c.target, SMED_TARGET_DEFAULT),
    perWeek: nn(c.perWeek, 5),
    valuePerMin: nn(c.valuePerMin, 0),
    notes: str(c.notes),
    walkRefs: (Array.isArray(c.walkRefs) ? c.walkRefs : []).map(String),
    steps,
  };
}

/* ----- the schedule: where each step sits in time ----- */
// mode "now": the changeover as it was observed. mode "after": with every
// planned improvement applied. Time 0 is the moment the machine stops.
function smedEff(s, mode) {
  const e = { ...s, gone: false, changed: false };
  if (mode !== "after") return e;
  e.at = null;
  if (s.plan === "eliminate") {
    e.gone = true;
    e.changed = true;
  } else if (s.plan === "external") {
    if (s.type === "internal")
      e.type = s.extWhere === "after" ? "after" : "before";
    e.changed = true;
  } else if (s.plan === "shorten") {
    if (s.newDur != null) e.dur = Math.min(s.dur, s.newDur);
    e.changed = true;
  } else if (s.plan === "parallel") {
    if (s.newWho) e.who = s.newWho;
    e.changed = true;
  }
  return e;
}
/* Waiting seen in a timed changeover. When a step started later than the person
   was free, it was waiting for something: the step that finished just before
   (kept as a dependency, so it moves if that step is improved), or, if nothing
   finished then, the clock (kept as "not before"). This keeps the plan equal
   to what was observed until you choose an improvement. */
function smedWaits(co) {
  const now = smedSchedule(co, "now", null),
    out = new Map(),
    byLane = new Map();
  const bars = now.bars.slice().sort((a, b) => a.start - b.start);
  for (const b of bars) {
    if (b.s.at == null || b.s.type === "before") continue;
    const phaseStart = b.s.type === "after" ? now.downtime : 0,
      key = b.s.type + "|" + b.s.who,
      free = byLane.get(key) ?? phaseStart;
    byLane.set(key, b.end);
    if (b.start <= free + 2) continue;
    let dep = null;
    for (const o of bars)
      if (o !== b && o.end <= b.start + 1 && o.end >= b.start - 3)
        if (!dep || o.end > dep.end) dep = o;
    out.set(b.s.id, dep ? { after: dep.s.id } : { notBefore: b.start });
  }
  return out;
}
function smedSchedule(co, mode, waits) {
  if (waits === undefined) waits = mode === "after" ? smedWaits(co) : null;
  const eff = co.steps.map((s) => smedEff(s, mode)),
    live = eff.filter((s) => !s.gone),
    bars = [],
    fin = new Map();
  // the earliest a step may start: after what it waits for, and its observed wait
  const ready = (s, start) => {
    if (s.after && fin.has(s.after)) start = Math.max(start, fin.get(s.after));
    const w = waits && waits.get(s.id);
    if (w?.after && fin.has(w.after)) start = Math.max(start, fin.get(w.after));
    if (w?.notBefore != null) start = Math.max(start, w.notBefore);
    return start;
  };
  // before the stop: each person's prep ends exactly when the machine stops
  const before = live.filter((s) => s.type === "before"),
    sums = new Map();
  for (const s of before) sums.set(s.who, (sums.get(s.who) || 0) + s.dur);
  const t = new Map();
  for (const s of before) {
    const timed = s.at != null && s.at + s.dur <= 0,
      start = timed ? s.at : (t.get(s.who) ?? -sums.get(s.who));
    t.set(s.who, start + s.dur);
    bars.push({ s, start, end: start + s.dur });
    fin.set(s.id, start + s.dur);
  }
  // while it is stopped
  const free = new Map();
  let internalEnd = 0;
  for (const s of live.filter((x) => x.type === "internal")) {
    const start = ready(
        s,
        s.at != null && s.at >= 0 ? s.at : (free.get(s.who) ?? 0),
      ),
      end = start + s.dur;
    free.set(s.who, end);
    fin.set(s.id, end);
    bars.push({ s, start, end });
    internalEnd = Math.max(internalEnd, end);
  }
  // after the restart
  const free2 = new Map();
  for (const s of live.filter((x) => x.type === "after")) {
    const start = ready(
      s,
      s.at != null && s.at >= internalEnd
        ? s.at
        : (free2.get(s.who) ?? internalEnd),
    );
    free2.set(s.who, start + s.dur);
    fin.set(s.id, start + s.dur);
    bars.push({ s, start, end: start + s.dur });
  }
  const labour = live.reduce((n, s) => n + s.dur, 0),
    ext = live
      .filter((s) => s.type !== "internal")
      .reduce((n, s) => n + s.dur, 0);
  return {
    bars,
    eff,
    downtime: internalEnd,
    labour,
    external: ext,
    start: Math.min(0, ...bars.map((b) => b.start)),
    end: Math.max(internalEnd, ...bars.map((b) => b.end)),
  };
}
function smedLanes(co) {
  const out = [];
  for (const s of co.steps) {
    if (!out.includes(s.who)) out.push(s.who);
    if (s.plan === "parallel" && s.newWho && !out.includes(s.newWho))
      out.push(s.newWho);
  }
  return out;
}
function smedResult(co) {
  const now = smedSchedule(co, "now"),
    after = smedSchedule(co, "after"),
    saved = Math.max(0, now.downtime - after.downtime),
    weeks = P.smed.weeks || 48,
    perYear = co.perWeek * weeks;
  return {
    now,
    after,
    saved,
    perYear,
    hoursYear: (saved * perYear) / 3600,
    moneyYear: co.valuePerMin ? (saved / 60) * co.valuePerMin * perYear : 0,
    external: co.steps
      .filter((s) => s.plan === "external" && s.type === "internal")
      .reduce((n, s) => n + s.dur, 0),
    eliminated: co.steps
      .filter((s) => s.plan === "eliminate" && s.type === "internal")
      .reduce((n, s) => n + s.dur, 0),
    onTarget: co.target > 0 && after.downtime <= co.target,
  };
}

/* ----- the timeline chart ----- */
function smedGantt(co, mode, axis, lanes) {
  const sc = smedSchedule(co, mode),
    W = 980,
    L = 120,
    R = 14,
    rowH = 30,
    top = 30,
    H = top + lanes.length * rowH + 46,
    span = Math.max(60, axis.end - axis.start),
    x = (t) => L + ((t - axis.start) / span) * (W - L - R),
    pid = "hatch" + mode;
  const step =
    [15, 30, 60, 120, 300, 600, 900, 1800].find((s) => span / s <= 14) || 1800;
  let s = `<svg class="gantt" viewBox="0 0 ${W} ${H}" role="img" aria-label="Changeover timeline, ${mode === "now" ? "as observed" : "improved plan"}"><defs><pattern id="${pid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#d7efe2"/><rect width="3" height="6" fill="#1f8a55"/></pattern></defs>`;
  lanes.forEach((ln, i) => {
    const y = top + i * rowH;
    s += `<rect x="${L}" y="${y}" width="${W - L - R}" height="${rowH}" fill="${i % 2 ? "#f6f7fb" : "#fff"}"/><text x="${L - 8}" y="${y + rowH / 2}" font-size="12" text-anchor="end" dominant-baseline="central" fill="#1c2250">${esc(clipText(ln, 16))}</text>`;
  });
  s += `<rect x="${x(0)}" y="${top}" width="${Math.max(0, x(sc.downtime) - x(0))}" height="${lanes.length * rowH}" fill="#fbe6e1" opacity=".55"/>`;
  for (let t = Math.ceil(axis.start / step) * step; t <= axis.end; t += step)
    s += `<line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${top + lanes.length * rowH}" stroke="#d9dce7" stroke-width="1"/><text x="${x(t)}" y="${H - 26}" font-size="11" text-anchor="middle" fill="#5e6584">${fmtMS(t)}</text>`;
  for (const b of sc.bars) {
    const i = lanes.indexOf(b.s.who);
    if (i < 0) continue;
    const y = top + i * rowH + 4,
      w = Math.max(2, x(b.end) - x(b.start)),
      ext = b.s.type !== "internal";
    const n = co.steps.findIndex((q) => q.id === b.s.id) + 1;
    s += `<g><title>${n}. ${esc(b.s.name)}: ${fmtMS(b.s.dur)} (${esc(SMED_TYPES.find((t) => t[0] === b.s.type)[1])})</title><rect x="${x(b.start)}" y="${y}" width="${w}" height="${rowH - 8}" rx="3" fill="${ext ? `url(#${pid})` : "#202c86"}" stroke="${b.s.changed && mode === "after" ? "#e07b00" : ext ? "#1f8a55" : "#18216a"}" stroke-width="${b.s.changed && mode === "after" ? 2.4 : 1}"/>${w > 18 ? `<text x="${x(b.start) + w / 2}" y="${y + (rowH - 8) / 2}" font-size="11" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="${ext ? "#0d4d2d" : "#fff"}">${n}</text>` : ""}</g>`;
  }
  s += `<line x1="${x(0)}" x2="${x(0)}" y1="${top - 8}" y2="${top + lanes.length * rowH}" stroke="#c3361a" stroke-width="2"/><text x="${x(0)}" y="${top - 12}" font-size="11" font-weight="700" text-anchor="middle" fill="#c3361a">Stops</text>`;
  s += `<line x1="${x(sc.downtime)}" x2="${x(sc.downtime)}" y1="${top - 8}" y2="${top + lanes.length * rowH}" stroke="#c3361a" stroke-width="2" stroke-dasharray="5 3"/><text x="${x(sc.downtime)}" y="${top - 12}" font-size="11" font-weight="700" text-anchor="${x(sc.downtime) > W - 80 ? "end" : "middle"}" fill="#c3361a">Running ${fmtMS(sc.downtime)}</text>`;
  if (co.target > 0 && co.target < axis.end)
    s += `<line x1="${x(co.target)}" x2="${x(co.target)}" y1="${top}" y2="${top + lanes.length * rowH}" stroke="#1f8a55" stroke-width="2" stroke-dasharray="2 4"/><text x="${x(co.target)}" y="${H - 8}" font-size="11" text-anchor="middle" fill="#1f8a55">Target ${fmtMS(co.target)}</text>`;
  return s + "</svg>";
}
function smedAxis(co) {
  const a = smedSchedule(co, "now"),
    b = smedSchedule(co, "after");
  return {
    start: Math.min(a.start, b.start),
    end: Math.max(a.end, b.end, co.target > 0 ? co.target * 1.05 : 0),
  };
}

/* ----- the SMED view ----- */
const curCO = () =>
  P.smed.changeovers.find((c) => c.id === ui.smed.sel) ||
  P.smed.changeovers.at(-1) ||
  null;
const coCode = (c) => "CO-" + String(c.no).padStart(3, "0");
const seriesOf = (c) => c.series || c.name;

function smedVizHTML(co) {
  const r = smedResult(co),
    lanes = smedLanes(co),
    axis = smedAxis(co);
  const walk = smedWalk(co);
  const big = co.steps
    .map((s, i) => ({ s, i }))
    .filter(
      (x) => x.s.type === "internal" && x.s.plan === "keep" && x.s.dur > 0,
    )
    .sort((a, b) => b.s.dur - a.s.dur)
    .slice(0, 3);
  let h = `<div class="kpis smedk"><div><b>${fmtMS(r.now.downtime)}</b><span>Stopped now</span></div><div><b class="${r.onTarget ? "c-ok" : ""}">${fmtMS(r.after.downtime)}</b><span>Stopped with the plan</span></div><div><b>${fmtMS(r.saved)}</b><span>Saved per changeover</span></div><div><b>${co.target ? fmtMS(co.target) : "–"}</b><span>Target</span></div><div><b>${r.hoursYear >= 10 ? Math.round(r.hoursYear) : r.hoursYear.toFixed(1)} h</b><span>Saved per year (${co.perWeek}/wk)</span></div>${co.valuePerMin ? `<div><b>£${Math.round(r.moneyYear).toLocaleString("en-GB")}</b><span>Value per year</span></div>` : ""}</div>`;
  if (!co.steps.length)
    return (
      h +
      `<p class="empty">Add the steps of the changeover, in the order they happen, to see the timeline.</p>`
    );
  h += `<section class="block wide"><h3>Now: ${esc(co.name)}, as observed</h3><p>Navy bars stop the machine (internal). Green hatched bars are done while it runs (external). The red band is the time the line is stopped, ${fmtMS(r.now.downtime)}.</p>${smedGantt(co, "now", axis, lanes)}</section>`;
  h += `<section class="block wide"><h3>With the plan</h3><p>${r.saved ? `${fmtMS(r.saved)} less stopped time. ${r.external ? `${fmtMS(r.external)} of work moved outside the stop. ` : ""}${r.eliminated ? `${fmtMS(r.eliminated)} eliminated. ` : ""}` : "No improvements chosen yet. Pick one for a step in the table below."} Orange outlines show the steps you changed.${co.target ? (r.onTarget ? " <b class='c-ok'>On target.</b>" : ` ${fmtMS(r.after.downtime - co.target)} over the ${fmtMS(co.target)} target.`) : ""}</p>${smedGantt(co, "after", axis, lanes)}</section>`;
  h += `<div class="tgrid">`;
  h += `<section class="block"><h3>Look here first</h3>${big.length ? `<p>The longest steps that stop the machine and have no improvement yet. Ask: can it be done before the stop or after the restart? Can it be quicker, with two people, or not needed?</p>${big.map((x) => `<div class="irow" style="--c:#202c86"><span>${x.i + 1}. ${esc(x.s.name)}</span><span>${fmtMS(x.s.dur)}</span></div>`).join("")}` : '<p class="empty" style="margin:0">Every long stopped step has an improvement planned.</p>'}</section>`;
  h += `<section class="block"><h3>Walking in this changeover</h3>${walk}</section></div>`;
  return h;
}
/* walking distance for the routes linked to the changeover, on every sheet that has them */
function smedWalk(co) {
  if (!co.walkRefs.length)
    return `<p class="small muted">Link routes drawn on the layout (Route tool) to see how far people walk. A better layout is a quicker changeover.</p><div class="btns"><button data-sm="routes">Choose routes</button></div>`;
  const rows = P.sheets
    .filter((sh) => sh.kind !== "daily")
    .map((sh) => {
      const rs = sh.routes.filter((r) => co.walkRefs.includes(r.ref)),
        len = rs.reduce((n, r) => n + polyLen(r.pts) * r.trips, 0);
      return { sh, n: rs.length, len };
    })
    .filter((r) => r.n);
  const m = mpu();
  return `<p class="small muted">Per changeover, trips included.</p><table class="rt"><tr><th>Sheet</th><th class="n">Distance</th>${m ? '<th class="n">Walking time</th>' : ""}</tr>${rows.map((r) => `<tr><td>${esc(r.sh.name)}</td><td class="n">${esc(fmtLen(r.len, r.sh))}</td>${m ? `<td class="n">${esc(fmtTime((r.len * (mpu(r.sh) || m)) / P.settings.walk))}</td>` : ""}</tr>`).join("")}</table><div class="btns"><button data-sm="routes">Choose routes</button></div>`;
}

function stepRow(co, s, i) {
  const earlier = co.steps
      .slice(0, i)
      .map((q, j) => [q.id, j + 1 + ". " + clipText(q.name || "step", 26)]),
    lanes = smedLanes(co),
    kits = P.boards.flatMap((b) =>
      b.slots.map((sl, k) => [slotCode(b, k), sl.name]),
    );
  const newCell =
    s.plan === "shorten"
      ? `<input data-k="newDur" value="${s.newDur == null ? "" : fmtMS(s.newDur)}" placeholder="new m:ss" aria-label="New time">`
      : s.plan === "parallel"
        ? `<input data-k="newWho" list="smedLanes" value="${esc(s.newWho)}" placeholder="who instead" aria-label="Who instead">`
        : s.plan === "external"
          ? `<select data-k="extWhere" aria-label="Where"><option value="before"${s.extWhere !== "after" ? " selected" : ""}>Before the stop</option><option value="after"${s.extWhere === "after" ? " selected" : ""}>After the restart</option></select>`
          : "";
  return `<tr data-i="${i}" class="${s.plan !== "keep" ? "chg" : ""}"><td class="n"><b>${i + 1}</b></td><td><input data-k="name" value="${esc(s.name)}" placeholder="What is done" aria-label="Step"></td><td><input data-k="who" list="smedLanes" value="${esc(s.who)}" aria-label="Who"></td><td><input data-k="dur" value="${fmtMS(s.dur)}" aria-label="Time m:ss" class="tm"></td><td><select data-k="type" aria-label="Type">${SMED_TYPES.map((t) => `<option value="${t[0]}"${s.type === t[0] ? " selected" : ""}>${esc(t[1])}</option>`).join("")}</select></td><td><select data-k="after" aria-label="Waits for"><option value="">-</option>${optsKV(earlier, s.after)}</select></td><td><select data-k="plan" aria-label="Improvement">${SMED_PLANS.map((t) => `<option value="${t[0]}"${s.plan === t[0] ? " selected" : ""}>${esc(t[1])}</option>`).join("")}</select></td><td>${newCell}</td><td><input data-k="idea" value="${esc(s.idea)}" placeholder="Idea or why" aria-label="Idea"></td><td><input data-k="kit" list="smedKits" value="${esc(kitShow(s.kit))}" placeholder="SB-01-07" aria-label="Kit location" class="kit"></td><td class="bact"><button type="button" data-mv="-1" aria-label="Move up">↑</button><button type="button" data-mv="1" aria-label="Move down">↓</button><button type="button" data-rm="1" class="danger" aria-label="Remove">✕</button></td></tr>${i === co.steps.length - 1 ? `<datalist id="smedLanes">${[...new Set([...lanes, ...Array.from({ length: Math.max(co.crew, 2) }, (_, k) => "Operator " + (k + 1))])].map((l) => `<option value="${esc(l)}">`).join("")}</datalist><datalist id="smedKits">${kits.map(([c, n]) => `<option value="${esc(c)}">${esc(n)}</option>`).join("")}</datalist>` : ""}`;
}
function smedStepsHTML(co) {
  const tot = smedResult(co);
  return `<div class="bdtbl smedtbl"><table class="tbl"><thead><tr><th class="n">#</th><th>Step</th><th>Who</th><th>Time</th><th>Type</th><th>Waits for</th><th>Improvement</th><th>New</th><th>Idea / why</th><th>Kit from</th><th></th></tr></thead><tbody>${co.steps.map((s, i) => stepRow(co, s, i)).join("")}</tbody><tfoot><tr><td></td><td><b>${co.steps.length} steps</b></td><td></td><td><b id="smLabour">${fmtMS(tot.now.labour)}</b></td><td colspan="7" class="small muted">Total work by everyone. Stopped time is on the chart above.</td></tr></tfoot></table></div>
    <div class="btns"><button id="smAdd" class="pri">Add step</button><button id="smAdd5">Add 5 steps</button></div>`;
}

function renderSmed() {
  const el = $("#smedView"),
    all = P.smed.changeovers,
    co = curCO();
  if (co) ui.smed.sel = co.id;
  let h = `<header><div><h2>SMED: shorter changeovers</h2><p class="muted" style="margin:4px 0 0">Time a changeover, split each step into <b>stopped</b> and <b>done while running</b>, then plan how to cut the stopped time. Target: under ${fmtMS(SMED_TARGET_DEFAULT)}.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pri" id="smNew">New changeover</button><button id="smTimer">Time one now</button><button id="smHist"${all.length ? "" : " disabled"}>${ui.smed.tab === "history" ? "Back to the changeover" : "History"}</button></div></header>`;
  if (!all.length)
    return void (el.innerHTML =
      h +
      `<div class="emptybox"><b>No changeovers yet</b>Start with a stopwatch: press <b>Time one now</b> at the next changeover and tap as each step finishes. Or type the steps in from memory or a video. Open the example model line to see a worked changeover with three trials.<div style="margin-top:14px"><button class="pri" id="smTimer2">Time one now</button> <button id="smNew2">Type one in</button> <button id="smExample">Open the example model line</button></div></div>`);
  h += `<div class="chips smchips">${all
    .map(
      (c) =>
        `<button class="chip${co && c.id === co.id && ui.smed.tab !== "history" ? " on" : ""}" data-co="${esc(c.id)}"><b>${esc(coCode(c))} ${esc(c.name)}</b><small>${esc(fmtDate(c.date))}${c.trial > 1 ? ", trial " + c.trial : ""}</small><span class="sc">${fmtMS(smedSchedule(c, "now").downtime)}</span></button>`,
    )
    .join("")}</div>`;
  if (ui.smed.tab === "history") h += smedHistoryHTML();
  else if (co) {
    h += `<div class="smedhead"><div><div class="smtitle">${esc(coCode(co))} · ${esc(co.name)}${co.trial > 1 ? ` <span class="count">trial ${co.trial}</span>` : ""}</div><p class="small muted" style="margin:2px 0 0">${[co.line, co.from && co.to ? co.from + " to " + co.to : "", fmtDate(co.date), co.crew + " people"].filter(Boolean).map(esc).join(" · ")}${co.notes ? " · " + esc(co.notes) : ""}</p></div><div class="btns" style="margin:0"><button id="smEdit">Details</button><button id="smPrint" class="pri">Print work sheet</button><button id="smNext">Next trial from the plan</button><button id="smCsv">Export CSV</button><button id="smDel" class="danger">Delete</button></div></div>`;
    h += `<div id="smViz">${smedVizHTML(co)}</div><h3 style="margin:18px 0 6px">Steps</h3><div id="smSteps">${smedStepsHTML(co)}</div>`;
  }
  el.innerHTML = h;
}
function refreshSmedViz() {
  const co = curCO();
  if (co && $("#smViz")) {
    $("#smViz").innerHTML = smedVizHTML(co);
    const f = $("#smLabour");
    if (f) f.textContent = fmtMS(smedResult(co).now.labour);
  }
  const chip = $(".smchips .chip.on .sc");
  if (chip && co) chip.textContent = fmtMS(smedSchedule(co, "now").downtime);
}

/* ----- history across trials ----- */
function smedHistoryHTML() {
  const groups = new Map();
  for (const c of P.smed.changeovers) {
    const k = seriesOf(c);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  let h = `<p class="small muted">Each trial is a recorded changeover. The bars show the stopped time of each trial and what its plan would give. The line is the target.</p>`;
  for (const [name, list] of groups) {
    list.sort((a, b) => a.date.localeCompare(b.date) || a.trial - b.trial);
    const data = list.map((c) => ({
        c,
        now: smedSchedule(c, "now").downtime,
        plan: smedSchedule(c, "after").downtime,
      })),
      max =
        Math.max(...data.map((d) => Math.max(d.now, d.plan, d.c.target)), 60) *
        1.1,
      W = 760,
      H = 230,
      L = 46,
      B = 34,
      slot = (W - L - 10) / data.length,
      y = (v) => 14 + (1 - v / max) * (H - 14 - B);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stopped time by trial">`;
    for (const f of [0, 0.5, 1])
      s += `<line x1="${L}" x2="${W - 10}" y1="${y((max / 1.1) * f)}" y2="${y((max / 1.1) * f)}" stroke="#d9dce7"/><text x="${L - 6}" y="${y((max / 1.1) * f)}" font-size="11" text-anchor="end" dominant-baseline="central" fill="#5e6584">${fmtMS((max / 1.1) * f)}</text>`;
    data.forEach((d, i) => {
      const cx = L + slot * (i + 0.5),
        bw = Math.min(46, slot * 0.34);
      s += `<rect x="${cx - bw - 2}" y="${y(d.now)}" width="${bw}" height="${H - B - y(d.now)}" fill="#202c86"><title>${esc(coCode(d.c))} observed ${fmtMS(d.now)}</title></rect><rect x="${cx + 2}" y="${y(d.plan)}" width="${bw}" height="${H - B - y(d.plan)}" fill="#1f8a55" opacity=".7"><title>${esc(coCode(d.c))} plan ${fmtMS(d.plan)}</title></rect><text x="${cx - bw / 2 - 2}" y="${y(d.now) - 4}" font-size="11" text-anchor="middle" fill="#1c2250">${fmtMS(d.now)}</text><text x="${cx}" y="${H - B + 15}" font-size="11" text-anchor="middle" fill="#5e6584">${esc(fmtDate(d.c.date).replace(/^\w+,? /, ""))}</text><text x="${cx}" y="${H - B + 28}" font-size="10" text-anchor="middle" fill="#5e6584">trial ${d.c.trial}</text>`;
    });
    const tg = list.at(-1).target;
    if (tg > 0)
      s += `<line x1="${L}" x2="${W - 10}" y1="${y(tg)}" y2="${y(tg)}" stroke="#1f8a55" stroke-dasharray="5 4"/><text x="${W - 12}" y="${y(tg) - 6}" font-size="11" text-anchor="end" fill="#1f8a55">Target ${fmtMS(tg)}</text>`;
    const first = data[0].now,
      last = data.at(-1).now;
    h += `<section class="block wide"><h3><span>${esc(name)}</span><span class="count">${list.length} trial${list.length === 1 ? "" : "s"}</span></h3><p>${list.length > 1 ? `From ${fmtMS(first)} to ${fmtMS(last)} stopped${first > last ? `: ${fmtMS(first - last)} saved (${Math.round(((first - last) / first) * 100)}%).` : "."}` : "One trial so far. Do another and the trend shows here."} Navy: observed. Green: with that trial's plan.</p>${s}</svg></section>`;
  }
  return h;
}

/* ----- events ----- */
$("#smedView").addEventListener("click", (e) => {
  const t = e.target,
    co = curCO();
  if (t.closest("#smNew,#smNew2")) return void newChangeover();
  if (t.closest("#smTimer,#smTimer2")) return void smedTimer();
  if (t.closest("#smExample")) return void loadExample();
  if (t.closest("#smHist")) {
    ui.smed.tab = ui.smed.tab === "history" ? "plan" : "history";
    return void renderSmed();
  }
  const chip = t.closest("[data-co]");
  if (chip) {
    ui.smed.sel = chip.dataset.co;
    ui.smed.tab = "plan";
    return void renderSmed();
  }
  if (!co) return;
  if (t.closest("#smEdit")) return void changeoverModal(co);
  if (t.closest("#smPrint")) return void printSmedSheet(co);
  if (t.closest("#smNext")) return void nextTrial(co);
  if (t.closest("#smCsv")) return void csvChangeover(co);
  if (t.closest("#smDel")) return void deleteChangeover(co);
  if (t.closest("[data-sm=routes]")) return void chooseRoutes(co);
  const tr = t.closest("tr[data-i]"),
    i = tr ? +tr.dataset.i : -1;
  if (t.closest("#smAdd,#smAdd5")) {
    const n = t.closest("#smAdd5") ? 5 : 1;
    checkpoint();
    for (let k = 0; k < n; k++)
      co.steps.push(blankStep({ who: co.steps.at(-1)?.who || "Operator 1" }));
    record("SMED steps added", coCode(co));
    renderAll();
    $("#smSteps tbody tr:last-child [data-k=name]")?.focus();
  } else if (t.closest("[data-rm]") && i >= 0) {
    checkpoint();
    const gone = co.steps.splice(i, 1)[0];
    for (const s of co.steps) if (s.after === gone.id) s.after = "";
    record("SMED step removed", gone.name);
    renderAll();
  } else if (t.closest("[data-mv]") && i >= 0) {
    const j = i + Number(t.closest("[data-mv]").dataset.mv);
    if (j < 0 || j >= co.steps.length) return;
    checkpoint();
    [co.steps[i], co.steps[j]] = [co.steps[j], co.steps[i]];
    // a step may only wait for an earlier one
    const seen = new Set();
    for (const s of co.steps) {
      if (s.after && !seen.has(s.after)) s.after = "";
      seen.add(s.id);
    }
    renderAll();
  }
});
$("#smedView").addEventListener("change", (e) => {
  const co = curCO(),
    tr = e.target.closest("tr[data-i]"),
    k = e.target.dataset.k;
  if (!co || !tr || !k) return;
  const s = co.steps[+tr.dataset.i];
  checkpoint();
  const v = e.target.value;
  if (k === "dur") {
    const d = parseDur(v);
    if (d != null) s.dur = d;
    e.target.value = fmtMS(s.dur);
  } else if (k === "newDur") {
    const d = parseDur(v);
    s.newDur = d;
    e.target.value = d == null ? "" : fmtMS(d);
  } else if (k === "kit") {
    s.kit = kitStoreIn(P.boards, v);
    e.target.value = kitShow(s.kit);
  } else s[k] = v;
  if (k === "who" && !String(v).trim()) s.who = e.target.value = "Operator 1";
  if (k === "plan" && v === "shorten" && s.newDur == null)
    s.newDur = Math.round(s.dur / 2);
  if (k === "plan" && v === "parallel" && !s.newWho)
    s.newWho = smedLanes(co).find((l) => l !== s.who) || "Operator 2";
  record("SMED step changed", s.name + ": " + k);
  save();
  // only the "New" cell depends on the choice of improvement, so only that row is
  // redrawn; nothing else in the table is replaced, so the next click still lands
  if (k === "plan") {
    const i = +tr.dataset.i,
      tmp = document.createElement("tbody");
    tmp.innerHTML = stepRow(co, s, i);
    tr.replaceWith(...tmp.childNodes);
  }
  refreshSmedViz();
});

/* ----- creating and editing ----- */
async function changeoverModal(co, isNew) {
  const lanesOpts = Array.from({ length: 6 }, (_, k) => k + 1);
  const r = await modal(
    isNew ? "New changeover" : coCode(co) + " details",
    `<div class="row2"><label class="f">Name<input name="name" required value="${esc(co.name)}" placeholder="e.g. Packer: small to large format"></label><label class="f">Series (trials of the same changeover)<input name="series" value="${esc(co.series)}" placeholder="same as name"></label></div>
    <div class="row3"><label class="f">Line or machine<input name="line" value="${esc(co.line)}"></label><label class="f">From product<input name="from" value="${esc(co.from)}"></label><label class="f">To product<input name="to" value="${esc(co.to)}"></label></div>
    <div class="row3"><label class="f">Date<input name="date" type="date" value="${esc(co.date)}"></label><label class="f">People on the changeover<select name="crew">${lanesOpts.map((n) => `<option${n === co.crew ? " selected" : ""}>${n}</option>`).join("")}</select></label><label class="f">Trial number<input name="trial" type="number" min="1" step="1" value="${esc(co.trial)}"></label></div>
    <div class="row3"><label class="f">Target stopped time (m:ss)<input name="target" value="${fmtMS(co.target)}"></label><label class="f">Changeovers per week<input name="perWeek" type="number" min="0" step="0.5" value="${esc(co.perWeek)}"></label><label class="f">Value of a stopped minute (£, optional)<input name="valuePerMin" type="number" min="0" step="1" value="${esc(co.valuePerMin || "")}"></label></div>
    <label class="f">Notes<textarea name="notes" rows="2">${esc(co.notes)}</textarea></label>
    <label class="f">Weeks a year the line runs (used for every changeover's yearly saving)<input name="weeks" type="number" min="1" max="52" step="1" value="${esc(P.smed.weeks)}"></label>`,
    isNew ? "Create" : "Save",
    { cls: "mid" },
  );
  if (!r) return null;
  checkpoint();
  Object.assign(co, {
    name: r.name.trim() || "Changeover",
    series: r.series.trim(),
    line: r.line.trim(),
    from: r.from.trim(),
    to: r.to.trim(),
    date: r.date || today(),
    crew: Number(r.crew) || 2,
    trial: Math.max(1, Math.round(Number(r.trial)) || 1),
    target: parseDur(r.target) ?? co.target,
    perWeek: Math.max(0, Number(r.perWeek) || 0),
    valuePerMin: Math.max(0, Number(r.valuePerMin) || 0),
    notes: r.notes.trim(),
  });
  P.smed.weeks = clamp(Math.round(Number(r.weeks)) || P.smed.weeks, 1, 52);
  if (isNew) {
    co.no = ++P.counters.smed;
    P.smed.changeovers.push(co);
  }
  ui.smed.sel = co.id;
  ui.smed.tab = "plan";
  record(
    isNew ? "Changeover added" : "Changeover updated",
    coCode(co) + " " + co.name,
  );
  renderAll();
  return co;
}
async function newChangeover() {
  const co = blankChangeover();
  const done = await changeoverModal(co, true);
  if (done) {
    setView("smed");
    renderSmed();
  }
}
async function nextTrial(co) {
  const r = smedResult(co);
  const ok = await modal(
    "Start the next trial?",
    `<p style="margin-top:0">A new changeover is created from the <b>improved plan</b> of ${esc(coCode(co))}: moved steps become external, shorter steps take their new time, parallel steps use the new person, eliminated steps are dropped. Time it for real, correct what really happened, and plan the next improvement.</p><p class="small muted">Plan: ${fmtMS(r.after.downtime)} stopped, from ${fmtMS(r.now.downtime)}.</p>`,
    "Create trial " + (co.trial + 1),
  );
  if (!ok) return;
  checkpoint();
  const n = blankChangeover({
    ...clone({ ...co, steps: [], id: undefined }),
    id: uid(),
    series: seriesOf(co),
    trial: co.trial + 1,
    date: today(),
    notes: "",
  });
  const map = new Map();
  for (const s of co.steps) {
    const e = smedEff(s, "after");
    if (e.gone) continue;
    const ns = blankStep({
      name: s.name,
      who: e.who,
      dur: e.dur,
      type: e.type,
      kit: s.kit,
      idea: "",
    });
    map.set(s.id, ns.id);
    n.steps.push(ns);
  }
  for (const s of co.steps) {
    const ns = n.steps.find((q) => q.id === map.get(s.id));
    if (ns && s.after && map.has(s.after)) ns.after = map.get(s.after);
  }
  n.no = ++P.counters.smed;
  P.smed.changeovers.push(n);
  ui.smed.sel = n.id;
  record("Next trial created", coCode(n) + " from " + coCode(co));
  renderAll();
}
async function deleteChangeover(co) {
  const q = await modal(
    "Delete " + coCode(co) + "?",
    '<p style="margin-top:0">This changeover and its steps will be removed. You can undo straight after.</p>',
    "Delete",
  );
  if (!q) return;
  checkpoint();
  P.smed.changeovers = P.smed.changeovers.filter((x) => x.id !== co.id);
  ui.smed.sel = "";
  record("Changeover deleted", coCode(co) + " " + co.name);
  renderAll();
}
async function chooseRoutes(co) {
  const seen = new Map();
  for (const sh of P.sheets)
    for (const r of sh.routes) if (!seen.has(r.ref)) seen.set(r.ref, r.name);
  if (!seen.size)
    return void toast("Draw a route on the layout first (Route tool).");
  const r = await modal(
    "Routes walked during this changeover",
    `<p style="margin-top:0" class="small muted">Tick the routes people walk. The distance is then compared across the standard and your proposals.</p>${[...seen].map(([ref, name]) => `<label class="chk"><input type="checkbox" name="r_${esc(ref)}"${co.walkRefs.includes(ref) ? " checked" : ""}>${esc(name)}</label>`).join("")}`,
    "Save",
    { cls: "mid" },
  );
  if (!r) return;
  checkpoint();
  co.walkRefs = [...seen.keys()].filter((ref) => r["r_" + ref]);
  record("Changeover routes linked", coCode(co));
  renderAll();
}
function csvChangeover(co) {
  const r = smedResult(co),
    rows = [
      [
        "Changeover",
        coCode(co),
        co.name,
        "Trial " + co.trial,
        fmtDate(co.date),
      ],
      [
        "Stopped now (s)",
        Math.round(r.now.downtime),
        "With plan (s)",
        Math.round(r.after.downtime),
        "Target (s)",
        co.target,
      ],
      [],
      [
        "No.",
        "Step",
        "Who",
        "Seconds",
        "Type",
        "Waits for",
        "Improvement",
        "New seconds",
        "New who",
        "Idea",
        "Kit from",
      ],
    ];
  co.steps.forEach((s, i) =>
    rows.push([
      i + 1,
      s.name,
      s.who,
      s.dur,
      SMED_TYPES.find((t) => t[0] === s.type)[1],
      s.after ? co.steps.findIndex((q) => q.id === s.after) + 1 : "",
      SMED_PLANS.find((t) => t[0] === s.plan)[1],
      s.newDur ?? "",
      s.newWho,
      s.idea,
      kitShow(s.kit),
    ]),
  );
  csv(rows, "5S_" + fileSafe(coCode(co) + "_" + co.name) + ".csv");
}
