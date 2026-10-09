"use strict";
/* ============ shared helpers ============ */
const owners = () =>
  [
    ...new Set(
      [
        ...P.tags.map((t) => t.owner),
        ...P.actions.map((a) => a.owner),
        ...P.documents.map((d) => d.owner),
        ...P.tags.map((t) => t.by),
        ...P.sheets.map((s) => s.checker),
      ]
        .map((s) => String(s || "").trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
const ownerList = () =>
  `<datalist id="owners">${owners()
    .map((o) => `<option value="${esc(o)}">`)
    .join("")}</datalist>`;
const opts = (arr, cur) =>
  arr
    .map((v) => `<option${v === cur ? " selected" : ""}>${esc(v)}</option>`)
    .join("");
const optsKV = (pairs, cur) =>
  pairs
    .map(
      ([v, l]) =>
        `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`,
    )
    .join("");
const lastChecker = () =>
  dailies()
    .map((d) => d.checker)
    .filter(Boolean)
    .at(-1) || "";
const blankTag = (i) => ({
  id: uid(),
  no: 0,
  title: i.title || "",
  cat: TAG_CATS[0],
  reason: "",
  disp: TAG_DISP[0],
  owner: "",
  due: "",
  status: "Open",
  raised: today(),
  by: lastChecker(),
  closed: "",
  note: "",
  sheet: i.sheet || "",
  drawing: i.drawing || "",
  ref: i.ref || "",
  x: i.x ?? null,
  y: i.y ?? null,
  photos: [],
});
const blankAct = (i) => ({
  id: uid(),
  no: 0,
  title: i.title || "",
  s5: i.s5 || "",
  pri: "Medium",
  owner: "",
  due: "",
  status: "Open",
  raised: today(),
  done: "",
  note: "",
  sheet: i.sheet || "",
  source: i.source || "",
  tag: i.tag || "",
  drawing: i.drawing || "",
  x: i.x ?? null,
  y: i.y ?? null,
});
const newTag = (i) => tagModal(blankTag(i || {}), true),
  editTag = (id) => {
    const t = P.tags.find((x) => x.id === id);
    if (t) tagModal(t, false);
  };
const newAction = (i) => actionModal(blankAct(i || {}), true),
  editAction = (id) => {
    const a = P.actions.find((x) => x.id === id);
    if (a) actionModal(a, false);
  };
const sheetLabel = (id) => {
  const s = P.sheets.find((x) => x.id === id);
  return s ? s.name : "";
};
