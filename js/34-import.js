"use strict";
/* ============ bring items from another project ============ */
// Pick a project from My projects (your own, or a teammate's copy), tick the items you want, and they
// are added to the layout you have open. Sizes follow the scale of each project; the operator tasks that
// use the items can come with them. Nothing in the other project is changed.

/* the zone an item of another project sits in: designated, else the smallest zone round it */
function srcZoneOf(sp, o) {
  const zones = sp.areas.filter((a) => a.level !== "line");
  const set = o.area && zones.find((a) => a.id === o.area);
  if (set) return set;
  let best = null,
    bs = Infinity;
  for (const a of zones)
    if (ptInPoly(o, a.pts)) {
      const s = polySize(a.pts);
      if (s < bs) {
        bs = s;
        best = a;
      }
    }
  return best;
}
const srcStandard = (sp) =>
  sp.sheets.find((s) => s.kind === "standard") || sp.sheets[0];

/* the list of items to choose from, grouped by zone */
function bringListHTML(sp) {
  const sh = srcStandard(sp),
    items = sh.objects.filter((o) => o.kind === "item"),
    groups = new Map();
  items.forEach((o, i) => {
    const k = srcZoneOf(sp, o)?.name || "Not in a zone";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push([i, o]);
  });
  if (!items.length)
    return '<p class="empty">That project has no movable items on its standard layout.</p>';
  const used = (o) => sp.tasks.filter((t) => t.items.includes(o.ref)).length;
  return `<input type="search" id="bpSearch" placeholder="Search items" aria-label="Search items" style="margin:4px 0">
    <div class="btns" style="margin:0 0 4px"><button type="button" id="bpAll">Tick all</button><button type="button" id="bpNone">Clear</button></div>
    <div class="itpick" id="bpList">${[...groups]
      .sort(
        (a, b) =>
          (a[0] === "Not in a zone") - (b[0] === "Not in a zone") ||
          a[0].localeCompare(b[0]),
      )
      .map(
        ([k, list]) =>
          `<label class="chk itrow" style="font-weight:700;margin-top:4px"><input type="checkbox" data-bpgrp="${esc(k)}">${esc(k)}<small>${list.length}</small></label>${list
            .sort((a, b) => a[1].label.localeCompare(b[1].label))
            .map(
              ([i, o]) =>
                `<label class="chk itrow" data-bplabel="${esc(o.label.toLowerCase())}"><input type="checkbox" name="it:${i}" data-bpin="${esc(k)}">${esc(o.label)}<small>${used(o) ? used(o) + " task" + (used(o) > 1 ? "s" : "") : ""}</small></label>`,
            )
            .join("")}`,
      )
      .join("")}</div>`;
}

async function bringItemsDialog() {
  const target = S();
  if (target.kind === "daily")
    return toast(
      "Open the standard or a proposal first. A daily check is a copy of the standard.",
    );
  const others = IDX.list.filter((e) => e.id !== PID);
  if (!others.length)
    return toast(
      "There is no other project in My projects yet. Open or copy one first (the person icon, top right).",
    );
  let src = null,
    srcName = "";
  const onStd = target.kind === "standard";
  const r = await modal(
    "Bring items from another project",
    `<label class="f">From project<select id="bpPid"><option value="">Choose a project…</option>${others.map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("")}</select></label>
    <div id="bpBody"><p class="small muted">Pick a project to see its items. Nothing in it is changed.</p></div>
    <h3>Where to put them</h3>
    <label class="chk"><input type="radio" name="place" value="mid" checked> Together in the middle of ${scopeArea() ? "the zone being shown" : "the view"}, keeping how they sit relative to each other</label>
    <label class="chk"><input type="radio" name="place" value="same"> At the same positions as in that project (use when both use the same factory plan)</label>
    ${onStd ? '<label class="chk"><input type="checkbox" name="tasks" checked> Also bring the operator tasks that use them</label>' : '<p class="small muted">Operator tasks come only when you bring items to the standard.</p>'}`,
    "Bring in",
    {
      cls: "mid",
      onOpen: (d) => {
        $("#bpPid").onchange = async (e) => {
          src = null;
          const id = e.target.value,
            body = $("#bpBody");
          if (!id) {
            body.innerHTML =
              '<p class="small muted">Pick a project to see its items.</p>';
            return;
          }
          body.innerHTML = '<p class="small muted">Loading…</p>';
          try {
            const got = await readProject(id);
            if (!got) throw Error("missing");
            src = got.P;
            srcName = IDX.list.find((x) => x.id === id)?.name || "";
            body.innerHTML = bringListHTML(src);
          } catch {
            body.innerHTML =
              '<p class="empty">That project could not be read, so nothing can be brought from it.</p>';
          }
        };
        d.addEventListener("input", (e) => {
          const g = e.target.dataset?.bpgrp;
          if (g != null)
            d.querySelectorAll("[data-bpin]").forEach((c) => {
              if (c.dataset.bpin === g && !c.closest("[hidden]"))
                c.checked = e.target.checked;
            });
          if (e.target.id === "bpSearch") {
            const q = e.target.value.trim().toLowerCase();
            d.querySelectorAll("[data-bplabel]").forEach(
              (l) => (l.hidden = !!q && !l.dataset.bplabel.includes(q)),
            );
          }
        });
        d.addEventListener("click", (e) => {
          if (e.target.id === "bpAll" || e.target.id === "bpNone")
            d.querySelectorAll("#bpList input[type=checkbox]").forEach(
              (c) =>
                !c.closest("[hidden]") && (c.checked = e.target.id === "bpAll"),
            );
        });
      },
    },
  );
  if (!r || !src) return;
  const sh = srcStandard(src),
    items = sh.objects.filter((o) => o.kind === "item"),
    chosen = Object.keys(r)
      .filter((k) => k.startsWith("it:") && r[k])
      .map((k) => items[Number(k.slice(3))])
      .filter(Boolean);
  if (!chosen.length) return toast("No items were ticked.");
  const out = bringItems(src, chosen, {
    place: r.place,
    tasks: onStd && r.tasks,
    name: srcName,
  });
  toast(
    `Brought in ${out.items} item${out.items === 1 ? "" : "s"}${out.tasks ? " and " + out.tasks + " task" + (out.tasks === 1 ? "" : "s") : ""} from ${srcName}.`,
    5000,
  );
}

/* put copies of `chosen` (items of project `sp`) on the open sheet; returns what was added */
function bringItems(sp, chosen, o) {
  const sh = S(),
    srcSheet = srcStandard(sp),
    srcMpu = sp.drawings[srcSheet.drawing]?.mpu,
    dstMpu = mpu(sh),
    // sizes follow each project's own scale, so a 1.2 m rack stays 1.2 m
    f = srcMpu && dstMpu ? srcMpu / dstMpu : 1;
  let cx = 0,
    cy = 0,
    tx = 0,
    ty = 0;
  if (o.place === "mid") {
    cx = chosen.reduce((s, i) => s + i.x, 0) / chosen.length;
    cy = chosen.reduce((s, i) => s + i.y, 0) / chosen.length;
    const A = scopeArea(),
      c = A ? areaCentre(A) : viewCentre();
    tx = c.x;
    ty = c.y;
  }
  checkpoint();
  // categories: same id, else same name, else the category comes along
  const catOf = (it) => {
    const c = sp.itemCategories.find((x) => x.id === it.category);
    if (!c) return it.category;
    if (P.itemCategories.some((x) => x.id === c.id)) return c.id;
    const byName = P.itemCategories.find(
      (x) => x.name.toLowerCase() === c.name.toLowerCase(),
    );
    if (byName) return byName.id;
    P.itemCategories.push({ ...c });
    return c.id;
  };
  const refMap = new Map(),
    ids = [];
  for (const it of chosen) {
    const id = uid(),
      n = {
        ...clone(it),
        id,
        ref: id,
        locked: false,
        area: "", // zones are different in this project
        fpLaid: false,
        category: catOf(it),
        w: it.w * f,
        h: it.h * f,
        x: o.place === "mid" ? tx + (it.x - cx) * f : it.x,
        y: o.place === "mid" ? ty + (it.y - cy) * f : it.y,
      };
    if (sh.kind === "daily") n.fp = false;
    sh.objects.push(n);
    refMap.set(it.ref, id);
    ids.push(id);
  }
  // operator tasks that use the items, with their items pointed at the new copies
  let tasks = 0;
  if (o.tasks)
    for (const t of sp.tasks) {
      const mine = t.items.map((r) => refMap.get(r)).filter(Boolean);
      if (!mine.length) continue;
      const zoneName = sp.areas.find((a) => a.id === t.zone)?.name,
        zone = P.areas.find(
          (a) => a.level !== "line" && zoneName && a.name === zoneName,
        );
      P.tasks.push({
        ...clone(t),
        id: uid(),
        no: ++P.counters.task,
        zone: zone?.id || "",
        items: mine,
        doc: "", // documents are not brought across
        at: null, // where it was done is on the other project's drawing
      });
      tasks++;
    }
  ui.sel = ids;
  ui.tab = "item";
  record(
    "Brought in",
    `${ids.length} item(s) from ${o.name || "another project"}`,
  );
  renderAll();
  return { items: ids.length, tasks };
}
$("#bFromProject").onclick = bringItemsDialog;
