"use strict";
/* ============ catalogue ============ */
/* floor marking standard: types are editable, TAPE is rebuilt from P.marking on every render */
const DEFAULT_TYPES = [
  {
    id: "walkway",
    name: "Walkway / aisle",
    c: "#FEC20F",
    c2: "",
    pattern: "solid",
    w: 50,
    use: "Edges of walkways and aisles",
  },
  {
    id: "equip",
    name: "Equipment & WIP",
    c: "#FFFFFF",
    c2: "",
    pattern: "solid",
    w: 50,
    use: "Homes for equipment, trolleys and work in progress",
  },
  {
    id: "raw",
    name: "Raw / packaging materials",
    c: "#2F6FD6",
    c2: "",
    pattern: "solid",
    w: 50,
    use: "Raw materials and packaging",
  },
  {
    id: "good",
    name: "Finished goods / QA OK",
    c: "#1F8A55",
    c2: "",
    pattern: "solid",
    w: 50,
    use: "Finished goods and released product",
  },
  {
    id: "red",
    name: "Red tag / reject / scrap",
    c: "#D3401D",
    c2: "",
    pattern: "solid",
    w: 50,
    use: "Red tag, reject and scrap areas",
  },
  {
    id: "hazard",
    name: "Hazard",
    c: "#FEC20F",
    c2: "#1C1C1C",
    pattern: "stripe",
    w: 50,
    use: "Hazards and trip points",
  },
  {
    id: "clear",
    name: "Keep clear",
    c: "#FFFFFF",
    c2: "#D3401D",
    pattern: "stripe",
    w: 50,
    use: "Fire, electrical and access clearance",
  },
];
const TAPE = {};
function edgeFor(t) {
  if (t.pattern === "stripe" && t.c2) return t.c2;
  const h = t.c.replace("#", ""),
    lum =
      (parseInt(h.slice(0, 2), 16) * 299 +
        parseInt(h.slice(2, 4), 16) * 587 +
        parseInt(h.slice(4, 6), 16) * 114) /
      1000;
  return lum > 225 ? "#7A8099" : "#3A3F55";
}
function applyMarking(p = P) {
  for (const k of Object.keys(TAPE)) delete TAPE[k];
  for (const t of p.marking.types)
    TAPE[t.id] = {
      n: t.name,
      c: t.c,
      c2: t.c2,
      pattern: t.pattern,
      w: t.w,
      use: t.use,
      edge: edgeFor(t),
    };
  if (!TAPE[ui.tape]) ui.tape = p.marking.types[0].id;
}
const tapeOf = (id) => TAPE[id] || TAPE[Object.keys(TAPE)[0]];
const LIB = [
  [
    "Movable items",
    [
      ["Pallet (UK)", 1.2, 1.0, "#8A6A3F"],
      ["Carton pallet", 1.2, 1.0, "#B07C3A"],
      ["Film reel rack", 1.2, 0.6, "#202C86"],
      ["Product bin", 1.0, 0.8, "#202C86"],
      ["Waste bin", 0.6, 0.6, "#D3401D"],
      ["Cardboard recycling", 1.0, 0.8, "#1F8A55"],
      ["Red tag bin", 0.6, 0.6, "#D3401D"],
      ["Tool trolley", 0.9, 0.5, "#202C86"],
      ["Cleaning station", 1.0, 0.5, "#2F6FD6"],
      ["Spill kit", 0.6, 0.6, "#D99A00"],
      ["Quality check station", 1.2, 0.8, "#1F8A55"],
      ["Document stand", 0.5, 0.4, "#F79622"],
      ["Bench / table", 1.8, 0.8, "#F79622"],
      ["Pallet truck", 1.6, 0.6, "#F79622"],
      ["Steps / ladder", 0.8, 0.5, "#6B7088"],
      ["Fan", 0.6, 0.6, "#6B7088"],
    ],
  ],
  [
    "Boards and points",
    [
      ["Shadow board", 1.2, 0.25, "#202C86"],
      ["Team / KPI board", 1.5, 0.25, "#202C86"],
      ["Hand wash / sanitiser", 0.5, 0.4, "#2F6FD6"],
      ["Operator position", 0.8, 0.8, "#6B3FA0"],
      ["First aid point", 0.5, 0.3, "#1F8A55"],
    ],
  ],
  [
    "Marked zones",
    [
      ["Storage area", 3, 2, "#B07C3A", "zone"],
      ["WIP area", 3, 2, "#7A8099", "zone"],
      ["Red tag area", 2, 2, "#D3401D", "zone"],
      ["Changeover parts area", 2.5, 1.5, "#202C86", "zone"],
      ["Walkway area", 6, 1.2, "#FEC20F", "zone"],
    ],
  ],
  [
    "Keep clear",
    [
      ["Electrical panel clearance", 2, 1, "#D3401D", "keepclear"],
      ["Fire point / extinguisher", 1.5, 1.5, "#D3401D", "keepclear"],
      ["Emergency exit route", 3, 1.2, "#D3401D", "keepclear"],
      ["Guard / access door", 1.5, 1.2, "#D3401D", "keepclear"],
    ],
  ],
];
const S5 = [
  ["sort", "Sort", "Only what is needed is here; red tags dealt with"],
  ["set", "Set in order", "Everything has a marked home and is in it"],
  ["shine", "Shine", "Floor, machines and stations clean"],
  ["std", "Standardise", "Markings, labels and boards clear and current"],
  ["sustain", "Sustain", "Checks done, actions closed, the team owns it"],
];

/* red tags */
const TAG_CATS = [
  "Not needed",
  "Excess stock",
  "Defective or damaged",
  "Wrong place",
  "Unknown owner",
  "Safety concern",
];
const TAG_DISP = [
  "To be decided",
  "Keep and give it a home",
  "Move to the right place",
  "Repair",
  "Return to stores",
  "Scrap or dispose",
  "Recycle",
  "Transfer or sell",
];
const TAG_ST = ["Open", "In red tag area", "Closed"];
const tagNo = (t) => "RT-" + String(t.no).padStart(3, "0");
const tagOverdue = (t) => !!t.due && t.due < today() && t.status !== "Closed";

const ACT_ST = ["Open", "In progress", "Done", "Cancelled"],
  ACT_PRI = ["Low", "Medium", "High"];
const actNo = (a) => "A-" + String(a.no).padStart(3, "0");
const actOverdue = (a) =>
  !!a.due && a.due < today() && !["Done", "Cancelled"].includes(a.status);

/* operator tasks: the jobs the people working in a zone do, each linked to the items it uses */
const TASK_FREQ = [
  "Start of shift",
  "Every shift",
  "End of shift",
  "Hourly",
  "Each changeover",
  "Daily",
  "Weekly",
  "Monthly",
  "As needed",
];
const TASK_WHO = [
  "Operator",
  "Team leader",
  "Maintenance",
  "Cleaner",
  "Quality",
];
const taskNo = (t) => "T-" + String(t.no).padStart(3, "0");

/* documents that live in a zone */
const DOC_TYPES = [
  "SOP",
  "One-point lesson",
  "Checklist",
  "Changeover sheet",
  "Risk assessment",
  "Work instruction",
  "Quality standard",
  "Cleaning schedule",
  "KPI / board",
  "Safety notice",
  "Other",
];
const DOC_FORMATS = [
  "A4 laminated",
  "A3 laminated",
  "A4 in holder",
  "A4 folder",
  "A4 clipboard",
  "Board / noticeboard",
  "Screen",
  "Sign",
];
const DOC_ST = ["Draft", "Current", "Under review", "Withdrawn"];
const docNo = (d) => "D-" + String(d.no).padStart(3, "0");
const docOverdue = (d) =>
  !!d.review && d.review < today() && d.status !== "Withdrawn";
// whole days from a to b; "" when either date is missing, so no NaN reaches the screen
const daysBetween = (a, b) => {
  const v = Math.round(
    (new Date(b + "T12:00") - new Date(a + "T12:00")) / 864e5,
  );
  return Number.isFinite(v) ? v : "";
};
const fmtD = (s) => {
  if (!s) return "";
  const d = new Date(s + "T12:00");
  return isNaN(d)
    ? s
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      });
};

/* ============ movable-item categories ============ */
// Initial groups are suggestions from names. Existing colours are retained until applied.
const DEFAULT_ITEM_CATEGORIES = [
  { id: "waste", name: "Waste bins", c: null },
  { id: "trolleys", name: "Trolleys", c: null },
  { id: "quality", name: "Quality", c: null },
  { id: "cleaning", name: "Cleaning", c: null },
  { id: "ppe", name: "PPE", c: null },
  { id: "production", name: "Production", c: null },
  { id: "other", name: "Other", c: null },
];
function suggestedCategory(o) {
  const text = String(o.label || "") + " " + String(o.type || "");
  if (
    /\b(quality|calibrat\w*|laser|sample\w*|test(?:er|ing)?|checkweigh\w*|gauge\w*)\b/i.test(
      text,
    )
  )
    return "quality";
  if (/\b(waste|bins?|rubbish|recycl\w*|scrap)\b/i.test(text)) return "waste";
  if (/\b(trolleys?|carts?|doll(?:y|ies))\b/i.test(text)) return "trolleys";
  if (
    /\b(clean\w*|brush\w*|brooms?|mops?|wipes?|shadow\s*boards?|squeegee\w*)\b/i.test(
      text,
    )
  )
    return "cleaning";
  if (
    /\b(ppe|mask\w*|glove\w*|goggles?|earplug\w*|hairnet\w*|face\s*shield\w*)\b/i.test(
      text,
    )
  )
    return "ppe";
  if (
    /\b(film|reels?|pallet\w*|packag\w*|ingredients?|materials?|wip)\b/i.test(
      text,
    )
  )
    return "production";
  return "other";
}
function normalizeItemCategories(project) {
  const supplied = Array.isArray(project.itemCategories)
      ? project.itemCategories
      : [],
    seen = new Set();
  const categories = supplied
    .filter((c) => c && typeof c === "object" && c.id)
    .map((c) => ({
      id: String(c.id),
      name: String(c.name || "Category").trim() || "Category",
      c: /^#[0-9a-f]{6}$/i.test(c.c) ? c.c : null,
    }))
    .filter((c) => !seen.has(c.id) && seen.add(c.id));
  if (!categories.length) categories.push(...clone(DEFAULT_ITEM_CATEGORIES));
  if (!categories.some((c) => c.id === "other"))
    categories.push({ id: "other", name: "Other", c: null });
  project.itemCategories = categories;
  const ids = new Set(categories.map((c) => c.id));
  // Resolve shared physical items consistently, preferring their explicit assignment.
  const explicit = new Map();
  for (const sheet of project.sheets)
    for (const o of sheet.objects)
      if (o.kind === "item" && ids.has(o.category) && !explicit.has(o.ref))
        explicit.set(o.ref, o.category);
  const resolved = new Map(explicit);
  for (const sheet of project.sheets)
    for (const o of sheet.objects) {
      if (o.kind !== "item") continue;
      if (!resolved.has(o.ref)) {
        const suggested = suggestedCategory(o);
        resolved.set(o.ref, ids.has(suggested) ? suggested : "other");
      }
      o.category = resolved.get(o.ref);
    }
}
function itemCategoryId(o) {
  if (P.itemCategories.some((c) => c.id === o.category)) return o.category;
  const suggested = suggestedCategory(o);
  return P.itemCategories.some((c) => c.id === suggested) ? suggested : "other";
}
function itemCategoryOptions(value) {
  return P.itemCategories
    .map(
      (c) =>
        `<option value="${esc(c.id)}"${c.id === value ? " selected" : ""}>${esc(c.name)}</option>`,
    )
    .join("");
}
function categoryAssignmentHTML(items) {
  if (!items.length) return "";
  const ids = new Set(items.map(itemCategoryId)),
    current = ids.size === 1 ? [...ids][0] : "";
  return `<label class="f">Category${items.length > 1 ? " (" + items.length + " movable items)" : ""}<select data-item-category aria-label="Item category">${current ? "" : '<option value="" selected disabled>Mixed categories</option>'}${itemCategoryOptions(current)}</select></label>`;
}
function assignSelectedCategory(id) {
  const category = P.itemCategories.find((c) => c.id === id);
  if (!category) return;
  const items = selected()
    .filter((f) => !f.fx && f.t === "obj" && f.x.kind === "item")
    .map((f) => f.x);
  if (!items.length) return;
  const refs = new Set(items.map((o) => o.ref));
  checkpoint();
  for (const sheet of P.sheets)
    for (const o of sheet.objects)
      if (o.kind === "item" && refs.has(o.ref)) {
        o.category = id;
        if (category.c) o.c = category.c;
      }
  record("Item category assigned", refs.size + " item(s) to " + category.name);
  renderAll();
}
function updateCategoryColour(id, colour) {
  const category = P.itemCategories.find((c) => c.id === id);
  if (!category || !/^#[0-9a-f]{6}$/i.test(colour)) return 0;
  category.c = colour;
  let count = 0;
  for (const sheet of P.sheets)
    for (const o of sheet.objects)
      if (o.kind === "item" && itemCategoryId(o) === id) {
        o.category = id;
        o.c = colour;
        count++;
      }
  return count;
}
function applyCategoryColour(id, colour) {
  const category = P.itemCategories.find((c) => c.id === id);
  if (!category || !/^#[0-9a-f]{6}$/i.test(colour)) return;
  checkpoint();
  const count = updateCategoryColour(id, colour);
  record(
    "Category colour applied",
    category.name +
      ": " +
      colour +
      ", " +
      count +
      " item placements across sheets",
  );
  renderAll();
  toast(
    category.name +
      " colour applied on every sheet. New items will use it too.",
  );
}
function selectCategoryItems(id) {
  ui.sel = S()
    .objects.filter((o) => o.kind === "item" && itemCategoryId(o) === id)
    .map((o) => o.id);
  ui.tab = "item";
  renderSide();
  draw();
}
function categoryGroupsHTML(sh) {
  const all = sh.objects.filter((o) => o.kind === "item" && scopeObj(o));
  const q = ui.itemQuery.trim().toLocaleLowerCase();
  const matches = (o) =>
    (!ui.itemFilter || itemCategoryId(o) === ui.itemFilter) &&
    (!ui.itemArea ||
      (ui.itemArea === "none"
        ? !areaOf(o, sh)
        : areaOf(o, sh)?.id === ui.itemArea)) &&
    (!q ||
      (
        o.label +
        " " +
        P.itemCategories.find((c) => c.id === itemCategoryId(o)).name
      )
        .toLocaleLowerCase()
        .includes(q));
  const row = (o) =>
    `<button class="irow${ui.sel.includes(o.id) ? " ux-selected" : ""}" title="${esc(o.label)}" style="--c:${o.c}" data-go="${n2(o.x)},${n2(o.y)}" data-sel="${esc(o.id)}"><span>${esc(o.label)}${o.locked ? " (locked)" : ""}</span></button>`;
  let html = `<section class="item-categories"><h3>Items by category <span class="count">${all.length}</span></h3>
    <label class="f">Find items<input id="itemSearch" type="search" value="${esc(ui.itemQuery)}" placeholder="Name or category" autocomplete="off"></label>
    <label class="f">Category<select id="itemFilter"><option value="">All categories</option>${P.itemCategories.map((c) => `<option value="${esc(c.id)}"${ui.itemFilter === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
    ${
      areasOn(sh).length
        ? `<label class="f">Zone<select id="itemArea"><option value="">All zones</option>${areasOn(
            sh,
          )
            .map(
              (a) =>
                `<option value="${esc(a.id)}"${ui.itemArea === a.id ? " selected" : ""}>${esc(a.name)}</option>`,
            )
            .join(
              "",
            )}<option value="none"${ui.itemArea === "none" ? " selected" : ""}>Not in a zone</option></select></label>`
        : ""
    }
    <div class="btns"><button data-manage-categories>Manage categories and colours</button><button data-show-categories>Show all on map</button></div>
    <p class="small muted">Visibility affects the map only. Checks and totals include every item.</p>`;
  let found = 0;
  for (const c of P.itemCategories) {
    const members = all.filter((o) => itemCategoryId(o) === c.id);
    const items = members
      .filter(matches)
      .sort((a, b) => a.label.localeCompare(b.label));
    if (
      !members.length ||
      (ui.itemFilter && ui.itemFilter !== c.id) ||
      ((q || ui.itemArea) && !items.length)
    )
      continue;
    found += items.length;
    const colours = [...new Set(members.map((o) => o.c))];
    html += `<details class="item-category" data-category-group="${esc(c.id)}"${q || !ui.categoryClosed.has(c.id) ? " open" : ""}><summary><span>${esc(c.name)}</span><span class="count">${items.length}${items.length !== members.length ? " / " + members.length : ""}</span></summary>
    <div class="category-tools"><label><input type="checkbox" data-category-visible="${esc(c.id)}"${ui.hiddenCategories.has(c.id) ? "" : " checked"}>Show on map</label><button data-category-select="${esc(c.id)}">Select all</button></div>
    <details class="category-tools"><summary>Quick group colour</summary><label>Colour<input type="color" data-category-colour="${esc(c.id)}" value="${esc(c.c || colours[0])}"></label><button data-category-apply="${esc(c.id)}">Apply colour</button></details><div class="ux-legend" aria-label="${esc(c.name)} colour legend">${colours.map((col) => `<span><i style="background:${esc(col)}"></i>${esc(col)}</span>`).join("")}${colours.length > 1 ? "<small>Mixed colours</small>" : ""}</div>${items.map(row).join("")}</details>`;
  }
  if (!found)
    html +=
      '<p class="empty">No matching items. Try another name or category.</p>';
  const zones = sh.objects.filter(
    (o) => o.kind !== "item" && (!q || o.label.toLocaleLowerCase().includes(q)),
  );
  if (zones.length && !ui.itemFilter)
    html += "<h3>Zones and keep-clear</h3>" + zones.map(row).join("");
  return html + "</section>";
}
async function manageItemCategories() {
  const original = clone(P.itemCategories);
  let rows = clone(original);
  const result = await modal(
    "Manage item categories",
    `<p class="small muted">Rename or add groups. A default colour applies to that category on every sheet and to future items. Removing a group moves its items to Other and keeps their current colours.</p><div id="categoryRows"></div><div class="btns"><button type="button" id="categoryAdd">Add category</button></div>`,
    "Save",
    {
      wide: true,
      onOpen: (dialog) => {
        const wrap = $("#categoryRows");
        const read = () => {
          rows = [...wrap.querySelectorAll("[data-category-row]")].map(
            (el) => ({
              id: el.dataset.categoryRow,
              name: el.querySelector("[data-cat-name]").value.trim(),
              c: el.querySelector("[data-cat-use]").checked
                ? el.querySelector("[data-cat-pick]").value
                : null,
            }),
          );
        };
        const render = () => {
          wrap.innerHTML = rows
            .map(
              (c) =>
                `<div class="category-edit" data-category-row="${esc(c.id)}"><label class="f">Name<input data-cat-name value="${esc(c.name)}" required aria-label="Category name"></label><label class="chk"><input type="checkbox" data-cat-use${c.c ? " checked" : ""}>Use default colour</label><input type="color" data-cat-pick value="${esc(c.c || "#202C86")}" aria-label="Default category colour"><button type="button" data-cat-remove="${esc(c.id)}"${c.id === "other" ? ' disabled title="Keep a fallback category"' : ""}>Remove</button></div>`,
            )
            .join("");
        };
        const form = dialog.querySelector("form");
        const validateNames = (event) => {
          if (event.submitter?.value === "cancel") return;
          read();
          const seen = new Set();
          if (
            rows.some(
              (c) =>
                !c.name ||
                seen.has(c.name.toLowerCase()) ||
                !seen.add(c.name.toLowerCase()),
            )
          ) {
            event.preventDefault();
            toast("Each category needs a different, non-empty name.");
          }
        };
        form.addEventListener("submit", validateNames);
        dialog.addEventListener(
          "close",
          () => form.removeEventListener("submit", validateNames),
          { once: true },
        );
        render();
        wrap.onclick = (e) => {
          const button = e.target.closest("[data-cat-remove]");
          if (!button) return;
          read();
          rows = rows.filter((c) => c.id !== button.dataset.catRemove);
          render();
        };
        wrap.oninput = read;
        wrap.onchange = read;
        $("#categoryAdd").onclick = () => {
          read();
          let name = "New category",
            suffix = 2;
          while (rows.some((c) => c.name.toLowerCase() === name.toLowerCase()))
            name = "New category " + suffix++;
          rows.push({
            id: "cat-" + uid(),
            name,
            c: null,
          });
          render();
          [...wrap.querySelectorAll("[data-cat-name]")].at(-1)?.focus();
        };
      },
    },
  );
  if (!result) return;
  const names = new Set();
  for (const c of rows) {
    if (!c.name || names.has(c.name.toLowerCase())) {
      toast("Each category needs a different, non-empty name.");
      return;
    }
    names.add(c.name.toLowerCase());
  }
  checkpoint();
  P.itemCategories = rows;
  const ids = new Set(rows.map((c) => c.id));
  for (const sheet of P.sheets)
    for (const o of sheet.objects)
      if (o.kind === "item" && o.category && !ids.has(o.category))
        o.category = "other";
  for (const c of rows)
    if (c.c && c.c !== original.find((old) => old.id === c.id)?.c)
      updateCategoryColour(c.id, c.c);
  record("Item categories updated", rows.length + " categories");
  renderAll();
}
