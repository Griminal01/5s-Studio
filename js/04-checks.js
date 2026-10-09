"use strict";
/* ============ checks ============ */
function keepClears(sh) {
  const ref = sh.kind === "daily" ? stdFor(sh) : null;
  const own = sh.objects.filter((o) => o.kind === "keepclear");
  if (ref)
    for (const z of ref.objects)
      if (z.kind === "keepclear" && !sh.objects.some((o) => o.ref === z.ref))
        own.push(z);
  return own;
}
function conflicts(sh) {
  const out = [],
    W = sh.routes.filter((r) => r.who === "walk"),
    V = sh.routes.filter((r) => r.who === "vehicle");
  for (const w of W)
    for (const v of V)
      for (let i = 1; i < w.pts.length; i++)
        for (let j = 1; j < v.pts.length; j++) {
          const p = segX(w.pts[i - 1], w.pts[i], v.pts[j - 1], v.pts[j]);
          if (p && !out.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 2))
            out.push({ ...p, w, v });
        }
  return out;
}
function issues(sh) {
  const kc = keepClears(sh),
    blocked = [];
  for (const o of sh.objects)
    if (o.kind === "item")
      for (const z of kc)
        if (overlap(o, z)) {
          blocked.push({ o, z });
          break;
        }
  const structure = [],
    wallHits = [],
    FR = fxRects(sh),
    DR = fxDoors(sh);
  if (FR.length || DR.length) {
    for (const o of sh.objects) {
      if (o.kind !== "item") continue;
      const r = Math.hypot(o.w, o.h) / 2;
      let hit = false;
      for (const d of DR) {
        if (Math.hypot(o.x - d.x, o.y - d.y) > r + Math.hypot(d.w, d.h) / 2)
          continue;
        if (overlap(o, d)) {
          structure.push({ o, z: d, door: true });
          hit = true;
          break;
        }
      }
      if (!hit)
        for (const z of FR) {
          if (Math.hypot(o.x - z.x, o.y - z.y) > r + Math.hypot(z.w, z.h) / 2)
            continue;
          if (overlap(o, z)) {
            structure.push({ o, z: z.wall || z.solid });
            break;
          }
        }
    }
    const pad = mpu(sh) ? 0.3 / mpu(sh) : 2;
    for (const r of sh.routes)
      for (let i = 1; i < r.pts.length; i++)
        for (const z of FR) {
          const h = segRectHit(r.pts[i - 1], r.pts[i], z);
          if (
            h &&
            !DR.some((d) =>
              ptInRect(h, {
                x: d.x,
                y: d.y,
                w: d.w + pad * 2,
                h: d.h + pad * 2,
                a: d.a,
              }),
            ) &&
            !wallHits.some(
              (w) => w.r === r && Math.hypot(w.x - h.x, w.y - h.y) < 3,
            )
          )
            wallHits.push({ x: h.x, y: h.y, r, z: z.wall || z.solid });
        }
  }
  const walkBlock = [],
    aisleClash = [],
    aisleNarrow = [],
    padD = mpu(sh) ? 0.3 / mpu(sh) : 2;
  for (const mk of sh.marks) {
    if (mk.kind !== "aisle") continue;
    const R = aisleRects(mk);
    if (mpu(sh) && mk.width * mpu(sh) < P.marking.minAisle - 1e-6)
      aisleNarrow.push(mk);
    for (const o of sh.objects) {
      if (o.kind !== "item" || walkBlock.some((w) => w.o === o)) continue;
      const r0 = Math.hypot(o.w, o.h) / 2;
      for (const z of R) {
        if (Math.hypot(o.x - z.x, o.y - z.y) > r0 + Math.hypot(z.w, z.h) / 2)
          continue;
        if (overlap(o, z)) {
          walkBlock.push({ o, m: mk });
          break;
        }
      }
    }
    const done = new Set();
    for (const z of FR) {
      const sid = (z.wall || z.solid).id;
      if (done.has(sid)) continue;
      for (const r of R) {
        if (
          Math.hypot(r.x - z.x, r.y - z.y) >
          Math.hypot(r.w, r.h) / 2 + Math.hypot(z.w, z.h) / 2
        )
          continue;
        if (
          overlap(r, z) &&
          !(
            z.wall &&
            DR.some((d) =>
              overlap(r, {
                x: d.x,
                y: d.y,
                w: d.w + padD * 2,
                h: d.h + padD * 2,
                a: d.a,
              }),
            )
          )
        ) {
          aisleClash.push({
            m: mk,
            z: z.wall || z.solid,
            x: r.x,
            y: r.y,
          });
          done.add(sid);
          break;
        }
      }
    }
  }
  return {
    blocked,
    structure,
    wallHits,
    walkBlock,
    aisleClash,
    aisleNarrow,
    conflicts: conflicts(sh),
    outOfArea: outOfArea(sh),
    damaged: sh.marks.filter((m) => m.status === "worn"),
  };
}
function compare(a, b) {
  const tol = tolU(a),
    rt = P.settings.rotTol,
    res = {
      ref: b,
      items: 0,
      inPlace: 0,
      ok: [],
      moved: [],
      missing: [],
      extra: [],
      tapeMissing: [],
      tapeExtra: [],
      ...issues(a),
    };
  const objectsByRef = new Map();
  for (const o of a.objects)
    if (!objectsByRef.has(o.ref)) objectsByRef.set(o.ref, o);
  const baseRefs = new Set(b.objects.map((o) => o.ref)),
    markRefs = new Set(a.marks.map((m) => m.ref)),
    baseMarkRefs = new Set(b.marks.map((m) => m.ref));
  for (const r of b.objects) {
    if (r.kind !== "item") continue;
    res.items++;
    const o = objectsByRef.get(r.ref);
    if (!o) {
      res.missing.push(r);
      continue;
    }
    const d = Math.hypot(o.x - r.x, o.y - r.y),
      da = angDiff(o.a, r.a);
    if (d > tol || da > rt) res.moved.push({ o, r, d, da });
    else {
      res.inPlace++;
      res.ok.push(o);
    }
  }
  for (const o of a.objects)
    if (o.kind === "item" && !baseRefs.has(o.ref)) res.extra.push(o);
  for (const m of b.marks)
    if (m.status !== "planned" && !markRefs.has(m.ref)) res.tapeMissing.push(m);
  for (const m of a.marks) if (!baseMarkRefs.has(m.ref)) res.tapeExtra.push(m);
  res.score = res.items ? Math.round((res.inPlace / res.items) * 100) : null;
  res.issueCount =
    res.moved.length +
    res.missing.length +
    res.extra.length +
    res.blocked.length +
    res.structure.length +
    res.walkBlock.length +
    res.aisleClash.length +
    res.outOfArea.length +
    res.damaged.length +
    res.tapeMissing.length;
  return res;
}
function cmpSheet() {
  const s = S();
  if (ui.cmp === "auto") return s.kind === "standard" ? null : stdFor(s);
  if (!ui.cmp) return null;
  // a choice that is the sheet itself (or has been deleted) compares with the standard, as the picker shows
  return (
    P.sheets.find((x) => x.id === ui.cmp && x.id !== s.id) ||
    (s.kind === "standard" ? null : stdFor(s))
  );
}
const scoreCls = (v) =>
  v == null
    ? ""
    : v >= P.settings.target
      ? "ok"
      : v >= P.settings.target - 15
        ? "warn"
        : "bad";
const scoreCol = (v) =>
  ({ ok: "var(--ok)", warn: "#F79622", bad: "var(--bad)" })[scoreCls(v)] ||
  "#C9CDDA";
function perShift(r) {
  return r.per === "hour" ? r.trips * P.settings.shiftH : r.trips;
}
function moveTotals(sh) {
  const t = { walk: 0, vehicle: 0, walkTrips: 0 };
  for (const r of sh.routes) {
    const L = polyLen(r.pts) * perShift(r);
    t[r.who] += L;
    if (r.who === "walk") t.walkTrips += perShift(r);
  }
  return t;
}
function s5Total(sh) {
  const v = S5.map(([k]) => sh.s5?.[k]).filter((x) => x != null);
  return v.length === 5 ? v.reduce((a, b) => a + b, 0) : null;
}

// Keep raster drawings untouched; sanitize SVG drawings before embedding them.
function safeImage(value) {
  if (typeof value !== "string") return "";
  if (
    /^data:image\/(?:png|jpeg|jpg|webp|gif|bmp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(
      value,
    )
  )
    return value;
  const match = value.match(
    /^data:image\/svg\+xml;base64,([A-Za-z0-9+/=\r\n]+)$/i,
  );
  if (!match) return "";
  try {
    const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
    const source = new TextDecoder().decode(bytes);
    if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(source)) return "";
    const doc = new DOMParser().parseFromString(source, "image/svg+xml"),
      root = doc.documentElement;
    if (root.localName !== "svg" || doc.querySelector("parsererror")) return "";
    if (!root.hasAttribute("xmlns"))
      root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blocked = new Set([
      "script",
      "foreignObject",
      "iframe",
      "object",
      "embed",
      "audio",
      "video",
      "animate",
      "animateMotion",
      "animateTransform",
      "set",
      "discard",
    ]);
    for (const el of [root, ...root.querySelectorAll("*")]) {
      if (blocked.has(el.localName)) {
        el.remove();
        continue;
      }
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase(),
          value = attr.value.trim();
        if (name.startsWith("on") || name === "xml:base") {
          el.removeAttributeNode(attr);
          continue;
        }
        if (
          (name === "href" || name.endsWith(":href")) &&
          !value.startsWith("#")
        ) {
          el.removeAttributeNode(attr);
          continue;
        }
        if (
          (name === "style" || el.localName === "style") &&
          /@import|url\s*\(/i.test(name === "style" ? value : el.textContent)
        ) {
          if (name === "style") el.removeAttributeNode(attr);
          else el.remove();
        }
      }
    }
    for (const style of [...root.querySelectorAll("style")])
      if (/@import|url\s*\(/i.test(style.textContent)) style.remove();
    const clean = new XMLSerializer().serializeToString(root),
      encoded = Array.from(new TextEncoder().encode(clean), (b) =>
        String.fromCharCode(b),
      ).join("");
    return "data:image/svg+xml;base64," + btoa(encoded);
  } catch {
    return "";
  }
}
function imageMap(value) {
  const out = {};
  if (value && typeof value === "object" && !Array.isArray(value))
    for (const [key, src] of Object.entries(value)) {
      const safe = safeImage(src);
      if (safe)
        Object.defineProperty(out, key, {
          value: safe,
          enumerable: true,
          writable: true,
          configurable: true,
        });
    }
  return out;
}
