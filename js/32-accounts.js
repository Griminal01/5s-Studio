"use strict";
/* ============ accounts and projects ============ */
// Accounts live in this browser. A person signs in with a username and password;
// everything they save is kept under their own account, so two people can share
// one computer without seeing each other's work. This is a sign-in screen for a
// shared computer, not encryption: the page's code runs in the browser, so
// someone who controls the browser can get past it. Passwords are never stored,
// only a salted PBKDF2 hash. Each account can hold several projects, and a
// teammate's published project (see 33-team.js) opens as a copy in your own list.

const AUTH_KEY = "auth/users",
  SESSION_KEY = "studio5s-user",
  REMEMBER_KEY = "studio5s-remember",
  PW_ITER = 210000,
  PW_MIN = 6;
const utf8 = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pbkdf2(pw, salt, iter) {
  if (!window.crypto?.subtle)
    throw Error(
      "Sign-in needs a secure page. Open the studio from its https address, from localhost, or as a local file.",
    );
  const key = await crypto.subtle.importKey(
    "raw",
    utf8.encode(pw),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return b64(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: iter },
      key,
      256,
    ),
  );
}
// compare without stopping at the first difference
const sameHash = (a, b) => {
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
};
async function makeCredentials(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: b64(salt),
    iter: PW_ITER,
    hash: await pbkdf2(pw, salt, PW_ITER),
  };
}
const checkPassword = async (user, pw) =>
  sameHash(await pbkdf2(pw, unb64(user.salt), user.iter), user.hash);
const validName = (n) => /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,23}$/.test(n);
const nameKey = (n) => String(n).trim().toLowerCase();
const loadUsers = async () => {
  const u = idb.db ? await idb.get(AUTH_KEY) : [];
  return Array.isArray(u) ? u : [];
};
const saveUsers = (list) => idb.write([[AUTH_KEY, list]]);

/* ----- the sign-in screen ----- */
function authGate() {
  return new Promise(async (resolve) => {
    // without browser storage there is nothing to sign in to
    if (!idb.db) {
      CUR = { id: "guest", name: "Guest" };
      return resolve();
    }
    let users = await loadUsers(),
      fails = 0;
    const finish = (u, remember) => {
      CUR = { id: u.id, name: u.name };
      try {
        sessionStorage.setItem(SESSION_KEY, u.id);
        if (remember) localStorage.setItem(REMEMBER_KEY, u.id);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch {}
      $("#auth").hidden = true;
      document.body.classList.remove("locked");
      resolve();
    };
    // already signed in in this tab, or asked to be remembered on this computer
    let ids = [];
    try {
      ids = [
        sessionStorage.getItem(SESSION_KEY),
        localStorage.getItem(REMEMBER_KEY),
      ];
    } catch {}
    const known = users.find((u) => ids.includes(u.id));
    if (known) return finish(known, !!localStorage.getItem(REMEMBER_KEY));

    document.body.classList.add("locked");
    const root = $("#auth"),
      body = $("#authBody"),
      msg = (t) => ($("#authMsg").textContent = t || "");
    root.hidden = false;
    const show = (mode, who) => {
      msg("");
      if (mode === "pick") {
        body.innerHTML = `<p class="authsub">Who is working?</p><div class="tiles">${users
          .map(
            (u) =>
              `<button class="tile" data-u="${esc(u.id)}"><span class="av">${esc(u.name.slice(0, 1).toUpperCase())}</span>${esc(u.name)}</button>`,
          )
          .join(
            "",
          )}<button class="tile new" data-new="1"><span class="av">+</span>New account</button></div>`;
      } else if (mode === "login") {
        body.innerHTML = `<form id="authForm"><p class="authsub">Welcome back, <b>${esc(who.name)}</b></p><label class="f">Password<input name="pw" type="password" autocomplete="current-password" required autofocus></label><label class="chk"><input type="checkbox" name="remember">Keep me signed in on this computer</label><div class="btns"><button class="pri" type="submit">Sign in</button>${users.length > 1 ? '<button type="button" data-back="1">Not you?</button>' : ""}</div><p class="small"><a href="#" data-forgot="1">Forgot your password?</a></p></form>`;
        body.querySelector("[name=pw]").focus();
      } else {
        body.innerHTML = `<form id="authForm"><p class="authsub">${users.length ? "Create an account" : "Welcome. Create the first account"}</p><label class="f">Username<input name="user" autocomplete="username" required maxlength="24" placeholder="e.g. Josh"></label><label class="f">Password (at least ${PW_MIN} characters)<input name="pw" type="password" autocomplete="new-password" required></label><label class="f">Repeat the password<input name="pw2" type="password" autocomplete="new-password" required></label><label class="chk"><input type="checkbox" name="remember">Keep me signed in on this computer</label><div class="btns"><button class="pri" type="submit">Create account</button>${users.length ? '<button type="button" data-back="1">Back</button>' : ""}</div><p class="small muted">Your projects are saved in this browser under your name. There is no password reset, so choose one you will remember. Save project files as backups.</p></form>`;
        body.querySelector("[name=user]").focus();
      }
      body.dataset.mode = mode;
      body.dataset.who = who?.id || "";
    };
    show(users.length ? "pick" : "create");
    body.onclick = async (e) => {
      const t = e.target.closest(
        "[data-u],[data-new],[data-back],[data-forgot]",
      );
      if (!t) return;
      e.preventDefault();
      if (t.dataset.u)
        show(
          "login",
          users.find((u) => u.id === t.dataset.u),
        );
      else if (t.dataset.new) show("create");
      else if (t.dataset.back) show("pick");
      else if (t.dataset.forgot) {
        const u = users.find((x) => x.id === body.dataset.who);
        if (await resetAccountDialog(u)) {
          users = await loadUsers();
          show(users.length ? "pick" : "create");
        }
      }
    };
    body.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target),
        btn = e.target.querySelector("[type=submit]");
      btn.disabled = true;
      try {
        if (body.dataset.mode === "login") {
          const u = users.find((x) => x.id === body.dataset.who);
          if (await checkPassword(u, String(f.get("pw"))))
            return finish(u, !!f.get("remember"));
          fails++;
          msg("That password is not right.");
          e.target.querySelector("[name=pw]").value = "";
          await sleep(Math.min(5000, 400 * fails)); // slows guessing a little
        } else {
          const name = String(f.get("user")).trim(),
            pw = String(f.get("pw"));
          if (!validName(name))
            msg(
              "Use 2 to 24 letters, numbers, spaces, dots, dashes or underscores.",
            );
          else if (users.some((u) => nameKey(u.name) === nameKey(name)))
            msg("That username is taken on this computer.");
          else if (pw.length < PW_MIN)
            msg(`The password needs at least ${PW_MIN} characters.`);
          else if (nameKey(pw) === nameKey(name))
            msg("The password cannot be your username.");
          else if (pw !== String(f.get("pw2")))
            msg("The two passwords are different.");
          else {
            const u = {
              id: uid(),
              name,
              created: today(),
              ...(await makeCredentials(pw)),
            };
            users = [...users, u];
            await saveUsers(users);
            return finish(u, !!f.get("remember"));
          }
        }
      } catch (err) {
        msg(err.message || "Something went wrong.");
      }
      btn.disabled = false;
    };
  });
}
/* "forgot my password": there is no reset, so the only way back in is to remove the account */
async function resetAccountDialog(u) {
  const r = await modal(
    "Forgot your password?",
    `<p style="margin-top:0">Passwords cannot be reset: they are not stored anywhere, only a scrambled check of them.</p><p>The only way back in is to <b>remove the account ${esc(u.name)} from this computer</b>. That deletes its saved projects from this browser. Project files you saved with <b>Save project</b>, and projects you published to a team folder, are not touched and can be opened again in a new account.</p><label class="f">Type the username to confirm<input name="n" autocomplete="off"></label>`,
    "Remove the account",
  );
  if (!r || nameKey(r.n) !== nameKey(u.name)) return false;
  await removeAccount(u);
  return true;
}
async function removeAccount(u) {
  await idb.removePrefix(userPrefix(u.id));
  try {
    for (const k of Object.keys(localStorage))
      if (k.startsWith(LSKEY + "/" + u.id + "/")) localStorage.removeItem(k);
  } catch {}
  await saveUsers((await loadUsers()).filter((x) => x.id !== u.id));
}
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
      root.innerHTML = `<p style="margin-top:0">Signed in as <b>${esc(CUR.name)}</b>${CUR.id === "guest" ? ". Browser storage is not available, so accounts cannot be used and nothing is kept between visits." : ", on this computer."}</p><div class="btns"><button id="acPw">Change password</button><button id="acOut" class="pri">Sign out</button><button id="acDel" class="danger">Delete this account</button></div><p class="small muted">Accounts are kept in this browser only. They keep people on a shared computer out of each other's projects; they do not encrypt anything, so keep project files somewhere only you can reach.</p>`;
    root.dataset.t = t;
    if (t === "team") wireTeamTab(root, closeThen(dlg));
  };
  await modal(
    "Account, projects and team",
    `<div class="tabs" id="acTabs"><button data-t="projects">My projects</button><button data-t="team">Team</button><button data-t="account">Account</button></div><div id="acRoot"></div>`,
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
                  '<p style="margin-top:0">The project is removed from this browser. Project files you saved are not affected. This cannot be undone.</p>',
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
          else if (b.id === "acPw") close(() => changePasswordDialog());
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
        `<tr data-p="${esc(e.id)}"><td><b>${esc(e.name)}</b>${e.id === PID ? ' <span class="pill done">open now</span>' : ""}${e.from ? `<span class="sub">copy of ${esc(e.from)}'s project</span>` : ""}</td><td>${esc(ago(e.updated))}</td><td class="bact">${e.id === PID ? "" : '<button data-a="open" class="pri">Open</button>'}<button data-a="rename">Rename</button><button data-a="copy">Copy</button><button data-a="delete" class="danger">Delete</button></td></tr>`,
    )
    .join("");
  return `<p style="margin-top:0">Your projects are saved in this browser under <b>${esc(CUR.name)}</b>. Switching is instant and nothing is lost.</p><div class="regtbl"><table class="tbl" style="width:100%"><tr><th>Project</th><th>Last saved</th><th></th></tr>${rows}</table></div><div class="btns"><button id="acNew" class="pri">New project</button><button id="acExample">Open the example model line</button><button id="acFile">Open a project file…</button></div>`;
}
async function changePasswordDialog() {
  const users = await loadUsers(),
    me = users.find((u) => u.id === CUR.id);
  if (!me) return;
  const r = await modal(
    "Change password",
    `<label class="f">Current password<input name="old" type="password" autocomplete="current-password" required></label><label class="f">New password (at least ${PW_MIN} characters)<input name="n1" type="password" autocomplete="new-password" required></label><label class="f">Repeat the new password<input name="n2" type="password" autocomplete="new-password" required></label>`,
    "Change password",
  );
  if (!r) return;
  try {
    if (!(await checkPassword(me, r.old)))
      return void toast("The current password is not right.");
    if (r.n1.length < PW_MIN)
      return void toast(
        `The new password needs at least ${PW_MIN} characters.`,
      );
    if (r.n1 !== r.n2)
      return void toast("The two new passwords are different.");
    Object.assign(me, await makeCredentials(r.n1));
    await saveUsers(users);
    toast("Password changed.");
  } catch (e) {
    toast(e.message);
  }
}
async function deleteAccountDialog() {
  const users = await loadUsers(),
    me = users.find((u) => u.id === CUR.id);
  if (!me) return;
  const r = await modal(
    "Delete this account?",
    `<p style="margin-top:0">This deletes <b>${esc(me.name)}</b> and all its projects from this browser. Project files you saved are not affected. It cannot be undone.</p><label class="f">Your password<input name="pw" type="password" autocomplete="current-password" required></label>`,
    "Delete the account",
  );
  if (!r) return;
  try {
    if (!(await checkPassword(me, r.pw)))
      return void toast("The password is not right, so nothing was deleted.");
    await removeAccount(me);
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    } catch {}
    location.reload();
  } catch (e) {
    toast(e.message);
  }
}
$("#userBtn").onclick = () => accountDialog();
