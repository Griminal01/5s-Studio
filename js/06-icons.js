"use strict";
/* ============ icons ============
   A small set of line icons (24 px grid, drawn in the text colour) and the one place that puts them
   on buttons: ICON_RULES matches a button's label ("Print", "Export CSV", "Delete this tag") to an
   icon, and every button that appears on the page gets its icon as it is added (a MutationObserver),
   so templates stay plain text. icon(name) gives the SVG for code that wants one directly.
   Left alone: the drawing tools (they have their own), the zoom bar, Present's controls, dialog
   OK / Cancel, tabs and filters. */
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  print:
    '<path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7" rx="1"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  folder:
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  sliders:
    '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  locate:
    '<circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  screen:
    '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  sheet:
    '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  paste:
    '<rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock:
    '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5M8 11h6M11 8v6"/>',
  camera:
    '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  all: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/>',
  open: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name) =>
  ICONS[name]
    ? `<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`
    : "";

// a button's label (its text, spaces tidied) to its icon; the first match wins
const ICON_RULES = [
  [/^Undo$/, "undo"],
  [/^Redo$/, "redo"],
  [/^(New|Add) (?!photos)|^Add a (type|task|cause)|^New$/, "plus"],
  [/^Add photos|^Add a plan image/, "camera"],
  [/^Export layout as image/, "image"],
  [/^Export|CSV\)?$|^Save project|^Download/, "download"],
  [/^Open a project/, "folder"],
  [/^Print/, "print"],
  [/^Settings$/, "sliders"],
  [/^Show$|^Show on (the )?(layout|map)|^Show the area|^Show in 5S/, "locate"],
  [/^Show only this/, "eye"],
  [/^Delete|^Remove(?! logo)/, "trash"],
  [/^Problem$|^Raise a problem/, "alert"],
  [/^Idea$|^Raise an idea/, "bulb"],
  [/^Pin\b|^Pin it/, "pin"],
  [/^Present$/, "screen"],
  [/^Edit drawing|^Edit walls/, "pencil"],
  [/^Layers$/, "layers"],
  [/^Sheet$/, "sheet"],
  [/^Rotate$/, "rotate"],
  [/^Duplicate$|^Copy$/, "copy"],
  [/^Paste$/, "paste"],
  [/^Lock$/, "lock"],
  [/^Unlock$/, "unlock"],
  [/^Red tag( here)?$/, "tag"],
  [/^Action here$/, "flag"],
  [/^Zoom( to it)?$/, "zoom"],
  [/^Fit the drawing$/, "fit"],
  [/^Select all$/, "all"],
  [/^Open$/, "open"],
  [/^Show the whole factory$/, "eye"],
];
// where buttons keep their own look: tools, zoom, Present, dialog answers, tabs and toggles
const ICON_SKIP =
  ".tools, .zoom, .prctl, #toast, .dlgx, #dlgOk, #dlgCancel, #gnav, #subnav, .tabbar, #tabs, .psteps, .psmode";
function iconize(root) {
  const els = root.matches?.("button, summary")
    ? [root]
    : [...(root.querySelectorAll?.("button, summary") || [])];
  for (const b of els) {
    if (b.dataset.ic || b.querySelector(".ic") || b.closest(ICON_SKIP))
      continue;
    // its words, without a shortcut shown beside them (<kbd> in the right-click menu)
    const label = [...b.childNodes]
        .filter((n) => n.nodeName !== "KBD")
        .map((n) => n.textContent)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      rule = ICON_RULES.find(([re]) => re.test(label));
    b.dataset.ic = rule ? rule[1] : "-";
    if (rule) {
      b.insertAdjacentHTML("afterbegin", icon(rule[1]));
      b.classList.add("hasic");
    }
  }
}
iconize(document.body);
new MutationObserver((list) => {
  for (const m of list) {
    for (const n of m.addedNodes) if (n.nodeType === 1) iconize(n);
    // a button whose words were replaced (Lock to Unlock) is looked at again
    const b = m.target.closest?.("button, summary");
    if (b && !b.querySelector(".ic")) {
      delete b.dataset.ic;
      iconize(b);
    }
  }
}).observe(document.body, { childList: true, subtree: true });
