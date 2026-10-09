"use strict";
/* ============ tape plan ============
   The A3 sheet someone lays floor tape from: the plan drawn to a true scale (1:50, 1:100 ...) with run
   numbers and the datum, a colour key, the order list (supplier, code, metres, rolls), the runs with their
   start points, a scale bar and a title block for sign-off. printTapePlan() makes it; the full point by
   point setting-out stays on the marking sheet (printMarkingSheet in 23-floor-marking). Also
   printColourStandard(): the marking standard as a document to review and sign. */
const TP_PAGE = { w: 420, h: 297, margin: 8 }, // A3 landscape, mm
  TP_PLAN = { w: 282, h: 232 }, // the drawing on the sheet, mm
  TP_SCALES = [
    10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1250,
    1500, 2000, 2500, 5000,
  ];
const patName = (t) =>
  t.pattern === "stripe"
    ? "Striped"
    : t.pattern === "dash"
      ? "Dashed"
      : "Solid";
// the smallest standard scale at which the marked area fits the plan box: 1:n
function tpScale(ext, m) {
  const need = Math.max(
    ((ext.x1 - ext.x0) * m * 1000) / TP_PLAN.w,
    ((ext.y1 - ext.y0) * m * 1000) / TP_PLAN.h,
  );
  return TP_SCALES.find((n) => n >= need) || Math.ceil(need / 1000) * 1000;
}
// a scale bar about 50 mm long in round metres, drawn in real millimetres
function tpScaleBar(n) {
  const mPerMm = n / 1000,
    L = [0.5, 1, 2, 5, 10, 20, 50, 100].find((v) => v / mPerMm >= 35) || 100,
    mm = L / mPerMm,
    seg = mm / 4;
  let bars = "";
  for (let i = 0; i < 4; i++)
    bars += `<rect x="${i * seg}" y="0" width="${seg}" height="2.2" fill="${i % 2 ? "#fff" : "#1C2250"}" stroke="#1C2250" stroke-width=".25"/>`;
  return `<svg class="tpbar" viewBox="-2 -1 ${mm + 14} 7" style="width:${mm + 16}mm;height:7mm">${bars}<text x="0" y="5.6" font-size="2.6">0</text><text x="${mm}" y="5.6" font-size="2.6" text-anchor="middle">${esc(L)} m</text></svg>`;
}

function printTapePlan() {
  const sh = S(),
    ext = markExtent(sh);
  if (!ext) {
    toast(
      "Nothing to print yet. Draw some tape or give items a home marking first.",
    );
    return;
  }
  const dm = DM(sh),
    m = mpu(sh),
    T = P.marking,
    sc = markSchedule(sh),
    so = settingOut(sh),
    F = (v) => esc(fmtLen(v, sh));
  // the window on the drawing: true to scale when the scale is set, else just fitted
  const cx = (ext.x0 + ext.x1) / 2,
    cy = (ext.y0 + ext.y1) / 2,
    pad = m ? 1 / m : Math.max(ext.x1 - ext.x0, ext.y1 - ext.y0) * 0.08;
  const padded = {
    x0: ext.x0 - pad,
    x1: ext.x1 + pad,
    y0: ext.y0 - pad,
    y1: ext.y1 + pad,
  };
  let scaleN = 0,
    vw,
    vh;
  if (m) {
    scaleN = tpScale(padded, m);
    vw = (TP_PLAN.w * scaleN) / 1000 / m;
    vh = (TP_PLAN.h * scaleN) / 1000 / m;
  } else {
    const bw = padded.x1 - padded.x0,
      bh = padded.y1 - padded.y0,
      asp = TP_PLAN.w / TP_PLAN.h;
    vw = Math.max(bw, bh * asp);
    vh = vw / asp;
  }
  const vb = [cx - vw / 2, cy - vh / 2, vw, vh],
    plan = tapePlanSVG(sh, vb, vb[2] / 1100).replace(
      "<svg ",
      `<svg style="width:${TP_PLAN.w}mm;height:${TP_PLAN.h}mm" `,
    );

  // colour key: every tape type on this sheet
  const sw = (t) =>
    `<span class="tpsw" style="background:${tswStyle(t)}"></span>`;
  const used = sc.rows.map((r) => ({ r, t: tapeOf(r.id) }));
  const key = used
    .map(
      ({ t }) =>
        `<tr><td>${sw(t)}</td><td><b>${esc(t.n)}</b>${t.use ? `<span class="tpsub">${esc(t.use)}</span>` : ""}</td><td class="n">${esc(t.w)} mm</td><td>${esc(patName(t))}${t.ref ? `<span class="tpsub">${esc(t.ref)}</span>` : ""}</td></tr>`,
    )
    .join("");

  // order list: what to buy for tape still to lay or relay
  let corners = 0;
  for (const o of sh.kind === "daily" ? stdFor(sh).objects : sh.objects)
    if (o.kind === "item" && o.fp && !o.fpLaid && o.fpStyle !== "outline")
      corners += 4;
  const order = used
    .map(({ r, t }) => {
      const ro = sc.rolls(r),
        extra = [
          r.arrows && `${r.arrows} arrow${r.arrows > 1 ? "s" : ""}`,
          r.homes && `${r.homes} item home${r.homes > 1 ? "s" : ""}`,
        ].filter(Boolean);
      return `<tr><td>${sw(t)}${esc(t.n)}${extra.length ? `<span class="tpsub">${esc(extra.join(", "))}</span>` : ""}</td><td>${esc(t.supplier || "-")}${t.code ? `<span class="tpsub">${esc(t.code)}</span>` : ""}</td><td class="n">${F(r.planned + r.worn)}</td><td class="n">${m ? `${esc(t.roll)} m` : "-"}</td><td class="n"><b>${ro == null ? "-" : ro}</b></td></tr>`;
    })
    .join("");

  // runs: number, tape, shape, length, where it starts; as many as fit above the title block
  const shapeName = (mk) =>
      mk.closed && mk.kind === "line" ? "box" : kindName(mk),
    usedMm =
      18 + // heading
      used.length * (6.2 + 5) + // a key row and an order row per tape
      34 + // headings, totals, notes
      (corners ? 4 : 0) +
      32, // title block
    MAX_RUNS = Math.max(
      4,
      Math.floor((TP_PAGE.h - 2 * TP_PAGE.margin - usedMm) / 4.3) - 2,
    ),
    runRows = so
      .slice(0, MAX_RUNS)
      .map((r) => {
        const t = tapeOf(r.mk.type),
          v = r.verts[0];
        return `<tr><td class="n"><b>${r.no}</b></td><td class="tpnm">${sw(t)}${esc(t.n)}</td><td>${esc(shapeName(r.mk))}</td><td class="n">${r.mk.kind === "arrow" ? "-" : F(markLen(r.mk))}</td><td class="n">${esc(v.e)}, ${esc(v.s)}</td><td>${esc(STATUS_NAME[r.mk.status])}</td></tr>`;
      })
      .join("");
  const more = so.length - MAX_RUNS;

  const u = m ? "m" : "units",
    sd = T.std || {},
    title = P.projectName || "Lean Studio project";
  const html = `<div class="pd tplan">
  <div class="tpmain">
    <div class="tphead"><h1>Floor tape plan</h1><span>${esc(title)} · ${esc(sh.name)}</span></div>
    <div class="tpplan">${plan}</div>
    <div class="tpfoot">${m ? tpScaleBar(scaleN) : ""}<span>${m ? `Scale 1:${scaleN} at A3. Print at 100% (actual size) for the scale to be true; check it against the bar.` : "Not to scale: set the scale with Measure so this plan can be measured."} Numbers in circles are runs. Start points are East, South from the ${dm.datum ? "datum (the cross on the plan)" : "top left corner of the drawing"}, in ${u}.</span></div>
  </div>
  <div class="tpside">
    <h2>Colour key${sd.no ? ` <small>${esc(sd.no)}${sd.rev ? " rev " + esc(sd.rev) : ""}</small>` : ""}</h2>
    <table class="tpt">${key}</table>
    <h2>Order list</h2>
    <table class="tpt"><tr><th>Tape</th><th>Supplier, code</th><th class="n">To lay</th><th class="n">Roll</th><th class="n">Rolls</th></tr>${order}
      <tr class="tot"><td colspan="2">Total to lay${T.waste ? ` (rolls include ${esc(T.waste)}% allowance)` : ""}</td><td class="n">${F(sc.tot.planned + sc.tot.worn)}</td><td></td><td></td></tr></table>
    ${corners ? `<p class="tpnote">Item homes marked with corners: ${corners} corner pieces if you use pre-cut corners instead of tape.</p>` : ""}
    <h2>Runs</h2>
    <table class="tpt tpruns"><tr><th class="n">Run</th><th>Tape</th><th>Shape</th><th class="n">Length</th><th class="n">Start E, S</th><th>Status</th></tr>${runRows || '<tr><td colspan="6">Only item home marks on this sheet.</td></tr>'}</table>
    ${more > 0 ? `<p class="tpnote">${more} more run${more > 1 ? "s" : ""} on the setting-out sheet.</p>` : ""}
    <p class="tpnote">Every point of every run, with distances to the nearest wall or column, is on the setting-out sheet (Tape tab, Setting-out sheet). Concept plan: check access, escape routes and dimensions on site before laying.</p>
    <table class="tpblock tpbottom">
      <tr><th>Drawn</th><td>${esc(CUR ? CUR.name : "")}</td><th>Printed</th><td>${esc(fmtD(today()))}</td></tr>
      <tr><th>Sheet</th><td>${esc(sh.name)}</td><th>Dated</th><td>${esc(fmtD(sh.date))}</td></tr>
      <tr><th>Scale</th><td>${m ? `1:${scaleN} at A3` : "Not to scale"}</td><th>Rev</th><td></td></tr>
      <tr><th>Checked</th><td></td><th>Date</th><td></td></tr>
      <tr><th>Approved</th><td></td><th>Date</th><td></td></tr>
    </table>
  </div>
</div>`;
  printWithPage(html, "", `size: A3 landscape; margin: ${TP_PAGE.margin}mm`);
}

/* ----- the colour standard: every tape type as a document to review and sign ----- */
function printColourStandard() {
  const T = P.marking,
    sd = T.std || {};
  const rows = T.types
    .map((t) => {
      const tt = tapeOf(t.id);
      // hazard and keep-clear tape is striped on the diagonal
      const bg =
        tt.pattern === "stripe" && tt.c2
          ? `repeating-linear-gradient(45deg,${tt.c} 0 3mm,${tt.c2} 3mm 6mm)`
          : tswStyle(tt);
      return `<tr><td><span class="csw" style="background:${bg}"></span></td><td><b>${esc(t.name)}</b><span class="tpsub">${esc(t.use || "")}</span></td><td>${esc(patName(t))}<span class="tpsub">${esc(t.c.toUpperCase())}${t.pattern === "stripe" && t.c2 ? " / " + esc(t.c2.toUpperCase()) : ""}</span></td><td class="n">${esc(t.w)} mm</td><td>${esc(t.ref || "")}</td><td>${esc(t.supplier || "")}<span class="tpsub">${esc(t.code || "")}</span></td><td class="n">${esc(t.roll || T.roll)} m</td></tr>`;
    })
    .join("");
  const home = tapeOf(T.homeType);
  const html = `<div class="pd cstd">
  <div class="tphead"><h1>Floor marking colour standard</h1><span>${esc(P.projectName || "Lean Studio project")}</span></div>
  <table class="tpblock cshead"><tr><th>Document</th><td>${esc(sd.no || "")}</td><th>Revision</th><td>${esc(sd.rev || "")}</td><th>Owner</th><td>${esc(sd.owner || "")}</td><th>Printed</th><td>${esc(fmtD(today()))}</td></tr></table>
  <table class="tpt cst"><tr><th></th><th>Marking</th><th>Pattern, colour</th><th class="n">Width</th><th>Colour ref</th><th>Supplier, code</th><th class="n">Roll</th></tr>${rows}</table>
  <p class="tpnote">Item homes are marked with <b>${esc(home.n)}</b>. Walkways must be at least <b>${esc(T.minAisle)} m</b> wide between tape edges. On screen colours are a guide only: check them against the supplier's samples or the colour reference.</p>
  <table class="tpblock csign"><tr><th>Prepared</th><td></td><th>Signature</th><td></td><th>Date</th><td></td></tr><tr><th>Approved</th><td></td><th>Signature</th><td></td><th>Date</th><td></td></tr></table>
</div>`;
  printWithPage(html, "", "size: A4 landscape; margin: 10mm");
}
