"use strict";
/* ============ project folder: projects saved as files in a OneDrive, Teams or network folder ============ */
// The studio is a static page with no server. Each person picks a folder once (a OneDrive or Teams folder
// synced to the PC, or a network drive); every project in it is one file, <name>.leanstudio.json. The file is
// the real copy: who can open it is decided by the folder's own sharing, OneDrive keeps its version history,
// and teammates open the same file. The browser keeps a working copy for speed, offline and crash recovery.
// A project in My projects is linked to its file by the index entry (IDX.list, 32-accounts): e.file (file
// name), e.fileMod (the file's lastModified when we last read or wrote it) and e.fileKey (a hash of the
// project as it is in the file). The open project differing from e.fileKey means changes not in the file
// yet; opening a project without changing it writes nothing, so it never looks like a change to others.
// Nothing is overwritten silently: a file changed by someone else is loaded only when there are no local
// changes; otherwise the person chooses (theirs, with theirs kept as a copy; or mine, saved as a new file).
// Needs Chrome or Edge on a computer (File System Access API); elsewhere files are opened and downloaded.
// Older team files (Lean-Studio__user__project.json, 5S-Studio__...) still open as copies.

const fsaOK = () => !!window.showDirectoryPicker;
const FILE_EXT = ".leanstudio.json";
let TEAM = { handle: null }; // the project folder, kept under the old "team" key
const teamKey = () => userPrefix() + "team";
async function teamLoad() {
  try {
    const t = (await idb.get(teamKey())) || {};
    TEAM = { handle: t.handle || null };
  } catch {}
}
const teamSave = () => idb.write([[teamKey(), TEAM]]);
const fsafe = (s) =>
  String(s)
    .trim()
    .replace(/[\\/:*?"<>|_]+/g, "-")
    .slice(0, 60) || "x";
// Files were named 5S-Studio__... before the rename; both are still read.
const TEAM_FILE = /^(?:Lean-Studio|5S-Studio)__(.+?)__(.+)\.json$/;
const curEntry = () => IDX.list.find((e) => e.id === PID);
const contentKey = (text) => hashStr(text) + ":" + text.length;
// the open project has changes that are not in its file yet
const entryDirty = (e) =>
  e.id === PID && !!P && contentKey(JSON.stringify(P)) !== e.fileKey;

// may the folder be written to? ask = show the browser's prompt (needs a click)
async function folderPerm(ask) {
  const h = TEAM.handle;
  if (!h) return false;
  if (!h.queryPermission) return true;
  const o = { mode: "readwrite" };
  try {
    if ((await h.queryPermission(o)) === "granted") return true;
    return ask && (await h.requestPermission(o)) === "granted";
  } catch {
    return false;
  }
}
// project files and older team files in the folder, newest first
async function folderFiles() {
  const files = [],
    older = [];
  for await (const [name, h] of TEAM.handle.entries()) {
    if (h.kind !== "file") continue;
    const m = name.match(TEAM_FILE);
    if (!m && !name.endsWith(FILE_EXT)) continue;
    const f = await h.getFile(),
      row = { name, h, modified: f.lastModified, size: f.size };
    if (m) older.push({ ...row, user: m[1], project: m[2] });
    else files.push(row);
  }
  const byDate = (a, b) => b.modified - a.modified;
  return { files: files.sort(byDate), older: older.sort(byDate) };
}
// a file name for a project that no other file in the folder has
async function freeFileName(project) {
  // characters a file name cannot hold become a spaced dash: "Line 1: redesign" is "Line 1 - redesign"
  const base =
    String(project || "Project")
      .replace(/\s*[\\/:*?"<>|]+\s*/g, " - ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "Project";
  for (let i = 1; i < 100; i++) {
    const name = base + (i > 1 ? ` (${i})` : "") + FILE_EXT;
    try {
      await TEAM.handle.getFileHandle(name);
    } catch {
      return name;
    }
  }
  return base + " " + uid() + FILE_EXT;
}
async function writeFile(fh, text) {
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
  return (await fh.getFile()).lastModified;
}
const saveIndex = () => idb.write([[indexKey(), IDX]]);

/* ----- the open project and its file ----- */
let folderTimer = 0,
  folderRun = Promise.resolve(),
  folderHeld = ""; // why syncing is paused for the open project ("conflict", "gone"), shown in the banner
// called after every save in the browser (05-storage)
function folderAfterSave() {
  const e = curEntry();
  if (!e?.file || !TEAM.handle || folderHeld) return;
  clearTimeout(folderTimer);
  folderTimer = setTimeout(() => folderSync(), 1500);
}
// one at a time: write local changes to the file, or bring in a newer file
function folderSync(ask = false) {
  folderRun = folderRun
    .then(() => folderSyncNow(ask))
    .catch((err) => {
      console.warn(err);
      folderStatus("Could not save to the folder: " + err.message);
    });
  return folderRun;
}
async function folderSyncNow(ask) {
  const e = curEntry();
  if (!e?.file || !TEAM.handle || folderHeld) return;
  if (!(await folderPerm(ask))) return folderChip(true);
  folderChip(false);
  let fh, f;
  try {
    fh = await TEAM.handle.getFileHandle(e.file);
    f = await fh.getFile();
  } catch {
    return folderHold("gone", e);
  }
  if (f.lastModified !== e.fileMod) {
    // someone else (or this person on another computer) saved the file since we last read it
    if (!entryDirty(e)) return folderLoad(e, f);
    return folderHold("conflict", e, f);
  }
  if (!entryDirty(e)) return;
  await flushSave();
  const key = contentKey(JSON.stringify(P));
  e.fileMod = await writeFile(fh, JSON.stringify(projectBundle()));
  e.fileKey = key;
  await saveIndex();
  folderStatus();
}
// take the file's version into the open project (no local changes are waiting)
async function folderLoad(e, f, quiet = false) {
  const j = JSON.parse(await f.text());
  if (!j.project) throw Error("not a project file");
  const p = validate(j.project),
    d = imageMap(j.drawings),
    ph = imageMap(j.photos);
  await idb.write([
    [K("project", e.id), JSON.stringify(p)],
    [K("drawings", e.id), d],
    [K("photos", e.id), ph],
  ]);
  e.fileMod = f.lastModified;
  e.fileKey = contentKey(JSON.stringify(p));
  e.name = p.projectName || e.name;
  await saveIndex();
  if (e.id === PID) {
    P = p;
    D = d;
    PH = ph;
    lastSavedProject = JSON.stringify(P); // already saved: no write back to the file
    dirtyImg = false;
    undoS = [];
    redoS = [];
    ui.sel = [];
    renderAll();
  }
  if (!quiet)
    toast(
      `Updated from the folder: saved by ${j.by || "someone"} ${ago(Date.parse(j.saved) || f.lastModified)}.`,
      5000,
    );
  folderStatus();
}
// keep the open project as a separate project in My projects, not linked to any file
async function keepLocalCopy(label) {
  await flushSave();
  const id = uid(),
    name = `${P.projectName || "Project"} (${label})`,
    copy = { ...JSON.parse(JSON.stringify(P)), projectName: name };
  await idb.write([
    [K("project", id), JSON.stringify(copy)],
    [K("drawings", id), { ...D }],
    [K("photos", id), { ...PH }],
  ]);
  IDX.list.push({
    id,
    name,
    created: today(),
    updated: Date.now(),
    from: "",
  });
  await saveIndex();
  return name;
}
function folderHold(why, e, f) {
  folderHeld = why;
  const el = $("#syncWarn");
  if (!el) return;
  el.hidden = false;
  el.innerHTML =
    why === "conflict"
      ? `<span>Someone saved <b>${esc(e.file)}</b> ${esc(ago(f.lastModified))}, and you have changes that are not in the file yet.</span><button type="button" data-sync="theirs">Use theirs (keep mine as a copy)</button><button type="button" data-sync="mine">Save mine as a new file</button>`
      : `<span><b>${esc(e.file)}</b> is no longer in the project folder (renamed, moved or deleted). Your work is safe in this browser.</span><button type="button" data-sync="again">Save it to the folder again</button><button type="button" data-sync="unlink">Keep it in this browser only</button>`;
}
function folderRelease() {
  folderHeld = "";
  const el = $("#syncWarn");
  if (el) el.hidden = true;
}
$("#syncWarn").addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-sync]");
  const e = curEntry();
  if (!b || !e) return;
  try {
    if (b.dataset.sync === "theirs") {
      const kept = await keepLocalCopy("my changes " + fmtD(today()));
      const f = await (await TEAM.handle.getFileHandle(e.file)).getFile();
      folderRelease();
      await folderLoad(e, f, true);
      toast(
        `Their version is open. Yours is kept in My projects as "${kept}".`,
        7000,
      );
    } else if (b.dataset.sync === "mine" || b.dataset.sync === "again") {
      if (!(await folderPerm(true))) return void folderChip(true);
      const name =
        b.dataset.sync === "mine"
          ? await freeFileName(`${P.projectName || "Project"} (${CUR.name})`)
          : await freeFileName(P.projectName);
      await linkToNewFile(e, name);
      folderRelease();
      toast(
        b.dataset.sync === "mine"
          ? `Saved yours as ${name}. The other file keeps their version.`
          : `Saved to the folder as ${name}.`,
        7000,
      );
    } else if (b.dataset.sync === "unlink") {
      delete e.file;
      delete e.fileMod;
      delete e.fileKey;
      await saveIndex();
      folderRelease();
      folderStatus();
    }
  } catch (err) {
    toast("That did not work: " + err.message, 6000);
  }
});
// write the open project to a new file in the folder and link it
async function linkToNewFile(e, name) {
  await flushSave();
  const fh = await TEAM.handle.getFileHandle(name, { create: true });
  e.file = name;
  const key = contentKey(JSON.stringify(P));
  e.fileMod = await writeFile(fh, JSON.stringify(projectBundle()));
  e.fileKey = key;
  await saveIndex();
  folderStatus();
}
// check the open project's file: on opening, and when the person comes back to the tab
async function folderCheck() {
  const e = curEntry();
  if (!e?.file || !TEAM.handle) return folderStatus();
  await folderSync();
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && P) folderCheck();
});
// the save status in the header says where the work is
function folderStatus(problem) {
  const e = P && curEntry(),
    el = $("#saved");
  if (!el || !e?.file || !TEAM.handle) return;
  el.textContent = problem
    ? problem
    : entryDirty(e)
      ? "Saving to folder…"
      : "Saved to folder · " +
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
  el.title = problem || `${TEAM.handle.name} / ${e.file}`;
}
function folderChip(needs) {
  const el = $("#teamChip");
  if (el) el.hidden = !needs;
}
$("#teamChip").onclick = async () => {
  if (await folderPerm(true)) {
    folderChip(false);
    await folderSync();
    toast("Project folder reconnected.");
  } else toast("The folder needs your permission to save there.");
};

/* ----- opening a file from the folder ----- */
async function folderOpenFile(row) {
  const mine = IDX.list.find((x) => x.file === row.name);
  if (mine) {
    if (mine.id !== PID) await openProject(mine.id);
    await folderCheck();
    return;
  }
  let j;
  try {
    j = JSON.parse(await (await row.h.getFile()).text());
    if (!j.project) throw Error();
  } catch {
    return void toast("That file could not be read as a project.");
  }
  const p = validate(j.project);
  const id = await addProject(
    p,
    imageMap(j.drawings),
    imageMap(j.photos),
    p.projectName || row.name.replace(FILE_EXT, ""),
  );
  const e = IDX.list.find((x) => x.id === id);
  e.file = row.name;
  e.fileMod = row.modified;
  e.fileKey = contentKey(JSON.stringify(P)); // it came from the file: nothing to write back
  await saveIndex();
  folderStatus();
  if (j.by && nameKey(j.by) !== nameKey(CUR.name)) {
    const mins = (Date.now() - (Date.parse(j.saved) || row.modified)) / 60000;
    if (mins < 30)
      toast(
        `${j.by} saved this ${ago(Date.parse(j.saved) || row.modified)} and may still be working on it. If you both change it, you will be asked which to keep.`,
        8000,
      );
  }
}

/* ----- the Project folder tab of the account dialog ----- */
let folderRows = { files: [], older: [] };
async function teamTabHTML() {
  await teamLoad();
  if (!fsaOK())
    return `<p style="margin-top:0">This browser cannot save into a folder, so files are handled by hand. Use <b>Edge</b> or <b>Chrome</b> on a computer to save projects straight into your OneDrive or Teams folder.</p><div class="btns"><button id="tmDl" class="pri">Download the open project</button><button id="tmFile">Open a project file…</button></div><p class="small muted">Put downloaded files in the folder your team shares; open them from there with the second button.</p>`;
  if (!TEAM.handle)
    return `<p style="margin-top:0">Choose the folder your projects should live in: a <b>OneDrive or Teams folder</b> synced to this computer, or a network drive. Each project becomes one file there. Who can open them is set by that folder's sharing, OneDrive keeps every version, and your teammates open the same files.</p><div class="btns"><button id="tmPick" class="pri">Choose the project folder</button></div><p class="small muted">Your work stays in this browser too, so it keeps working offline; it is written to the folder a moment after each change.</p>`;
  const ok = await folderPerm(false);
  folderRows = { files: [], older: [] };
  if (ok)
    try {
      folderRows = await folderFiles();
    } catch (e) {
      console.warn(e);
    }
  const e = curEntry(),
    { files, older } = folderRows;
  return `<p style="margin-top:0">Project folder: <b>${esc(TEAM.handle.name)}</b>. The open project is ${e?.file ? `saved there as <b>${esc(e.file)}</b>` : "<b>only in this browser</b>"}.</p>
    ${ok ? "" : '<div class="status extra">The browser needs your permission again to use this folder.<button id="tmGrant">Reconnect</button></div>'}
    <div class="btns">${e?.file ? "" : '<button id="tmLink" class="pri">Save the open project to the folder</button>'}<button id="tmPick">Change folder</button><button id="tmStop" class="danger">Stop using a project folder</button></div>
    <h3>Projects in the folder</h3>
    ${files.length ? `<div class="regtbl"><table class="tbl" style="width:100%"><tr><th>File</th><th>Last saved</th><th></th></tr>${files.map((r, i) => `<tr><td><b>${esc(r.name.replace(FILE_EXT, ""))}</b>${r.name === e?.file ? ' <span class="pill done">open now</span>' : IDX.list.some((x) => x.file === r.name) ? ' <span class="pill">in my list</span>' : ""}</td><td>${esc(ago(r.modified))}</td><td>${r.name === e?.file ? "" : `<button data-open="${i}" class="pri">Open</button>`}</td></tr>`).join("")}</table></div>` : `<p class="empty">${ok ? "No project files here yet." : "Reconnect to see them."}</p>`}
    ${older.length ? `<h3>Older shared copies</h3><div class="regtbl"><table class="tbl" style="width:100%"><tr><th>Who</th><th>Project</th><th>Published</th><th></th></tr>${older.map((r, i) => `<tr><td><b>${esc(r.user)}</b></td><td>${esc(r.project)}</td><td>${esc(ago(r.modified))}</td><td><button data-older="${i}">Open as my copy</button></td></tr>`).join("")}</table></div><p class="small muted">Files from the earlier way of sharing. Opening one adds a copy to My projects; to share it the new way, open it and save it to the folder.</p>` : ""}
    <p class="small muted">Anyone who can open this folder can open these files, so choose a folder shared only with your team.</p>`;
}
function wireTeamTab(root, closeThen) {
  root.onclick = async (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    try {
      if (b.id === "tmPick") {
        // must run straight from the click: the picker needs the user gesture
        TEAM.handle = await showDirectoryPicker({
          id: "studio5s-team",
          mode: "readwrite",
        });
        await teamSave();
        folderRelease();
        root.innerHTML = await teamTabHTML();
      } else if (b.id === "tmGrant") {
        await folderPerm(true);
        root.innerHTML = await teamTabHTML();
      } else if (b.id === "tmLink") {
        if (!(await folderPerm(true)))
          return void toast("The folder needs your permission.");
        const e = curEntry(),
          name = await freeFileName(P.projectName);
        await linkToNewFile(e, name);
        toast("Saved to the folder as " + name);
        root.innerHTML = await teamTabHTML();
      } else if (b.id === "tmStop") {
        TEAM = { handle: null };
        await teamSave();
        folderChip(false);
        folderRelease();
        root.innerHTML = await teamTabHTML();
      } else if (b.dataset.open !== undefined) {
        const r = folderRows.files[+b.dataset.open];
        closeThen(() => folderOpenFile(r));
      } else if (b.dataset.older !== undefined) {
        const r = folderRows.older[+b.dataset.older];
        closeThen(() => openTeamFile(r));
      } else if (b.id === "tmDl") {
        download(
          new Blob([JSON.stringify(projectBundle())], {
            type: "application/json",
          }),
          fsafe(P.projectName || "Project") + FILE_EXT,
        );
        toast("Downloaded. Put it in the folder your team shares.");
      } else if (b.id === "tmFile") closeThen(() => $("#fTeam").click());
    } catch (err) {
      if (err.name !== "AbortError")
        toast("That did not work: " + err.message, 6000);
    }
  };
}

/* ----- older team files and files opened by hand: added as copies ----- */
async function openTeamFile(en) {
  let j;
  try {
    j = JSON.parse(await (await en.h.getFile()).text());
  } catch {
    return void toast("That file could not be read.");
  }
  await openTeammateBundle(j, en.user, en.project);
}
async function openTeammateBundle(j, user, proj) {
  let refresh = false;
  const mine = IDX.list.find(
    (x) => x.from && nameKey(x.from) === nameKey(user) && x.src === proj,
  );
  if (mine) {
    const r = await modal(
      `Open ${user}'s project`,
      `<p style="margin-top:0">You already have a copy of <b>${esc(user)}</b>'s "${esc(proj)}" (saved ${esc(ago(mine.updated))}).</p><label class="chk"><input type="radio" name="m" value="refresh" checked> Refresh my copy with their latest. Changes I made to my copy are lost.</label><label class="chk"><input type="radio" name="m" value="another"> Open it as another copy</label>`,
      "Open",
      { cls: "mid" },
    );
    if (!r) return;
    refresh = r.m === "refresh";
  }
  try {
    await importBundle(j, proj, user, proj);
  } catch {
    toast(
      "That is not a project file this studio can open. Your copy was not changed.",
    );
    return;
  }
  // the old copy goes only once the new one has opened
  if (refresh) await deleteProject(mine.id);
  toast(`Opened ${user}'s project as a copy in your list.`);
}
$("#fTeam").onchange = async () => {
  const f = $("#fTeam").files[0];
  $("#fTeam").value = "";
  if (!f) return;
  try {
    const j = JSON.parse(await f.text()),
      m = f.name.match(TEAM_FILE);
    await openTeammateBundle(
      j,
      m ? m[1] : j.by || "Teammate",
      m ? m[2] : f.name.replace(/(\.leanstudio)?\.json$/, ""),
    );
  } catch {
    toast("That file could not be opened.");
  }
};
