"use strict";
/* ============ tracking: checks over time and where things actually sit ============ */
function trendData() {
  return dailies().map((d) => ({
    d,
    c: compare(d, stdFor(d)),
    s5: s5Total(d),
    walk: moveTotals(d).walk,
  }));
}
function lineChart(data, W = 760) {
  const H = 260,
    pl = 38,
    pr = 14,
    pt = 14,
    pb = 36,
    n = data.length,
    iw = W - pl - pr,
    ih = H - pt - pb;
  const x = (i) =>
      pl + 18 + (n < 2 ? (iw - 36) / 2 : (i * (iw - 36)) / (n - 1)),
    y = (v) => pt + (1 - v / 100) * ih,
    bw = Math.max(4, Math.min(26, (iw / Math.max(1, n)) * 0.5));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Percentage in place and 5S score by check">`;
  for (const v of [0, 25, 50, 75, 100])
    s += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="#D9DCE7"/><text x="${pl - 6}" y="${y(v)}" font-size="11" text-anchor="end" dominant-baseline="central" fill="#5E6584">${v}%</text>`;
  const tg = P.settings.target;
  s += `<line x1="${pl}" x2="${W - pr}" y1="${y(tg)}" y2="${y(tg)}" stroke="#1F8A55" stroke-dasharray="5 4"/><text x="${W - pr}" y="${y(tg) - 7}" font-size="11" text-anchor="end" fill="#1F8A55">Target ${tg}%</text>`;
  data.forEach((p, i) => {
    if (p.s5 != null)
      s += `<rect x="${x(i) - bw / 2}" y="${y(p.s5 * 4)}" width="${bw}" height="${ih - (y(p.s5 * 4) - pt)}" fill="#FEC20F" opacity=".55"><title>5S ${p.s5}/25</title></rect>`;
  });
  const pts = data
    .map((p, i) => (p.c.score == null ? null : [x(i), y(p.c.score)]))
    .filter(Boolean);
  if (pts.length > 1)
    s += `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#202C86" stroke-width="2.5" stroke-linejoin="round"/>`;
  const every = Math.ceil(n / 12);
  data.forEach((p, i) => {
    if (p.c.score != null)
      s += `<circle cx="${x(i)}" cy="${y(p.c.score)}" r="4.5" fill="#fff" stroke="#202C86" stroke-width="2.5"><title>${esc(fmtDate(p.d.date))}: ${p.c.score}% in place</title></circle>`;
    if (i % every === 0 || i === n - 1)
      s += `<text x="${x(i)}" y="${H - pb + 16}" font-size="11" text-anchor="middle" fill="#5E6584">${esc(fmtDate(p.d.date).replace(/^\w+,? /, ""))}</text>`;
  });
  return s + "</svg>";
}
function barChart(data, refV, W = 760) {
  const H = 220,
    pl = 56,
    pr = 14,
    pt = 14,
    pb = 36,
    n = data.length,
    iw = W - pl - pr,
    ih = H - pt - pb,
    max = Math.max(refV || 0, ...data.map((d) => d.walk), 1) * 1.15;
  const y = (v) => pt + (1 - v / max) * ih,
    slot = iw / Math.max(1, n),
    bw = Math.min(36, slot * 0.6);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Walking per shift by check">`;
  for (const f of [0, 0.5, 1]) {
    const v = (max / 1.15) * f;
    s += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="#D9DCE7"/><text x="${pl - 6}" y="${y(v)}" font-size="11" text-anchor="end" dominant-baseline="central" fill="#5E6584">${esc(fmtLen(v, STD()))}</text>`;
  }
  const every = Math.ceil(n / 12);
  data.forEach((d, i) => {
    const cx = pl + slot * (i + 0.5);
    s += `<rect x="${cx - bw / 2}" y="${y(d.walk)}" width="${bw}" height="${pt + ih - y(d.walk)}" fill="${refV && d.walk > refV * 1.1 ? "#F79622" : "#202C86"}" opacity=".85"><title>${esc(fmtDate(d.d.date))}: ${esc(fmtLen(d.walk, STD()))}</title></rect>`;
    if (i % every === 0)
      s += `<text x="${cx}" y="${H - pb + 16}" font-size="11" text-anchor="middle" fill="#5E6584">${esc(fmtDate(d.d.date).replace(/^\w+,? /, ""))}</text>`;
  });
  if (refV)
    s += `<line x1="${pl}" x2="${W - pr}" y1="${y(refV)}" y2="${y(refV)}" stroke="#1F8A55" stroke-dasharray="5 4"/><text x="${W - pr}" y="${y(refV) - 7}" font-size="11" text-anchor="end" fill="#1F8A55">Standard ${esc(fmtLen(refV, STD()))}</text>`;
  return s + "</svg>";
}
function renderTracking() {
  const std = STD(),
    data = trendData(),
    el = $("#trackView"),
    n = data.length;
  if (!n) {
    el.innerHTML = `<header><div><h2>Tracking</h2><p class="muted">Against ${esc(std.name)}</p></div></header><div class="block" style="max-width:640px"><h3>No daily checks yet</h3><p>Start a daily check each day and move things to where they really are. Tracking then shows where each item actually sits over time, what keeps drifting away from its home, and how far people walk. Open the example model line to see it filled in.</p><div class="btns"><button class="pri" id="tStart">Start today's check</button><button id="tExample">Open the example model line</button></div></div>`;
    $("#tStart").onclick = () => {
      setView("layout");
      newDaily();
    };
    $("#tExample").onclick = () => loadExample();
    return;
  }
  const sc = data.map((d) => d.c.score).filter((v) => v != null),
    last = data.at(-1),
    avg5 = sc.slice(-5),
    stdWalk = moveTotals(std).walk;
  const avg = avg5.length
    ? Math.round(avg5.reduce((a, b) => a + b, 0) / avg5.length)
    : null;
  let h = `<header><div><h2>Tracking</h2><p class="muted" style="margin:4px 0 0">${n} check${n > 1 ? "s" : ""}. Each is scored against the standard as it was when the check started.</p></div><div class="kpis">
    <div><b class="c-${scoreCls(last.c.score)}">${last.c.score ?? "–"}%</b><span>Latest, ${esc(fmtDate(last.d.date))}</span></div>
    <div><b class="c-${scoreCls(avg)}">${avg ?? "–"}%</b><span>Average, last ${avg5.length}</span></div>
    <div><b>${last.c.issueCount}</b><span>Issues on the latest check</span></div>
    <div><b>${last.s5 ?? "–"}${last.s5 != null ? '<small style="font-size:14px">/25</small>' : ""}</b><span>Latest quick 5S score</span></div>
    <div><b>${P.tags.filter((t) => t.status !== "Closed").length}</b><span>Open red tags</span></div>
    <div><b class="${P.actions.some(actOverdue) ? "c-bad" : ""}">${P.actions.filter((a) => !["Done", "Cancelled"].includes(a.status)).length}</b><span>Open actions${P.actions.some(actOverdue) ? ", " + P.actions.filter(actOverdue).length + " overdue" : ""}</span></div></div>
    <div class="btns"><button id="tCsv">Export trend (CSV)</button><button id="tLog">Export movement log (CSV)</button><button id="tPrint">Print</button></div></header><div class="tgrid">`;
  h += `<section class="block wide" id="driftBlock"></section>`;
  h += `<section class="block wide"><h3>In place, check by check</h3><p>Blue line: share of movable items in their standard place. Yellow bars: quick layout 5S score.</p><div data-chart="line"></div></section>`;
  h += `<section class="block"><h3>Walking per shift</h3><p>${stdWalk ? "Orange bars walk more than 10% over the standard routes." : "Trace the ideal routes on the standard to get a reference line."}</p>${data.some((d) => d.walk) ? '<div data-chart="bar"></div>' : '<p class="empty">No routes traced on daily checks yet.</p>'}</section>`;
  h += followUpHTML();
  h += `<section class="block wide"><h3>Every check</h3><div class="tbl"><table><tr><th>Date</th><th>Shift</th><th>Checked by</th><th class="n">In place</th><th class="n">Out of place</th><th class="n">Missing</th><th class="n">Not in std</th><th class="n">Keep-clear</th><th class="n">Tape</th><th class="n">5S</th><th class="n">Walking</th></tr>${data
    .slice()
    .reverse()
    .map(
      (p) =>
        `<tr class="click" data-sheet="${esc(p.d.id)}"><td>${esc(fmtDate(p.d.date))}</td><td>${esc(p.d.shift)}</td><td>${esc(p.d.checker)}</td><td class="n c-${scoreCls(p.c.score)}"><b>${p.c.score ?? "–"}%</b></td><td class="n">${p.c.moved.length}</td><td class="n">${p.c.missing.length}</td><td class="n">${p.c.extra.length}</td><td class="n">${p.c.blocked.length}</td><td class="n">${p.c.damaged.length + p.c.tapeMissing.length}</td><td class="n">${p.s5 ?? ""}</td><td class="n">${p.walk ? esc(fmtLen(p.walk, p.d)) : ""}</td></tr>`,
    )
    .join("")}</table></div></section>`;
  h += `<section class="block wide"><h3>Change log</h3><p>A working record of edits in this browser, newest first. Not a controlled audit trail.</p><div class="log">${P.journal
    .slice(-250)
    .reverse()
    .map(
      (j) =>
        `<div><span class="muted">${esc(new Date(j.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</span><span><b>${esc(j.action)}</b> ${esc(j.detail)} <span class="muted">(${esc(j.sheet)})</span></span></div>`,
    )
    .join("")}</div></section></div>`;
  el.innerHTML = h;
  renderDrift();
  wireFollowUp(el);
  for (const c of el.querySelectorAll("[data-chart]")) {
    const w = Math.max(360, c.clientWidth);
    c.innerHTML =
      c.dataset.chart === "line"
        ? lineChart(data, w)
        : barChart(data, stdWalk, w);
  }
  $("#tCsv").onclick = () =>
    csv(
      [
        [
          "Date",
          "Shift",
          "Checked by",
          "In place %",
          "Items",
          "In place",
          "Out of place",
          "Missing",
          "Not in standard",
          "Blocking keep-clear",
          "Tape issues",
          "5S /25",
          "Walking per shift",
        ],
        ...data.map((p) => [
          p.d.date,
          p.d.shift,
          p.d.checker,
          p.c.score,
          p.c.items,
          p.c.inPlace,
          p.c.moved.length,
          p.c.missing.length,
          p.c.extra.length,
          p.c.blocked.length,
          p.c.damaged.length + p.c.tapeMissing.length,
          p.s5 ?? "",
          fmtLen(p.walk, p.d),
        ]),
      ],
      "LeanStudio_tracking.csv",
    );
  $("#tLog").onclick = csvMovementLog;
  $("#tPrint").onclick = () =>
    printView(el, "size: A3 landscape; margin: 10mm");
  el.querySelectorAll("tr[data-sheet]").forEach(
    (tr) =>
      (tr.onclick = () => {
        setView("layout");
        openSheet(tr.dataset.sheet);
      }),
  );
}

/* every position of every item on every check, ready for a spreadsheet */
function csvMovementLog() {
  const std = STD(),
    m = mpu(std),
    k = m || 1,
    rows = [
      [
        "Date",
        "Shift",
        "Checked by",
        "Item",
        "Status",
        "East (" + (m ? "m" : "u") + ")",
        "South (" + (m ? "m" : "u") + ")",
        "Home east",
        "Home south",
        "Distance from home (" + (m ? "m" : "u") + ")",
      ],
    ];
  for (const d of dailies()) {
    const ref = stdFor(d);
    for (const r of ref.objects) {
      if (r.kind !== "item") continue;
      const o = d.objects.find((x) => x.ref === r.ref),
        rd = (v) => Math.round(v * k * 100) / 100;
      rows.push([
        d.date,
        d.shift,
        d.checker,
        r.label,
        o ? "found" : "missing",
        o ? rd(o.x) : "",
        o ? rd(o.y) : "",
        rd(r.x),
        rd(r.y),
        o ? rd(Math.hypot(o.x - r.x, o.y - r.y)) : "",
      ]);
    }
  }
  csv(rows, "LeanStudio_movement_log.csv");
}
