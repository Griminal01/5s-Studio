"use strict";
/* ============ example project: a model packing line ============ */
// A made-up but realistic line so you can see every feature filled in:
// walls, machines, items with home marks, floor tape, routes, documents,
// actions and a proposal to compare. Dates are relative to today, so the
// document review warnings always show something. Open it from the empty
// layout or Settings. It is only an example: change anything.

function makeExampleProject() {
  const MPU = 0.03, // metres per drawing unit: 1000 units = 30 m
    u = (m) => Math.round((m / MPU) * 100) / 100,
    pt = (x, y) => ({ x: u(x), y: u(y) }),
    dayOffset = (n) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };

  newProject();
  const p = P,
    std = p.sheets[0],
    dm = p.drawings.d1;
  dm.mpu = MPU;
  dm.w = 1000;
  dm.h = 560;
  dm.name = "Model line, 30 m x 16.8 m";
  p.projectName = "Example: model packing line";
  std.name = "Model line standard";
  std.notes =
    "Example project. The line runs left to right: supplies along the top, the packer line in the middle, the operator walkway along the front, and cleaning, changeover tooling and the KPI board along the bottom wall.";

  /* ----- walls, doors and fixed equipment ----- */
  const fx = [];
  const fixed = (label, x, y, w, h, a = 0, extra = {}) =>
    fx.push({
      id: uid(),
      t: "block",
      label,
      x: u(x),
      y: u(y),
      w: u(w),
      h: u(h),
      a,
      c: "#4A4F66",
      passable: false,
      locked: true,
      ...extra,
    });
  fx.push({
    id: uid(),
    t: "wall",
    label: "Room walls",
    pts: [pt(0.5, 0.5), pt(29.5, 0.5), pt(29.5, 16.3), pt(0.5, 16.3)],
    closed: true,
    th: u(0.2),
    c: "#4A4F66",
    locked: true,
  });
  fixed("Personnel door", 5, 16.3, 1.2, 0.3, 0, {
    c: "#1F8A55",
    passable: true,
  });
  fixed("Goods-in door", 0.5, 8, 2.4, 0.3, 90, {
    c: "#1F8A55",
    passable: true,
  });
  for (const [x, y] of [
    [10, 3],
    [20, 3],
    [10, 13.4],
    [20, 13.4],
  ])
    fixed("Column", x, y, 0.4, 0.4);
  fixed("Electrical cabinet", 24, 1, 0.8, 0.4);
  fixed("Infeed conveyor", 7.5, 7.6, 4.5, 0.9);
  fixed("Packer", 13, 7.6, 4, 2.2);
  fixed("Case packer", 19, 7.6, 3, 2);
  fixed("Palletiser", 25, 7.6, 3, 3);
  dm.fixed = fx;

  /* ----- movable items, each with a home marked on the floor ----- */
  const cat = {
    "Waste bin": "waste",
    "Cardboard recycling": "waste",
    "Red tag bin": "waste",
    "Tool trolley": "trolleys",
    "Cleaning station": "cleaning",
    "Spill kit": "cleaning",
    "Shadow board": "cleaning",
    "Spares kanban rack": "other",
    "Quality check station": "quality",
    "Film reel rack": "production",
    "Carton pallet": "production",
    "Pallet (UK)": "production",
    "Product bin": "production",
  };
  const items = {}; // by label, so documents and the proposal can refer to them
  const item = (name, x, y, w, h, c, a = 0, extra = {}) => {
    const id = uid(),
      label = extra.label || name,
      o = {
        id,
        ref: id,
        type: name,
        label,
        kind: "item",
        x: u(x),
        y: u(y),
        w: u(w),
        h: u(h),
        a,
        c,
        fp: true,
        fpStyle: "corners",
        fpLaid: false,
        locked: false,
        note: "",
        category: cat[name] || "other",
        ...extra,
      };
    std.objects.push(o);
    items[label] = o;
    return o;
  };
  const zone = (name, x, y, w, h, c, kind = "zone") => {
    const id = uid();
    std.objects.push({
      id,
      ref: id,
      type: name,
      label: name,
      kind,
      x: u(x),
      y: u(y),
      w: u(w),
      h: u(h),
      a: 0,
      c,
      fp: false,
      fpStyle: "corners",
      fpLaid: false,
      locked: false,
      note: "",
    });
  };
  // areas and keep-clear zones sit underneath the items
  zone("Storage area", 20.6, 3.6, 7.6, 2.2, "#B07C3A");
  zone("Changeover parts area", 12, 14.1, 3.6, 1.8, "#202C86");
  zone("Electrical panel clearance", 24, 2.1, 2, 1.4, "#D3401D", "keepclear");
  zone("Emergency exit route", 5, 14.9, 1.4, 2.2, "#D3401D", "keepclear");
  zone(
    "Fire point / extinguisher",
    28.4,
    1.9,
    1.5,
    1.5,
    "#D3401D",
    "keepclear",
  );

  item("Red tag bin", 2.8, 2.8, 0.6, 0.6, "#D3401D");
  item("Product bin", 8, 3.6, 1, 0.8, "#202C86");
  item("Film reel rack", 12, 3.6, 1.2, 0.6, "#202C86");
  item("Film reel rack", 13.6, 3.6, 1.2, 0.6, "#202C86", 0, {
    label: "Film reel rack 2",
  });
  item("Carton pallet", 17.6, 3.6, 1.2, 1, "#B07C3A", 0, {
    fpStyle: "outline",
  });
  item("Carton pallet", 19, 3.6, 1.2, 1, "#B07C3A", 0, {
    label: "Carton pallet 2",
    fpStyle: "outline",
  });
  item("Pallet (UK)", 22.2, 3.8, 1.2, 1, "#8A6A3F", 0, { fpStyle: "outline" });
  item("Pallet (UK)", 24.2, 3.8, 1.2, 1, "#8A6A3F", 0, {
    label: "Pallet (UK) 2",
    fpStyle: "outline",
  });
  item("Operator position", 13, 10.2, 0.8, 0.8, "#6B3FA0", 0, {
    label: "Operator position: packer",
    fp: false,
  });
  item("Operator position", 19, 10.2, 0.8, 0.8, "#6B3FA0", 0, {
    label: "Operator position: case packer",
    fp: false,
  });
  item("Document stand", 14.4, 10.2, 0.5, 0.4, "#F79622", 0, {
    label: "Document stand (packer)",
  });
  item("Document stand", 20.4, 10.2, 0.5, 0.4, "#F79622", 0, {
    label: "Document stand (case packer)",
  });
  item("Quality check station", 16.5, 14.5, 1.2, 0.8, "#1F8A55");
  item("Tool trolley", 9, 14.6, 0.9, 0.5, "#202C86");
  item("Shadow board", 13.8, 15.8, 1.2, 0.25, "#202C86", 0, {
    label: "Changeover shadow board",
    fpStyle: "outline",
  });
  item("Cleaning station", 20, 14.7, 1, 0.5, "#2F6FD6");
  item("Spill kit", 22.5, 14.8, 0.6, 0.6, "#D99A00");
  item("Spares kanban rack", 18.6, 15.95, 1.2, 0.3, "#202C86", 0, {
    fpStyle: "outline",
  });
  item("Waste bin", 7, 10.2, 0.6, 0.6, "#D3401D", 0, { fp: false });
  item("Cardboard recycling", 26, 13.6, 1, 0.8, "#1F8A55");
  item("Pallet truck", 2.6, 10.2, 1.6, 0.6, "#F79622", 0, {
    fpStyle: "outline",
  });
  item("Team / KPI board", 25, 16, 1.5, 0.25, "#202C86", 0, {
    label: "Team / KPI board",
    fp: false,
  });
  item("Hand wash / sanitiser", 3.2, 14.6, 0.5, 0.4, "#2F6FD6", 0, {
    fp: false,
  });
  item("First aid point", 28.4, 14.8, 0.5, 0.3, "#1F8A55", 0, { fp: false });

  /* ----- areas: named zones, with the key items designated to them ----- */
  const area = (name, owner, note, x0, y0, x1, y1) => {
    const no = ++p.counters.area;
    p.areas.push({
      id: uid(),
      no,
      level: "zone",
      parent: "",
      name,
      color: AREA_COLS[(no - 1) % AREA_COLS.length],
      owner,
      note,
      drawing: "d1",
      pts: [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)],
      closed: true,
      created: dayOffset(-90),
    });
  };
  area(
    "Supplies and staging",
    "Sam",
    "Film, cartons and pallets for the next order. Nothing else stays here.",
    6.5,
    1.2,
    29,
    6,
  );
  area(
    "Packing line",
    "Josh",
    "Packer, case packer and palletiser with their operator positions.",
    6.5,
    6.5,
    29,
    11.2,
  );
  area(
    "Goods-in and WIP",
    "Sam",
    "Pallets in from goods-in and the WIP buffer before the infeed.",
    1,
    6,
    6,
    12.5,
  );
  area(
    "Tooling and cleaning",
    "Josh",
    "Changeover parts, cleaning kit and the quality check station.",
    7.5,
    13,
    23.8,
    16.2,
  );
  area(
    "Finished goods",
    "Sam",
    "Palletised product waiting for dispatch, recycling and the KPI board.",
    24,
    12.5,
    29.5,
    16.2,
  );
  area(
    "Red tag area",
    "Sam",
    "Everything waiting for a decision. Kept clear of the line.",
    1.6,
    1.6,
    4.4,
    4.2,
  );
  area(
    "Entry and hygiene",
    "Josh",
    "Personnel door, hand wash and the emergency exit route.",
    1,
    13,
    7,
    16.2,
  );
  // two lines, each drawn round its zones
  for (const [name, owner, note, zones] of [
    [
      "Model packing line",
      "Josh",
      "Goods in, supplies and the packer line: one flow from left to right.",
      [
        "Supplies and staging",
        "Packing line",
        "Goods-in and WIP",
        "Red tag area",
      ],
    ],
    [
      "Support and despatch",
      "Sam",
      "Tooling, finished goods and the entry along the bottom wall.",
      ["Tooling and cleaning", "Finished goods", "Entry and hygiene"],
    ],
  ]) {
    const no = ++p.counters.line,
      mine = p.areas.filter((a) => zones.includes(a.name)),
      xs = mine.flatMap((a) => a.pts.map((q) => q.x)),
      ys = mine.flatMap((a) => a.pts.map((q) => q.y)),
      pad = u(0.25),
      line = {
        id: uid(),
        no,
        level: "line",
        parent: "",
        name,
        color: LINE_COLS[(no - 1) % LINE_COLS.length],
        owner,
        note,
        drawing: "d1",
        pts: [
          { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad },
          { x: Math.max(...xs) + pad, y: Math.min(...ys) - pad },
          { x: Math.max(...xs) + pad, y: Math.max(...ys) + pad },
          { x: Math.min(...xs) - pad, y: Math.max(...ys) + pad },
        ],
        closed: true,
        created: dayOffset(-90),
      };
    p.areas.push(line);
    for (const z of mine) z.parent = line.id;
  }
  {
    const idOf = (n) => p.areas.find((a) => a.name === n).id;
    for (const [label, areaName] of [
      ["Film reel rack", "Supplies and staging"],
      ["Film reel rack 2", "Supplies and staging"],
      ["Carton pallet", "Supplies and staging"],
      ["Carton pallet 2", "Supplies and staging"],
      ["Tool trolley", "Tooling and cleaning"],
      ["Changeover shadow board", "Tooling and cleaning"],
      ["Cleaning station", "Tooling and cleaning"],
      ["Spill kit", "Tooling and cleaning"],
      ["Spares kanban rack", "Tooling and cleaning"],
      ["Quality check station", "Tooling and cleaning"],
    ])
      items[label].area = idOf(areaName);
  }

  /* ----- floor tape ----- */
  const mark = (type, pts, extra = {}) => {
    const id = uid();
    std.marks.push({
      id,
      ref: id,
      type,
      pts,
      closed: false,
      kind: "line",
      status: "planned",
      damaged: false,
      laid: "",
      note: "",
      ...extra,
    });
  };
  const box = (type, x0, y0, x1, y1, note = "") =>
    mark(type, [pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)], {
      closed: true,
      note,
    });
  mark("walkway", [pt(3, 11.8), pt(28, 11.8)], {
    kind: "aisle",
    width: u(1.6),
    note: "Main operator walkway",
  });
  mark("walkway", [pt(8, 5.4), pt(24, 5.4)], {
    kind: "aisle",
    width: u(1.2),
    note: "Material feed aisle",
  });
  box("red", 1.6, 1.6, 4.4, 4.2, "Red tag area, kept clear of the line");
  box("raw", 17, 2.8, 20.2, 4.6, "Cartons and film at point of use");
  box("raw", 11, 2.9, 14.8, 4.3, "Film reel racks");
  box("equip", 3, 6.4, 5.8, 8.8, "WIP buffer before the infeed");
  box("good", 23.5, 12.8, 29, 15.6, "Finished goods staging");
  box("equip", 11.8, 14.4, 15.8, 16, "Changeover parts and tooling");
  mark("hazard", [pt(22.8, 9.7), pt(27.2, 9.7)], {
    note: "Palletiser guard line",
  });
  box("clear", 22.8, 1.5, 26.2, 3.6, "Keep clear: electrical cabinet");
  mark("walkway", [pt(5, 14), pt(5, 16)], {
    kind: "arrow",
    note: "Exit direction",
  });
  mark("walkway", [pt(6, 11.8), pt(9, 11.8)], { kind: "arrow", note: "Flow" });

  /* ----- routes ----- */
  const route = (name, who, trips, per, pts, note = "") => {
    const id = uid();
    std.routes.push({ id, ref: id, name, who, trips, per, pts, note });
  };
  route("Film reel change", "walk", 6, "shift", [
    pt(12, 4.4),
    pt(12, 5.4),
    pt(13, 5.4),
    pt(13, 6.4),
  ]);
  route("Changeover tooling run", "walk", 2, "shift", [
    pt(14, 15),
    pt(14, 11.8),
    pt(13, 11.8),
    pt(13, 9.9),
  ]);
  route("Pallets from goods-in", "vehicle", 8, "shift", [
    pt(1.5, 8),
    pt(3.6, 8),
    pt(3.6, 2),
    pt(21, 2),
    pt(21, 3),
  ]);

  /* ----- documents ----- */
  const ref = (label) => items[label]?.ref || "";
  const doc = (title, type, owner, over) => {
    const d = {
      id: uid(),
      no: ++p.counters.doc,
      title,
      type,
      owner,
      rev: "1",
      issued: dayOffset(-120),
      review: dayOffset(240),
      format: "A4 laminated",
      qty: 1,
      holder: "",
      where: "",
      status: "Current",
      ref: "",
      note: "",
      sheet: std.id,
      drawing: "d1",
      x: null,
      y: null,
      ...over,
    };
    p.documents.push(d);
  };
  const at = (label, dx = 0, dy = -0.9) => ({
    holder: ref(label),
    x: u(items[label].x * MPU + dx),
    y: u(items[label].y * MPU + dy),
  });
  doc("Packer start-up and shutdown", "SOP", "Josh", {
    ref: "SOP-1021",
    rev: "3",
    ...at("Document stand (packer)", -0.2, -0.9),
    where: "Top slot, eye level",
  });
  doc("Start-of-shift line checklist", "Checklist", "Sam", {
    ref: "CHK-0412",
    rev: "2",
    format: "A4 clipboard",
    review: dayOffset(18),
    ...at("Document stand (packer)", 0.6, -0.5),
    where: "Clipboard on the stand",
  });
  doc("Case packer jam clearing", "Work instruction", "Josh", {
    ref: "WI-0309",
    rev: "1",
    ...at("Document stand (case packer)", -0.2, -0.9),
  });
  doc("Film reel splice", "One-point lesson", "Josh", {
    rev: "2",
    ...at("Film reel rack", 0, -0.8),
    where: "On the rack upright",
  });
  doc("Format changeover: small to large", "Changeover sheet", "Sam", {
    ref: "CO-0007",
    rev: "4",
    format: "A3 laminated",
    ...at("Changeover shadow board", 0, -0.7),
  });
  doc("Packer guarding and interlocks", "Risk assessment", "Sam", {
    ref: "RA-0188",
    rev: "5",
    review: dayOffset(-25),
    format: "A4 folder",
    x: u(13 - 0.0),
    y: u(6.7),
    where: "Folder on the guard door",
  });
  doc("Line cleaning schedule", "Cleaning schedule", "Josh", {
    rev: "1",
    ...at("Cleaning station", 0, -0.9),
  });
  doc("Seal integrity check", "Quality standard", "Sam", {
    ref: "QS-0054",
    rev: "6",
    ...at("Quality check station", 0, -1),
  });
  doc("Team KPI board", "KPI / board", "Sam", {
    format: "Board / noticeboard",
    rev: "",
    review: "",
    ...at("Team / KPI board", 0, -0.9),
  });
  doc("Spill response", "One-point lesson", "Josh", {
    rev: "1",
    review: dayOffset(-3),
    ...at("Spill kit", 0, -0.8),
  });
  doc("Emergency exit route", "Safety notice", "Sam", {
    format: "Sign",
    rev: "",
    review: "",
    qty: 2,
    x: u(5),
    y: u(15.3),
    where: "On the wall above the personnel door",
  });
  doc("Red tag process", "SOP", "Josh", {
    status: "Draft",
    rev: "",
    issued: "",
    review: "",
    format: "A3 laminated",
    ...at("Red tag bin", 0, -0.8),
    where: "Wall beside the red tag bin",
  });
  doc("Palletiser pattern set-up", "Work instruction", "Josh", {
    status: "Under review",
    rev: "2",
    review: dayOffset(40),
    where: "Hung at the palletiser HMI",
    x: u(25),
    y: u(9.2),
  });
  doc("Old film reel instruction", "One-point lesson", "Josh", {
    status: "Withdrawn",
    rev: "1",
    review: "",
  });

  /* ----- actions ----- */
  const action = (title, owner, due, pri, status, extra = {}) =>
    p.actions.push({
      id: uid(),
      no: ++p.counters.act,
      title,
      s5: "",
      pri,
      owner,
      due,
      status,
      raised: dayOffset(-10),
      done: "",
      note: "",
      sheet: std.id,
      source: "",
      drawing: "",
      x: null,
      y: null,
      ...extra,
    });
  action(
    "Order yellow and white 50 mm tape, 6 rolls",
    "Josh",
    dayOffset(7),
    "High",
    "Open",
    { s5: "set" },
  );
  action(
    "Laminate and fit the changeover sheet to the shadow board",
    "Sam",
    dayOffset(14),
    "Medium",
    "In progress",
    {
      s5: "std",
      drawing: "d1",
      x: u(13.8),
      y: u(15.1),
    },
  );
  action(
    "Agree the red tag process with the team leaders",
    "Josh",
    dayOffset(-4),
    "Medium",
    "Open",
    { s5: "sort" },
  );

  /* ----- document actions: jobs on the documents themselves ----- */
  {
    const docId = (t) => p.documents.find((d) => d.title === t)?.id || "";
    action(
      "Review the packer guarding risk assessment, the review date has passed",
      "Sam",
      dayOffset(-3),
      "High",
      "Open",
      { stream: "doc", doc: docId("Packer guarding and interlocks") },
    );
    action(
      "Laminate the revised start-up SOP and fit it to the packer stand",
      "Josh",
      dayOffset(4),
      "Medium",
      "In progress",
      { stream: "doc", doc: docId("Packer start-up and shutdown") },
    );
    action(
      "Put a second copy of the exit route notice by the goods-in door",
      "Sam",
      dayOffset(10),
      "Low",
      "Open",
      { stream: "doc", doc: docId("Emergency exit route") },
    );
  }

  /* ----- a proposal: swap the film racks to the infeed side ----- */
  const prop = JSON.parse(JSON.stringify(std));
  prop.id = uid();
  prop.kind = "proposal";
  prop.name = "Proposal 1: film racks and changeover board nearer the packer";
  prop.notes =
    "Try moving both film reel racks 3 m to the right so the reel change walk is shorter. Compare against the standard.";
  prop.objects = prop.objects.map((o) => ({ ...o, id: uid() }));
  prop.marks = prop.marks.map((m) => ({ ...m, id: uid() }));
  prop.routes = prop.routes.map((r) => ({ ...r, id: uid() }));
  for (const o of prop.objects)
    if (/^Film reel rack/.test(o.label)) o.x += u(2.4);
  // the changeover board moves closer to the packer, so the tooling run is shorter
  const cb = prop.objects.find((o) => o.label === "Changeover shadow board");
  if (cb) cb.y -= u(1.9);
  const tr = prop.routes.find((r) => r.name === "Changeover tooling run");
  if (tr) tr.pts[0] = pt(14, 13.1);
  p.sheets.push(prop);

  /* ----- red tags ----- */
  const tag = (title, cat, reason, disp, owner, due, status, extra = {}) =>
    p.tags.push({
      id: uid(),
      no: ++p.counters.tag,
      title,
      cat,
      reason,
      disp,
      owner,
      due,
      status,
      raised: dayOffset(-12),
      by: "Sam",
      closed: "",
      note: "",
      sheet: std.id,
      drawing: "d1",
      ref: "",
      x: null,
      y: null,
      photos: [],
      ...extra,
    });
  tag(
    "Spare film cores (box)",
    "Excess stock",
    "Not used on this line, turns up on most checks",
    "Return to stores",
    "Josh",
    dayOffset(3),
    "In red tag area",
    {
      x: u(15.5),
      y: u(6),
    },
  );
  tag(
    "Cracked product bin lid",
    "Defective or damaged",
    "Lid will not close",
    "Repair",
    "Sam",
    dayOffset(-2),
    "Open",
    {
      ref: ref("Product bin"),
      x: u(8),
      y: u(3.6),
    },
  );
  tag(
    "Unlabelled pallet of cartons",
    "Unknown owner",
    "No label, nobody knows whose it is",
    "To be decided",
    "",
    dayOffset(-6),
    "Open",
  );
  tag(
    "Old changeover tooling",
    "Not needed",
    "Replaced by the new format set",
    "Scrap or dispose",
    "Sam",
    dayOffset(-8),
    "Closed",
    {
      closed: dayOffset(-5),
    },
  );

  /* ----- problems: worked examples, with their countermeasures in the Actions register ----- */
  {
    const areaId = (n) => p.areas.find((a) => a.name === n)?.id || "",
      docId = (t) => p.documents.find((d) => d.title === t)?.id || "",
      prob = (over, whys = [], fish = {}) => {
        const x = blankProblem(over);
        x.no = ++p.counters.prob;
        for (const [text, evidence] of whys)
          x.whys.push({ id: uid(), text, evidence: evidence || "" });
        for (const [cat, list] of Object.entries(fish))
          for (const [text, likely] of list)
            x.fish[cat].push({ id: uid(), text, likely: !!likely });
        p.problems.push(x);
        return x;
      },
      // the id of a cause, found by the start of its text
      cid = (x, start) =>
        Object.values(x.fish)
          .flat()
          .find((c) => c.text.startsWith(start))?.id || "",
      cm = (x, title, owner, due, status, extra = {}) =>
        action(title, owner, due, "High", status, {
          source: probNo(x),
          prob: x.id,
          done: status === "Done" ? dayOffset(-3) : "",
          ...extra,
        });
    const jam = prob(
      {
        title: "Film jams at the packer infeed after a reel change",
        status: "Countermeasures",
        owner: "Josh",
        team: "Sam, nights shift leader",
        raised: dayOffset(-20),
        category: "Machine breakdown",
        area: areaId("Packing line"),
        count: 14,
        mins: 210,
        background:
          "Every jam stops the packer and wastes film and product. Nights report it most.",
        current:
          "14 jams in the last 4 weeks, about 15 minutes each to clear and restart. All happened within an hour of a reel change.",
        target: "No jam caused by a reel change within 8 weeks.",
        containment:
          "Operators check the splice and the film tension by hand after every reel change until the standard is in place.",
        root: "Unwind brake tension is not set or checked at reel change: it is not in the standard work and there is no gauge at the unwind.",
        rootCheck: "yes",
        hypothesis:
          "Uneven unwind tension after a reel change lets the film wander off the rollers. Test: set the brake with a gauge on every reel change for a week of nights.",
        confirm:
          "6 reel changes on nights with the tension set by gauge: no jams. 2 without the gauge: 1 jam.",
        docs: [docId("Packer start-up and shutdown")].filter(Boolean),
        items: [items["Film reel rack"].ref],
        checkOn: dayOffset(40),
        after: "",
        standard: "",
      },
      [
        [
          "The film wanders off the tracking rollers after the reel is loaded",
          "Seen on 9 of the 14 jams (photos on the tablet)",
        ],
        [
          "The reel is loaded with uneven tension",
          "Tension reads about 20% over on the left side",
        ],
        [
          "Nobody sets or checks the unwind brake tension at a reel change",
          "Not a step in the start-up SOP, revision 3",
        ],
        [
          "The brake setting is not part of the standard work and there is no gauge at the unwind",
          "Confirmed with two operators on each shift",
        ],
      ],
      {
        people: [["New operators are not shown the tension setting", false]],
        method: [
          ["Reel change steps do not include the brake tension", true],
          ["Shifts load reels in a different order", false],
        ],
        machine: [
          ["Unwind brake wears and drifts", false],
          ["Left tracking roller is worn", false],
        ],
        material: [["Some reels have out-of-round cores", false]],
        measurement: [["No tension gauge at the unwind", true]],
        environment: [
          [
            "Reel racks are 5 m from the unwind, so reels get knocked in transit",
            false,
          ],
        ],
      },
    );
    cm(
      jam,
      "Add the unwind brake tension check to the packer start-up SOP",
      "Josh",
      dayOffset(5),
      "In progress",
      { cause: cid(jam, "Reel change steps") },
    );
    cm(
      jam,
      "Fit a tension gauge on the unwind and mark the green range",
      "Sam",
      dayOffset(12),
      "Open",
      { cause: cid(jam, "No tension gauge") },
    );
    cm(
      jam,
      "Replace the worn left tracking roller",
      "Sam",
      dayOffset(-2),
      "Done",
      { cause: cid(jam, "Left tracking roller") },
    );
    cm(
      jam,
      "Re-run reel changes on nights and compare the jam count",
      "Josh",
      dayOffset(30),
      "Open",
    );

    const slow = prob(
      {
        title:
          "Small to large format changeover is well over the 10 minute target",
        status: "Verifying",
        owner: "Josh",
        team: "Sam, packer operators",
        raised: dayOffset(-15),
        category: "Changeover",
        area: areaId("Packing line"),
        count: 6,
        mins: 150,
        background:
          "The packer is stopped for the whole changeover, four times a week.",
        current:
          "Timed at the baseline: every step done with the machine stopped.",
        target: "Stopped time under 10 minutes by the end of next month.",
        containment: "Next format is staged at the line the shift before.",
        root: "Parts and tools are fetched with the machine stopped because the next format kit is never staged and the tools have no home.",
        rootCheck: "yes",
        hypothesis:
          "The stop is long because parts and tools are fetched after the machine stops. Test: stage the kit before the stop on the next trial.",
        confirm: "Trial 2 with the kit staged: 12 minutes less stopped.",
        checkOn: dayOffset(-1),
        after: "Trials 2 and 3 show the stopped time coming down.",
        standard: "",
      },
      [
        [
          "The machine is stopped while people fetch parts and tools",
          "Steps 2 and 3 on the timing",
        ],
        [
          "The parts and tools are not at the line when the stop starts",
          "Tools are spread over three places",
        ],
        [
          "There is no standard kit and no home for the changeover tools",
          "No board or labels until the shadow board design",
        ],
      ],
      {
        method: [["Everything is done after the stop, none before", true]],
        machine: [["Guide rails need a spanner and two people", false]],
        material: [["Next format parts stored in the store room", true]],
        environment: [["Tool trolley is parked 8 m from the packer", false]],
      },
    );
    cm(
      slow,
      "Make the changeover shadow board with outlines and labels",
      "Josh",
      dayOffset(-6),
      "Done",
      { done: dayOffset(-8), cause: cid(slow, "Everything is done") },
    );
    cm(
      slow,
      "Stage the next format kit on a trolley the shift before",
      "Sam",
      dayOffset(-4),
      "Done",
      { done: dayOffset(-5), cause: cid(slow, "Next format parts") },
    );

    const clean = prob(
      {
        title: "Cleaning kit is missing at the start of the shift",
        status: "Closed",
        owner: "Sam",
        team: "Josh",
        raised: dayOffset(-50),
        closed: dayOffset(-12),
        category: "Housekeeping / 5S",
        area: areaId("Tooling and cleaning"),
        count: 9,
        mins: 45,
        background:
          "The first 5 minutes of the shift go on finding brushes and wipes.",
        current: "Missing on 9 of the last 20 starts.",
        target: "Complete on every start.",
        root: "The cleaning kit has no home and nothing shows what is missing, so it walks to other lines.",
        rootCheck: "yes",
        hypothesis:
          "The kit walks because it has no home and nobody can see what is missing.",
        confirm: "Shadow board fitted: complete on 12 starts out of 12.",
        checkOn: dayOffset(-14),
        result: "yes",
        after: "Complete on every start for the last 12 shifts.",
        standard:
          "Cleaning station shadow board with outlines, and a kit count on the start-of-shift checklist.",
        lessons: "The same shadow board idea fits the quality check station.",
        docs: [docId("Start-of-shift line checklist")].filter(Boolean),
      },
      [
        [
          "The brushes and wipes are taken to other lines",
          "Seen twice, found on Line 2",
        ],
        [
          "Nothing shows where they belong or that they are missing",
          "No board, no outline, no count",
        ],
      ],
      {
        method: [["No kit count on the start-of-shift checklist", true]],
        environment: [["Cleaning station has no shadow board", true]],
      },
    );
    cm(
      clean,
      "Make a shadow board for the cleaning station",
      "Sam",
      dayOffset(-30),
      "Done",
      { done: dayOffset(-24), cause: cid(clean, "Cleaning station has no") },
    );
    cm(
      clean,
      "Add the kit count to the start-of-shift checklist",
      "Josh",
      dayOffset(-20),
      "Done",
      { done: dayOffset(-16), cause: cid(clean, "No kit count") },
    );

    prob({
      title: "Pallets of cartons arrive without labels",
      owner: "Sam",
      raised: dayOffset(-6),
      category: "Information",
      area: areaId("Goods-in and WIP"),
      count: 3,
      mins: 35,
      tag:
        p.tags.find((t) => t.title === "Unlabelled pallet of cartons")?.id ||
        "",
      containment:
        "Unlabelled pallets are held in the red tag area until someone owns them.",
    });
    prob(
      {
        title: "The waste bin wanders off its home along the operator walkway",
        status: "Analysing",
        owner: "Josh",
        raised: dayOffset(-9),
        category: "Housekeeping / 5S",
        area: areaId("Packing line"),
        count: 5,
        mins: 10,
        current: "Out of place on 5 of the last 8 daily checks.",
        target: "In its home on every check.",
      },
      [["The bin is pushed along when the walkway is swept", "Seen on nights"]],
      {
        method: [
          [
            "Sweeping routine does not say to move the bin and put it back",
            false,
          ],
        ],
      },
    );
  }

  /* ----- daily checks: eight recent days of where things actually sat ----- */
  const rev = stdRev(p);
  let seed = 7;
  const rnd = () =>
    (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const jit = (m) => u((rnd() - 0.5) * 2 * m);
  const days = [-13, -12, -11, -8, -7, -6, -5, -4];
  days.forEach((off, n) => {
    const d = blankSheet("daily", "", std.drawing);
    d.date = dayOffset(off);
    d.shift = n % 3 === 2 ? "Nights" : "Days";
    d.checker = n % 2 ? "Sam" : "Josh";
    d.name = "Check " + fmtDate(d.date) + " " + d.shift;
    d.rev = rev;
    d.marks = std.marks.map((m) => ({
      ...JSON.parse(JSON.stringify(m)),
      id: uid(),
      status: "laid",
      damaged: false,
    }));
    for (const o of std.objects) {
      const c = { ...JSON.parse(JSON.stringify(o)), id: uid(), fp: false };
      if (o.kind === "item") {
        c.x += jit(0.1);
        c.y += jit(0.1);
        // the tool trolley really lives by the quality station, not by its marked home
        if (o.label === "Tool trolley" && n !== 2 && n !== 6) {
          c.x = u(10.4) + jit(0.1);
          c.y = u(14.2) + jit(0.1);
        }
        // the waste bin wanders along the operator side
        if (o.label === "Waste bin" && n % 2 === 0) {
          c.x = u(7 + n * 0.5) + jit(0.1);
          c.y = u(10.2 + (n % 4 === 0 ? 0.9 : 0.2));
        }
        if (o.label === "Film reel rack 2" && n === 5) c.x += u(0.7);
        // the spill kit gets left by the packer after a clean-up, outside its area
        if (o.label === "Spill kit" && n >= 5) {
          c.x = u(22.4) + jit(0.1);
          c.y = u(12.2) + jit(0.1);
        }
        if (o.label === "Pallet truck" && (n === 1 || n === 6)) continue; // missing
      }
      d.objects.push(c);
    }
    if (n !== 0 && n !== 3) {
      const id = uid();
      d.objects.push({
        id,
        ref: id,
        type: "Product bin",
        label: "Spare film cores (box)",
        kind: "item",
        x: u(15.5) + jit(0.15),
        y: u(6) + jit(0.15),
        w: u(0.6),
        h: u(0.4),
        a: 0,
        c: "#8A6A3F",
        fp: false,
        fpStyle: "corners",
        fpLaid: false,
        locked: false,
        note: "",
        category: "production",
      });
    }
    p.sheets.push(d);
  });

  p.settings.tolM = 0.3;
  return validate(p);
}

/* the example is added to your projects, so nothing you have is replaced */
async function loadExample() {
  const keep = [P, D];
  let ex;
  try {
    ex = makeExampleProject();
  } finally {
    [P, D] = keep;
  }
  if (ui.view !== "layout") setView("layout");
  await addProject(ex, {}, {}, "Example: model packing line");
  fitView();
  draw();
}
