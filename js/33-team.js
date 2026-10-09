"use strict";
/* ============ team: share projects through a folder everyone can reach ============ */
// The studio is a static web page, so there is no server to hold shared data.
// Instead each person points the studio at a folder their team shares (a
// OneDrive or Teams folder synced to the PC, or a network drive). The studio
// writes your open project there as a file, and lists the files your teammates
// have put there; opening one adds it to your own project list as a copy, so
// you never overwrite their work and they never overwrite yours. Needs a
// browser that can write to folders (Chrome or Edge). Anyone else can use the
// same files by hand with the download and open buttons.
// The files are plain project files: anyone who can open the folder can read them.

const fsaOK = () => !!window.showDirectoryPicker;
let TEAM = { handle: null, auto: false, last: 0 };
const teamKey = () => userPrefix() + "team";
async function teamLoad() {
  try {
    TEAM = {
      handle: null,
      auto: false,
      last: 0,
      ...((await idb.get(teamKey())) || {}),
    };
  } catch {}
}
const teamSave = () => idb.write([[teamKey(), TEAM]]);
const fsafe = (s) =>
  String(s)
    .trim()
    .replace(/[\\/:*?"<>|_]+/g, "-")
    .slice(0, 60) || "x";
const teamFileName = (user, proj) =>
  `5S-Studio__${fsafe(user)}__${fsafe(proj)}.json`;
const myFileName = () => teamFileName(CUR.name, P.projectName || "project");

async function teamPerm(write, ask) {
  const h = TEAM.handle;
  if (!h) return false;
  const o = { mode: write ? "readwrite" : "read" };
  try {
    if ((await h.queryPermission(o)) === "granted") return true;
    return ask && (await h.requestPermission(o)) === "granted";
  } catch {
    return false;
  }
}
async function teamPublish(ask = true) {
  if (!TEAM.handle || !(await teamPerm(true, ask))) return false;
  await flushSave();
  const fh = await TEAM.handle.getFileHandle(myFileName(), { create: true }),
    w = await fh.createWritable();
  await w.write(JSON.stringify(projectBundle()));
  await w.close();
  TEAM.last = Date.now();
  TEAM.lastName = myFileName();
  await teamSave();
  teamChip(false);
  return true;
}
/* keep the team copy fresh: shortly after you stop editing, publish quietly */
let teamTimer = 0;
function teamAfterSave() {
  if (!TEAM.auto || !TEAM.handle) return;
  clearTimeout(teamTimer);
  teamTimer = setTimeout(async () => {
    try {
      if (await teamPerm(true, false)) await teamPublish(false);
      else teamChip(true);
    } catch (e) {
      console.warn(e);
    }
  }, 20000);
}
function teamChip(needs) {
  const el = $("#teamChip");
  if (el) el.hidden = !needs;
}
$("#teamChip").onclick = async () => {
  try {
    if (await teamPublish(true))
      toast("Team folder reconnected and your project published.");
  } catch (e) {
    toast("The team folder could not be written to: " + e.message);
  }
};
async function teamList() {
  const out = [];
  for await (const [name, h] of TEAM.handle.entries()) {
    if (h.kind !== "file") continue;
    const m = name.match(/^5S-Studio__(.+?)__(.+)\.json$/);
    if (!m || nameKey(m[1]) === nameKey(CUR.name)) continue;
    const f = await h.getFile();
    out.push({ name, user: m[1], project: m[2], modified: f.lastModified, h });
  }
  return out.sort((a, b) => b.modified - a.modified);
}
let teamEntries = [];
async function teamTabHTML() {
  await teamLoad();
  if (!fsaOK())
    return `<p style="margin-top:0">This browser cannot write to a shared folder, so the team features work by hand. Use <b>Chrome</b> or <b>Edge</b> for the automatic version.</p><div class="btns"><button id="tmDl" class="pri">Download my project for the shared folder</button><button id="tmFile">Open a teammate's file…</button></div><p class="small muted">Put the downloaded file in the folder your team shares. A teammate opens it with the second button and gets their own copy.</p>`;
  if (!TEAM.handle)
    return `<p style="margin-top:0">Pick the folder your team shares: a OneDrive or Teams folder synced to this PC, or a network drive. Your open project is written there as a file, and the projects your teammates put there appear here, ready to open as your own copy.</p><div class="btns"><button id="tmPick" class="pri">Choose the shared folder</button></div><p class="small muted">The files are ordinary project files. Anyone who can open the folder can read them, so choose a folder only your team can reach.</p>`;
  const ok = await teamPerm(false, false);
  let list = [];
  if (ok)
    try {
      list = await teamList();
    } catch (e) {
      console.warn(e);
    }
  teamEntries = list;
  return `<p style="margin-top:0">Shared folder: <b>${esc(TEAM.handle.name)}</b>${TEAM.last ? `. Last published ${esc(ago(TEAM.last))}.` : ""}</p>
    ${ok ? "" : '<div class="status extra">The browser needs your permission again to use this folder.<button id="tmGrant">Reconnect</button></div>'}
    <div class="btns"><button id="tmPub" class="pri">Publish my open project now</button><button id="tmPick">Change folder</button><button id="tmStop" class="danger">Stop using a team folder</button></div>
    <label class="chk"><input type="checkbox" id="tmAuto"${TEAM.auto ? " checked" : ""}>Keep my team copy up to date automatically while I work</label>
    <h3>Your teammates' projects</h3>
    ${list.length ? `<div class="regtbl"><table class="tbl" style="width:100%"><tr><th>Who</th><th>Project</th><th>Published</th><th></th></tr>${list.map((e, i) => `<tr data-i="${i}"><td><b>${esc(e.user)}</b></td><td>${esc(e.project)}</td><td>${esc(ago(e.modified))}</td><td><button data-open="${i}" class="pri">Open as my copy</button></td></tr>`).join("")}</table></div>` : `<p class="empty">${ok ? "Nobody else has published here yet." : "Reconnect to see them."}</p>`}
    <p class="small muted">Opening one adds a copy to <b>My projects</b>. Your work and theirs never overwrite each other. Open it again later to refresh the copy.</p>`;
}
function wireTeamTab(root, closeThen) {
  root.onclick = async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    try {
      if (b.id === "tmPick") {
        // must run straight from the click: the picker needs the user gesture
        const handle = await showDirectoryPicker({
          id: "studio5s-team",
          mode: "readwrite",
        });
        TEAM.handle = handle;
        await teamSave();
        root.innerHTML = await teamTabHTML();
      } else if (b.id === "tmGrant") {
        await teamPerm(true, true);
        root.innerHTML = await teamTabHTML();
      } else if (b.id === "tmPub") {
        if (await teamPublish(true)) {
          toast("Published: " + myFileName());
          root.innerHTML = await teamTabHTML();
        } else toast("The folder needs your permission. Press Reconnect.");
      } else if (b.id === "tmStop") {
        TEAM = { handle: null, auto: false, last: 0 };
        await teamSave();
        teamChip(false);
        root.innerHTML = await teamTabHTML();
      } else if (b.dataset.open !== undefined) {
        const en = teamEntries[+b.dataset.open];
        closeThen(() => openTeamFile(en));
      } else if (b.id === "tmDl") {
        download(
          new Blob([JSON.stringify(projectBundle())], {
            type: "application/json",
          }),
          myFileName(),
        );
        toast("Downloaded. Put it in the folder your team shares.");
      } else if (b.id === "tmFile") closeThen(() => $("#fTeam").click());
    } catch (err) {
      if (err.name !== "AbortError")
        toast("That did not work: " + err.message, 6000);
    }
  };
  root.onchange = async (e) => {
    if (e.target.id === "tmAuto") {
      TEAM.auto = e.target.checked;
      await teamSave();
      if (TEAM.auto) {
        try {
          if (await teamPublish(true))
            toast("Published. It will now stay up to date while you work.");
        } catch (err) {
          toast("Could not write to the folder: " + err.message);
        }
      }
    }
  };
}
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
    if (r.m === "refresh") await deleteProject(mine.id);
  }
  try {
    await importBundle(j, proj, user, proj);
    toast(`Opened ${user}'s project as a copy in your list.`);
  } catch {
    toast("That is not a project file this studio can open.");
  }
}
$("#fTeam").onchange = async () => {
  const f = $("#fTeam").files[0];
  $("#fTeam").value = "";
  if (!f) return;
  try {
    const j = JSON.parse(await f.text()),
      m = f.name.match(/^5S-Studio__(.+?)__(.+)\.json$/);
    await openTeammateBundle(
      j,
      m ? m[1] : j.by || "Teammate",
      m ? m[2] : f.name.replace(/\.json$/, ""),
    );
  } catch {
    toast("That file could not be opened.");
  }
};
