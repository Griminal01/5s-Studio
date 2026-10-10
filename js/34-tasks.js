"use strict";
/* ============ operator tasks: what is done in a zone, how often, and which items it uses ============ */
// P.tasks: { id, no, name, zone (a zone id), who, freq, mins, s5, items: [item refs], doc, how, note }.
// Items are linked by ref, so a task follows its items across the standard, proposals and daily checks.
// The page follows the Showing picker (see scopePass in 34-areas.js).

const blankTask = (i = {}) => ({
  id: uid(),
  no: 0,
  name: "",
  zone: i.zone || "",
  who: "Operator",
  freq: "Every shift",
  mins: 0,
  s5: "",
  items: i.items || [],
  doc: "",
  how: "",
  note: "",
});
const zoneName = (id) => P.areas.find((a) => a.id === id)?.name || "";
const itemByRef = (ref) => STD().objects.find((o) => o.ref === ref);
const taskItems = (t) => t.items.map(itemByRef).filter(Boolean);
const tasksOfItem = (o) => P.tasks.filter((t) => t.items.includes(o.ref));
const tasksOfZone = (a) =>
  P.tasks.filter(
    (t) =>
      t.zone === a.id ||
      (isLine(a) && P.areas.find((z) => z.id === t.zone)?.parent === a.id),
  );
const taskInScope = (t) => {
  const a = scopeArea();
  return !a || tasksOfZone(a).includes(t);
};
// tasks that happen every shift, counted into a shift's operator time
const SHIFT_FREQ = ["Start of shift", "Every shift", "End of shift"];

/* ---------- the page ---------- */
function tasksFiltered() {
  const f = ui.reg.tasks,
    q = f.q.trim().toLowerCase();
  return P.tasks
    .filter((t) => {
      if (!taskInScope(t)) return false;
      if (f.freq && t.freq !== f.freq) return false;
      if (f.who && t.who !== f.who) return false;
      if (
        q &&
        !(
          taskNo(t) +
          " " +
          t.name +
          " " +
          t.who +
          " " +
          t.how +
          " " +
          t.note +
          " " +
          taskItems(t)
            .map((o) => o.label)
            .join(" ")
        )
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    })
    .sort(
      (a, b) =>
        (zoneName(a.zone) || "￿").localeCompare(zoneName(b.zone) || "￿") ||
        a.no - b.no,
    );
}
function taskItemsCell(t) {
  const have = taskItems(t),
    gone = t.items.length - have.length,
    names = have.map((o) => esc(o.label));
  const shown = names.slice(0, 3).join(", "),
    more =
      names.length > 3
        ? ` <span class="muted">+${names.length - 3} more</span>`
        : "";
  return (
    (shown ? shown + more : '<span class="muted">none linked</span>') +
    (gone ? ` <span class="muted">(${gone} removed)</span>` : "")
  );
}
function taskRows(rows) {
  if (!rows.length)
    return `<p class="empty" style="padding:14px 4px">Nothing matches these filters.</p>`;
  let last = null,
    h = `<table class="tbl" style="width:100%"><tr><th>No.</th><th>Task</th><th>Who</th><th>When</th><th class="n">Min</th><th>Items it uses</th><th>5S step</th><th></th></tr>`;
  for (const t of rows) {
    if (t.zone !== last) {
      last = t.zone;
      const z = P.areas.find((a) => a.id === t.zone),
        l = z && P.areas.find((a) => a.id === z.parent);
      h += `<tr class="tgrp"><td colspan="8"><b>${esc(z ? z.name : "Not in a zone")}</b>${l ? ` <span class="muted">${esc(l.name)}</span>` : ""}</td></tr>`;
    }
    const d = P.documents.find((x) => x.id === t.doc);
    h += `<tr class="click" data-taskid="${esc(t.id)}"><td><b class="nw">${taskNo(t)}</b></td><td class="t"><b>${esc(t.name)}</b>${d ? `<span class="sub">${esc(docNo(d))} ${esc(d.title)}</span>` : ""}${t.how ? `<span class="sub">${esc(t.how.split("\n")[0])}</span>` : ""}</td><td>${esc(t.who)}</td><td>${esc(t.freq)}</td><td class="n">${t.mins || "-"}</td><td>${taskItemsCell(t)}</td><td>${esc(S5.find((x) => x[0] === t.s5)?.[1] || "")}</td><td>${taskItems(t).length ? `<button data-tshow="${esc(t.id)}">Show</button>` : ""}</td></tr>`;
  }
  return h + "</table>";
}
function tasksHTML() {
  const F = ui.reg.tasks,
    sh = STD(),
    a = scopeArea(),
    mine = P.tasks.filter(taskInScope),
    zones = a ? (isLine(a) ? zonesOfLine(a) : [a]) : areasOn(sh),
    covered = new Set(mine.filter((t) => t.zone).map((t) => t.zone)),
    items = sh.objects.filter((o) => o.kind === "item" && scopeObj(o)),
    used = new Set(mine.flatMap((t) => t.items)),
    shiftMins = mine
      .filter((t) => SHIFT_FREQ.includes(t.freq))
      .reduce((n, t) => n + t.mins, 0),
    whoList = [...new Set(P.tasks.map((t) => t.who).filter(Boolean))].sort();
  let h = `<header><div><h2>Operator tasks: ${esc(a?.name || "the whole factory")}</h2><p class="muted" style="margin:4px 0 0">What the people working in each zone do, how often, and which items each task uses. Tasks are what the zone's 5S, documents and checks are built around.</p></div>
    <div class="kpis"><div><b>${mine.length}</b><span>Tasks</span></div><div><b>${covered.size}/${zones.length}</b><span>Zones with tasks</span></div><div><b>${items.filter((o) => used.has(o.ref)).length}/${items.length}</b><span>Items used</span></div><div><b>${shiftMins}</b><span>Min per shift</span></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pri" id="tNew">New task</button><button id="tPrint">Print</button><button id="tCsv">Export CSV</button></div></header>`;
  if (!P.tasks.length)
    return (
      h +
      `<div class="emptybox"><b>No tasks yet</b>List what an operator does in a zone: start-of-shift checks, cleaning, restocking, a changeover. Give each a frequency and a time, and link the items it uses (the film rack, the spill kit). The zone, the layout and the document list then show which items and documents are really needed.<div style="margin-top:14px"><button class="pri" id="tNew2">New task</button></div></div>`
    );
  h += `<div class="filters"><label>When<select data-f="freq">${optsKV([["", "Any time"], ...TASK_FREQ.map((x) => [x, x])], F.freq)}</select></label>
    <label>Who<select data-f="who">${optsKV([["", "Anyone"], ...whoList.map((x) => [x, x])], F.who)}</select></label>
    <label>Search<input type="search" data-f="q" value="${esc(F.q)}" placeholder="Task, item, step"></label></div>
    <div class="regtbl" id="taskTbl">${taskRows(tasksFiltered())}</div>`;
  return h;
}
function renderTasks() {
  const el = $("#taskView");
  if (!el) return;
  el.innerHTML = tasksHTML();
}

/* ---------- the form ---------- */
function taskItemPickHTML(zone, chosen) {
  const sh = STD(),
    all = sh.objects
      .filter((o) => o.kind === "item")
      .map((o) => ({ o, z: areaOf(o, sh) }))
      .sort(
        (p, q) =>
          (q.z?.id === zone) - (p.z?.id === zone) ||
          p.o.label.localeCompare(q.o.label),
      );
  if (!all.length)
    return '<p class="small muted">There are no items on the layout yet.</p>';
  return all
    .map(
      ({ o, z }) =>
        `<label class="chk itrow" data-itlabel="${esc(o.label.toLowerCase())}"><input type="checkbox" name="it:${esc(o.ref)}"${chosen.has(o.ref) ? " checked" : ""}>${esc(o.label)}<small>${z?.id === zone && zone ? "in this zone" : esc(z?.name || "no zone")}</small></label>`,
    )
    .join("");
}
async function taskModal(t, isNew) {
  let del = false;
  // the task's current zone and document stay selectable even if they are withdrawn or elsewhere
  const zones = P.areas.filter(
      (a) => !isLine(a) && (a.drawing === STD().drawing || a.id === t.zone),
    ),
    docs = P.documents.filter(
      (d) => d.status !== "Withdrawn" || d.id === t.doc,
    );
  const html = `<label class="f">Task<input name="name" required value="${esc(t.name)}" placeholder="e.g. Change the film reel"></label>
    <div class="row3"><label class="f">Zone<select name="zone"><option value="">Not in a zone</option>${zones.map((z) => `<option value="${esc(z.id)}"${t.zone === z.id ? " selected" : ""}>${esc(z.name)}</option>`).join("")}</select></label><label class="f">Who<input name="who" list="taskwho" value="${esc(t.who)}"></label><label class="f">When<select name="freq">${opts(TASK_FREQ, t.freq)}</select></label></div>
    <div class="row3"><label class="f">Minutes each time<input name="mins" type="number" min="0" step="1" value="${esc(t.mins || "")}"></label><label class="f">5S step<select name="s5"><option value="">None</option>${optsKV(
      S5.map((x) => [x[0], x[1]]),
      t.s5,
    )}</select></label><label class="f">Document<select name="doc"><option value="">None</option>${optsKV(
      docs.map((d) => [d.id, docNo(d) + " " + d.title]),
      t.doc,
    )}</select></label></div>
    <label class="f">How it is done (one step per line)<textarea name="how" rows="3" placeholder="1. Stop the packer&#10;2. Fit the new reel">${esc(t.how)}</textarea></label>
    <div class="f"><span>Items it uses <small class="muted">tick everything the task touches</small></span>
      <input type="search" id="itSearch" placeholder="Search items" aria-label="Search items" style="margin:4px 0">
      <div class="itpick" id="itPick">${taskItemPickHTML(t.zone, new Set(t.items))}</div>
      <div class="btns" style="margin-top:4px"><button type="button" id="itZone">Tick all in this zone</button><button type="button" id="itNone">Clear</button></div></div>
    <label class="f">Notes<textarea name="note" rows="2">${esc(t.note)}</textarea></label>
    ${isNew ? "" : '<div class="btns"><button type="button" class="danger" id="taskDel">Delete this task</button></div>'}
    <datalist id="taskwho">${[
      ...new Set([...TASK_WHO, ...P.tasks.map((x) => x.who)]),
    ]
      .filter(Boolean)
      .map((w) => `<option value="${esc(w)}">`)
      .join("")}</datalist>`;
  const checked = (dlg) =>
    new Set(
      [...dlg.querySelectorAll("#itPick input:checked")].map((c) =>
        c.name.slice(3),
      ),
    );
  const r = await modal(
    isNew ? "New task" : taskNo(t) + " task",
    html,
    isNew ? "Add task" : "Save",
    {
      cls: "mid",
      onOpen: (dlg) => {
        const zone = () => dlg.querySelector('[name="zone"]').value,
          redraw = () => {
            $("#itPick").innerHTML = taskItemPickHTML(zone(), checked(dlg));
            filter();
          },
          filter = () => {
            const q = $("#itSearch").value.trim().toLowerCase();
            dlg
              .querySelectorAll("#itPick .itrow")
              .forEach(
                (l) => (l.hidden = !!q && !l.dataset.itlabel.includes(q)),
              );
          };
        dlg.querySelector('[name="zone"]').onchange = redraw;
        $("#itSearch").oninput = filter;
        $("#itZone").onclick = () => {
          const z = zone();
          if (!z) return toast("Choose a zone first.");
          const sh = STD();
          dlg.querySelectorAll("#itPick input").forEach((c) => {
            const o = sh.objects.find((x) => x.ref === c.name.slice(3));
            if (o && areaOf(o, sh)?.id === z) c.checked = true;
          });
        };
        $("#itNone").onclick = () =>
          dlg
            .querySelectorAll("#itPick input")
            .forEach((c) => (c.checked = false));
        $("#taskDel") &&
          ($("#taskDel").onclick = () => {
            del = true;
            dlg.close("cancel");
          });
      },
    },
  );
  if (del) {
    const q = await modal(
      "Delete " + taskNo(t) + "?",
      '<p style="margin-top:0">This task will be removed. You can undo straight after.</p>',
      "Delete",
    );
    if (q) {
      checkpoint();
      P.tasks = P.tasks.filter((x) => x.id !== t.id);
      record("Task deleted", taskNo(t) + " " + t.name);
      renderAll();
    }
    return;
  }
  if (!r) return;
  checkpoint();
  Object.assign(t, {
    name: r.name.trim() || t.name || "Task",
    zone: r.zone,
    who: r.who.trim(),
    freq: r.freq,
    mins: Math.max(0, Number(r.mins) || 0),
    s5: r.s5,
    doc: r.doc,
    how: r.how.trim(),
    note: r.note.trim(),
    items: Object.keys(r)
      .filter((k) => k.startsWith("it:") && r[k])
      .map((k) => k.slice(3)),
  });
  if (isNew) {
    t.no = ++P.counters.task;
    P.tasks.push(t);
  }
  record(isNew ? "Task added" : "Task updated", taskNo(t) + " " + t.name);
  renderAll();
  if (ui.view === "tasks" && !taskInScope(t))
    toast(
      "Saved. It is not in the zone being shown, so it is hidden here.",
      5000,
    );
}
const newTask = (i) => taskModal(blankTask(i || {}), true),
  editTask = (id) => {
    const t = P.tasks.find((x) => x.id === id);
    if (t) taskModal(t, false);
  };

/* ---------- side panel blocks (zone and item) ---------- */
function taskRowsPanel(list, empty) {
  return list.length
    ? list
        .map(
          (t) =>
            `<button class="irow" style="--c:#0E7C86" data-a="taskOpen" data-id="${esc(t.id)}"><span>${esc(taskNo(t))} ${esc(t.name)}</span><span>${esc(t.freq)}${t.mins ? ", " + t.mins + " min" : ""}</span></button>`,
        )
        .join("")
    : `<p class="small muted">${empty}</p>`;
}
const zoneTasksHTML = (a) => {
  const list = tasksOfZone(a);
  return `<h3><span>Operator tasks</span><span class="count">${list.length}</span></h3>${taskRowsPanel(list, isLine(a) ? "No tasks in this line's zones yet." : "No operator tasks yet. Add what is done here and the items it uses.")}${isLine(a) ? "" : '<div class="btns"><button data-a="taskNew">Add a task here</button></div>'}`;
};
const itemTasksHTML = (o) => {
  const list = tasksOfItem(o);
  return `<h3><span>Operator tasks</span><span class="count">${list.length}</span></h3>${taskRowsPanel(list, "No task uses this item. Is it needed?")}<div class="btns"><button data-a="taskNewFor">Add a task using this</button></div>`;
};

/* ---------- output ---------- */
function csvTasks() {
  csv(
    [
      [
        "No.",
        "Task",
        "Zone",
        "Line",
        "Who",
        "When",
        "Minutes",
        "5S step",
        "Items",
        "Document",
        "How",
        "Notes",
      ],
      ...P.tasks.filter(taskInScope).map((t) => {
        const z = P.areas.find((a) => a.id === t.zone),
          l = z && P.areas.find((a) => a.id === z.parent),
          d = P.documents.find((x) => x.id === t.doc);
        return [
          taskNo(t),
          t.name,
          z?.name || "",
          l?.name || "",
          t.who,
          t.freq,
          t.mins,
          S5.find((x) => x[0] === t.s5)?.[1] || "",
          taskItems(t)
            .map((o) => o.label)
            .join("; "),
          d ? docNo(d) + " " + d.title : "",
          t.how.replace(/\n/g, " | "),
          t.note,
        ];
      }),
    ],
    "LeanStudio_operator_tasks.csv",
  );
}
function taskSheetHTML(rows, extra = "") {
  return `<table class="fixed"><colgroup><col style="width:6%"><col style="width:26%"><col style="width:11%"><col style="width:12%"><col style="width:5%"><col style="width:30%"><col style="width:${extra ? 5 : 10}%">${extra ? '<col style="width:5%">' : ""}</colgroup><tr><th>No.</th><th>Task</th><th>Who</th><th>When</th><th class="n">Min</th><th>Items it uses</th><th>How</th>${extra ? "<th>Done</th>" : ""}</tr>${rows
    .map(
      (t) =>
        `<tr><td><b class="nw">${esc(taskNo(t))}</b></td><td>${esc(t.name)}</td><td>${esc(t.who)}</td><td>${esc(t.freq)}</td><td class="n">${t.mins || "-"}</td><td>${
          taskItems(t)
            .map((o) => esc(o.label))
            .join(", ") || "-"
        }</td><td>${esc(t.how.split("\n").join(" / "))}</td>${extra ? '<td><span class="box"></span></td>' : ""}</tr>`,
    )
    .join("")}</table>`;
}
function printTasks() {
  const rows = tasksFiltered();
  if (!rows.length) return toast("No tasks to print yet.");
  const groups = new Map();
  for (const t of rows) {
    const k = zoneName(t.zone) || "Not in a zone";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  printWithPage(
    `<div class="pd"><h1>Operator tasks: ${esc(scopeArea()?.name || "the whole factory")}</h1>
    <p class="pdm">${esc(P.projectName || "Lean Studio project")}, printed ${esc(fmtD(today()))}. ${rows.length} task${rows.length > 1 ? "s" : ""}.</p>
    ${[...groups].map(([k, ts]) => `<div class="run"><h3>${esc(k)}</h3>${taskSheetHTML(ts, "tick")}</div>`).join("")}</div>`,
    "",
    "size: A4 landscape; margin: 10mm",
  );
}

/* ---------- events ---------- */
function showTaskItems(t) {
  const ids = taskItems(t).map((o) => o.id);
  if (!ids.length) return;
  if (ui.view !== "layout") setView("layout");
  if (S().kind !== "standard") openSheet(STD().id);
  // the zone's own items must be in view, so a scoped layout is widened to the whole factory
  if (ui.scope && !taskItems(t).every((o) => scopeObj(o))) setScope("");
  ui.sel = ids;
  ui.tab = "item";
  const o = taskItems(t)[0];
  drawNow();
  centreOn(o.x, o.y);
  renderSide();
}
$("#taskView").addEventListener("click", (e) => {
  let b;
  if ((b = e.target.closest("[data-tshow]"))) {
    showTaskItems(P.tasks.find((t) => t.id === b.dataset.tshow));
    return;
  }
  if ((b = e.target.closest("[data-taskid]")))
    return editTask(b.dataset.taskid);
  if (e.target.closest("#tNew,#tNew2")) {
    const a = scopeArea(),
      only =
        a && isLine(a) && zonesOfLine(a).length === 1
          ? zonesOfLine(a)[0]
          : null;
    newTask({ zone: a ? (isLine(a) ? only?.id || "" : a.id) : "" });
  } else if (e.target.closest("#tPrint")) printTasks();
  else if (e.target.closest("#tCsv")) csvTasks();
});
$("#taskView").addEventListener("change", (e) => {
  const k = e.target.dataset.f;
  if (!k || k === "q") return;
  ui.reg.tasks[k] = e.target.value;
  renderTasks();
});
$("#taskView").addEventListener("input", (e) => {
  if (e.target.dataset.f === "q") {
    ui.reg.tasks.q = e.target.value;
    $("#taskTbl").innerHTML = taskRows(tasksFiltered());
  }
});
