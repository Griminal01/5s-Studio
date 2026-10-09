"use strict";
/* ============ small UI helpers ============ */
function toast(t, ms = 3200) {
  const el = $("#toast");
  el.textContent = t;
  el.style.display = "block";
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.style.display = "none"), ms);
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
  c.querySelectorAll("button, select, input, .filters, .dctl, .btns").forEach(
    (n) => n.remove(),
  );
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

// Only the dialog's own OK and Cancel may close it. A button inside the body
// (tabs, row actions) is inside the form, so it would otherwise submit it.
$("#dlgForm").addEventListener("submit", (e) => {
  const s = e.submitter;
  if (s && s.id !== "dlgOk" && s.id !== "dlgCancel") e.preventDefault();
});
