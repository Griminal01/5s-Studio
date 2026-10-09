"use strict";
/* ============ sheets ============ */
const dailies = () =>
  P.sheets
    .filter((s) => s.kind === "daily")
    .sort(
      (a, b) =>
        (a.date || "").localeCompare(b.date || "") ||
        (a.shift || "").localeCompare(b.shift || ""),
    );
function openSheet(id) {
  if (id === P.active) return;
  const prevD = S().drawing;
  P.active = id;
  ui.sel = [];
  ui.draft = null;
  if (S().drawing !== prevD) ui.vb = null;
  renderAll();
}
async function newDaily() {
  const std = STD(),
    last = dailies().at(-1);
  const r = await modal(
    "Start a daily check",
    `<div class="row2"><label class="f">Date<input name="date" type="date" value="${today()}"></label><label class="f">Shift<input name="shift" list="shiftList" placeholder="Days"></label></div>
    <datalist id="shiftList"><option>Days</option><option>Nights</option><option>AM</option><option>PM</option></datalist>
    <label class="f">Checked by<input name="checker" value="${esc(lastChecker())}"></label>
    <label class="f">Start from<select name="from"><option value="std">The standard (then move what is different)</option>${last ? `<option value="last">Last check, ${esc(fmtDate(last.date))}</option>` : ""}</select></label>
    <p class="small muted">On the drawing: drag anything that is somewhere else to where it actually is, delete what is missing, and add anything that should not be there. The Check tab scores it as you go.</p>`,
    "Start check",
  );
  if (!r) return;
  checkpoint();
  const src = r.from === "last" && last ? last : std,
    s = blankSheet("daily", "", std.drawing);
  s.date = r.date || today();
  s.shift = r.shift.trim();
  s.checker = r.checker.trim();
  s.name = "Check " + fmtDate(s.date) + (s.shift ? " " + s.shift : "");
  s.objects = src.objects.map((o) => ({ ...clone(o), id: uid() }));
  s.marks = src.marks.map((m) => {
    const n = { ...clone(m), id: uid() };
    if (src !== last && n.status === "worn") n.status = "laid";
    n.damaged = n.status === "worn";
    return n;
  });
  s.rev = stdRev();
  P.sheets.push(s);
  P.active = s.id;
  ui.sel = [];
  ui.cmp = "auto";
  ui.tab = "check";
  record("Daily check started", s.name);
  renderAll();
  requestAnimationFrame(() =>
    $(".chip.on")?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
    }),
  );
}
async function newProposal() {
  const cur = S();
  const r = await modal(
    "New proposal",
    `<label class="f">Name<input name="name" value="Proposal ${P.sheets.filter((s) => s.kind === "proposal").length + 1}"></label>
    <label class="f">Start from<select name="from"><option value="std">The standard</option>${cur.kind !== "standard" ? `<option value="cur">This sheet (${esc(cur.name)})</option>` : ""}<option value="blank">Empty drawing</option></select></label>
    <p class="small muted">Try out a different layout here and compare it with the standard. When it is agreed, use Sheet, Make this the standard.</p>`,
    "Create",
  );
  if (!r) return;
  checkpoint();
  const src = r.from === "cur" ? cur : r.from === "std" ? STD() : null,
    s = blankSheet(
      "proposal",
      r.name.trim() || "Proposal",
      (src || STD()).drawing,
    );
  if (src) {
    s.objects = src.objects.map((o) => ({ ...clone(o), id: uid() }));
    s.marks = src.marks.map((m) => {
      const n = { ...clone(m), id: uid() };
      if (n.status === "worn") n.status = "laid";
      n.damaged = false;
      return n;
    });
    s.routes = src.routes.map((x) => ({ ...clone(x), id: uid() }));
  }
  P.sheets.push(s);
  P.active = s.id;
  ui.sel = [];
  ui.cmp = "auto";
  record("Proposal created", s.name);
  renderAll();
}
async function makeStandard() {
  const s = S(),
    old = STD();
  if (s.kind !== "proposal") return;
  const r = await modal(
    "Make this the standard?",
    `<p style="margin-top:0">New daily checks will be scored against <b>${esc(s.name)}</b>. Past checks keep the standard they were scored against; each can be re-scored on its Compare tab.</p><p class="small muted">The current standard is kept as a proposal called “${esc(old.name)} (previous)”.</p>`,
    "Make standard",
  );
  if (!r) return;
  checkpoint();
  old.kind = "proposal";
  old.name += " (previous)";
  s.kind = "standard";
  record("New standard", s.name);
  renderAll();
}
async function deleteSheet() {
  const s = S();
  if (s.kind === "standard") {
    toast(
      "The standard cannot be deleted. Make another sheet the standard first.",
    );
    return;
  }
  const r = await modal(
    "Delete this sheet?",
    `<p style="margin-top:0">${esc(s.name)} will be removed. You can undo straight after.</p>`,
    "Delete",
  );
  if (!r) return;
  checkpoint();
  if (ui.cmp === s.id) ui.cmp = "auto";
  P.sheets = P.sheets.filter((x) => x !== s);
  pruneRevisions();
  P.active = STD().id;
  ui.sel = [];
  record("Sheet deleted", s.name);
  renderAll();
}
