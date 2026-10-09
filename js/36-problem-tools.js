"use strict";
/* ============ problem solving: fishbone, Pareto, A3 report, CSV ============ */
/* ---------- fishbone ---------- */
function wrapWords(s, max, lines) {
  const words = String(s).split(/\s+/).filter(Boolean),
    out = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > max) {
      out.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    out.length = lines;
    out[lines - 1] = out[lines - 1].slice(0, max - 1).replace(/\s+$/, "") + "…";
  }
  return out.map((l) => (l.length > max ? l.slice(0, max - 1) + "…" : l));
}
function fishboneSVG(p) {
  const W = 1240,
    H = 560,
    SY = 280,
    COL = ["#202C86", "#0E7C86", "#6B3FA0"],
    top = FISH_TOP.map((k) => FISH.find((f) => f[0] === k)),
    bot = FISH_BOT.map((k) => FISH.find((f) => f[0] === k)),
    ROWS = 5;
  const font = 'font-family="Segoe UI,system-ui,sans-serif"';
  let s = `<svg class="fishsvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fishbone diagram for ${esc(p.title)}">`;
  s += `<rect width="${W}" height="${H}" fill="#fff"/>`;
  s += `<line x1="30" y1="${SY}" x2="982" y2="${SY}" stroke="#1C2250" stroke-width="5" stroke-linecap="round"/>`;
  s += `<rect x="984" y="${SY - 64}" width="246" height="128" rx="10" fill="#202C86"/>`;
  const head = wrapWords(p.title, 22, 5);
  head.forEach((l, i) => {
    s += `<text x="1107" y="${SY - (head.length - 1) * 9 + i * 18}" ${font} font-size="15" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${esc(l)}</text>`;
  });
  const drawSide = (cats, up) =>
    cats.forEach(([k, name], i) => {
      const cx = 235 + i * 250,
        y0 = up ? 44 : H - 44,
        col = COL[i % 3];
      s += `<line x1="${cx}" y1="${y0}" x2="${cx + 130}" y2="${SY}" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>`;
      s += `<rect x="${cx - 70}" y="${y0 - (up ? 26 : -2)}" width="140" height="26" rx="13" fill="${col}"/><text x="${cx}" y="${y0 - (up ? 13 : -15)}" ${font} font-size="14" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${esc(name)}</text>`;
      const causes = p.fish[k];
      causes.slice(0, ROWS).forEach((c, j) => {
        const yy = up ? 78 + j * 42 : H - 78 - j * 42,
          bxx = cx + (130 * (yy - y0)) / (SY - y0);
        s += `<line x1="${bxx - 205}" y1="${yy}" x2="${bxx}" y2="${yy}" stroke="${col}" stroke-width="1.6"/>`;
        if (c.likely)
          s += `<circle cx="${bxx - 205}" cy="${yy}" r="5.5" fill="#C3361A"/>`;
        const lines = wrapWords(c.text, 30, 2);
        lines.forEach((l, li) => {
          s += `<text x="${bxx - 196}" y="${yy - 18 + li * 13 + (lines.length === 1 ? 7 : 0)}" ${font} font-size="11.5" font-weight="${c.likely ? 700 : 500}" fill="${c.likely ? "#C3361A" : "#1C2250"}">${esc(l)}</text>`;
        });
      });
      if (causes.length > ROWS)
        s += `<text x="${cx - 60}" y="${up ? 78 + ROWS * 42 - 20 : H - 78 - ROWS * 42 + 28}" ${font} font-size="11" fill="#5E6584">+ ${causes.length - ROWS} more, see the list</text>`;
    });
  drawSide(top, true);
  drawSide(bot, false);
  return s + "</svg>";
}
/* ---------- Pareto ---------- */
function paretoData() {
  const f = ui.prob;
  let cutoff = "";
  if (f.range !== "all") {
    const d = new Date();
    d.setDate(d.getDate() - Number(f.range));
    cutoff = d.toISOString().slice(0, 10);
  }
  const rows = P.problems.filter(
      (p) =>
        (f.closed || probOpen(p)) && (!cutoff || (p.raised || "") >= cutoff),
    ),
    key = (p) =>
      f.by === "area"
        ? probArea(p)?.name || "No area set"
        : f.by === "owner"
          ? p.owner || "No owner"
          : f.by === "status"
            ? p.status
            : p.category || "Kind not set";
  let measure = f.measure;
  const val = (p, m) => (m === "mins" ? p.mins : m === "count" ? p.count : 1);
  let total = rows.reduce((n, p) => n + val(p, measure), 0),
    fell = false;
  if (!total && measure !== "n") {
    measure = "n";
    fell = true;
    total = rows.length;
  }
  const g = new Map();
  for (const p of rows) {
    const k = key(p),
      e = g.get(k) || { k, v: 0, n: 0 };
    e.v += val(p, measure);
    e.n++;
    g.set(k, e);
  }
  const list = [...g.values()].filter((e) => e.v > 0).sort((a, b) => b.v - a.v);
  let run = 0;
  for (const e of list) {
    run += e.v;
    e.cum = total ? run / total : 0;
  }
  return { list, total, measure, fell, rows: rows.length };
}
const PARETO_UNITS = {
  mins: "minutes lost",
  count: "times it happened",
  n: "problems",
};
function paretoSVG(d) {
  const W = 920,
    H = 380,
    L = 64,
    R = 56,
    T = 24,
    B = 84,
    iw = W - L - R,
    ih = H - T - B,
    list = d.list.slice(0, 10),
    max = Math.max(...list.map((e) => e.v), 1),
    nice =
      4 *
      ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
        .map((x) => x * Math.pow(10, Math.floor(Math.log10(max / 4))))
        .find((x) => x * 4 >= max) || max / 4),
    bw = (iw / list.length) * 0.66,
    x = (i) => L + (iw / list.length) * (i + 0.5),
    y = (v) => T + ih - (v / nice) * ih,
    yp = (c) => T + ih - c * ih;
  const font = 'font-family="Segoe UI,system-ui,sans-serif"';
  let s = `<svg class="pareto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pareto chart">`;
  s += `<rect width="${W}" height="${H}" fill="#fff"/>`;
  for (let i = 0; i <= 4; i++) {
    const v = (nice / 4) * i;
    s += `<line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="#E3E5EE"/><text x="${L - 8}" y="${y(v)}" ${font} font-size="11" fill="#5E6584" text-anchor="end" dominant-baseline="central">${Math.round(v * 10) / 10}</text>`;
    s += `<text x="${W - R + 8}" y="${yp(i / 4)}" ${font} font-size="11" fill="#5E6584" dominant-baseline="central">${i * 25}%</text>`;
  }
  s += `<line x1="${L}" y1="${yp(0.8)}" x2="${W - R}" y2="${yp(0.8)}" stroke="#C3361A" stroke-dasharray="5 4" opacity=".6"/>`;
  list.forEach((e, i) => {
    const vital = i === 0 || list[i - 1].cum < 0.8;
    s += `<rect x="${x(i) - bw / 2}" y="${y(e.v)}" width="${bw}" height="${T + ih - y(e.v)}" fill="${vital ? "#202C86" : "#9AA1BC"}" rx="2"><title>${esc(e.k)}: ${e.v}</title></rect>`;
    s += `<text x="${x(i)}" y="${y(e.v) - 6}" ${font} font-size="12" font-weight="700" fill="#1C2250" text-anchor="middle">${Math.round(e.v * 10) / 10}</text>`;
    wrapWords(e.k, 14, 3).forEach((l, li) => {
      s += `<text x="${x(i)}" y="${T + ih + 16 + li * 13}" ${font} font-size="11" fill="#1C2250" text-anchor="middle">${esc(l)}</text>`;
    });
  });
  s += `<polyline points="${list.map((e, i) => x(i) + "," + yp(e.cum)).join(" ")}" fill="none" stroke="#E07B00" stroke-width="2.4"/>`;
  list.forEach((e, i) => {
    s += `<circle cx="${x(i)}" cy="${yp(e.cum)}" r="4" fill="#E07B00" stroke="#fff" stroke-width="1.5"/>`;
  });
  s += `<line x1="${L}" y1="${T + ih}" x2="${W - R}" y2="${T + ih}" stroke="#1C2250"/>`;
  return s + "</svg>";
}
function paretoHTML() {
  const d = paretoData(),
    f = ui.prob,
    unit = PARETO_UNITS[d.measure];
  let h = `<div class="filters"><label>Group by<select data-pare="by">${optsKV(
    [
      ["category", "Kind of problem"],
      ["area", "Where"],
      ["owner", "Owner"],
      ["status", "Status"],
    ],
    f.by,
  )}</select></label>
  <label>Measure<select data-pare="measure">${optsKV(
    [
      ["mins", "Minutes lost"],
      ["count", "Times it happened"],
      ["n", "Number of problems"],
    ],
    f.measure,
  )}</select></label>
  <label>Raised in<select data-pare="range">${optsKV(
    [
      ["all", "All time"],
      ["365", "Last year"],
      ["90", "Last 90 days"],
      ["30", "Last 30 days"],
    ],
    f.range,
  )}</select></label>
  <label class="chk"><input type="checkbox" data-pare="closed"${f.closed ? " checked" : ""}>Include closed problems</label>
  <button data-pareto-print>Print</button></div>`;
  h += `<div id="psPareto"><section class="block wide"><h3>Pareto: ${esc(unit)}, by ${esc({ category: "kind of problem", area: "where", owner: "owner", status: "status" }[f.by])}</h3>`;
  if (!d.list.length)
    return (
      h +
      `<p class="empty">Nothing to chart. Raise problems and fill in <b>Times it has happened</b> and <b>Minutes lost</b> on each.</p></section></div>`
    );
  const few = d.list.filter((e, i) => i === 0 || d.list[i - 1].cum < 0.8);
  h += `${d.fell ? `<p class="small muted">Nothing has minutes or counts filled in yet, so this counts problems. Add <b>Minutes lost</b> on each problem for a truer picture.</p>` : ""}${paretoSVG(d)}
  <p>${few.length === 1 ? `<b>${esc(few[0].k)}</b> alone is` : `The first <b>${few.length}</b> bars (${few.map((e) => esc(e.k)).join(", ")}) are`} <b>${Math.round(few.at(-1).cum * 100)}%</b> of ${esc(unit)}. Start there; navy bars are the vital few, the orange line is the running total.</p>
  <table class="tbl" style="width:100%"><tr><th>${esc({ category: "Kind of problem", area: "Where", owner: "Owner", status: "Status" }[f.by])}</th><th class="n">Problems</th><th class="n">${esc(unit)}</th><th class="n">Share</th><th class="n">Running total</th></tr>${d.list.map((e) => `<tr><td>${esc(e.k)}</td><td class="n">${e.n}</td><td class="n">${Math.round(e.v * 10) / 10}</td><td class="n">${Math.round((e.v / d.total) * 100)}%</td><td class="n">${Math.round(e.cum * 100)}%</td></tr>`).join("")}</table></section></div>`;
  return h;
}

/* ---------- A3 report ---------- */
function printProblem(p) {
  const ar = probArea(p),
    pr = probProgress(p),
    acts = probActs(p).sort(
      (a, b) =>
        actFin(a) - actFin(b) ||
        (a.due || "9999").localeCompare(b.due || "9999"),
    ),
    tag = P.tags.find((t) => t.id === p.tag),
    co = P.smed.changeovers.find((c) => c.id === p.co),
    step = co?.steps.find((s) => s.id === p.step),
    docs = p.docs
      .map((id) => P.documents.find((d) => d.id === id))
      .filter(Boolean),
    para = (v, empty) =>
      v.trim()
        ? `<p>${esc(v).replace(/\n/g, "<br>")}</p>`
        : `<p class="pdm">${empty}</p>`,
    meta = [
      ["Owner", p.owner || "-"],
      ["Team", p.team || "-"],
      ["Raised", fmtD(p.raised)],
      ["Where", ar?.name || "-"],
      ["Status", p.status],
    ];
  const links = [
    tag && `Red tag ${tagNo(tag)} ${tag.title}`,
    co && `Changeover ${coCode(co)} ${co.name}${step ? ", " + step.name : ""}`,
    ...docs.map((d) => docNo(d) + " " + d.title),
  ].filter(Boolean);
  const whys = p.whys.filter((w) => w.text.trim());
  const photos = p.photos.filter((x) => PH[x.id]).slice(0, 3);
  const html = `<div class="pd a3">
  <div class="a3head"><div><h1>${esc(probNo(p))} ${esc(p.title)}</h1><p class="pdm">${esc(P.projectName || "5S design project")}, printed ${esc(fmtD(today()))}${p.category ? ". " + esc(p.category) : ""}${links.length ? ". Linked: " + links.map(esc).join("; ") : ""}</p></div>
    <table class="a3meta"><tr>${meta.map(([k]) => `<th>${k}</th>`).join("")}</tr><tr>${meta.map(([, v]) => `<td>${esc(v)}</td>`).join("")}</tr></table></div>
  <div class="a3cols">
   <div>
    <section><h3>1 Background</h3>${para(p.background, "Not written yet.")}${p.containment.trim() ? `<p><b>Containment:</b> ${esc(p.containment)}</p>` : ""}</section>
    <section><h3>2 Current state</h3>${para(p.current, "Not written yet.")}${p.count || p.mins ? `<p class="pdm">${[p.count && p.count + " occurrence" + (p.count > 1 ? "s" : ""), p.mins && p.mins + " minutes lost"].filter(Boolean).join(", ")}</p>` : ""}${photos.length ? `<div class="a3ph">${photos.map((x) => `<img src="${esc(PH[x.id])}" alt="${esc(x.cap)}">`).join("")}</div>` : ""}</section>
    <section><h3>3 Target</h3>${para(p.target, "Not written yet.")}</section>
    <section><h3>4 Root cause analysis</h3>
      ${whys.length ? `<ol class="a3why">${whys.map((w) => `<li><b>${esc(w.text)}</b>${w.evidence.trim() ? `<span>${esc(w.evidence)}</span>` : ""}</li>`).join("")}</ol>` : '<p class="pdm">No 5-Why recorded.</p>'}
      ${p.hypothesis.trim() ? `<p><b>Hypothesis:</b> ${esc(p.hypothesis)}</p>` : ""}
      ${p.confirm.trim() ? `<p><b>Confirmed by:</b> ${esc(p.confirm)}</p>` : ""}
      ${p.root.trim() ? `<div class="a3root"><b>Root cause:</b> ${esc(p.root)}${p.rootCheck ? `<br><span>${esc(ROOT_CHECKS.find((c) => c[0] === p.rootCheck)[1])}</span>` : ""}</div>` : ""}
      ${probCauseCount(p) ? `<div class="a3fish">${fishboneSVG(p)}</div>` : ""}
    </section>
   </div>
   <div>
    <section><h3>5 Countermeasures</h3>${
      acts.length
        ? `<table class="fixed"><colgroup><col style="width:9%"><col style="width:47%"><col style="width:15%"><col style="width:15%"><col style="width:14%"></colgroup><tr><th>No.</th><th>Countermeasure</th><th>Owner</th><th>Due</th><th>Status</th></tr>${acts.map((a) => `<tr><td>${esc(actNo(a))}</td><td>${esc(a.title)}${a.note ? `<br><span class="pdm">${esc(a.note)}</span>` : ""}</td><td>${esc(a.owner)}</td><td>${esc(fmtD(actFin(a) ? a.done : a.due))}</td><td>${esc(a.status)}</td></tr>`).join("")}</table><p class="pdm">${pr.done} of ${pr.n} done${pr.late ? ", " + pr.late + " overdue" : ""}.</p>`
        : '<p class="pdm">No countermeasures yet.</p>'
    }</section>
    <section><h3>6 Follow-up</h3>
      <table class="fixed"><tr><th style="width:34%">Effectiveness check on</th><td>${esc(fmtD(p.checkOn)) || "Not set"}</td></tr><tr><th>Result</th><td>${esc(PROB_RESULTS.find((c) => c[0] === p.result)[1])}</td></tr></table>
      ${p.after.trim() ? `<p><b>Numbers now:</b> ${esc(p.after)}</p>` : ""}
      ${p.standard.trim() ? `<p><b>Kept fixed by:</b> ${esc(p.standard)}</p>` : ""}
      ${p.lessons.trim() ? `<p><b>Lessons:</b> ${esc(p.lessons)}</p>` : ""}
      ${p.recur.length ? `<p class="pdm">Came back on ${p.recur.map((d) => esc(fmtD(d))).join(", ")}.</p>` : ""}
      ${p.status === "Closed" ? `<p><b>Closed</b> on ${esc(fmtD(p.closed))}, ${probDays(p)} days after it was raised.</p>` : ""}
      <table class="fixed a3sign"><tr><th>Reviewed by</th><td></td><th>Date</th><td></td></tr></table>
    </section>
   </div>
  </div></div>`;
  printWithPage(html, "", "size: A3 landscape; margin: 10mm");
}

/* ---------- CSV ---------- */
function csvProblems() {
  csv(
    [
      [
        "No.",
        "Problem",
        "Status",
        "Kind",
        "Owner",
        "Team",
        "Where",
        "Raised",
        "Closed",
        "Days",
        "Times it happened",
        "Minutes lost",
        "Root cause",
        "Likely causes",
        "Countermeasures done",
        "Countermeasures",
        "Check on",
        "Result",
        "Came back",
      ],
      ...P.problems.map((p) => {
        const pr = probProgress(p);
        return [
          probNo(p),
          p.title,
          p.status,
          p.category,
          p.owner,
          p.team,
          probArea(p)?.name || "",
          p.raised,
          p.closed,
          probDays(p),
          p.count,
          p.mins,
          p.root,
          probLikely(p)
            .map((c) => c.text)
            .join("; "),
          pr.done,
          pr.n,
          p.checkOn,
          PROB_RESULTS.find((c) => c[0] === p.result)[1],
          p.recur.length,
        ];
      }),
    ],
    `5S_problems_${fileSafe(P.projectName || "project")}_${today()}.csv`,
  );
}
