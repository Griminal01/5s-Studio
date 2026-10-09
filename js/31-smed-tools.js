"use strict";
/* ============ SMED tools: stopwatch capture and the printable work sheet ============ */

/* Time a changeover live. Pick who finished and tap "Step done" as each step
   finishes; each person's step is timed from the end of their own previous step,
   so people working at the same time are timed side by side. Tap "Machine
   stopped" and "Machine running again" at those moments; each step is filed as
   before the stop, stopped (internal) or after the restart by when it finished.
   The timing is kept in the browser as it goes, so a closed tab or a flat phone
   does not lose it. */
const SMED_DRAFT = "5s-smed-timer-draft";
async function smedTimer() {
  let st = {
    start: null,
    stopAt: null,
    runAt: null,
    phase: "before",
    lastBy: {},
    steps: [],
  };
  let resumed = false;
  try {
    const d = JSON.parse(localStorage.getItem(SMED_DRAFT) || "null");
    if (d && d.start && Array.isArray(d.steps)) {
      st = { ...st, ...d };
      resumed = true;
    }
  } catch {}
  const keep = () => {
    try {
      localStorage.setItem(SMED_DRAFT, JSON.stringify(st));
    } catch {}
  };
  const drop = () => {
    try {
      localStorage.removeItem(SMED_DRAFT);
    } catch {}
  };
  const now = () => Date.now() / 1000;
  const phaseName = {
    before: "Machine running: preparing",
    internal: "MACHINE STOPPED",
    after: "Machine running again: clearing up",
  };
  const html = `<div class="row2"><label class="f">Changeover<input name="name" value="" placeholder="e.g. Packer: small to large format"></label><label class="f">Line or machine<input name="line" value=""></label></div>
    <div class="timer"><div id="tmClock" class="tmclock">0:00</div><div id="tmPhase" class="tmphase">Not started</div></div>
    <div class="btns" id="tmStart"><button type="button" class="pri" data-tm="startBefore">Start: preparing, machine still running</button><button type="button" class="pri" data-tm="startStopped">Start: machine just stopped</button></div>
    <div class="btns" id="tmPhases" hidden><button type="button" data-tm="stopped">Machine stopped</button><button type="button" data-tm="running">Machine running again</button></div>
    <div id="tmEntry" hidden><div class="row2"><label class="f">What did you just finish?<input id="tmName" placeholder="e.g. Remove guide rails" autocomplete="off"></label><label class="f">Who<select id="tmWho">${Array.from({ length: 6 }, (_, k) => `<option>Operator ${k + 1}</option>`).join("")}</select></label></div><div class="btns"><button type="button" class="pri tmbig" data-tm="done">Step done</button></div></div>
    <div id="tmList" class="small"></div>
    <p class="small muted">One person times, the others call out. Choose who finished, then tap Step done: each person is timed from the end of their own last step, so people working at the same time are timed side by side. Fix anything afterwards in the table.</p>${resumed ? '<div class="status extra">Carrying on from an unfinished timing kept in this browser.</div>' : ""}`;
  const refresh = () => {
    const el = $("#tmClock");
    if (!el) return;
    el.textContent = st.start == null ? "0:00" : fmtMS(now() - st.start);
    $("#tmPhase").textContent =
      st.start == null ? "Not started" : phaseName[st.phase];
    $("#tmPhase").className = "tmphase " + (st.start == null ? "" : st.phase);
    $("#tmList").innerHTML = st.steps.length
      ? `<table class="rt"><tr><th>#</th><th>Step</th><th>Who</th><th class="n">Time</th><th>When</th></tr>${st.steps.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td>${esc(s.who)}</td><td class="n">${fmtMS(s.dur)}</td><td>${esc(SMED_TYPES.find((t) => t[0] === s.type)[1])}</td></tr>`).join("")}</table>`
      : "";
  };
  let timer = 0;
  const begin = (phase) => {
    st.start = now();
    st.phase = phase;
    if (phase === "internal") st.stopAt = st.start;
    $("#tmStart").hidden = true;
    $("#tmPhases").hidden = false;
    $("#tmEntry").hidden = false;
    $("#tmName").focus();
    refresh();
  };
  const done = () => {
    if (st.start == null) return;
    const t = now(),
      nm = $("#tmName").value.trim(),
      who = $("#tmWho").value,
      from = st.lastBy[who] ?? st.start;
    st.steps.push({
      name: nm || "Step " + (st.steps.length + 1),
      who,
      from,
      dur: Math.max(1, Math.round(t - from)),
      type: st.phase,
    });
    st.lastBy[who] = t;
    keep();
    $("#tmName").value = "";
    $("#tmName").focus();
    refresh();
  };
  const guard = new AbortController();
  const r = await modal("Time a changeover", html, "Save changeover", {
    cls: "mid",
    onOpen: (dlg) => {
      timer = setInterval(refresh, 250);
      if (resumed) {
        $("#tmStart").hidden = true;
        $("#tmPhases").hidden = false;
        $("#tmEntry").hidden = false;
        refresh();
      }
      // Esc or Cancel would throw the timing away: ask first
      let armed = false;
      dlg.addEventListener(
        "cancel",
        (e) => {
          if (st.steps.length) {
            e.preventDefault();
            toast(
              "Tap Save changeover to keep this timing, or Cancel twice to throw it away.",
            );
          }
        },
        { signal: guard.signal },
      );
      $("#dlgCancel").addEventListener(
        "click",
        (e) => {
          if (st.steps.length && !armed) {
            e.preventDefault();
            armed = true;
            e.target.textContent = "Throw the timing away";
            toast(
              `${st.steps.length} timed step${st.steps.length > 1 ? "s" : ""} would be lost. Tap again to throw them away.`,
            );
          }
        },
        { signal: guard.signal },
      );
      const body = $("#dlgBody");
      body.addEventListener("click", (e) => {
        const a = e.target.closest("[data-tm]")?.dataset.tm;
        if (a === "startBefore") begin("before");
        else if (a === "startStopped") begin("internal");
        else if (a === "stopped" && st.start != null) {
          st.stopAt = now();
          st.phase = "internal";
          keep();
          refresh();
        } else if (a === "running" && st.start != null) {
          st.runAt = now();
          st.phase = "after";
          keep();
          refresh();
        } else if (a === "done") done();
      });
      body.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.id === "tmName") {
          e.preventDefault();
          done();
        }
      });
    },
  });
  clearInterval(timer);
  guard.abort();
  if (!r) {
    drop();
    return;
  }
  if (!st.steps.length) {
    drop();
    return void toast("No steps were timed.");
  }
  const zero = st.stopAt ?? st.steps[0].from,
    co = blankChangeover({
      name: r.name.trim() || "Timed changeover",
      line: r.line.trim(),
      date: today(),
    });
  co.steps = st.steps.map((s) =>
    blankStep({
      name: s.name,
      who: s.who,
      dur: s.dur,
      type: s.type,
      at: Math.round(s.from - zero),
    }),
  );
  co.crew = new Set(co.steps.map((s) => s.who)).size;
  checkpoint();
  co.no = ++P.counters.smed;
  P.smed.changeovers.push(co);
  ui.smed.sel = co.id;
  ui.smed.tab = "plan";
  record("Changeover timed", coCode(co) + " " + co.name);
  drop();
  setView("smed");
  renderAll();
  toast("Saved. Now choose an improvement for each step.");
}

/* the work sheet: the improved plan as a checklist, with the timelines */
function printSmedSheet(co) {
  const r = smedResult(co),
    lanes = smedLanes(co),
    axis = smedAxis(co),
    nn = (s) => co.steps.findIndex((q) => q.id === s.id) + 1;
  const phase = (type, title) => {
    const bars = r.after.bars
      .filter((b) => b.s.type === type)
      .sort((a, b) => a.start - b.start || a.s.who.localeCompare(b.s.who));
    if (!bars.length) return "";
    return `<tr><th colspan="7" class="phase ${type}">${esc(title)}</th></tr>${bars
      .map(
        (b) =>
          `<tr><td><b>${nn(b.s)}</b></td><td>${esc(b.s.name)}${b.s.idea ? `<br><span class="pdm">${esc(b.s.idea)}</span>` : ""}</td><td>${esc(b.s.who)}</td><td class="n">${fmtMS(b.s.dur)}</td><td class="n">${fmtMS(b.start)}</td><td>${esc(b.s.kit ? kitName(b.s.kit) : "")}</td><td><span class="box"></span></td></tr>`,
      )
      .join("")}`;
  };
  const gone = co.steps.filter((s) => s.plan === "eliminate");
  printWithPage(
    `<div class="pd"><h1>Changeover standard work: ${esc(co.name)}</h1>
    <p class="pdm">${esc([coCode(co), co.line, co.from && co.to ? co.from + " to " + co.to : "", "trial " + co.trial, fmtDate(co.date), co.crew + " people"].filter(Boolean).join(" · "))}. Stopped time: <b>${fmtMS(r.now.downtime)}</b> observed, <b>${fmtMS(r.after.downtime)}</b> with this plan${co.target ? `, target ${fmtMS(co.target)}` : ""}.</p>
    <h2>Improved plan</h2><div class="pdplan">${smedGantt(co, "after", axis, lanes)}</div>
    <h2>As observed</h2><div class="pdplan">${smedGantt(co, "now", axis, lanes)}</div>
    <div class="pdbreak"></div>
    <h2>Checklist</h2><table class="fixed"><colgroup><col style="width:5%"><col style="width:37%"><col style="width:11%"><col style="width:7%"><col style="width:8%"><col style="width:26%"><col style="width:6%"></colgroup><tr><th>#</th><th>Step</th><th>Who</th><th class="n">Time</th><th class="n">Starts at</th><th>Get it from</th><th>Done</th></tr>
    ${phase("before", "Before the stop: machine still running")}${phase("internal", "Machine stopped")}${phase("after", "After the restart: machine running")}</table>
    ${gone.length ? `<p class="pdm">No longer needed: ${gone.map((s) => esc(s.name)).join(", ")}.</p>` : ""}
    <p class="pdm">Time 0:00 is the moment the machine stops. Times are the plan, not a guarantee: time the next changeover and correct them.</p></div>`,
    "",
    "",
  );
}
