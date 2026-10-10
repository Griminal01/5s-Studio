"use strict";
/* ============ small UI helpers ============
   Dialogs and output: toast() (optionally with a button, e.g. Undo after a delete: offerUndo()),
   flashRow() (a saved row lights up), modal() (fresh body each time; Enter never submits), download(),
   csv(), printWithPage() which every print goes through, printView(). */
// action: { label, run } adds a button to the message (Undo after a delete)
function toast(t, ms = 3200, action) {
  const el = $("#toast");
  el.textContent = t;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = action.label;
    b.onclick = () => {
      hideToast();
      action.run();
    };
    el.append(b);
  }
  toast.text = t;
  toast.n = (toast.n || 0) + 1;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(hideToast, ms);
}
function hideToast() {
  $("#toast").classList.remove("show");
}
// after a delete: say what went and offer Undo, while nothing else has changed since
const UNDO_AFTER =
  /^(Deleted|(Red tag|Action|Document|Idea|Problem|Task|Sheet) deleted)$/;
function offerUndo(action, detail) {
  const n = toast.n || 0,
    depth = undoS.length;
  setTimeout(() => {
    if ($("#dlg").open || !depth) return;
    // a message shown by the delete itself (a warning) keeps its words and gains the button
    const said =
      (toast.n || 0) !== n
        ? toast.text
        : action + (detail ? ": " + String(detail).slice(0, 70) : "");
    toast(said, 7000, {
      label: "Undo",
      run: () =>
        undoS.length === depth
          ? restore(undoS, redoS)
          : toast("Something has changed since. Use Undo at the top instead."),
    });
  }, 0);
}
// light up a register row that was just saved, so the eye finds it
function flashRow(id) {
  setTimeout(() => {
    const q = CSS.escape(id),
      row = document.querySelector(
        ["tag", "actid", "docid", "taskid", "ideaid", "ps-open"]
          .map((a) => `main:not([hidden]) tr[data-${a}="${q}"]`)
          .join(","),
      );
    if (!row) return;
    row.classList.remove("flash");
    void row.offsetWidth; // restart the animation if it is already lit
    row.classList.add("flash");
  }, 0);
}
function modal(title, html, ok = "OK", opts = {}) {
  return new Promise((res) => {
    const d = $("#dlg");
    d.className = opts.cls || (opts.wide ? "wide" : "");
    $("#dlgTitle").textContent = title;
    // a fresh body each time, so listeners added by an earlier dialog cannot fire in this one
    const old = $("#dlgBody"),
      fresh = old.cloneNode(false);
    old.replaceWith(fresh);
    fresh.innerHTML = html;
    $("#dlgOk").textContent = ok;
    $("#dlgOk").hidden = !ok;
    $("#dlgCancel").textContent = opts.cancel || "Cancel";
    const done = () => {
      d.removeEventListener("close", done);
      if (d.returnValue !== "ok") return res(null);
      const out = {};
      for (const el of $("#dlgBody").querySelectorAll("[name]")) {
        if (el.type === "radio") {
          if (el.checked) out[el.name] = el.value;
        } else out[el.name] = el.type === "checkbox" ? el.checked : el.value;
      }
      res(out);
    };
    d.addEventListener("close", done);
    d.returnValue = "";
    for (const m of $$("details.menu[open]")) m.open = false;
    d.showModal();
    opts.onOpen?.(d);
    const f = $("#dlgBody").querySelector("input,select,textarea");
    if (f) f.focus();
  });
}
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function csv(rows, name) {
  const q = (v) => {
    let text = String(v ?? "");
    if (typeof v === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  download(
    new Blob(["\ufeff" + rows.map((r) => r.map(q).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
    name,
  );
}
const fileSafe = (s) =>
  String(s)
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 60);

/* every printed document goes through here: one page size per print, cleaned up afterwards */
function printWithPage(html, cls, pageCss) {
  const box = $("#printDoc");
  box.className = cls || "";
  box.innerHTML = html;
  let st = $("#pageStyle");
  if (!st) {
    st = document.createElement("style");
    st.id = "pageStyle";
    document.head.append(st);
  }
  st.textContent = pageCss ? `@media print{@page{${pageCss}}}` : "";
  document.body.classList.add("printing-doc");
  setTimeout(() => window.print(), 80);
}

/* print what a view shows (registers, Tracking) without its buttons and filters */
function printView(el, pageCss = "size: A4 landscape; margin: 10mm") {
  const c = el.cloneNode(true);
  c.querySelectorAll(
    "button:not(.irow), select, input, .filters, .dctl, .btns",
  ).forEach((n) => n.remove());
  printWithPage(
    `<div class="pd pdview"><p class="pdm">${esc(P.projectName || "Lean Studio project")}, printed ${esc(fmtD(today()))}</p>${c.innerHTML}</div>`,
    "",
    pageCss,
  );
}

// Enter in a text field would submit the dialog form with its first button,
// which is Cancel, and throw away what was typed. Stop that everywhere.
$("#dlgForm").addEventListener("keydown", (e) => {
  if (
    e.key === "Enter" &&
    e.target.tagName === "INPUT" &&
    !["button", "submit", "checkbox", "radio"].includes(e.target.type)
  )
    e.preventDefault();
});

// the ✕ closes like Esc: no answer (not Cancel, which some dialogs read as a choice)
$("#dlgX").onclick = () => $("#dlg").close();

// Only the dialog's own OK and Cancel may close it. A button inside the body
// (tabs, row actions) is inside the form, so it would otherwise submit it.
$("#dlgForm").addEventListener("submit", (e) => {
  const s = e.submitter;
  if (s && s.id !== "dlgOk" && s.id !== "dlgCancel") e.preventDefault();
});
