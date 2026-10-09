"use strict";
/* ============ drift map ============
   Tracking's drift map: where each item was found across daily checks (driftCalc), the map
   (driftSVG, renderDrift), moving an item's home (moveHome) or adding a found item to the standard. */
const median = (a) => {
  const s = a.slice().sort((x, y) => x - y),
    m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
function driftCalc() {
  const std = STD(),
    days = dailies(),
    use = ui.drift.n ? days.slice(-ui.drift.n) : days,
    tol = tolU(std);
  const homes = new Map(
    std.objects.filter((o) => o.kind === "item").map((o) => [o.ref, o]),
  );
  const items = new Map(
      [...homes.values()].map((h) => [
        h.ref,
        {
          ref: h.ref,
          label: h.label,
          home: h,
          pts: [],
          checks: 0,
          missing: 0,
        },
      ]),
    ),
    extra = new Map();
  for (const d of use) {
    const refs = new Set(
      stdFor(d)
        .objects.filter((o) => o.kind === "item")
        .map((o) => o.ref),
    );
    for (const it of items.values()) {
      if (!refs.has(it.ref)) continue;
      it.checks++;
      const o = d.objects.find((x) => x.ref === it.ref);
      if (!o) {
        it.missing++;
        continue;
      }
      it.pts.push({
        x: o.x,
        y: o.y,
        dist: Math.hypot(o.x - it.home.x, o.y - it.home.y),
        date: d.date,
        shift: d.shift,
        sheet: d.id,
      });
    }
    for (const o of d.objects) {
      if (o.kind !== "item" || refs.has(o.ref) || homes.has(o.ref)) continue;
      const key = o.label.trim().toLowerCase();
      let e = extra.get(key);
      if (!e) {
        e = {
          label: o.label,
          pts: [],
          sheets: new Set(),
          sample: o,
          lastSheet: d.id,
        };
        extra.set(key, e);
      }
      e.pts.push({ x: o.x, y: o.y, date: d.date, sheet: d.id });
      e.sheets.add(d.id);
      e.sample = o;
      e.lastSheet = d.id;
    }
  }
  for (const it of items.values()) {
    it.inPlace = it.pts.filter((p) => p.dist <= tol).length;
    it.out = it.pts.length - it.inPlace;
    it.bad = it.out + it.missing;
    it.maxDist = Math.max(0, ...it.pts.map((p) => p.dist));
    it.med = it.pts.length ? median(it.pts.map((p) => p.dist)) : 0;
    it.settled = null;
    if (it.pts.length) {
      it.mx = median(it.pts.map((p) => p.x));
      it.my = median(it.pts.map((p) => p.y));
      it.mdist = Math.hypot(it.mx - it.home.x, it.my - it.home.y);
      const near = it.pts.filter(
        (p) => Math.hypot(p.x - it.mx, p.y - it.my) <= tol,
      );
      if (
        it.pts.length >= 3 &&
        it.mdist > tol &&
        near.length / it.pts.length >= 0.6
      )
        it.settled = {
          x: near.reduce((a, p) => a + p.x, 0) / near.length,
          y: near.reduce((a, p) => a + p.y, 0) / near.length,
          n: near.length,
        };
    }
  }
  const list = [...items.values()]
    .filter((i) => i.checks)
    .sort(
      (a, b) =>
        b.bad - a.bad ||
        b.maxDist - a.maxDist ||
        a.label.localeCompare(b.label),
    );
  const ex = [...extra.values()]
    .map((e) => ({
      ...e,
      count: e.sheets.size,
      mx: median(e.pts.map((p) => p.x)),
      my: median(e.pts.map((p) => p.y)),
    }))
    .sort((a, b) => b.count - a.count);
  return { items: list, extras: ex, used: use.length, tol };
}
function driftSVG(D0, W) {
  const std = STD(),
    dm = DM(std),
    S0 = ui.drift,
    tol = D0.tol,
    H = Math.round(Math.min(520, W * 0.5)),
    asp = W / H,
    foc = S0.focus ? D0.items.find((i) => i.ref === S0.focus) : null;
  const shown = foc ? [foc] : D0.items.filter((i) => !S0.moved || i.bad > 0),
    showEx = !foc && S0.extras,
    xs = [],
    ys = [],
    add = (x, y) => {
      xs.push(x);
      ys.push(y);
    };
  for (const i of shown) {
    add(i.home.x - i.home.w / 2, i.home.y - i.home.h / 2);
    add(i.home.x + i.home.w / 2, i.home.y + i.home.h / 2);
    for (const p of i.pts) add(p.x, p.y);
    if (foc && i.settled) {
      add(i.settled.x - i.home.w / 2, i.settled.y - i.home.h / 2);
      add(i.settled.x + i.home.w / 2, i.settled.y + i.home.h / 2);
    }
  }
  if (showEx) for (const e of D0.extras) for (const p of e.pts) add(p.x, p.y);
  let vb;
  if (S0.view === "all" || !xs.length) vb = [0, 0, dm.w, dm.h];
  else {
    let x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      y0 = Math.min(...ys),
      y1 = Math.max(...ys);
    const m = mpu(std),
      pad = Math.max(x1 - x0, y1 - y0) * 0.15 + (m ? 0.5 / m : 5),
      minW = m ? 10 / m : 100;
    x0 -= pad;
    x1 += pad;
    y0 -= pad;
    y1 += pad;
    let bw = Math.max(x1 - x0, minW),
      bh = y1 - y0;
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    if (bw / bh < asp) bw = bh * asp;
    else bh = bw / asp;
    vb = [cx - bw / 2, cy - bh / 2, bw, bh];
  }
  const k = vb[2] / W,
    home = (i, strong) =>
      `<g transform="translate(${i.home.x} ${i.home.y}) rotate(${i.home.a})" pointer-events="none"><rect x="${-i.home.w / 2}" y="${-i.home.h / 2}" width="${i.home.w}" height="${i.home.h}" fill="${strong ? "#202C86" : "none"}" fill-opacity=".07" stroke="${strong ? "#202C86" : "#9AA1BC"}" stroke-width="${(strong ? 1.6 : 1) * k}" ${strong ? "" : `stroke-opacity=".7"`}/></g>`;
  let s =
    `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#fff"/>${D[std.drawing] ? `<image href="${esc(D[std.drawing])}" x="0" y="0" width="${dm.w}" height="${dm.h}" preserveAspectRatio="none" opacity=".4"/>` : ""}` +
    fixedSVG(std, k, false, "fxhd");
  for (const i of D0.items) if (!shown.includes(i)) s += home(i, false);
  for (const i of shown) {
    s += home(i, true);
    for (const p of i.pts)
      if (p.dist > tol)
        s += `<line x1="${i.home.x}" y1="${i.home.y}" x2="${p.x}" y2="${p.y}" stroke="#E07B00" stroke-opacity=".35" stroke-width="${k}" pointer-events="none"/>`;
  }
  if (foc && foc.settled) {
    const q = foc.settled;
    s += `<line x1="${foc.home.x}" y1="${foc.home.y}" x2="${q.x}" y2="${q.y}" stroke="#6B3FA0" stroke-width="${1.6 * k}" stroke-dasharray="${5 * k} ${3 * k}"/><g transform="translate(${q.x} ${q.y}) rotate(${foc.home.a})"><rect x="${-foc.home.w / 2}" y="${-foc.home.h / 2}" width="${foc.home.w}" height="${foc.home.h}" fill="#6B3FA0" fill-opacity=".1" stroke="#6B3FA0" stroke-width="${2 * k}" stroke-dasharray="${6 * k} ${3 * k}"/></g>${txt(q.x, q.y - foc.home.h / 2 - 9 * k, "Where it settles", 10.5 * k, k, { fill: "#6B3FA0" })}`;
  }
  if (showEx)
    for (const e of D0.extras)
      for (const p of e.pts)
        s += `<g data-dot="${esc(p.sheet)}"><title>${esc(e.label)}: not in the standard, ${esc(fmtDate(p.date))}</title><rect transform="translate(${p.x} ${p.y}) rotate(45)" x="${-3.4 * k}" y="${-3.4 * k}" width="${6.8 * k}" height="${6.8 * k}" fill="#6B3FA0" fill-opacity=".65" stroke="#fff" stroke-width="${0.7 * k}"/></g>`;
  for (const i of shown)
    for (const p of i.pts) {
      const ok = p.dist <= tol;
      s += `<g data-dot="${esc(p.sheet)}"><title>${esc(i.label)}: ${esc(fmtDate(p.date))}${p.shift ? " " + esc(p.shift) : ""}, ${ok ? "in place" : esc(fmtLen(p.dist, std)) + " from home"}</title><circle cx="${p.x}" cy="${p.y}" r="${3.6 * k}" fill="${ok ? "#1F8A55" : "#E07B00"}" fill-opacity=".6" stroke="#fff" stroke-width="${0.7 * k}"/></g>`;
    }
  const lab = shown.filter((i) => i.bad > 0).slice(0, foc ? 1 : 16);
  if (foc || shown.length <= 40)
    for (const i of lab)
      s += txt(i.home.x, i.home.y - i.home.h / 2 - 8 * k, i.label, 10.5 * k, k);
  return `<svg class="dmap" viewBox="${vb.map((v) => Math.round(v * 100) / 100).join(" ")}" role="img" aria-label="Positions of items across all checks">${s}</svg>`;
}
function renderDrift() {
  const blk = $("#driftBlock");
  if (!blk) return;
  const S0 = ui.drift,
    std = STD(),
    D0 = driftCalc();
  if (S0.focus && !D0.items.some((i) => i.ref === S0.focus)) S0.focus = "";
  const W = Math.max(480, blk.clientWidth - 36),
    foc = S0.focus ? D0.items.find((i) => i.ref === S0.focus) : null,
    rows = S0.all ? D0.items : D0.items.slice(0, 12);
  const note = (i) =>
    i.settled
      ? `Usually sits ${fmtLen(i.mdist, std)} away. The home may be wrong.`
      : i.checks >= 3 && i.bad / i.checks >= 0.5
        ? "Moves on most checks"
        : i.missing >= 2 && i.missing / i.checks >= 0.4
          ? "Often missing"
          : "";
  let h = `<h3>Where things actually sit</h3><p>Every spot each item was found in across ${D0.used} check${D0.used === 1 ? "" : "s"}, against where the standard says it lives. Click an item in the table to look at just that one. Click a dot to open that day. Distances are from where the standard puts each item <b>now</b>. The check scores elsewhere in Tracking use the standard each check was scored against.</p>
    <div class="dctl"><label>Checks<select data-d="n">${[
      [0, "All"],
      [5, "Last 5"],
      [10, "Last 10"],
      [20, "Last 20"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${esc(v)}"${S0.n === v ? " selected" : ""}>${l}</option>`,
      )
      .join("")}</select></label>
    <label>View<select data-d="view"><option value="fit"${S0.view === "fit" ? " selected" : ""}>Zoom to the dots</option><option value="all"${S0.view === "all" ? " selected" : ""}>Whole drawing</option></select></label>
    <label><input type="checkbox" data-d="moved"${S0.moved ? " checked" : ""}>Only items that have moved</label>
    <label><input type="checkbox" data-d="extras"${S0.extras ? " checked" : ""}>Show things not in the standard</label></div>
    ${driftSVG(D0, W)}
    <div class="legend"><span><i class="sq"></i>Standard home</span><span><i style="background:#1F8A55"></i>Found in place</span><span><i style="background:#E07B00"></i>Found out of place</span><span><i class="dia"></i>Not in the standard</span></div>`;
  if (foc)
    h += `<div class="focus"><div class="grow"><b>${esc(foc.label)}</b><br>Checked ${foc.checks} time${foc.checks === 1 ? "" : "s"}: in place ${foc.inPlace}, out of place ${foc.out}, missing ${foc.missing}.${foc.pts.length ? ` Furthest from home: ${esc(fmtLen(foc.maxDist, std))}.` : ""}${foc.settled ? `<br><b>It tends to settle ${esc(fmtLen(foc.mdist, std))} from its home</b> (${foc.settled.n} of ${foc.pts.length} checks). Moving the standard home there would match how it is really used.` : ""}</div>${foc.settled ? `<button class="pri" data-d-move="${esc(foc.ref)}">Move the standard home there</button>` : ""}<button data-d-open="${esc(foc.ref)}">Open on the layout</button><button data-d-clear="1">Show all items</button></div>`;
  h += D0.items.length
    ? `<div class="tbl"><table><tr><th>Item</th><th class="n">Checks</th><th class="n">In place</th><th class="n">Out of place</th><th class="n">Missing</th><th class="n">Usually from home</th><th>Note</th></tr>${rows.map((i) => `<tr class="click" data-d-focus="${esc(i.ref)}"${i.ref === S0.focus ? ' style="background:var(--soft)"' : ""}><td><b>${esc(i.label)}</b></td><td class="n">${i.checks}</td><td class="n">${i.inPlace}</td><td class="n">${i.out}</td><td class="n">${i.missing}</td><td class="n">${i.pts.length ? esc(fmtLen(i.med, std)) : ""}</td><td>${esc(note(i))}</td></tr>`).join("")}</table></div>${D0.items.length > 12 ? `<div class="btns"><button data-d-all="1">${S0.all ? "Show the top 12 only" : "Show all " + D0.items.length + " items"}</button></div>` : ""}`
    : '<p class="empty">Place movable items on the standard to see where they end up.</p>';
  if (D0.extras.length)
    h += `<h3 style="margin-top:18px">Turn up but not in the standard</h3><div class="tbl"><table><tr><th>Item</th><th class="n">Checks seen</th><th></th></tr>${D0.extras
      .slice(0, 10)
      .map(
        (e, i) =>
          `<tr><td><b>${esc(e.label)}</b></td><td class="n">${e.count} of ${D0.used}</td><td style="text-align:right"><button data-d-add="${esc(i)}">Add to the standard</button> <button data-d-tag="${esc(i)}">Red tag it</button></td></tr>`,
      )
      .join("")}</table></div>`;
  blk.innerHTML = h;
  blk.onchange = (e) => {
    const k = e.target.dataset.d;
    if (!k) return;
    S0[k] =
      e.target.type === "checkbox"
        ? e.target.checked
        : k === "n"
          ? +e.target.value
          : e.target.value;
    renderDrift();
  };
  blk.onclick = (e) => {
    let b;
    if ((b = e.target.closest("[data-dot]"))) {
      setView("layout");
      openSheet(b.dataset.dot);
      return;
    }
    if ((b = e.target.closest("[data-d-move]"))) {
      moveHome(b.dataset.dMove);
      return;
    }
    if ((b = e.target.closest("[data-d-open]"))) {
      const o = STD().objects.find((x) => x.ref === b.dataset.dOpen);
      setView("layout");
      openSheet(STD().id);
      if (o) {
        ui.sel = [o.id];
        ui.tab = "item";
        renderSide();
        drawNow();
        centreOn(o.x, o.y);
      }
      return;
    }
    if (e.target.closest("[data-d-clear]")) {
      S0.focus = "";
      renderDrift();
      return;
    }
    if (e.target.closest("[data-d-all]")) {
      S0.all = !S0.all;
      renderDrift();
      return;
    }
    if ((b = e.target.closest("[data-d-add]"))) {
      addExtraToStd(+b.dataset.dAdd);
      return;
    }
    if ((b = e.target.closest("[data-d-tag]"))) {
      const x = D0.extras[+b.dataset.dTag];
      newTag({
        x: n2(x.mx),
        y: n2(x.my),
        drawing: std.drawing,
        sheet: x.lastSheet,
        title: x.label,
      });
      return;
    }
    if ((b = e.target.closest("[data-d-focus]"))) {
      S0.focus = S0.focus === b.dataset.dFocus ? "" : b.dataset.dFocus;
      renderDrift();
    }
  };
}
function moveHome(ref) {
  const it = driftCalc().items.find((i) => i.ref === ref);
  if (!it || !it.settled) return;
  const o = STD().objects.find((x) => x.ref === ref);
  if (!o) return;
  checkpoint();
  const was = Math.hypot(it.settled.x - o.x, it.settled.y - o.y);
  o.x = n2(it.settled.x);
  o.y = n2(it.settled.y);
  record("Standard home moved", o.label + ", " + fmtLen(was, STD()));
  renderAll();
  toast(
    `${o.label} home moved. Past checks keep the standard they were scored against; new checks use the new home.`,
    5000,
  );
}
function addExtraToStd(i) {
  const e = driftCalc().extras[i];
  if (!e) return;
  checkpoint();
  const n = clone(e.sample);
  n.id = uid();
  n.ref = e.sample.ref || n.id; // the same ref, so the checks recognise it from now on
  n.x = n2(e.mx);
  n.y = n2(e.my);
  n.fp = true;
  n.locked = false;
  STD().objects.push(n);
  // the same thing found on earlier checks becomes this item, so it is tracked from its first sighting
  const key = n.label.trim().toLowerCase(),
    stdRefs = new Set(STD().objects.map((o) => o.ref));
  for (const sh of P.sheets)
    if (e.sheets.has(sh.id))
      for (const o of sh.objects)
        if (
          o.kind === "item" &&
          o.label.trim().toLowerCase() === key &&
          (!stdRefs.has(o.ref) || o.ref === n.ref)
        )
          o.ref = n.ref;
  record("Added to standard", n.label);
  renderAll();
  toast(
    `${n.label} added to the standard at its usual spot. Check it is the right home.`,
    5000,
  );
}
