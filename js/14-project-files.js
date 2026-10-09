"use strict";
/* ============ project files ============ */
/* everything in the open project as one file (also what is published to a team folder) */
function projectBundle() {
  const ph = {};
  for (const s of P.sheets)
    for (const p of s.photos) if (PH[p.id]) ph[p.id] = PH[p.id];
  for (const t of P.tags)
    for (const p of t.photos) if (PH[p.id]) ph[p.id] = PH[p.id];
  for (const t of P.problems)
    for (const p of t.photos) if (PH[p.id]) ph[p.id] = PH[p.id];
  const dr = {};
  for (const id in P.drawings) if (D[id]) dr[id] = D[id];
  return {
    app: "5s-studio",
    version: 11,
    saved: new Date().toISOString(),
    by: CUR ? CUR.name : "",
    project: P,
    drawings: dr,
    photos: ph,
  };
}
function saveProject() {
  P.lastBackupDownload = new Date().toISOString();
  updateBackupChip();
  download(
    new Blob([JSON.stringify(projectBundle())], { type: "application/json" }),
    `LeanStudio_project_${fileSafe(P.projectName || "project")}_${today()}.json`,
  );
  save();
  updateProjectIdentity();
  toast("Backup download started. Keep the JSON file somewhere backed up.");
}
$("#bSave").onclick = saveProject;
// Amber nudge when work exists but no backup file has been downloaded for a week.
const BACKUP_DAYS = 7;
function updateBackupChip() {
  const el = $("#bkChip");
  if (!el || !P) return;
  const last = Date.parse(P.lastBackupDownload || ""),
    hasLast = Number.isFinite(last),
    days = hasLast ? Math.floor((Date.now() - last) / 864e5) : 0,
    stale = hasLast ? days >= BACKUP_DAYS : (P.journal || []).length > 0;
  el.hidden = !stale;
  if (stale)
    el.textContent = hasLast
      ? `Last backup ${days} days ago`
      : "No backup file yet";
}
$("#bkChip").onclick = saveProject;
setInterval(updateBackupChip, 36e5);
$("#bOpen").onclick = () => $("#fProject").click();
$("#fProject").onchange = async () => {
  const f = $("#fProject").files[0];
  $("#fProject").value = "";
  if (!f) return;
  try {
    // a file becomes a new project in your list: nothing you have is replaced
    await importBundle(
      JSON.parse(await f.text()),
      f.name.replace(/\.json$/, ""),
    );
    toast("Opened as a new project. Your other projects are untouched.");
  } catch (e) {
    toast(
      "That file could not be opened. Choose a project file saved from this studio or the original single-file version.",
    );
  }
};
$("#fImage").onchange = () => {
  const f = $("#fImage").files[0];
  $("#fImage").value = "";
  if (!f) return;
  const rd = new FileReader();
  rd.onload = async () => {
    try {
      const img = await loadImg(rd.result),
        sh = S(),
        did = sh.drawing,
        n = P.sheets.filter((s) => s.drawing === did).length;
      const r = await modal(
        D[did] ? "Replace the drawing?" : "Add a drawing image?",
        `<p style="margin-top:0">This replaces the drawing on <b>${n} sheet${n > 1 ? "s" : ""}</b>. Items, walls and fixed objects stay where they are in drawing units, so check them against the new drawing. The scale is cleared; set it again with Measure.</p>`,
        D[did] ? "Replace" : "Add",
      );
      if (!r) return;
      checkpoint();
      D[did] = rd.result;
      Object.assign(P.drawings[did], {
        w: 1000,
        h: (1000 * img.height) / img.width,
        mpu: null,
      });
      dirtyImg = true;
      ui.vb = null;
      record("Drawing replaced", f.name);
      renderAll();
    } catch {
      toast("That image could not be read.");
    }
  };
  rd.readAsDataURL(f);
};

/* ============ photos & logo ============ */
function shrink(file, max = 1280, type = "image/jpeg", q = 0.72) {
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const img = await loadImg(rd.result),
          s = Math.min(1, max / Math.max(img.width, img.height)),
          c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        const x = c.getContext("2d");
        x.fillStyle = "#fff";
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL(type, q));
      } catch (e) {
        rej(e);
      }
    };
    rd.onerror = rej;
    rd.readAsDataURL(file);
  });
}
$("#fPhoto").onchange = async () => {
  const fs = [...$("#fPhoto").files];
  $("#fPhoto").value = "";
  if (!fs.length) return;
  const sh = S();
  checkpoint();
  let n = 0;
  for (const f of fs) {
    try {
      const id = uid();
      PH[id] = await shrink(f);
      sh.photos.push({ id, cap: "" });
      n++;
    } catch {}
  }
  dirtyImg = true;
  record("Photos added", String(n));
  renderAll();
};
async function viewPhoto(id) {
  const sh = S(),
    p = sh.photos.find((x) => x.id === id);
  if (!p) return;
  const r = await modal(
    p.cap || "Photo",
    `<img class="big" src="${esc(PH[id])}" alt=""><label class="f">Caption<input name="cap" value="${esc(p.cap)}" placeholder="What does this show?"></label><button type="button" class="danger" id="phDel">Delete photo</button>`,
    "Save caption",
    {
      wide: true,
      onOpen: (d) => {
        $("#phDel").onclick = () => {
          checkpoint();
          sh.photos = sh.photos.filter((x) => x.id !== id);
          record("Photo deleted", "");
          d.close("cancel");
          renderAll();
        };
      },
    },
  );
  if (r) {
    checkpoint();
    p.cap = r.cap;
    renderAll();
  }
}
$("#fLogo").onchange = async () => {
  const f = $("#fLogo").files[0];
  $("#fLogo").value = "";
  if (!f) return;
  try {
    checkpoint();
    P.logo = await shrink(f, 240, "image/png");
    renderAll();
    toast("Logo added.");
  } catch {
    toast("That image could not be read.");
  }
};
