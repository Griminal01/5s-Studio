"use strict";
/* ============ floor marking: schedule, setting-out, standard ============ */
const tswStyle = (t) =>
  t.pattern === "stripe" && t.c2
    ? `repeating-linear-gradient(90deg,${t.c} 0 5px,${t.c2} 5px 10px)`
    : t.pattern === "dash"
      ? `repeating-linear-gradient(90deg,${t.c} 0 6px,transparent 6px 10px)`
      : t.c;
const kindName = (m) =>
  m.kind === "aisle"
    ? "aisle"
    : m.kind === "arrow"
      ? "arrow"
      : m.closed
        ? "closed shape"
        : "line";
const STATUS_NAME = { planned: "Planned", laid: "Laid", worn: "Worn" };

function markSchedule(sh) {
  const by = new Map(),
    get = (id) => {
      let r = by.get(id);
      if (!r) {
        r = {
          id,
          len: 0,
          planned: 0,
          laid: 0,
          worn: 0,
          runs: 0,
          arrows: 0,
          homes: 0,
        };
        by.set(id, r);
      }
      return r;
    };
  for (const mk of sh.marks) {
    const r = get(mk.type);
    if (mk.kind === "arrow") {
      r.arrows++;
      continue;
    }
    const L = markTape(mk);
    r.len += L;
    r[mk.status] += L;
    r.runs++;
  }
  const src = sh.kind === "daily" ? stdFor(sh).objects : sh.objects,
    hr = get(P.marking.homeType);
  for (const o of src) {
    if (o.kind !== "item" || !o.fp) continue;
    const L = homeLen(o, sh);
    hr.len += L;
    hr[o.fpLaid ? "laid" : "planned"] += L;
    hr.homes++;
  }
  const rows = [...by.values()]
    .filter((r) => r.len > 0 || r.arrows > 0)
    .sort((a, b) => b.len - a.len);
  const tot = rows.reduce(
    (a, r) => ({
      len: a.len + r.len,
      planned: a.planned + r.planned,
      laid: a.laid + r.laid,
      worn: a.worn + r.worn,
    }),
    { len: 0, planned: 0, laid: 0, worn: 0 },
  );
  const m = mpu(sh),
    rolls = (r) =>
      m
        ? Math.ceil(
            ((r.planned + r.worn) * m * (1 + P.marking.waste / 100)) /
              P.marking.roll -
              1e-9,
          )
        : null;
  return {
    rows,
    tot,
    rolls,
    done: tot.len ? Math.round(((tot.laid + tot.worn) / tot.len) * 100) : 0,
  };
}

function settingOut(sh) {
  const dm = DM(sh),
    dat = dm.datum || { x: 0, y: 0 },
    m = mpu(sh),
    f = (v) => (m ? n2(v * m) : Math.round(v * 10) / 10);
  return sh.marks.map((mk, i) => {
    const pts = dedupePts(mk.pts),
      closed = mk.closed && mk.kind !== "aisle",
      n = pts.length;
    const verts = pts.map((p, j) => ({
      n: j + 1,
      e: f(p.x - dat.x),
      s: f(p.y - dat.y),
      near: nearestStruct(sh, p),
    }));
    const segs = [];
    for (let j = 0; j < (closed ? n : n - 1); j++) {
      const a = pts[j],
        b = pts[(j + 1) % n],
        dx = b.x - a.x,
        dy = b.y - a.y;
      segs.push({
        len: Math.hypot(dx, dy),
        dir: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360,
      });
    }
    return { no: i + 1, mk, verts, segs };
  });
}

function setMarkStatus(id, val) {
  const f = find(id);
  if (!f || !f.x.pts) return;
  const x = f.x;
  checkpoint();
  x.status = val;
  x.damaged = val === "worn";
  x.laid = val === "laid" ? x.laid || today() : val === "planned" ? "" : x.laid;
  record("Tape status", "Run " + runNo(S(), x) + ": " + val);
  renderAll();
}
function markAllLaid() {
  const sh = S();
  if (sh.kind === "daily") return;
  checkpoint();
  let n = 0;
  for (const m of sh.marks)
    if (m.status === "planned") {
      m.status = "laid";
      m.laid = today();
      n++;
    }
  for (const o of sh.objects)
    if (o.kind === "item" && o.fp && !o.fpLaid) {
      o.fpLaid = true;
      n++;
    }
  record("Tape marked as laid", n + " runs and home marks");
  renderAll();
  toast(
    n
      ? `${n} planned run${n > 1 ? "s and home marks" : " or home mark"} marked as laid.`
      : "Nothing was waiting to be laid.",
  );
}
function setDatum(p) {
  checkpoint();
  DM().datum = { x: n2(p.x), y: n2(p.y) };
  record("Datum set", "");
  setTool("select");
  renderAll();
  toast("Datum set. Setting-out dimensions are measured from it.");
}

function paneMark() {
  const sh = S(),
    dm = DM(sh),
    m = mpu(sh),
    T = P.marking,
    sc = markSchedule(sh),
    iss = cmpCache || issues(sh),
    daily = sh.kind === "daily",
    F = (v) => esc(fmtLen(v, sh));
  let h = `<h2>Floor marking</h2>`;
  if (!sc.rows.length && !sh.marks.length)
    return (
      h +
      `<p class="empty">No floor marking on this sheet yet. Use the Tape tool (T) to draw walkway edges, boxes, aisles and arrows, or give items a home marking. This tab then totals the tape, tracks what has been laid and prints a setting-out sheet.</p><div class="btns"><button data-a="editMarking">Marking standard</button></div>`
    );
  h +=
    `<div class="meter"><i style="width:${sc.done}%;background:var(--ok)"></i></div>` +
    kv([
      ["Tape in this plan", F(sc.tot.len)],
      [
        "Laid on the floor",
        F(sc.tot.laid + sc.tot.worn) + " (" + sc.done + "%)",
      ],
      ["Still to lay", F(sc.tot.planned)],
      ["Worn, to relay", F(sc.tot.worn)],
    ]);
  h += `<table class="rt"><tr><th>Tape</th><th class="n">Total</th><th class="n">To lay</th><th class="n">Rolls</th></tr>${sc.rows
    .map((r) => {
      const t = tapeOf(r.id),
        ro = sc.rolls(r);
      return `<tr><td><span class="tsw" style="display:inline-block;vertical-align:middle;margin-right:6px;background:${tswStyle(t)}"></span>${esc(t.n)}${r.homes ? `<span style="display:block;font-size:11px;color:var(--muted)">${r.homes} item home mark${r.homes > 1 ? "s" : ""}</span>` : ""}${r.arrows ? `<span style="display:block;font-size:11px;color:var(--muted)">${r.arrows} arrow${r.arrows > 1 ? "s" : ""}</span>` : ""}</td><td class="n">${F(r.len)}</td><td class="n">${F(r.planned + r.worn)}</td><td class="n">${ro == null ? "?" : ro}</td></tr>`;
    })
    .join("")}</table>
    <p class="small muted" style="margin:0 0 10px">${m ? `Rolls are ${T.roll} m with ${T.waste}% allowance, for tape still to lay or relay.` : "Set the scale with Measure to get rolls to order."} Aisles count both edge lines.</p>`;
  const np = iss.aisleNarrow.length,
    bp = iss.walkBlock.length,
    cp = iss.aisleClash.length;
  if (np || bp || cp)
    h += `<div class="status bad"><b>Walkway problems.</b> ${[np && `${np} narrower than ${T.minAisle} m`, bp && `${bp} item${bp > 1 ? "s" : ""} blocking an aisle`, cp && `${cp} running into a wall or fixed object`].filter(Boolean).join(", ")}. Details are on the Check tab.</div>`;
  h += `<div class="btns"><button class="pri" data-a="printMarking">Print marking sheet</button><button data-a="csvSchedule">Schedule CSV</button><button data-a="csvSetout">Setting-out CSV</button></div>
    <div class="btns"><button data-a="editMarking">Marking standard</button><button data-a="setDatum">${dm.datum ? "Move datum" : "Set datum"}</button>${daily ? "" : '<button data-a="allLaid">Mark all as laid</button>'}</div>
    <p class="small muted">${dm.datum ? "Datum is set. Setting-out dimensions are measured from it." : "No datum set, so dimensions are measured from the top left corner of the drawing. Set one on a column or door frame that is easy to find on the floor."}${daily ? " On a daily check, set a run to Worn when tape needs relaying." : ""}</p>`;
  if (sh.marks.length)
    h += `<h3><span>Runs</span><span class="count">${sh.marks.length}</span></h3><table class="rt"><tr><th>Run</th><th>Tape</th><th class="n">Length</th><th>Status</th></tr>${sh.marks
      .map(
        (mk, i) =>
          `<tr class="click" data-sel="${esc(mk.id)}" data-go="${n2(mk.pts[0].x)},${n2(mk.pts[0].y)}"><td><b>${i + 1}</b></td><td>${esc(tapeOf(mk.type).n)}<span style="display:block;font-size:11px;color:var(--muted)">${kindName(mk)}</span></td><td class="n">${mk.kind === "arrow" ? "arrow" : F(markLen(mk))}</td><td><select data-ms="${esc(mk.id)}" aria-label="Status of run ${i + 1}" style="padding:2px 4px;font-size:12px">${Object.entries(
            STATUS_NAME,
          )
            .map(
              ([v, l]) =>
                `<option value="${esc(v)}"${mk.status === v ? " selected" : ""}>${l}</option>`,
            )
            .join("")}</select></td></tr>`,
      )
      .join("")}</table>`;
  return h;
}

/* ----- marking standard editor ----- */
function usedTypeIds() {
  const s = new Set();
  for (const sh of P.sheets) for (const m of sh.marks) s.add(m.type);
  for (const r of Object.values(P.revisions))
    for (const m of r.marks) s.add(m.type);
  return s;
}
async function markingModal() {
  let rows = clone(P.marking.types),
    homeSel = P.marking.homeType;
  const used = usedTypeIds();
  const html = `<p class="small muted" style="margin-top:0">The colours and widths your site uses for floor marking. They feed the tape tool, the schedule and the printed marking sheet. Check them against your site standard before ordering tape.</p>
    <div class="mkhead"><span>Name</span><span>Colour</span><span>Pattern</span><span>2nd</span><span>mm</span><span>Where it is used</span><span></span></div><div id="mkRows"></div>
    <div class="btns"><button type="button" id="mkAdd">Add a type</button><button type="button" id="mkReset">Reset to the default colours</button></div>
    <h3>Ordering and checks</h3><div class="row3"><label class="f">Roll length (m)<input name="roll" type="number" min="1" step="1" value="${esc(P.marking.roll)}"></label><label class="f">Waste allowance (%)<input name="waste" type="number" min="0" step="1" value="${esc(P.marking.waste)}"></label><label class="f">Minimum aisle width (m)<input name="minAisle" type="number" min="0.3" step="0.1" value="${esc(P.marking.minAisle)}"></label></div>
    <label class="f">Tape used for item home marks<select name="homeType" id="mkHome"></select></label>`;
  const r = await modal("Floor marking standard", html, "Save standard", {
    wide: true,
    onOpen: (d) => {
      const wrap = $("#mkRows");
      const read = () => {
        rows = [...wrap.querySelectorAll(".mkrow")].map((el) => {
          const g = (k) => el.querySelector(`[data-k=${k}]`),
            pat = g("p").value;
          return {
            id: el.dataset.id,
            name: g("name").value.trim() || el.dataset.id,
            c: g("c").value,
            c2: pat === "stripe" ? g("c2").value : "",
            pattern: pat,
            w: Math.max(5, Number(g("w").value) || 50),
            use: g("u").value.trim(),
          };
        });
        const hs = $("#mkHome");
        if (hs && hs.value) homeSel = hs.value;
      };
      const render = () => {
        wrap.innerHTML = rows
          .map(
            (t, i) =>
              `<div class="mkrow" data-id="${esc(t.id)}"><input data-k="name" value="${esc(t.name)}" aria-label="Name" required><input data-k="c" type="color" value="${esc(t.c)}" aria-label="Colour"><select data-k="p" aria-label="Pattern">${[
                ["solid", "Solid"],
                ["stripe", "Striped"],
                ["dash", "Dashed"],
              ]
                .map(
                  ([v, l]) =>
                    `<option value="${esc(v)}"${t.pattern === v ? " selected" : ""}>${l}</option>`,
                )
                .join(
                  "",
                )}</select><input data-k="c2" type="color" value="${t.c2 || "#1C1C1C"}"${t.pattern === "stripe" ? "" : " disabled"} aria-label="Second colour" title="Second colour, used for striped tape"><input data-k="w" type="number" min="5" step="5" value="${esc(t.w)}" aria-label="Width in millimetres"><input data-k="u" value="${esc(t.use)}" aria-label="Where it is used" placeholder="Where it is used"><button type="button" data-rm="${esc(i)}"${used.has(t.id) || rows.length < 2 ? ` disabled title="${rows.length < 2 ? "Keep at least one type" : "In use on a sheet"}"` : ""}>Remove</button></div>`,
          )
          .join("");
        refreshHome();
      };
      const refreshHome = () => {
        if (!rows.some((t) => t.id === homeSel)) homeSel = rows[0].id;
        $("#mkHome").innerHTML = rows
          .map(
            (t) =>
              `<option value="${esc(t.id)}"${t.id === homeSel ? " selected" : ""}>${esc(t.name)}</option>`,
          )
          .join("");
      };
      render();
      wrap.addEventListener("input", read);
      wrap.addEventListener("change", (e) => {
        read();
        if (e.target.dataset.k === "p") {
          const c2 = e.target.closest(".mkrow").querySelector("[data-k=c2]");
          c2.disabled = e.target.value !== "stripe";
        }
        refreshHome();
      });
      wrap.addEventListener("click", (e) => {
        const b = e.target.closest("[data-rm]");
        if (b && !b.disabled) {
          read();
          rows.splice(+b.dataset.rm, 1);
          render();
        }
      });
      $("#mkHome").addEventListener("change", read);
      $("#mkAdd").onclick = () => {
        read();
        rows.push({
          id: "t" + uid().slice(-6),
          name: "New tape",
          c: "#6B3FA0",
          c2: "",
          pattern: "solid",
          w: 50,
          use: "",
        });
        render();
        wrap.querySelector(".mkrow:last-child [data-k=name]").select();
      };
      $("#mkReset").onclick = () => {
        read();
        const keep = rows.filter(
          (t) => !DEFAULT_TYPES.some((x) => x.id === t.id) && used.has(t.id),
        );
        rows = [...clone(DEFAULT_TYPES), ...keep];
        render();
      };
    },
  });
  if (!r) return;
  if (!rows.length) rows = clone(DEFAULT_TYPES);
  checkpoint();
  P.marking = {
    types: rows,
    roll: Math.max(1, Number(r.roll) || 33),
    waste: Math.max(0, Number(r.waste) || 0),
    minAisle: Math.max(0.3, Number(r.minAisle) || 1.2),
    homeType: rows.some((t) => t.id === r.homeType) ? r.homeType : rows[0].id,
  };
  record("Marking standard changed", rows.length + " tape types");
  renderAll();
  toast("Marking standard saved.");
}

/* ----- exports ----- */
function csvSchedule() {
  const sh = S(),
    sc = markSchedule(sh),
    m = mpu(sh),
    M = (u) => (m ? n2(u * m) : Math.round(u));
  csv(
    [
      [
        "Sheet",
        "Tape",
        "Width mm",
        "Pattern",
        "Runs",
        "Arrows",
        "Item home marks",
        "Total m",
        "Planned m",
        "Laid m",
        "Worn m",
        "Rolls to order",
      ],
      ...sc.rows.map((r) => {
        const t = tapeOf(r.id);
        return [
          sh.name,
          t.n,
          t.w,
          t.pattern,
          r.runs,
          r.arrows,
          r.homes,
          M(r.len),
          M(r.planned),
          M(r.laid),
          M(r.worn),
          sc.rolls(r) ?? "",
        ];
      }),
    ],
    `LeanStudio_tape_schedule_${fileSafe(sh.name)}.csv`,
  );
}
function csvSetout() {
  const sh = S(),
    m = mpu(sh),
    rows = [
      [
        "Run",
        "Tape",
        "Shape",
        "Status",
        "Point",
        "East from datum",
        "South from datum",
        "Next segment length",
        "Direction (degrees clockwise from drawing up)",
        "Nearest wall or fixed object",
        "Distance to it",
        "Unit",
      ],
    ];
  for (const r of settingOut(sh))
    r.verts.forEach((v, j) => {
      const sg = r.segs[j];
      rows.push([
        r.no,
        tapeOf(r.mk.type).n,
        kindName(r.mk) +
          (r.mk.kind === "aisle"
            ? ", " + (m ? n2(r.mk.width * m) + " m wide" : "")
            : ""),
        STATUS_NAME[r.mk.status],
        v.n,
        v.e,
        v.s,
        sg ? (m ? n2(sg.len * m) : Math.round(sg.len * 10) / 10) : "",
        sg ? Math.round(sg.dir) : "",
        v.near ? v.near.label : "",
        v.near ? (m ? n2(v.near.d * m) : Math.round(v.near.d * 10) / 10) : "",
        m ? "m" : "drawing units",
      ]);
    });
  csv(rows, `LeanStudio_setting_out_${fileSafe(sh.name)}.csv`);
}

/* ----- printable marking sheet ----- */
function printMarkingSheet() {
  const sh = S();
  if (
    !sh.marks.length &&
    !(sh.kind === "daily" ? stdFor(sh).objects : sh.objects).some((o) => o.fp)
  ) {
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
  const save = { ...ui.layers };
  Object.assign(ui.layers, {
    objects: false,
    routes: false,
    pins: false,
    docs: false,
    overlay: false,
    marks: true,
    fixed: true,
    dims: false,
    runs: false,
    drawing: true,
  });
  const xs = [],
    ys = [],
    add = (x, y) => {
      xs.push(x);
      ys.push(y);
    };
  for (const mk of sh.marks) {
    const e = mk.kind === "aisle" ? mk.width / 2 : 0;
    for (const q of mk.pts) {
      add(q.x - e, q.y - e);
      add(q.x + e, q.y + e);
    }
  }
  for (const o of sh.kind === "daily" ? stdFor(sh).objects : sh.objects)
    if (o.kind === "item" && o.fp) {
      add(o.x - o.w / 2, o.y - o.h / 2);
      add(o.x + o.w / 2, o.y + o.h / 2);
    }
  let vb = [0, 0, dm.w, dm.h];
  if (xs.length) {
    let x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      y0 = Math.min(...ys),
      y1 = Math.max(...ys);
    const pad = Math.max(x1 - x0, y1 - y0) * 0.12 + (m ? 3 / m : 25),
      asp = 1.75;
    x0 -= pad;
    x1 += pad;
    y0 -= pad;
    y1 += pad;
    let bw = Math.max(x1 - x0, m ? 20 / m : 150),
      bh = y1 - y0;
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    if (bw / bh < asp) bw = bh * asp;
    else bh = bw / asp;
    vb = [cx - bw / 2, cy - bh / 2, bw, bh];
  }
  let plan;
  try {
    plan = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map((v) => Math.round(v * 100) / 100).join(" ")}">${buildSVG(sh, { k: vb[2] / 1500, cmp: null, export: true, runNos: true })}</svg>`;
  } finally {
    Object.assign(ui.layers, save);
  }
  const sw = (t) =>
      `<span class="sw" style="background:${tswStyle(t)}"></span>`,
    u = m ? "m" : "u";
  const html = `<div class="pd"><h1>Floor marking sheet</h1>
    <p class="pdm">${esc(sh.name)}, ${esc(fmtDate(sh.date))}. ${m ? "Scale set, lengths in metres." : "No scale set, so lengths are in drawing units."} Dimensions are measured from the ${dm.datum ? "datum marked on the plan" : "top left corner of the drawing"}. The plan is zoomed to the marked area.</p>
    <div class="pdplan">${plan}</div><div class="pdbreak"></div>
    <h2>Tape schedule</h2><table><tr><th>Tape</th><th>Pattern</th><th class="n">Width</th><th class="n">Runs</th><th class="n">Total</th><th class="n">To lay</th><th class="n">Rolls to order</th></tr>
    ${sc.rows
      .map((r) => {
        const t = tapeOf(r.id),
          ro = sc.rolls(r);
        return `<tr><td>${sw(t)}${esc(t.n)}${r.homes ? ` (incl. ${r.homes} item home marks)` : ""}${r.arrows ? `, ${r.arrows} arrow${r.arrows > 1 ? "s" : ""}` : ""}</td><td>${t.pattern === "stripe" ? "Striped" : t.pattern === "dash" ? "Dashed" : "Solid"}</td><td class="n">${t.w} mm</td><td class="n">${r.runs}</td><td class="n">${F(r.len)}</td><td class="n">${F(r.planned + r.worn)}</td><td class="n">${ro == null ? "" : ro}</td></tr>`;
      })
      .join("")}
    <tr><th colspan="4">Total</th><th class="n">${F(sc.tot.len)}</th><th class="n">${F(sc.tot.planned + sc.tot.worn)}</th><th></th></tr></table>
    <p class="pdm">${m ? `Rolls are ${T.roll} m with a ${T.waste}% allowance, for tape still to lay or relay. Aisles count both edge lines.` : "Set the scale to calculate rolls."}</p>
    <h2>Setting out</h2><p class="pdm">East is to the right on the plan and South is down. Direction is in degrees clockwise from the top of the plan. Run numbers match the circles on the plan.</p>
    ${
      so
        .map((r) => {
          const t = tapeOf(r.mk.type);
          return `<div class="run"><h3>${sw(t)}Run ${r.no}: ${esc(t.n)}, ${kindName(r.mk)}${r.mk.kind === "aisle" ? `, ${esc(fmtLen(r.mk.width, sh))} edge to edge` : ""}, ${STATUS_NAME[r.mk.status].toLowerCase()}${r.mk.note ? `. ${esc(r.mk.note)}` : ""}</h3>
<table><tr><th>Point</th><th class="n">East (${u})</th><th class="n">South (${u})</th><th class="n">To next point</th><th class="n">Direction</th><th>Nearest wall or fixed object</th></tr>
${r.verts
  .map((v, j) => {
    const sg = r.segs[j];
    return `<tr><td>${v.n}</td><td class="n">${v.e}</td><td class="n">${v.s}</td><td class="n">${sg ? F(sg.len) : ""}</td><td class="n">${sg ? Math.round(sg.dir) + "°" : ""}</td><td>${v.near ? `${esc(v.near.label)}, ${F(v.near.d)}` : ""}</td></tr>`;
  })
  .join("")}</table></div>`;
        })
        .join("") ||
      '<p class="pdm">No tape runs on this sheet, only item home marks.</p>'
    }
    <p class="pdm">Concept plan. Verify dimensions, access and escape routes on site before laying tape.</p></div>`;
  printWithPage(html, "", "");
}
