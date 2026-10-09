"use strict";
/* ============ exports ============ */
function csvDeviations() {
  const c = cmpCache,
    sh = S();
  if (!c) {
    toast("Choose a sheet to compare with first.");
    return;
  }
  const rows = [["Sheet", "Date", "Compared with", "Issue", "Item", "Detail"]];
  for (const m of c.moved)
    rows.push([
      sh.name,
      sh.date,
      c.ref.name,
      "Out of place",
      m.o.label,
      fmtLen(m.d) +
        (m.da > P.settings.rotTol ? ", turned " + Math.round(m.da) + "°" : ""),
    ]);
  for (const r of c.missing)
    rows.push([sh.name, sh.date, c.ref.name, "Missing", r.label, ""]);
  for (const o of c.extra)
    rows.push([sh.name, sh.date, c.ref.name, "Not in standard", o.label, ""]);
  for (const b of c.blocked)
    rows.push([
      sh.name,
      sh.date,
      c.ref.name,
      "Blocking keep-clear",
      b.o.label,
      b.z.label,
    ]);
  for (const m of c.damaged)
    rows.push([
      sh.name,
      sh.date,
      c.ref.name,
      "Tape damaged",
      tapeOf(m.type).n,
      fmtLen(markLen(m)),
    ]);
  for (const m of c.tapeMissing)
    rows.push([
      sh.name,
      sh.date,
      c.ref.name,
      "Tape missing",
      tapeOf(m.type).n,
      fmtLen(markLen(m)),
    ]);
  csv(rows, `5S_deviations_${fileSafe(sh.name)}.csv`);
}
function csvRoutes() {
  const sh = S();
  csv(
    [
      ["Sheet", "Route", "Who", "One trip", "Trips", "Per", "Per shift"],
      ...sh.routes.map((r) => [
        sh.name,
        r.name,
        r.who === "walk" ? "Walking" : "Vehicle",
        fmtLen(polyLen(r.pts)),
        r.trips,
        r.per,
        fmtLen(polyLen(r.pts) * perShift(r)),
      ]),
    ],
    `5S_routes_${fileSafe(sh.name)}.csv`,
  );
}
const loadImg = (src) =>
  new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
async function exportPNG() {
  try {
    const sh = S(),
      dm = DM(sh),
      W = 2400,
      H = Math.round((W * dm.h) / dm.w),
      k = (dm.w / W) * 1.5,
      ref = cmpSheet(),
      c = ref ? compare(sh, ref) : null,
      head = 118;
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${dm.w} ${dm.h}">${buildSVG(sh, { k, cmp: c, export: true, noBg: true })}</svg>`;
    const [bg, ov] = await Promise.all([
      D[sh.drawing] ? loadImg(D[sh.drawing]) : Promise.resolve(null),
      loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr)),
    ]);
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H + head + 40;
    const x = cv.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, W, cv.height);
    x.fillStyle = "#202C86";
    x.fillRect(0, 0, W, head - 12);
    for (let i = -20; i < W + 20; i += 24) {
      x.fillStyle = "#FEC20F";
      x.beginPath();
      x.moveTo(i, head - 12);
      x.lineTo(i + 12, head - 12);
      x.lineTo(i + 24, head);
      x.lineTo(i + 12, head);
      x.fill();
    }
    x.fillStyle = "#fff";
    x.font = '600 38px Bahnschrift, "Segoe UI", sans-serif';
    x.fillText(`5S Studio  |  ${sh.name}`, 32, 52);
    x.font = '22px "Segoe UI", sans-serif';
    x.globalAlpha = 0.85;
    x.fillText(
      [
        fmtDate(sh.date),
        {
          standard: "Standard layout",
          proposal: "Proposal",
          daily: "Daily check",
        }[sh.kind],
        sh.checker && "Checked by " + sh.checker,
        c && c.score != null && `${c.score}% in place against ${c.ref.name}`,
      ]
        .filter(Boolean)
        .join("   |   "),
      32,
      88,
    );
    x.globalAlpha = 1;
    if (c) {
      let lx = W - 32;
      x.font = '20px "Segoe UI", sans-serif';
      x.textAlign = "right";
      for (const [t, col] of [
        ["Not in standard", COL.extra],
        ["Missing", COL.bad],
        ["Out of place", COL.warn],
        ["In place", COL.ok],
      ]) {
        x.fillStyle = "#fff";
        x.fillText(t, lx, 72);
        lx -= x.measureText(t).width + 12;
        x.fillStyle = col;
        x.fillRect(lx - 18, 58, 18, 18);
        lx -= 44;
      }
      x.textAlign = "left";
    }
    if (ui.layers.drawing && bg) {
      x.globalAlpha = ui.layers.fade ? 0.35 : 1;
      x.drawImage(bg, 0, head, W, H);
      x.globalAlpha = 1;
    }
    x.drawImage(ov, 0, head, W, H);
    x.font = '16px "Segoe UI", sans-serif';
    x.fillStyle = "#5E6584";
    x.fillText(
      "Concept layout. Verify dimensions, access, escape routes, guarding, hygiene and services on site before changing anything.",
      24,
      cv.height - 13,
    );
    cv.toBlob((b) => download(b, `5S_${fileSafe(sh.name)}.png`), "image/png");
  } catch (e) {
    console.error(e);
    toast("Image export failed. Try Print instead.");
  }
}
$("#bPng").onclick = exportPNG;
$("#bPrint").onclick = () => {
  document.body.classList.remove("printing-doc");
  $("#printDoc").className = "";
  $("#pageStyle")?.remove();
  if (ui.view !== "layout") setView("layout");
  ui.printing = true;
  drawNow();
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      if (ui.printing) {
        ui.printing = false;
        draw();
      }
    }, 400);
  }, 60);
};
