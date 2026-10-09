"use strict";
/* ============ actions ============
   What the layout buttons do: addItem() drops a library item, act(a, el) handles the layout side panel's
   data-a="..." buttons (routed from 11-side-panel) and the dup / del / rot90 shortcuts, setField() edits a selected item. */
function addItem(def, at) {
  const sh = S(),
    u = upm(sh),
    id = uid();
  let auto = !at;
  if (!at) at = viewCentre();
  let x = snapV(at.x, sh),
    y = snapV(at.y, sh);
  const step = Math.max(def.w, def.h) * u * 0.7;
  for (
    let n = 0;
    auto &&
    n < 30 &&
    sh.objects.some((o) => Math.hypot(o.x - x, o.y - y) < step * 0.5);
    n++
  ) {
    x = snapV(x + step, sh);
    y = snapV(y + step * 0.4, sh);
  }
  const o = {
    id,
    ref: id,
    type: def.n,
    label: def.n,
    kind: def.k || "item",
    x,
    y,
    w: def.w * u,
    h: def.h * u,
    a: 0,
    c: def.c || "#202C86",
    fp: (def.k || "item") === "item" && sh.kind !== "daily",
    locked: false,
    note: "",
  };
  if (o.kind === "item") {
    o.category = itemCategoryId(o);
    const category = P.itemCategories.find((c) => c.id === o.category);
    if (category?.c) o.c = category.c;
  }
  checkpoint();
  // working on one zone: a new item lands inside it (the middle of it if the view's centre is outside)
  const A = scopeArea();
  if (A && !scopeObj(o, A)) {
    const c = areaCentre(A);
    o.x = snapV(c.x, sh);
    o.y = snapV(c.y, sh);
  }
  sh.objects.push(o);
  ui.sel = [id];
  ui.tab = "item";
  if (ui.tool !== "select") setTool("select");
  record("Added", o.label);
  renderAll();
}
function act(a, el) {
  const sh = S(),
    sel = selected();
  switch (a) {
    case "del": {
      if (!sel.length) return;
      const live = sel.filter((f) => !f.x.locked);
      if (!live.length) {
        toast("Unlock it first.");
        return;
      }
      checkpoint();
      const names = [];
      for (const f of live) {
        f.arr.splice(f.arr.indexOf(f.x), 1);
        if (f.t === "area") {
          if (ui.scope === f.x.id) {
            ui.scope = "";
            ui.vb = null;
          }
          if (isLine(f.x))
            for (const z of P.areas) if (z.parent === f.x.id) z.parent = "";
          releaseArea(f.x.id);
          for (const t of P.tasks) if (t.zone === f.x.id) t.zone = "";
          for (const pr of P.problems) if (pr.area === f.x.id) pr.area = "";
        }
        names.push(f.x.label || f.x.name || TAPE[f.x.type]?.n);
      }
      const miss =
        sh.kind === "daily" &&
        live.some(
          (f) =>
            f.t === "obj" &&
            f.x.kind === "item" &&
            stdFor(sh).objects.some((r) => r.ref === f.x.ref),
        );
      record(miss ? "Marked missing" : "Deleted", names.join(", "));
      if (miss) toast("Marked missing. Click its red outline to put it back.");
      else if (sh.kind === "standard") {
        // documents point at items in the standard: say when that link is lost
        const refs = new Set(
            live.filter((f) => f.t === "obj").map((f) => f.x.ref),
          ),
          nd = P.documents.filter((d) => refs.has(d.holder)).length;
        if (nd)
          toast(
            `${nd} document${nd > 1 ? "s were" : " was"} kept here and ${nd > 1 ? "are" : "is"} now unlinked. Undo (Ctrl+Z) to put it back.`,
            7000,
          );
      }
      ui.sel = [];
      renderAll();
      break;
    }
    case "dup": {
      if (!sel.length) return;
      checkpoint();
      const off = mpu() ? 0.5 / mpu() : 4,
        ids = [];
      for (const f of sel) {
        const n = clone(f.x);
        n.id = n.ref = uid();
        n.locked = false;
        if (f.t === "obj") {
          n.x += off;
          n.y += off;
        } else n.pts = n.pts.map((p) => ({ x: p.x + off, y: p.y + off }));
        if (f.t === "area") {
          n.no = ++P.counters[isLine(f.x) ? "line" : "area"];
          n.name = f.x.name + " copy";
        }
        f.arr.push(n);
        ids.push(n.id);
      }
      ui.sel = ids;
      record("Duplicated", ids.length + " item(s)");
      widenIfOutside(ids);
      renderAll();
      break;
    }
    case "lock": {
      const objs = sel.filter((f) => f.t === "obj" || f.t === "area");
      if (!objs.length) return;
      checkpoint();
      const v = !objs.every((f) => f.x.locked);
      objs.forEach((f) => (f.x.locked = v));
      record(
        v ? "Locked" : "Unlocked",
        objs.map((f) => f.x.label || f.x.name).join(", "),
      );
      renderAll();
      break;
    }
    case "rot90": {
      const objs = sel.filter((f) => f.t === "obj" && !f.x.locked);
      if (!objs.length) return;
      checkpoint();
      objs.forEach((f) => (f.x.a = (f.x.a + 90) % 360));
      record("Rotated", objs.map((f) => f.x.label).join(", "));
      renderAll();
      break;
    }
    case "back": {
      const f = sel[0],
        m = cmpCache?.moved.find((z) => z.o.id === f?.x.id);
      if (!m) return;
      checkpoint();
      Object.assign(f.x, { x: m.r.x, y: m.r.y, a: m.r.a });
      record("Moved back to standard", f.x.label);
      renderAll();
      break;
    }
    case "toStd": {
      const f = sel[0],
        std = STD();
      if (!f || !std || sh.kind === "standard") return;
      checkpoint();
      const n = clone(f.x);
      n.id = uid();
      n.fp = true;
      std.objects.push(n);
      record("Added to standard", f.x.label);
      toast(`${f.x.label} is now part of the standard.`);
      renderAll();
      break;
    }
    case "restoreAll": {
      const c = cmpCache;
      if (!c || !c.missing.length) return;
      checkpoint();
      for (const r of c.missing) sh.objects.push({ ...clone(r), id: uid() });
      record("Put back", c.missing.length + " items");
      renderAll();
      break;
    }
    case "goSetup":
      setView("setup");
      break;
    case "loadExample":
      loadExample();
      break;
    case "editMarking":
      markingModal();
      break;
    case "setDatum":
      setTool("datum");
      break;
    case "allLaid":
      markAllLaid();
      break;
    case "printMarking":
      printMarkingSheet();
      break;
    case "csvSchedule":
      csvSchedule();
      break;
    case "csvSetout":
      csvSetout();
      break;
    case "newDaily":
      newDaily();
      break;
    case "rescore": {
      if (sh.kind !== "daily") return;
      checkpoint();
      sh.rev = stdRev();
      pruneRevisions();
      record("Re-scored against current standard", sh.name);
      renderAll();
      break;
    }
    case "tagItem": {
      const f = sel[0];
      if (!f || f.t !== "obj") return;
      newTag({
        x: f.x.x,
        y: f.x.y,
        drawing: sh.drawing,
        sheet: sh.id,
        ref: f.x.ref,
        title: f.x.label,
      });
      break;
    }
    case "newAct":
      newAction({ sheet: sh.id });
      break;
    case "linesToActs":
      linesToActions();
      break;
    case "toolRoute":
      setTool("route");
      break;
    case "csvDev":
      csvDeviations();
      break;
    case "csvRoutes":
      csvRoutes();
      break;
    case "photo":
      $("#fPhoto").click();
      break;
    case "clearSel":
      ui.sel = [];
      draw();
      renderSide();
      break;
    case "align":
      alignSel(el?.dataset.id);
      break;
    default:
      areaAct(a, el);
  }
}
function restoreMissing(ref) {
  const sh = S(),
    r = cmpCache?.ref?.objects.find((o) => o.ref === ref);
  if (!r || sh.kind === "standard") return;
  checkpoint();
  const n = { ...clone(r), id: uid() };
  sh.objects.push(n);
  ui.sel = [n.id];
  ui.tab = "item";
  record("Put back", r.label);
  toast(`${r.label} put back on this sheet.`);
  renderAll();
}
function setField(f, v) {
  const sel = selected();
  if (sel.length !== 1) return;
  const { t, x } = sel[0];
  if (t === "obj" && x.locked && !["note"].includes(f)) {
    toast("Unlock it first.");
    renderSide();
    return;
  }
  if (f === "px" || f === "py") {
    const n = Number(v),
      dt = DM().datum;
    if (v === "" || !Number.isFinite(n)) {
      renderSide();
      return;
    }
    checkpoint();
    if (f === "px") x.x = (dt ? dt.x : 0) + fromUser(n);
    else x.y = (dt ? dt.y : 0) + fromUser(n);
    record("Placed", (x.label || "") + " at a typed position");
    renderAll();
    return;
  }
  let val = v;
  if (f === "w" || f === "h" || f === "th" || f === "fs" || f === "width") {
    const n = Number(v);
    if (!(n > 0)) {
      renderSide();
      return;
    }
    val = fromUser(n);
  } else if (f === "a") val = (((Number(v) || 0) % 360) + 360) % 360;
  else if (f === "freq") {
    val = Math.max(1, Math.round(Number(v)) || 30);
  } else if (f === "trips") {
    val = Math.max(0.1, Number(v) || 1);
  }
  if (t === "area" && f === "name" && !String(v).trim()) {
    renderSide();
    return;
  }
  checkpoint();
  if (f === "home") {
    x.fp = val !== "none";
    if (val !== "none") x.fpStyle = val;
  } else x[f] = val;
  if (f === "status") {
    x.damaged = val === "worn";
    x.laid =
      val === "laid" ? x.laid || today() : val === "planned" ? "" : x.laid;
  }
  if (x.t === "text" && (f === "label" || f === "fs")) {
    x.w = Math.max(1, String(x.label).length) * x.fs * 0.6;
    x.h = x.fs * 1.3;
  }
  record("Edited", (x.label || x.name || TAPE[x.type]?.n) + " (" + f + ")");
  renderAll();
}
