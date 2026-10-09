"use strict";
/* ============ storage ============
   Saving and loading. IndexedDB 'studio-5s' (idb), keys per account and project K(), autosave
   save() / flushSave() / runSave() with a localStorage fallback, validate(p) migrates every older project
   shape (bump the version here), migrateLegacy() for v6 files, keepStorage(), the second-tab warning
   (tabTell / tabWarn over BroadcastChannel) and deviceId(). */
// One transaction keeps project metadata and media consistent after interruption.
const idb = {
  db: null,
  open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(Error("IndexedDB unavailable"));
      const request = indexedDB.open("studio-5s", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => {
          this.db.close();
          this.db = null;
        };
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(Error("Storage upgrade blocked"));
    });
  },
  get(key) {
    return new Promise((resolve, reject) => {
      const request = this.db.transaction("kv").objectStore("kv").get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  write(entries) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("kv", "readwrite"),
        store = tx.objectStore("kv");
      for (const [key, value] of entries) store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || Error("Save aborted"));
    });
  },
  // delete every key that starts with a prefix (one account, or one project)
  removePrefix(prefix) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("kv", "readwrite"),
        store = tx.objectStore("kv"),
        req = store.openCursor(IDBKeyRange.bound(prefix, prefix + "\uffff"));
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          c.delete();
          c.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () =>
        reject(tx.error || Error("Delete aborted"));
    });
  },
};
/* Who is signed in and which of their projects is open. Everything a person
   saves is stored under their own key prefix, so accounts never see each
   other's work in the same browser. */
let CUR = null, // { id, name }
  PID = ""; // id of the open project
const userPrefix = (uid0 = CUR.id) => "u/" + uid0 + "/";
const projPrefix = (pid = PID, uid0 = CUR.id) =>
  userPrefix(uid0) + "p/" + pid + "/";
const K = (name, pid = PID) => projPrefix(pid) + name;
const recoveryKey = (pid = PID) => LSKEY + "/" + CUR.id + "/" + pid;
let saveT = null,
  savePending = false,
  saveRunning = false,
  holdSave = false, // true while an unreadable saved project is being resolved
  lastSavedProject = "";
function save() {
  clearTimeout(saveT);
  savePending = true;
  $("#saved").textContent = "Saving…";
  saveT = setTimeout(flushSave, 350);
}
let saveDone = Promise.resolve();
// Resolves when everything edited so far is saved. If a save is already running its loop
// picks up the newer edits, so callers that switch project afterwards can rely on this.
function flushSave() {
  clearTimeout(saveT);
  saveT = null;
  if (holdSave || !P) return saveDone;
  if (saveRunning) return saveDone;
  if (!savePending) return saveDone;
  saveRunning = true;
  saveDone = runSave();
  return saveDone;
}
async function runSave() {
  try {
    while (savePending) {
      savePending = false;
      const project = JSON.stringify(P),
        mediaDirty = dirtyImg;
      // Snapshot media before awaiting so a newer edit cannot be marked saved.
      const drawings = mediaDirty ? { ...D } : null,
        photos = mediaDirty ? { ...PH } : null;
      dirtyImg = false;
      if (project === lastSavedProject && !mediaDirty) continue;
      try {
        if (!idb.db) throw Error("IndexedDB unavailable");
        const entries = [[K("project"), project]];
        if (mediaDirty)
          entries.push([K("drawings"), drawings], [K("photos"), photos]);
        // keep the project list's name and time current (small, written with every save)
        if (typeof projectIndexEntry === "function")
          entries.push(projectIndexEntry());
        await idb.write(entries);
        lastSavedProject = project;
        tabTell("saved");
        // An older fallback must not override this successful database save.
        try {
          localStorage.removeItem(recoveryKey());
        } catch {}
      } catch (error) {
        // the images were not written to the database: they stay dirty until a write succeeds
        dirtyImg = dirtyImg || mediaDirty;
        try {
          localStorage.setItem(
            recoveryKey(),
            JSON.stringify({
              recovery: true,
              project: JSON.parse(project),
              drawings: drawings || D,
              photos: photos || PH,
            }),
          );
          lastSavedProject = project;
        } catch (fallbackError) {
          dirtyImg = dirtyImg || mediaDirty;
          savePending = true;
          $("#saved").textContent = "Not saved";
          toast(
            "Browser storage is full or blocked. Use Save project to keep a file copy.",
          );
          return;
        }
      }
    }
    $("#saved").textContent =
      "Saved in browser · " +
      new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    updateProjectIdentity();
    if (typeof teamAfterSave === "function") teamAfterSave();
  } finally {
    saveRunning = false;
  }
}
// Hidden tabs throttle timers. Start the pending save while the page is still alive.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) flushSave();
});
window.addEventListener("pagehide", flushSave);
window.addEventListener("beforeunload", (e) => {
  if (!holdSave && (savePending || saveRunning)) {
    flushSave();
    e.preventDefault();
    e.returnValue = "";
  }
});
function normMark(m, types) {
  const ids = types.map((t) => t.id);
  if (!ids.includes(m.type)) m.type = ids[0];
  m.kind = ["line", "aisle", "arrow"].includes(m.kind) ? m.kind : "line";
  m.status = ["planned", "laid", "worn"].includes(m.status)
    ? m.status
    : m.damaged
      ? "worn"
      : "planned";
  m.damaged = m.status === "worn";
  m.laid = String(m.laid || "");
  m.note = String(m.note || "");
  if (m.kind === "aisle") {
    m.width = Number.isFinite(m.width) && m.width > 0 ? m.width : 12;
    m.closed = false;
  }
  if (m.kind === "arrow") {
    m.pts = m.pts.slice(0, 2);
    m.closed = false;
  }
  return m;
}
function validate(p) {
  if (!p || !Array.isArray(p.sheets) || !p.sheets.length)
    throw Error("No sheets");
  p.settings = {
    tolM: 0.5,
    tolU: 4,
    rotTol: 20,
    walk: 1.2,
    shiftH: 8,
    target: 90,
    ...(p.settings || {}),
  };
  for (const [key, fallback] of Object.entries({
    tolM: 0.5,
    tolU: 4,
    rotTol: 20,
    walk: 1.2,
    shiftH: 8,
    target: 90,
  }))
    if (!Number.isFinite(p.settings[key]) || p.settings[key] <= 0)
      p.settings[key] = fallback;
  p.settings.target = Math.min(100, p.settings.target);
  {
    const hex6 = (v) => /^#[0-9a-f]{6}$/i.test(v),
      mk = p.marking && typeof p.marking === "object" ? p.marking : {};
    let types = (Array.isArray(mk.types) ? mk.types : [])
      .filter((t) => t && typeof t === "object" && t.id)
      .map((t) => ({
        id: String(t.id),
        name: String(t.name || t.id),
        c: hex6(t.c) ? t.c : "#FEC20F",
        c2: hex6(t.c2) ? t.c2 : "",
        pattern: ["solid", "stripe", "dash"].includes(t.pattern)
          ? t.pattern
          : "solid",
        w: Number(t.w) > 0 ? Number(t.w) : 50,
        use: String(t.use || ""),
        // version 12: ordering details per tape type
        roll: Number(t.roll) > 0 ? Number(t.roll) : 0,
        supplier: String(t.supplier || "").slice(0, 80),
        code: String(t.code || "").slice(0, 80),
        ref: String(t.ref || "").slice(0, 80),
      }));
    const seen = new Set();
    types = types.filter((t) => !seen.has(t.id) && seen.add(t.id));
    if (!types.length) types = clone(DEFAULT_TYPES);
    p.marking = {
      types,
      roll: Number(mk.roll) > 0 ? Number(mk.roll) : 33,
      waste:
        Number(mk.waste) >= 0 && mk.waste != null && mk.waste !== ""
          ? Number(mk.waste)
          : 10,
      minAisle: Number(mk.minAisle) > 0 ? Number(mk.minAisle) : 1.2,
      homeType: types.some((t) => t.id === mk.homeType)
        ? mk.homeType
        : (types.find((t) => t.id === "walkway") || types[0]).id,
      // version 12: the colour standard as a document: its number, revision and owner
      std: {
        no: String(mk.std?.no || "").slice(0, 60),
        rev: String(mk.std?.rev || "").slice(0, 20),
        owner: String(mk.std?.owner || "").slice(0, 60),
      },
    };
  }
  p.revisions =
    p.revisions &&
    typeof p.revisions === "object" &&
    !Array.isArray(p.revisions)
      ? p.revisions
      : {};
  for (const id of Object.keys(p.revisions)) {
    const r = p.revisions[id];
    if (!r || !Array.isArray(r.objects)) {
      delete p.revisions[id];
      continue;
    }
    r.sig = String(r.sig || "");
    r.date = r.date || "";
    r.objects = r.objects.filter(
      (o) => o && ["x", "y", "w", "h"].every((k) => Number.isFinite(o[k])),
    );
    for (const o of r.objects) {
      o.a = Number.isFinite(Number(o.a)) ? Number(o.a) : 0;
      o.ref = String(o.ref || o.id || uid());
      o.kind = ["item", "zone", "keepclear"].includes(o.kind) ? o.kind : "item";
      o.label = String(o.label || "Item");
      o.fpStyle = o.fpStyle === "outline" ? "outline" : "corners";
      o.fpLaid = !!o.fpLaid;
    }
    const okPts = (m) =>
      m &&
      Array.isArray(m.pts) &&
      m.pts.length >= 2 &&
      m.pts.every((q) => q && Number.isFinite(q.x) && Number.isFinite(q.y));
    r.marks = (Array.isArray(r.marks) ? r.marks : [])
      .filter(okPts)
      .map((m) => normMark(m, p.marking.types));
    r.routes = (Array.isArray(r.routes) ? r.routes : []).filter(okPts);
  }
  // Features removed from the studio (formal audits and areas) are kept
  // untouched so old backups lose nothing and could be restored later.
  // Anything parked by an earlier version that is back in use is restored.
  {
    const parked =
      p.parked && typeof p.parked === "object" && !Array.isArray(p.parked)
        ? p.parked
        : {};
    const hasData = (v) =>
      Array.isArray(v)
        ? v.length > 0
        : v && typeof v === "object"
          ? Object.keys(v).length > 0
          : false;
    for (const k of ["tags", "revisions"])
      if (!hasData(p[k]) && hasData(parked[k])) {
        p[k] = parked[k];
        delete parked[k];
      }
    if (p.counters && typeof p.counters === "object") {
      if (parked.counters?.tag > 0 && !(Number(p.counters.tag) > 0))
        p.counters.tag = parked.counters.tag;
      delete parked.counters?.tag;
      if (parked.counters && !Object.keys(parked.counters).length)
        delete parked.counters;
    }
    for (const k of ["audits", "lines", "audit"]) {
      if (hasData(p[k])) parked[k] = p[k];
      delete p[k];
    }
    // Boards and SMED were removed from the studio (version 9). Their data is kept
    // untouched in `parked` so old backups lose nothing and could be restored later.
    if (Array.isArray(p.boards) && p.boards.length) parked.boards = p.boards;
    if (
      p.smed &&
      Array.isArray(p.smed.changeovers) &&
      p.smed.changeovers.length
    )
      parked.smed = p.smed;
    if ((parked.boards || parked.smed) && hasData(p.labels))
      parked.labels = p.labels;
    delete p.boards;
    delete p.smed;
    delete p.labels;
    // Areas are back. Older files kept them as audit areas: they come back
    // as plain areas, and anything that is not a usable polygon stays parked.
    {
      const okPoly = (a) =>
          a &&
          typeof a === "object" &&
          Array.isArray(a.pts) &&
          a.pts.length >= 3 &&
          a.pts.every((q) => q && Number.isFinite(q.x) && Number.isFinite(q.y)),
        have = Array.isArray(p.areas) ? p.areas : [],
        old = Array.isArray(parked.areas) ? parked.areas : [],
        ids = new Set(have.map((a) => a && a.id)),
        all = [...have, ...old.filter((a) => !(a && ids.has(a.id)))];
      p.areas = all.filter(okPoly);
      const bad = all.filter((a) => !okPoly(a));
      delete parked.areas;
      if (bad.length) parked.areas = bad;
    }
    if (p.counters && Number(p.counters.audit) > 0)
      (parked.counters = parked.counters || {}).audit = p.counters.audit;
    if (hasData(parked)) p.parked = parked;
    else delete p.parked;
  }
  const str = (v, d = "") => (v == null ? d : String(v)),
    pick = (v, arr, d) => (arr.includes(v) ? v : d),
    num = (v) => (Number.isFinite(v) ? v : null),
    photos = (a) =>
      (Array.isArray(a) ? a : [])
        .filter((x) => x && x.id)
        .map((x) => ({ id: str(x.id), cap: str(x.cap) }));
  p.counters = {
    tag: 0,
    act: 0,
    doc: 0,
    board: 0,
    smed: 0,
    area: 0,
    line: 0,
    task: 0,
    prob: 0,
    ...(p.counters && typeof p.counters === "object" ? p.counters : {}),
  };
  delete p.counters.audit;
  p.tags = (Array.isArray(p.tags) ? p.tags : []).filter(
    (t) => t && typeof t === "object",
  );
  p.actions = (Array.isArray(p.actions) ? p.actions : []).filter(
    (t) => t && typeof t === "object",
  );
  for (const t of p.tags) {
    t.id = str(t.id, uid());
    t.no = Number(t.no) || 0;
    t.title = str(t.title, "Red tag");
    t.cat = pick(t.cat, TAG_CATS, TAG_CATS[0]);
    t.reason = str(t.reason);
    t.disp = pick(t.disp, TAG_DISP, TAG_DISP[0]);
    t.owner = str(t.owner);
    t.due = str(t.due);
    t.status = pick(t.status, TAG_ST, "Open");
    t.raised = str(t.raised);
    t.by = str(t.by);
    t.closed = str(t.closed);
    t.note = str(t.note);
    t.sheet = str(t.sheet);
    t.drawing = str(t.drawing);
    t.ref = str(t.ref);
    t.x = num(t.x);
    t.y = num(t.y);
    t.photos = photos(t.photos);
  }
  for (const a of p.actions) {
    a.id = str(a.id, uid());
    a.no = Number(a.no) || 0;
    a.title = str(a.title, "Action");
    a.s5 = pick(a.s5, ["", ...S5.map((x) => x[0])], "");
    a.pri = pick(a.pri, ACT_PRI, "Medium");
    a.owner = str(a.owner);
    a.due = str(a.due);
    a.status = pick(a.status, ACT_ST, "Open");
    a.raised = str(a.raised);
    a.done = str(a.done);
    a.note = str(a.note);
    a.sheet = str(a.sheet);
    a.source = str(a.source);
    a.tag = str(a.tag);
    a.prob = str(a.prob);
    a.cause = str(a.cause);
    a.doc = str(a.doc);
    // which section an action belongs to: 5S, document mapping, or improvement (linked to a problem)
    a.stream = a.prob
      ? "improve"
      : pick(a.stream, ["5s", "doc"], a.doc ? "doc" : "5s");
    a.drawing = str(a.drawing);
    a.x = num(a.x);
    a.y = num(a.y);
  }
  p.counters.tag = Math.max(
    Number(p.counters.tag) || 0,
    ...p.tags.map((t) => t.no),
  );
  p.counters.act = Math.max(
    Number(p.counters.act) || 0,
    ...p.actions.map((a) => a.no),
  );
  for (const t of p.tags) if (t.no <= 0) t.no = ++p.counters.tag;
  for (const a of p.actions) if (a.no <= 0) a.no = ++p.counters.act;
  p.documents = (Array.isArray(p.documents) ? p.documents : [])
    .filter((d) => d && typeof d === "object")
    .map((d) => ({
      id: str(d.id, uid()),
      no: Number(d.no) || 0,
      title: str(d.title, "Document"),
      type: str(d.type, "Other"),
      owner: str(d.owner),
      rev: str(d.rev),
      issued: str(d.issued),
      review: str(d.review),
      format: str(d.format),
      qty: Math.max(1, Math.round(Number(d.qty)) || 1),
      holder: str(d.holder),
      where: str(d.where),
      status: pick(d.status, DOC_ST, "Current"),
      ref: str(d.ref),
      note: str(d.note),
      sheet: str(d.sheet),
      drawing: str(d.drawing),
      x: num(d.x),
      y: num(d.y),
    }));
  p.counters.doc = Math.max(
    Number(p.counters.doc) || 0,
    ...p.documents.map((d) => d.no),
  );
  for (const d of p.documents) if (d.no <= 0) d.no = ++p.counters.doc;
  p.problems = (Array.isArray(p.problems) ? p.problems : [])
    .filter((x) => x && typeof x === "object")
    .map(normProblem);
  p.counters.prob = Math.max(
    Number(p.counters.prob) || 0,
    ...p.problems.map((x) => x.no),
  );
  for (const x of p.problems) if (x.no <= 0) x.no = ++p.counters.prob;
  p.drawings =
    p.drawings && typeof p.drawings === "object" && !Array.isArray(p.drawings)
      ? p.drawings
      : {};
  for (const [id, dm] of Object.entries(p.drawings)) {
    if (!dm || typeof dm !== "object") {
      delete p.drawings[id];
      continue;
    }
    dm.w = Number.isFinite(dm.w) && dm.w > 0 ? dm.w : 1000;
    dm.h = Number.isFinite(dm.h) && dm.h > 0 ? dm.h : 1000 / RATIO0;
    dm.mpu = Number.isFinite(dm.mpu) && dm.mpu > 0 ? dm.mpu : null;
    if (dm.datum && !["x", "y"].every((k) => Number.isFinite(dm.datum[k])))
      dm.datum = null;
  }
  {
    const firstDrawing = Object.keys(p.drawings)[0] || "d1";
    p.areas = p.areas.map((a, i) => ({
      id: str(a.id, uid()),
      no: Number(a.no) || 0,
      level: a.level === "line" ? "line" : "zone",
      locked: !!a.locked,
      parent: str(a.parent),
      name: str(a.name, a.level === "line" ? "Line" : "Zone"),
      color: /^#[0-9a-f]{6}$/i.test(a.color)
        ? a.color
        : AREA_COLS[i % AREA_COLS.length],
      owner: str(a.owner),
      note: str(a.note),
      drawing: p.drawings[a.drawing] ? a.drawing : firstDrawing,
      pts: a.pts.map((q) => ({ x: q.x, y: q.y })),
      closed: true,
      created: str(a.created),
      ...(a.line || a.freq
        ? { legacy: { line: str(a.line), freq: num(Number(a.freq)) } }
        : a.legacy
          ? { legacy: a.legacy }
          : {}),
    }));
    const seenA = new Set();
    for (const a of p.areas) {
      while (seenA.has(a.id)) a.id = uid();
      seenA.add(a.id);
    }
    // lines are the outlines of production lines; a zone sits in one line (or none yet)
    const lineIds = new Set(
      p.areas.filter((a) => a.level === "line").map((a) => a.id),
    );
    for (const a of p.areas)
      if (a.level === "line" || !lineIds.has(a.parent)) a.parent = "";
    for (const [lvl, key] of [
      ["zone", "area"],
      ["line", "line"],
    ]) {
      const mine = p.areas.filter((a) => a.level === lvl);
      p.counters[key] = Math.max(
        Number(p.counters[key]) || 0,
        ...mine.map((a) => a.no),
      );
      for (const a of mine) if (a.no <= 0) a.no = ++p.counters[key];
    }
  }
  // every record needs its own id, or editing or deleting one would hit several
  for (const list of [p.tags, p.actions, p.documents, p.problems]) {
    const seen = new Set();
    for (const x of list) {
      if (!x.id || seen.has(x.id)) x.id = uid();
      seen.add(x.id);
    }
  }
  // operator tasks: the jobs done in a zone, each linked to the items it uses (by item ref)
  {
    const zoneIds = new Set(
        p.areas.filter((a) => a.level !== "line").map((a) => a.id),
      ),
      docIds = new Set(p.documents.map((d) => d.id));
    p.tasks = (Array.isArray(p.tasks) ? p.tasks : [])
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        id: str(t.id, uid()),
        no: Number(t.no) || 0,
        name: str(t.name, "Task"),
        zone: zoneIds.has(t.zone) ? t.zone : "",
        who: str(t.who),
        freq: pick(t.freq, TASK_FREQ, "Every shift"),
        mins: Math.max(0, Number(t.mins) || 0),
        s5: S5.some((x) => x[0] === t.s5) ? t.s5 : "",
        items: [
          ...new Set(
            (Array.isArray(t.items) ? t.items : [])
              .map((x) => str(x))
              .filter(Boolean),
          ),
        ],
        doc: docIds.has(t.doc) ? t.doc : "",
        how: str(t.how),
        note: str(t.note),
      }));
    const seenT = new Set();
    for (const t of p.tasks) {
      while (seenT.has(t.id)) t.id = uid();
      seenT.add(t.id);
    }
    p.counters.task = Math.max(
      Number(p.counters.task) || 0,
      ...p.tasks.map((t) => t.no),
    );
    for (const t of p.tasks) if (t.no <= 0) t.no = ++p.counters.task;
  }
  p.sheets = p.sheets.filter((sheet) => sheet && typeof sheet === "object");
  if (!p.sheets.length) throw Error("No valid sheets");
  p.journal = Array.isArray(p.journal)
    ? p.journal.filter((j) => j && typeof j === "object").slice(-3000)
    : [];
  p.logo = safeImage(p.logo) || "";
  for (const s of p.sheets) {
    s.id = String(s.id || uid());
    s.kind = ["standard", "proposal", "daily"].includes(s.kind)
      ? s.kind
      : "proposal";
    s.name = String(s.name || "Sheet");
    s.date = s.date || "";
    s.objects = Array.isArray(s.objects) ? s.objects : [];
    s.marks = Array.isArray(s.marks) ? s.marks : [];
    s.routes = Array.isArray(s.routes) ? s.routes : [];
    s.notes = String(s.notes || "");
    s.actions = String(s.actions || "");
    s.s5 = s.s5 || {};
    s.photos = photos(s.photos);
    s.shift = String(s.shift || "");
    s.checker = String(s.checker || "");
    delete s.reviewedAreas;
    if (!p.drawings[s.drawing]) {
      s.drawing = Object.keys(p.drawings)[0] || "d1";
      p.drawings[s.drawing] = p.drawings[s.drawing] || {
        w: 1000,
        h: 1000 / RATIO0,
        mpu: null,
      };
    }
    s.objects = s.objects.filter(
      (o) =>
        o &&
        ["x", "y", "w", "h"].every((k) => Number.isFinite(o[k])) &&
        o.w > 0 &&
        o.h > 0,
    );
    for (const o of s.objects) {
      o.id = String(o.id || uid());
      o.ref = String(o.ref || o.id);
      o.a = Number.isFinite(Number(o.a)) ? Number(o.a) : 0;
      o.kind = ["item", "zone", "keepclear"].includes(o.kind) ? o.kind : "item";
      o.c = /^#[0-9a-f]{6}$/i.test(o.c) ? o.c : "#202C86";
      o.label = String(o.label || o.type || "Item");
      o.type = String(o.type || o.label);
      o.fpStyle = o.fpStyle === "outline" ? "outline" : "corners";
      o.fpLaid = !!o.fpLaid;
      o.area = typeof o.area === "string" ? o.area : "";
    }
    for (const arr of [s.marks, s.routes])
      for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i];
        if (
          !m ||
          !Array.isArray(m.pts) ||
          m.pts.length < 2 ||
          !m.pts.every((q) => q && Number.isFinite(q.x) && Number.isFinite(q.y))
        )
          arr.splice(i, 1);
        else {
          m.id = String(m.id || uid());
          m.ref = String(m.ref || m.id);
        }
      }
    for (const m of s.marks) normMark(m, p.marking.types);
    for (const r of s.routes) {
      r.who = r.who === "vehicle" ? "vehicle" : "walk";
      r.trips = Math.max(0.1, Number(r.trips) || 1);
      r.per = r.per === "hour" ? "hour" : "shift";
      r.name = String(r.name || "Route");
    }
  }
  const stds = p.sheets.filter((s) => s.kind === "standard");
  if (!stds.length) p.sheets[0].kind = "standard";
  else stds.slice(1).forEach((s) => (s.kind = "proposal"));
  if (!p.sheets.some((s) => s.id === p.active)) p.active = p.sheets[0].id;
  for (const dm of Object.values(p.drawings))
    if (dm && typeof dm === "object")
      dm.fixed = (Array.isArray(dm.fixed) ? dm.fixed : [])
        .map(fxNorm)
        .filter(Boolean);
  for (const s of p.sheets)
    if (s.kind === "daily" && !(s.rev && p.revisions[s.rev])) s.rev = stdRev(p);
  pruneRevisions(p);
  normalizeItemCategories(p);
  p.version = 12;
  p.app = "5s-studio";
  return p;
}

/* older ChatGPT-built format (percent coordinates, one picture per sheet) */
function migrateLegacy(old) {
  if (!Array.isArray(old.layouts) || !old.layouts.length)
    throw Error("Not a layout file");
  const drawings = {},
    imgs = {},
    bySrc = new Map(),
    sheets = [];
  for (const l of old.layouts) {
    const src = safeImage(l.background) || safeImage(old.background) || "",
      ratio =
        Number(l.ratio || old.ratio) > 0
          ? Number(l.ratio || old.ratio)
          : RATIO0;
    let did = bySrc.get(src);
    if (!did) {
      did = "d" + (bySrc.size + 1);
      bySrc.set(src, did);
      drawings[did] = {
        w: 1000,
        h: 1000 / ratio,
        mpu: null,
        name: "Drawing " + bySrc.size,
      };
      imgs[did] = src;
    }
    const H = 1000 / ratio,
      kind = l.stage === "Agreed layout" ? "standard" : "proposal";
    const s = {
      id: String(l.id || uid()),
      kind,
      name: String(l.name || "Imported sheet"),
      date: l.date || "",
      drawing: did,
      marks: [],
      notes: [l.notes, l.checks].filter(Boolean).join("\n\n"),
      actions: "",
      s5: {},
      photos: [],
      shift: "",
      checker: "",
      objects: (l.objects || [])
        .filter((o) => ["x", "y", "w", "h"].every((k) => Number.isFinite(o[k])))
        .map((o) => ({
          id: uid(),
          ref: String(o.id),
          type: o.type || o.label,
          label: o.label || o.type || "Item",
          kind:
            o.kind === "zone"
              ? /keep|clear/i.test(o.label || "")
                ? "keepclear"
                : "zone"
              : "item",
          x: (o.x + o.w / 2) * 10,
          y: ((o.y + o.h / 2) * H) / 100,
          w: o.w * 10,
          h: (o.h * H) / 100,
          a: Number(o.a) || 0,
          c: o.c || "#202C86",
          fp: false,
          locked: !!o.locked,
          note: "",
        })),
      routes: (l.routes || []).map((r) => ({
        id: uid(),
        ref: uid(),
        name: r.name || "Route",
        who: "walk",
        trips: Math.max(1, Number(r.trips) || 1),
        per: "shift",
        note: r.period || "",
        pts: (r.points || []).map((q) => ({
          x: q.x * 10,
          y: (q.y * H) / 100,
        })),
      })),
    };
    sheets.push(s);
  }
  if (!sheets.some((s) => s.kind === "standard")) {
    (sheets.find((s) => s.kind === "proposal") || sheets[0]).kind = "standard";
  }
  const project = validate({
    version: 5,
    drawings,
    sheets,
    active: sheets[0].id,
    logo: old.logo || "",
    settings: {},
    journal: [],
  });
  D = imgs;
  return project;
}

/* Ask the browser to keep this site's data (it may otherwise clear it when the disk is short). */
async function keepStorage() {
  try {
    if (navigator.storage && navigator.storage.persist)
      return await navigator.storage.persist();
  } catch {}
  return false;
}
/* Two tabs on one project overwrite each other (last save wins). Tabs tell each other which
   project they have open and when they save, and the one that is now out of date says so. */
const TAB_ID = Math.random().toString(36).slice(2),
  tabChan =
    "BroadcastChannel" in window ? new BroadcastChannel("studio5s-tabs") : null;
function tabTell(kind) {
  if (!tabChan || !CUR || !PID) return;
  try {
    tabChan.postMessage({ kind, tab: TAB_ID, u: CUR.id, p: PID });
  } catch {}
}
function tabWarn(text, reload = false) {
  const el = $("#tabWarn");
  if (!el) return;
  el.hidden = !text;
  el.innerHTML = text
    ? esc(text) +
      (reload
        ? ' <button type="button" id="tabReload">Reload this tab</button>'
        : "")
    : "";
  const b = $("#tabReload");
  if (b) b.onclick = () => location.reload();
}
if (tabChan)
  tabChan.onmessage = (e) => {
    const m = e.data || {};
    if (!m || m.tab === TAB_ID || !CUR || m.u !== CUR.id || m.p !== PID) return;
    if (m.kind === "open") {
      tabTell("here");
      tabWarn(
        "This project is also open in another tab. Edit in one tab only, or the last save wins.",
      );
    } else if (m.kind === "here") {
      tabWarn(
        "This project is also open in another tab. Edit in one tab only, or the last save wins.",
      );
    } else if (m.kind === "saved") {
      tabWarn(
        "Another tab saved changes to this project. Reload this tab before editing so nothing is overwritten.",
        true,
      );
    }
  };

/* A short id for this browser, so two people who chose the same username on different
   computers do not write the same team file. */
function deviceId() {
  try {
    let d = localStorage.getItem("studio5s-device");
    if (!d) {
      d = Math.random().toString(36).slice(2, 8);
      localStorage.setItem("studio5s-device", d);
    }
    return d;
  } catch {
    return "";
  }
}
