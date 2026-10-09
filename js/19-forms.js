"use strict";
/* ============ red tag form ============ */
function renderTagPhotos() {
  const d = ui.tagDraft,
    el = $("#tagPh");
  if (!el || !d) return;
  el.innerHTML = d.photos.length
    ? `<div class="tph">${d.photos.map((p) => (PH[p.id] ? `<div><img src="${esc(PH[p.id])}" alt="Photo of the tagged item"><button type="button" data-rm="${esc(p.id)}" title="Remove photo" aria-label="Remove photo">×</button></div>` : "")).join("")}</div>`
    : "";
  el.querySelectorAll("[data-rm]").forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.rm;
        d.photos = d.photos.filter((p) => p.id !== id);
        if (d._added.includes(id)) {
          d._added = d._added.filter((x) => x !== id);
          delete PH[id];
        } else d._removed.push(id);
        renderTagPhotos();
      }),
  );
}
async function tagModal(t, isNew) {
  const draft = clone(t);
  draft._added = [];
  draft._removed = [];
  ui.tagDraft = draft;
  let after = "",
    del = false;
  const html = `<div class="row2"><label class="f">What is it<input name="title" required value="${esc(t.title)}" placeholder="e.g. Spare film reel core"></label><label class="f">Category<select name="cat">${opts(TAG_CATS, t.cat)}</select></label></div>
    <label class="f">Why is it tagged<textarea name="reason" rows="2" placeholder="Not used on this line, no home, leaking, damaged">${esc(t.reason)}</textarea></label>
    <div class="row2"><label class="f">What happens to it<select name="disp">${opts(TAG_DISP, t.disp)}</select></label><label class="f">Status<select name="status">${opts(TAG_ST, t.status)}</select></label></div>
    <div class="row3"><label class="f">Owner<input name="owner" list="owners" value="${esc(t.owner)}"></label><label class="f">Decide by<input name="due" type="date" value="${esc(t.due)}"></label><label class="f">Closed on<input name="closed" type="date" value="${esc(t.closed)}"></label></div>
    <div class="row2"><label class="f">Raised on<input name="raised" type="date" value="${esc(t.raised)}"></label><label class="f">Raised by<input name="by" list="owners" value="${esc(t.by)}"></label></div>
    <label class="f">Notes<textarea name="note" rows="2">${esc(t.note)}</textarea></label>
    <div id="tagPh"></div><div class="btns"><button type="button" id="tagAddPh">Add photos</button><input type="file" id="tagPhIn" accept="image/*" multiple hidden></div>
    <p class="pinfo">${t.x != null ? `Pinned on the layout${sheetLabel(t.sheet) ? " (" + esc(sheetLabel(t.sheet)) + ")" : ""}. Drag the pin to move it. <button type="button" id="tagShow">Show on layout</button>` : `Not pinned to the drawing. <button type="button" id="tagPin">Pin it on the layout</button>`}</p>
    ${isNew ? "" : '<div class="btns"><button type="button" class="danger" id="tagDel">Delete this tag</button></div>'}${ownerList()}`;
  const r = await modal(
    isNew ? "New red tag" : tagNo(t) + " red tag",
    html,
    isNew ? "Raise tag" : "Save",
    {
      cls: "mid",
      onOpen: (d) => {
        renderTagPhotos();
        $("#tagAddPh").onclick = () => $("#tagPhIn").click();
        $("#tagPhIn").onchange = async () => {
          const fs = [...$("#tagPhIn").files];
          $("#tagPhIn").value = "";
          for (const f of fs) {
            try {
              const id = uid();
              PH[id] = await shrink(f);
              draft.photos.push({ id, cap: "" });
              draft._added.push(id);
            } catch {}
          }
          dirtyImg = true;
          renderTagPhotos();
        };
        $("#tagPin") &&
          ($("#tagPin").onclick = () => {
            after = "pin";
            $("#dlgOk").click();
          });
        $("#tagShow") &&
          ($("#tagShow").onclick = () => {
            after = "show";
            $("#dlgOk").click();
          });
        $("#tagDel") &&
          ($("#tagDel").onclick = () => {
            del = true;
            d.close("cancel");
          });
      },
    },
  );
  const drop = (ids) => {
    for (const id of ids) delete PH[id];
  };
  if (del) {
    drop(draft._added);
    ui.tagDraft = null;
    const q = await modal(
      "Delete " + tagNo(t) + "?",
      '<p style="margin-top:0">The tag and its photos will be removed. You can undo straight after.</p>',
      "Delete",
    );
    if (q) {
      checkpoint();
      P.tags = P.tags.filter((x) => x.id !== t.id);
      drop(t.photos.map((p) => p.id));
      record("Red tag deleted", tagNo(t) + " " + t.title);
      dirtyImg = true;
      renderAll();
    }
    return;
  }
  if (!r) {
    drop(draft._added);
    ui.tagDraft = null;
    return;
  }
  checkpoint(); // before dropping removed photos, so undo can bring them back
  drop(draft._removed);
  const closed = r.status === "Closed";
  Object.assign(t, {
    title: r.title.trim() || t.title,
    cat: r.cat,
    reason: r.reason.trim(),
    disp: r.disp,
    status: r.status,
    owner: r.owner.trim(),
    due: r.due,
    raised: r.raised || today(),
    by: r.by.trim(),
    note: r.note.trim(),
    closed: closed ? r.closed || today() : "",
    photos: draft.photos,
  });
  if (isNew) {
    t.no = ++P.counters.tag;
    P.tags.push(t);
  }
  record(
    isNew ? "Red tag raised" : "Red tag updated",
    tagNo(t) + " " + t.title,
  );
  dirtyImg = true;
  ui.tagDraft = null;
  renderAll();
  if (after === "pin") startPinning("tag", t.id);
  else if (after === "show") showOnLayout(t);
}

/* ============ action form ============ */
async function actionModal(a, isNew) {
  let after = "",
    del = false;
  const s5opts = optsKV([["", "None"], ...S5.map((x) => [x[0], x[1]])], a.s5);
  const html = `<label class="f">What needs doing<input name="title" required value="${esc(a.title)}" placeholder="e.g. Mark a home for the film reel trolley"></label>
    <div class="row3"><label class="f">Owner<input name="owner" list="owners" value="${esc(a.owner)}"></label><label class="f">Due<input name="due" type="date" value="${esc(a.due)}"></label><label class="f">Priority<select name="pri">${opts(ACT_PRI, a.pri)}</select></label></div>
    <div class="row3"><label class="f">Status<select name="status">${opts(ACT_ST, a.status)}</select></label><label class="f">Done on<input name="done" type="date" value="${esc(a.done)}"></label><label class="f">5S step<select name="s5">${s5opts}</select></label></div>
    <div class="row3"><label class="f">Raised on<input name="raised" type="date" value="${esc(a.raised)}"></label><label class="f">From sheet<select name="sheet">${optsKV([["", "Not linked"], ...P.sheets.map((s) => [s.id, s.name])], a.sheet)}</select></label><label class="f">Linked red tag<select name="tag">${optsKV([["", "None"], ...P.tags.map((t) => [t.id, tagNo(t) + " " + t.title])], a.tag)}</select></label></div>
    <label class="f">Notes<textarea name="note" rows="2">${esc(a.note)}</textarea></label>
    ${a.prob && P.problems.find((x) => x.id === a.prob) ? `<p class="small muted">A countermeasure for ${esc(probNo(P.problems.find((x) => x.id === a.prob)))} ${esc(P.problems.find((x) => x.id === a.prob).title)}.</p>` : ""}
    <p class="pinfo">${a.x != null ? `Pinned on the layout. Drag the pin to move it. <button type="button" id="actShow">Show on layout</button>` : `Not pinned to the drawing. <button type="button" id="actPin">Pin it on the layout</button>`}</p>
    ${isNew ? "" : '<div class="btns"><button type="button" class="danger" id="actDel">Delete this action</button></div>'}${ownerList()}`;
  const r = await modal(
    isNew ? "New action" : actNo(a) + " action",
    html,
    isNew ? "Add action" : "Save",
    {
      cls: "mid",
      onOpen: (d) => {
        $("#actPin") &&
          ($("#actPin").onclick = () => {
            after = "pin";
            $("#dlgOk").click();
          });
        $("#actShow") &&
          ($("#actShow").onclick = () => {
            after = "show";
            $("#dlgOk").click();
          });
        $("#actDel") &&
          ($("#actDel").onclick = () => {
            del = true;
            d.close("cancel");
          });
      },
    },
  );
  if (del) {
    const q = await modal(
      "Delete " + actNo(a) + "?",
      '<p style="margin-top:0">This action will be removed. You can undo straight after.</p>',
      "Delete",
    );
    if (q) {
      checkpoint();
      P.actions = P.actions.filter((x) => x.id !== a.id);
      record("Action deleted", actNo(a) + " " + a.title);
      renderAll();
    }
    return;
  }
  if (!r) return;
  checkpoint();
  const fin = ["Done", "Cancelled"].includes(r.status);
  Object.assign(a, {
    title: r.title.trim() || a.title,
    owner: r.owner.trim(),
    due: r.due,
    pri: r.pri,
    status: r.status,
    s5: r.s5,
    raised: r.raised || today(),
    sheet: r.sheet,
    tag: r.tag,
    note: r.note.trim(),
    done: fin ? r.done || today() : "",
  });
  if (isNew) {
    a.no = ++P.counters.act;
    P.actions.push(a);
  }
  record(isNew ? "Action added" : "Action updated", actNo(a) + " " + a.title);
  renderAll();
  if (after === "pin") startPinning("act", a.id);
  else if (after === "show") showOnLayout(a);
}
async function linesToActions() {
  const sh = S(),
    lines = sh.actions
      .split(/\n+/)
      .map((s) => s.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s+/, "").trim())
      .filter(Boolean);
  if (!lines.length) return;
  const r = await modal(
    "Turn notes into logged actions?",
    `<p style="margin-top:0">${lines.length} action${lines.length > 1 ? "s" : ""} will be created from this sheet with no owner or due date. Add those in the Actions view.</p><ul class="small">${lines
      .slice(0, 8)
      .map((l) => `<li>${esc(l)}</li>`)
      .join("")}${lines.length > 8 ? "<li>and more</li>" : ""}</ul>`,
    "Create actions",
  );
  if (!r) return;
  checkpoint();
  for (const l of lines) {
    const a = blankAct({ title: l, sheet: sh.id });
    a.no = ++P.counters.act;
    P.actions.push(a);
  }
  sh.actions = "";
  record("Actions logged", lines.length + " from notes");
  renderAll();
}
