"use strict";
/* ============ accounts and projects ============ */
// People, not passwords. Whoever uses the studio picks their name ("Who is working?"), or types it the
// first time; everything they save is kept under that name in this browser, so two people sharing a
// computer each have their own projects. There is no password: the site is a static page and the data
// lives in the browser, so a password could not protect anything and a forgotten one cost the work.
// Anyone at this computer can open any name. Profiles made before this had passwords: the hash is
// left in the stored list, unused. Each person can hold several projects, and a teammate's published
// project (see 33-team.js) opens as a copy in their own list.

const AUTH_KEY = "auth/users", // [{ id, name, created }]
  SESSION_KEY = "studio5s-user",
  REMEMBER_KEY = "studio5s-remember"; // the last person on this computer opens straight away
const validName = (n) => /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,23}$/.test(n);
const nameKey = (n) => String(n).trim().toLowerCase();
const nameProblem = (name, users, me = "") =>
  !validName(name)
    ? "Use 2 to 24 letters, numbers, spaces, dots, dashes or underscores."
    : users.some((u) => u.id !== me && nameKey(u.name) === nameKey(name))
      ? "That name is already used on this computer."
      : "";
const loadUsers = async () => {
  const u = idb.db ? await idb.get(AUTH_KEY) : [];
  return Array.isArray(u) ? u : [];
};
const saveUsers = (list) => idb.write([[AUTH_KEY, list]]);

/* ----- who is working ----- */
function authGate() {
  return new Promise(async (resolve) => {
    // without browser storage nothing is kept, so there is nobody to choose
    if (!idb.db) {
      CUR = { id: "guest", name: "Guest" };
      return resolve();
    }
    let users = await loadUsers();
    const finish = (u) => {
      CUR = { id: u.id, name: u.name };
      try {
        sessionStorage.setItem(SESSION_KEY, u.id);
        localStorage.setItem(REMEMBER_KEY, u.id);
      } catch {}
      $("#auth").hidden = true;
      document.body.classList.remove("locked");
      resolve();
    };
    // this tab's person, else the last person on this computer
    let ids = [];
    try {
      ids = [
        sessionStorage.getItem(SESSION_KEY),
        localStorage.getItem(REMEMBER_KEY),
      ];
    } catch {}
    const known =
      users.find((u) => u.id === ids[0]) || users.find((u) => u.id === ids[1]);
    if (known) return finish(known);

    document.body.classList.add("locked");
    const body = $("#authBody"),
      msg = (t) => ($("#authMsg").textContent = t || "");
    $("#auth").hidden = false;
    const show = (mode) => {
      msg("");
      body.innerHTML =
        mode === "pick"
          ? `<p class="authsub">Who is working?</p><div class="tiles">${users
              .map(
                (u) =>
                  `<button class="tile" data-u="${esc(u.id)}"><span class="av">${esc(u.name.slice(0, 1).toUpperCase())}</span>${esc(u.name)}</button>`,
              )
              .join(
                "",
              )}<button class="tile new" data-new="1"><span class="av">+</span>Someone new</button></div><p class="small muted">Each name has its own projects in this browser. There is no password: anyone at this computer can open any name, so save project files as backups.</p>`
          : `<form id="authForm"><p class="authsub">${users.length ? "Who is it?" : "Welcome. What is your name?"}</p><label class="f">Your name<input name="user" autocomplete="name" required maxlength="24" placeholder="e.g. Josh"></label><div class="btns"><button class="pri" type="submit">Start</button>${users.length ? '<button type="button" data-back="1">Back</button>' : ""}</div><p class="small muted">Your projects are saved in this browser under your name, and it goes on what you print and share. There is no password: anyone at this computer can open it. Save project files as backups.</p></form>`;
      body.dataset.mode = mode;
      body.querySelector("[name=user]")?.focus();
    };
    show(users.length ? "pick" : "name");
    body.onclick = (e) => {
      const t = e.target.closest("[data-u],[data-new],[data-back]");
      if (!t) return;
      e.preventDefault();
      if (t.dataset.u) finish(users.find((u) => u.id === t.dataset.u));
      else if (t.dataset.new) show("name");
      else show("pick");
    };
    body.onsubmit = async (e) => {
      e.preventDefault();
      const name = String(new FormData(e.target).get("user")).trim(),
        same = users.find((u) => nameKey(u.name) === nameKey(name));
      // typing a name that is already here opens it, rather than refusing
      if (same) return finish(same);
      const problem = nameProblem(name, users);
      if (problem) return msg(problem);
      const u = { id: uid(), name, created: today() };
      users = [...users, u];
      try {
        await saveUsers(users);
        finish(u);
      } catch (err) {
        msg(err.message || "Something went wrong.");
      }
    };
  });
}
async function removeAccount(u) {
  await idb.removePrefix(userPrefix(u.id));
  try {
    for (const k of Object.keys(localStorage))
      if (k.startsWith(LSKEY + "/" + u.id + "/")) localStorage.removeItem(k);
  } catch {}
  await saveUsers((await loadUsers()).filter((x) => x.id !== u.id));
}
// back to "Who is working?"
async function signOut() {
  try {
    await flushSave();
  } catch {}
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  } catch {}
  location.reload();
}

/* ----- the project list ----- */
let IDX = { active: "", list: [] };
const indexKey = () => userPrefix() + "index";
function projectIndexEntry() {
  const e = IDX.list.find((x) => x.id === PID);
  if (e) {
    e.name = (P && P.projectName) || e.name;
    e.updated = Date.now();
  }
  return [indexKey(), IDX];
}
async function loadIndex() {
  let ix = idb.db ? await idb.get(indexKey()) : null;
  if (!ix || !Array.isArray(ix.list) || !ix.list.length) {
    const id = uid();
    ix = {
      active: id,
      list: [
        {
          id,
          name: "My first project",
          created: today(),
          updated: Date.now(),
          from: "",
        },
      ],
    };
    if (idb.db) await idb.write([[indexKey(), ix]]);
  }
  if (!ix.list.some((e) => e.id === ix.active)) ix.active = ix.list[0].id;
  IDX = ix;
  PID = ix.active;
}
const blankProjectObject = () => {
  const keep = [P, D];
  newProject();
  const p = P;
  [P, D] = keep;
  return p;
};
async function readProject(pid) {
  const raw = await idb.get(K("project", pid));
  if (!raw) return null;
  return {
    P: validate(JSON.parse(raw)),
    D: imageMap(await idb.get(K("drawings", pid))),
    PH: imageMap(await idb.get(K("photos", pid))),
  };
}
function afterProjectChange() {
  tabWarn("");
  folderRelease(); // a sync question belongs to the project that has just closed
  tabTell("open");
  undoS = [];
  redoS = [];
  lastSavedProject = "";
  holdSave = false;
  dirtyImg = true;
  ui.sel = [];
  ui.vb = null;
  ui.draft = null;
  ui.cmp = "auto";
  ui.tab = "item";
  ui.drift.focus = "";
  // what was being shown belongs to the project that has just closed
  ui.scope = "";
  ui.fromSetup = "";
  ui.prob.sel = "";
  su.focus = "";
  dm.focus = "";
  dm.place = "";
  dm.vb = null;
  ui.hiddenCategories.clear();
  if (ui.editDrawing) setEditDrawing(false);
  setTool("select");
}
/* make another project from data in memory and open it */
async function addProject(p, d, ph, name, from = "", src = "") {
  await flushSave();
  const id = uid();
  p.projectName = name || p.projectName || "Project";
  await idb.write([
    [K("project", id), JSON.stringify(p)],
    [K("drawings", id), d || {}],
    [K("photos", id), ph || {}],
  ]);
  IDX.list.push({
    id,
    name: p.projectName,
    created: today(),
    updated: Date.now(),
    from,
    src,
  });
  await openProject(id);
  return id;
}
async function openProject(pid) {
  if (pid === PID) return;
  await flushSave();
  let r;
  try {
    r = await readProject(pid);
  } catch (e) {
    console.warn(e);
    return void toast(
      "That project could not be read, so it was not opened.",
      6000,
    );
  }
  IDX.active = pid;
  PID = pid;
  if (r) {
    P = r.P;
    D = r.D;
    PH = r.PH;
  } else {
    newProject();
    PH = {};
  }
  afterProjectChange();
  await idb.write([[indexKey(), IDX]]);
  renderAll();
  save();
  folderCheck(); // a project saved in the folder may have been changed there
}
async function deleteProject(pid) {
  await flushSave();
  // the project that opens next must be readable: never put a blank one over unreadable data
  if (pid === PID) {
    const rest = IDX.list.filter((e) => e.id !== pid);
    if (rest.length)
      try {
        await readProject(rest.at(-1).id);
      } catch {
        toast(
          "Nothing was deleted: the next project in your list could not be read. Open that one first to see what is wrong.",
          7000,
        );
        return;
      }
  }
  await idb.removePrefix(projPrefix(pid));
  try {
    localStorage.removeItem(recoveryKey(pid));
  } catch {}
  IDX.list = IDX.list.filter((e) => e.id !== pid);
  if (!IDX.list.length) {
    const id = uid();
    IDX.list.push({
      id,
      name: "My first project",
      created: today(),
      updated: Date.now(),
      from: "",
    });
  }
  if (pid === PID) {
    const next = IDX.list.at(-1).id;
    PID = "";
    IDX.active = next;
    await idb.write([[indexKey(), IDX]]);
    PID = next;
    let r = null;
    try {
      r = await readProject(next);
    } catch {}
    if (r) ({ P, D, PH } = { P: r.P, D: r.D, PH: r.PH });
    else {
      newProject();
      PH = {};
    }
    afterProjectChange();
    renderAll();
    save();
  } else await idb.write([[indexKey(), IDX]]);
}
/* a saved project file (this studio, or the original single-file version) becomes a new project */
async function importBundle(j, label, from = "", src = "") {
  let p,
    d = {},
    ph = {};
  if (j.project) {
    p = validate(j.project);
    d = imageMap(j.drawings);
    ph = imageMap(j.photos);
  } else if (j.layouts) {
    const keep = D;
    p = migrateLegacy(j);
    d = D;
    D = keep;
  } else throw Error("Not a project file");
  return addProject(
    p,
    d,
    ph,
    from ? from + ": " + (p.projectName || label) : p.projectName || label,
    from,
    src,
  );
}
async function startNewProject(name) {
  await addProject(blankProjectObject(), {}, {}, name || "New project");
}

/* ----- the account dialog: projects, team, account ----- */
const ago = (ms) => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1
    ? "just now"
    : m < 60
      ? m + " min ago"
      : m < 1440
        ? Math.round(m / 60) + " h ago"
        : fmtD(new Date(ms).toISOString().slice(0, 10));
};
async function accountDialog(tab = "projects") {
  let done = null;
  const closeThen = (dlg) => (fn) => {
    done = fn;
    dlg.close("cancel");
  };
  const render = async (t, root, dlg) => {
    $$("#acTabs button").forEach((b) =>
      b.classList.toggle("on", b.dataset.t === t),
    );
    if (t === "projects") root.innerHTML = projectsTabHTML();
    else if (t === "team") root.innerHTML = await teamTabHTML();
    else
      root.innerHTML = `<p style="margin-top:0">Working as <b>${esc(CUR.name)}</b>${CUR.id === "guest" ? ". Browser storage is not available, so nothing is kept between visits." : ", on this computer."}</p><div class="btns"><button id="acOut" class="pri">Switch person</button><button id="acName">Change my name</button><button id="acDel" class="danger">Remove me from this computer</button></div><p class="small muted">Names keep people's projects apart on a shared computer. There is no password and nothing is encrypted, so anyone at this computer can open any name. Keep project files somewhere backed up.</p>`;
    root.dataset.t = t;
    if (t === "team") wireTeamTab(root, closeThen(dlg));
  };
  await modal(
    "Projects, folder and account",
    `<div class="tabs" id="acTabs"><button data-t="projects">My projects</button><button data-t="team">Project folder</button><button data-t="account">Account</button></div><div id="acRoot"></div>`,
    "",
    {
      cls: "xwide",
      cancel: "Close",
      onOpen: (dlg) => {
        const root = $("#acRoot");
        render(tab, root, dlg);
        $("#acTabs").onclick = (e) => {
          const b = e.target.closest("[data-t]");
          if (b) render(b.dataset.t, root, dlg);
        };
        root.onclick = async (e) => {
          const b = e.target.closest("button");
          if (!b || root.dataset.t === "team") return;
          const row = b.closest("tr[data-p]"),
            pid = row?.dataset.p;
          const close = (fn) => {
            done = fn;
            dlg.close("cancel");
          };
          if (b.dataset.a === "open") close(() => openProject(pid));
          else if (b.dataset.a === "rename")
            close(async () => {
              const e0 = IDX.list.find((x) => x.id === pid),
                r = await modal(
                  "Rename the project",
                  `<label class="f">Name<input name="n" required value="${esc(e0.name)}"></label>`,
                  "Save",
                );
              if (r?.n.trim()) {
                e0.name = r.n.trim();
                if (pid === PID) {
                  checkpoint();
                  P.projectName = e0.name;
                  record("Project renamed", e0.name);
                  renderAll();
                } else
                  try {
                    const raw = JSON.parse(await idb.get(K("project", pid)));
                    raw.projectName = e0.name;
                    await idb.write([[K("project", pid), JSON.stringify(raw)]]);
                  } catch {}
                await idb.write([[indexKey(), IDX]]);
              }
              accountDialog("projects");
            });
          else if (b.dataset.a === "copy")
            close(async () => {
              await flushSave();
              const r = await readProject(pid);
              if (r)
                await addProject(
                  r.P,
                  r.D,
                  r.PH,
                  IDX.list.find((x) => x.id === pid).name + " (copy)",
                );
            });
          else if (b.dataset.a === "delete")
            close(async () => {
              const e0 = IDX.list.find((x) => x.id === pid),
                r = await modal(
                  "Delete " + e0.name + "?",
                  `<p style="margin-top:0">The project is removed from this browser. ${e0.file ? `Its file in the project folder, <b>${esc(e0.file)}</b>, is not deleted.` : "Project files you saved are not affected."} This cannot be undone.</p>`,
                  "Delete",
                );
              if (r) await deleteProject(pid);
              accountDialog("projects");
            });
          else if (b.id === "acNew")
            close(async () => {
              const r = await modal(
                "New project",
                '<label class="f">Name<input name="n" required placeholder="e.g. Packing line, big redesign"></label>',
                "Create",
              );
              if (r) await startNewProject(r.n.trim());
            });
          else if (b.id === "acExample") close(() => loadExample());
          else if (b.id === "acFile") close(() => $("#fProject").click());
          else if (b.id === "acName") close(() => renameMeDialog());
          else if (b.id === "acOut") close(() => signOut());
          else if (b.id === "acDel") close(() => deleteAccountDialog());
        };
      },
    },
  );
  if (done) await done();
}
function projectsTabHTML() {
  const rows = IDX.list
    .slice()
    .sort((a, b) => b.updated - a.updated)
    .map(
      (e) =>
        `<tr data-p="${esc(e.id)}"><td><b>${esc(e.name)}</b>${e.id === PID ? ' <span class="pill done">open now</span>' : ""}${e.from ? `<span class="sub">copy of ${esc(e.from)}'s project</span>` : ""}<span class="sub">${e.file ? "In the project folder: " + esc(e.file) : "Only in this browser"}</span></td><td>${esc(ago(e.updated))}</td><td class="bact">${e.id === PID ? "" : '<button data-a="open" class="pri">Open</button>'}<button data-a="rename">Rename</button><button data-a="copy">Copy</button><button data-a="delete" class="danger">Delete</button></td></tr>`,
    )
    .join("");
  return `<p style="margin-top:0">Your projects are saved in this browser under <b>${esc(CUR.name)}</b>. Switching is instant and nothing is lost.</p><div class="regtbl"><table class="tbl" style="width:100%"><tr><th>Project</th><th>Last saved</th><th></th></tr>${rows}</table></div><div class="btns"><button id="acNew" class="pri">New project</button><button id="acExample">Open the example model line</button><button id="acFile">Open a project file…</button></div>`;
}
async function renameMeDialog() {
  const users = await loadUsers(),
    me = users.find((u) => u.id === CUR.id);
  if (!me) return;
  const r = await modal(
    "Change my name",
    `<label class="f">Name<input name="n" required maxlength="24" value="${esc(me.name)}"></label><p class="small muted">Your projects stay as they are. Prints and team files use the new name from now on.</p>`,
    "Save",
  );
  if (!r) return;
  const name = r.n.trim(),
    problem = nameProblem(name, users, me.id);
  if (problem) return void toast(problem);
  me.name = name;
  await saveUsers(users);
  CUR.name = name;
  $("#userBtn").textContent = name;
  toast("Name changed.");
}
async function deleteAccountDialog() {
  const users = await loadUsers(),
    me = users.find((u) => u.id === CUR.id);
  if (!me) return;
  const r = await modal(
    "Remove " + me.name + " from this computer?",
    `<p style="margin-top:0">This deletes <b>${esc(me.name)}</b> and all of their projects from this browser. Project files you saved, and projects published to a team folder, are not affected. It cannot be undone.</p><label class="f">Type the name to confirm<input name="n" autocomplete="off"></label>`,
    "Remove",
  );
  if (!r) return;
  if (nameKey(r.n) !== nameKey(me.name))
    return void toast("The name did not match, so nothing was removed.");
  await removeAccount(me);
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  } catch {}
  location.reload();
}
$("#userBtn").onclick = () => accountDialog();
