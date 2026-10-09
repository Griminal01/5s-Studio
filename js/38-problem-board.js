"use strict";
/* ============ the problem solving board: one screen, laid out like the whiteboard ============ */
// Statement at the top, the fishbone in the middle, hypothesis and the why chain underneath,
// then the action list. A cause that gets an action carries a number, and its actions carry
// the same number, like the circled numbers on a whiteboard.

/* causes that have actions, numbered in the order their first action was raised */
function causeNumbers(p) {
  const out = new Map();
  for (const a of probActs(p).sort((x, y) => x.no - y.no))
    if (a.cause && !out.has(a.cause) && probCause(p, a.cause))
      out.set(a.cause, out.size + 1);
  return out;
}
function probCause(p, id) {
  for (const [k] of FISH) {
    const c = p.fish[k].find((x) => x.id === id);
    if (c) return { ...c, cat: k };
  }
  return null;
}
const cnum = (n) =>
  `<span class="cnum" title="Linked to action number ${n}">${n}</span>`;
function causeOptions(p, cur) {
  return optsKV(
    [
      ["", "Not linked"],
      ...FISH.flatMap(([k, name]) =>
        p.fish[k]
          .filter((c) => c.text.trim())
          .map((c) => [c.id, `${name}: ${clipText(c.text, 40)}`]),
      ),
    ],
    cur,
  );
}

function boardHTML(p) {
  const nums = causeNumbers(p),
    fishName = (k) => FISH.find((f) => f[0] === k);
  const cause = (k, c) =>
    `<div class="pcause${c.likely ? " likely" : ""}"><button type="button" class="star" data-pb="likely" data-a1="${k}" data-a2="${esc(c.id)}" aria-pressed="${c.likely}" title="${c.likely ? "Likely cause: click to unmark" : "Mark as a likely cause"}">★</button><textarea rows="1" data-fc="${k}:${esc(c.id)}" aria-label="Cause">${esc(c.text)}</textarea>${nums.has(c.id) ? cnum(nums.get(c.id)) : ""}<span class="cbtns"><button type="button" data-pb="cause-act" data-a2="${esc(c.id)}" title="Raise an action against this cause">Act</button><button type="button" data-pa="fish-why" data-a1="${k}" data-a2="${esc(c.id)}" title="Start the why chain from this cause">Why</button><button type="button" data-pa="fish-del" data-a1="${k}" data-a2="${esc(c.id)}" aria-label="Remove this cause">×</button></span></div>`;
  const col = (k, pos) => {
    const [, name, hint] = fishName(k);
    return `<div class="fcol ${pos}"><h4 title="${esc(hint)}">${name}</h4><div class="fcauses">${p.fish[k].map((c) => cause(k, c)).join("")}<div class="pcause add"><input data-fadd="${k}" placeholder="Add a cause" title="${esc(hint)}" aria-label="Add a cause under ${name}"></div></div></div>`;
  };
  const nW = Math.min(MAX_WHYS, Math.max(5, p.whys.length + 1));
  const whys = Array.from({ length: nW }, (_, i) => {
    const w = p.whys[i] || { text: "", evidence: "" };
    return `<div class="pwhy"><span>Why ${i + 1}</span><textarea data-why="${i}:text" rows="3" placeholder="${i === 0 ? "Why does it happen?" : "Why did that happen?"}" aria-label="Why ${i + 1}">${esc(w.text)}</textarea><input data-why="${i}:evidence" value="${esc(w.evidence)}" placeholder="Evidence" aria-label="Evidence for why ${i + 1}"></div>`;
  }).join("");
  const likely = probLikely(p),
    acts = probActs(p).sort((a, b) => a.no - b.no),
    pr = probProgress(p),
    free = P.actions.filter((a) => !a.prob && !actFin(a)),
    newCause =
      ui.prob.newCause && probCause(p, ui.prob.newCause)
        ? ui.prob.newCause
        : "";
  const actRow = (a) => {
    const n = a.cause ? nums.get(a.cause) : null;
    return `<tr class="${a.status === "Done" ? "done" : actOverdue(a) ? "late" : ""}"><td class="n">${n ? cnum(n) : ""}<small>${esc(actNo(a))}</small></td><td><input data-ai="${esc(a.id)}:title" value="${esc(a.title)}" aria-label="Action"></td><td><select data-ai="${esc(a.id)}:cause" aria-label="From cause">${causeOptions(p, a.cause)}</select></td><td><input data-ai="${esc(a.id)}:owner" value="${esc(a.owner)}" list="owners" aria-label="Who"></td><td><input data-ai="${esc(a.id)}:due" type="date" value="${esc(a.due)}" aria-label="When"></td><td><select data-ai="${esc(a.id)}:status" aria-label="Status">${opts(ACT_ST, a.status)}</select>${a.status === "Done" && a.done ? `<small>${esc(fmtD(a.done))}</small>` : ""}</td><td><button type="button" data-pa="act-open" data-a1="${esc(a.id)}" title="Notes, priority, pin on the layout">More</button></td></tr>`;
  };
  return `<div class="pboard">
  <div class="pbhead">
    <div class="pbid"><small>Problem solving board</small><b>${esc(probNo(p))}</b>${probPill(p.status)}</div>
    <label class="pbstate"><small>Problem statement</small><textarea data-pf="title" rows="2" aria-label="Problem statement">${esc(p.title)}</textarea></label>
    <div class="pbmeta"><label>Date<input type="date" data-pf="raised" value="${esc(p.raised)}"></label><label>Owner<input data-pf="owner" value="${esc(p.owner)}" list="owners"></label><label>Status<select data-pf="status">${opts(PROB_ST, p.status)}</select></label><label>Where<select data-pf="area">${optsKV([["", "Not set"], ...P.areas.map((a) => [a.id, a.name])], p.area)}</select></label></div>
  </div>
  <div class="pbfish">
    ${FISH_TOP.map((k) => col(k, "up")).join("")}
    <div class="fspine" aria-hidden="true"></div>
    <div class="fhead"><span id="psHead">${esc(p.title)}</span></div>
    ${FISH_BOT.map((k) => col(k, "down")).join("")}
  </div>
  <p class="small muted pbtip">★ marks a likely cause. <b>Act</b> raises an action against a cause: both get the same number. <b>Why</b> starts the why chain from a cause.</p>
  <div class="pblow">
    <div class="pbhyp">
      <label class="f">Hypothesis<textarea data-pf="hypothesis" rows="4" placeholder="What we think is causing it, and how we will test it">${esc(p.hypothesis)}</textarea></label>
      ${!p.hypothesis.trim() && likely.length ? `<div class="pchips">${likely.map((c) => `<button type="button" class="pchip" data-pb="hyp" data-a2="${esc(c.id)}" title="Use this likely cause as the hypothesis">★ ${esc(clipText(c.text, 34))}</button>`).join("")}</div>` : ""}
      <label class="f">Confirm hypothesis<textarea data-pf="confirm" rows="3" placeholder="What the test or trial showed">${esc(p.confirm)}</textarea></label>
      <label class="f">Result<select data-pf="rootCheck">${optsKV(ROOT_CHECKS, p.rootCheck)}</select></label>
    </div>
    <div class="pbwhys">
      <div class="pwhys">${whys}<div class="pwhy root"><span>Root cause</span><textarea data-pf="root" rows="3" placeholder="The cause that, fixed, stops it coming back">${esc(p.root)}</textarea><button type="button" data-pa="why-root" title="Copy the last answer in the chain here">Use the last why</button></div></div>
      <p class="small muted" style="margin:6px 0 0">Ask why of each answer, not of the problem again. Clear a box to remove it.</p>
    </div>
  </div>
  <div class="pbacts">
    <h3><span>Actions</span><span class="count">${pr.n ? pr.done + " of " + pr.n + " done" : "none yet"}</span></h3>
    <div class="bdtbl"><table class="tbl pacts"><thead><tr><th class="n">#</th><th>Action</th><th>From cause</th><th>Who</th><th>When</th><th>Updated / completed</th><th></th></tr></thead><tbody>
    ${acts.map(actRow).join("")}
    <tr class="new"><td></td><td><input id="paTitle" placeholder="Add an action and press Enter" aria-label="New action"></td><td><select id="paCause" aria-label="From cause">${causeOptions(p, newCause)}</select></td><td><input id="paWho" list="owners" value="${esc(p.owner)}" aria-label="Who"></td><td><input id="paWhen" type="date" aria-label="When"></td><td></td><td><button type="button" class="pri" data-pb="act-new">Add</button></td></tr>
    </tbody></table></div>
    ${free.length ? `<div class="btns"><select id="psLink" aria-label="Link an existing action"><option value="">Link an existing action…</option>${free.map((a) => `<option value="${esc(a.id)}">${esc(actNo(a) + " " + a.title)}</option>`).join("")}</select></div>` : ""}
    <p class="small muted">Actions also show in the Actions register. Prefer fixes that make the problem impossible over reminders and retraining.</p>
  </div>
  ${ownerList()}
  </div>`;
}

/* ---------- board events ---------- */
function addBoardAction(p) {
  const t = $("#paTitle");
  if (!t || !t.value.trim()) {
    t?.focus();
    return toast("Type what needs doing first.");
  }
  checkpoint();
  const a = blankAct({ title: t.value.trim(), prob: p.id, source: probNo(p) });
  a.owner = $("#paWho").value.trim();
  a.due = $("#paWhen").value;
  a.cause = $("#paCause").value;
  a.no = ++P.counters.act;
  P.actions.push(a);
  ui.prob.newCause = "";
  if (p.status === "Open" || p.status === "Analysing")
    p.status = "Countermeasures";
  record("Action added", actNo(a) + " " + a.title + " for " + probNo(p));
  renderAll();
  $("#paTitle")?.focus();
}
psView.addEventListener("click", (e) => {
  const b = e.target.closest("[data-pb]"),
    p = curProb();
  if (!b || !p) return;
  const a2 = b.dataset.a2;
  switch (b.dataset.pb) {
    case "likely": {
      const c = p.fish[b.dataset.a1]?.find((x) => x.id === a2);
      if (!c) return;
      checkpoint();
      c.likely = !c.likely;
      lightEdit("fishbone");
      return renderProblems();
    }
    case "cause-act":
      ui.prob.newCause = a2;
      renderProblems();
      $("#paTitle")?.scrollIntoView({ block: "center" });
      $("#paTitle")?.focus();
      return;
    case "hyp": {
      const c = probCause(p, a2);
      if (!c) return;
      checkpoint();
      p.hypothesis = c.text;
      lightEdit("hypothesis");
      return renderProblems();
    }
    case "act-new":
      return addBoardAction(p);
    case "print-board":
      return printBoard(p);
  }
});
psView.addEventListener("change", (e) => {
  const el = e.target,
    p = curProb();
  if (!p || !el.dataset.ai) return;
  const [id, k] = el.dataset.ai.split(":"),
    a = P.actions.find((x) => x.id === id);
  if (!a) return;
  checkpoint();
  a[k] = k === "title" ? el.value.trim() || a.title : el.value;
  if (k === "status") a.done = actFin(a) ? a.done || today() : "";
  record("Action updated", actNo(a) + " (" + k + ")");
  if (k === "status" || k === "cause") renderAll();
  else {
    save();
    updateNavBadges();
  }
});
psView.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.target.id !== "paTitle") return;
  e.preventDefault();
  const p = curProb();
  if (p) addBoardAction(p);
});

/* ---------- print the board as it is, on one A3 sheet ---------- */
function printBoard(p) {
  const live = $("#problemView .pboard");
  if (!live) return;
  const c = live.cloneNode(true);
  // form fields become plain text; buttons, empty rows and hints go
  c.querySelectorAll("textarea, input").forEach((el) => {
    const src = live.querySelector(
      el.dataset.pf
        ? `[data-pf="${el.dataset.pf}"]`
        : el.dataset.why
          ? `[data-why="${el.dataset.why}"]`
          : el.dataset.fc
            ? `[data-fc="${el.dataset.fc}"]`
            : el.dataset.ai
              ? `[data-ai="${el.dataset.ai}"]`
              : "#__none",
    );
    const v = (src || el).value || "",
      span = document.createElement("span");
    span.className = "pv";
    span.textContent = el.type === "date" ? fmtD(v) : v;
    el.replaceWith(span);
  });
  c.querySelectorAll("select").forEach((el) => {
    const span = document.createElement("span");
    span.className = "pv";
    const src = el.dataset.pf
      ? live.querySelector(`[data-pf="${el.dataset.pf}"]`)
      : el.dataset.ai
        ? live.querySelector(`[data-ai="${el.dataset.ai}"]`)
        : null;
    const opt = (src || el).selectedOptions?.[0];
    span.textContent = opt && opt.value ? opt.textContent : "";
    el.replaceWith(span);
  });
  c.querySelectorAll(
    ".pcause.add, tr.new, button, .pbtip, datalist, .btns",
  ).forEach((n) => n.remove());
  c.querySelectorAll(".pbacts > p").forEach((n) => n.remove());
  printWithPage(
    `<div class="pd pboardprint"><p class="pdm">${esc(P.projectName || "Lean Studio project")}, printed ${esc(fmtD(today()))}</p>${c.outerHTML}</div>`,
    "",
    "size: A3 landscape; margin: 8mm",
  );
}

/* causes are one-line boxes that grow to fit what is typed, so long causes are never cut off */
function growCauses(root = $("#problemView")) {
  root.querySelectorAll(".pcause textarea").forEach((t) => {
    t.style.height = "auto";
    t.style.height = t.scrollHeight + "px";
  });
}
psView.addEventListener("input", (e) => {
  if (e.target.matches(".pcause textarea")) growCauses(e.target.parentElement);
});
psView.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches(".pcause textarea")) {
    e.preventDefault();
    e.target.blur();
  }
});
