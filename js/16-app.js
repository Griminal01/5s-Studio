"use strict";
/* ============ render all & start ============ */
function renderAll() {
  applyMarking();
  updateProjectIdentity();
  const ref = cmpSheet();
  cmpCache = ref ? compare(S(), ref) : null;
  $("#logo").hidden = !P.logo;
  if (P.logo) $("#logo").src = P.logo;
  renderDays();
  renderSheetBar();
  renderSide();
  updateEditBan();
  $("#bUndo").disabled = !undoS.length;
  $("#bRedo").disabled = !redoS.length;
  updateNavBadges();
  if (ui.view === "tags" || ui.view === "actions") renderRegister();
  else if (ui.view === "tracking") renderTracking();
  else if (ui.view === "boards") renderBoards();
  else if (ui.view === "smed") renderSmed();
  else if (ui.view === "documents") renderDocuments();
  else if (ui.view === "problems") renderProblems();
  else draw();
  updateBackupChip();
  save();
}
// A short hash names a preserved copy, so the same unreadable data is kept once.
const hashStr = (t) => {
  let h = 7;
  for (let i = 0; i < t.length; i++)
    h = (Math.imul(h, 31) + t.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
// Keep a copy of anything that could not be read before a blank project can overwrite it.
async function preserveUnreadable(items) {
  if (!items.length) return null;
  let drawings = null,
    photos = null;
  if (idb.db)
    try {
      drawings = (await idb.get(K("drawings"))) ?? null;
      photos = (await idb.get(K("photos"))) ?? null;
    } catch {}
  const bundle = {
    app: "5s-studio",
    note: "Copy of a saved project this studio could not read. The raw project text is in items[].raw.",
    saved: new Date().toISOString(),
    items,
    drawings,
    photos,
  };
  if (idb.db)
    try {
      await idb.write([
        [
          userPrefix() +
            "unreadable-" +
            hashStr(items.map((i) => i.raw).join("\n")),
          bundle,
        ],
      ]);
    } catch {}
  return bundle;
}
// Autosave stays paused until the person chooses; Esc cannot skip the choice.
async function resolveHeld(bundle, why) {
  $("#saved").textContent = "Autosave paused";
  let got = false;
  for (;;) {
    const body = bundle
      ? `<p style="margin-top:0">The project saved in this browser could not be read, so it has <b>not</b> been changed or overwritten. A copy is kept in the browser, and you can download it now.</p><p class="small muted">Reason: ${esc(bundle.items.map((i) => i.source + ": " + i.error).join("; "))}</p><p>If you have a backup file, choose <b>Start fresh</b>, then use <b>Open</b>. Autosave stays paused until you choose.${got ? " <b>Copy downloaded.</b>" : ""}</p>`
      : `<p style="margin-top:0">Browser storage could not be read just now (${esc(why)}), so a saved project may exist that is not showing. Nothing has been overwritten.</p><p><b>Reload</b> is the safe choice. <b>Start fresh</b> opens a blank studio and may replace what is stored.</p>`;
    const r = await modal(
      bundle
        ? "Saved project could not be opened"
        : "Browser storage not available",
      body,
      bundle ? (got ? "Download again" : "Download copy") : "Reload",
      { cancel: "Start fresh" },
    );
    if (r) {
      if (!bundle) return location.reload();
      download(
        new Blob([JSON.stringify(bundle)], { type: "application/json" }),
        `5S_unreadable_${today()}.json`,
      );
      got = true;
    } else if ($("#dlg").returnValue === "cancel") break;
  }
  holdSave = false;
  save();
}
async function init() {
  let storageDown = "";
  try {
    await idb.open();
  } catch (e) {
    idb.db = null;
    storageDown = (e && e.message) || "storage is unavailable";
  }
  await authGate(); // sign in (or create the first account)
  $("#userBtn").textContent = CUR.name;
  if (idb.db) {
    await loadIndex();
    await teamLoad();
  } else {
    PID = "main";
    IDX = {
      active: PID,
      list: [
        {
          id: PID,
          name: "Project",
          created: today(),
          updated: Date.now(),
          from: "",
        },
      ],
    };
  }
  const unreadable = [],
    keepRaw = (source, raw, e) => {
      if (
        typeof raw === "string" &&
        raw &&
        !unreadable.some((u) => u.raw === raw)
      )
        unreadable.push({
          source,
          error: String((e && e.message) || e),
          raw,
        });
    };
  let loaded = false,
    readFailed = "",
    rawLS = null;
  try {
    rawLS = localStorage.getItem(recoveryKey());
  } catch {}
  // A fallback produced after a failed database write is the latest work.
  try {
    const recovery = JSON.parse(rawLS || "null");
    if (recovery?.recovery && recovery.project) {
      P = validate(recovery.project);
      D = imageMap(recovery.drawings);
      PH = imageMap(recovery.photos);
      loaded = true;
    }
  } catch (e) {
    keepRaw("browser recovery copy", rawLS, e);
  }
  if (idb.db && !loaded) {
    let p;
    try {
      p = await idb.get(K("project"));
      if (p) {
        P = validate(JSON.parse(p));
        D = imageMap(await idb.get(K("drawings")));
        PH = imageMap(await idb.get(K("photos")));
        loaded = true;
      }
    } catch (e) {
      console.warn(e);
      if (p) keepRaw("saved project", p, e);
      else readFailed = (e && e.message) || "read error";
    }
  }
  // Never start a blank project over something that exists but could not be read.
  const held = !loaded && !!(unreadable.length || readFailed || storageDown);
  let bundle = null;
  if (held) {
    holdSave = true;
    bundle = await preserveUnreadable(unreadable);
  }
  if (!loaded) newProject();
  dirtyImg = true;
  renderLib();
  renderFixLib();
  renderTools();
  setTool("select");
  renderAll();
  if (!applyHash()) syncHash(false);
  if (held) await resolveHeld(bundle, readFailed || storageDown);
}
