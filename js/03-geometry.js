"use strict";
/* ============ geometry ============
   Geometry on drawing units: rotated rectangles (corners, overlap), points and segments, polygon
   length, fixed structure (fxRects, fxNorm normalises saved fixed objects), tape offsets and aisles,
   viewInDrawing (keeps a zone's view on the drawing). */
function corners(o, pad = 0) {
  const r = (o.a * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r),
    hw = o.w / 2 + pad,
    hh = o.h / 2 + pad;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => ({ x: o.x + x * c - y * s, y: o.y + x * s + y * c }));
}
function overlap(a, b) {
  const A = corners(a),
    B = corners(b);
  for (const poly of [A, B])
    for (let i = 0; i < 4; i++) {
      const p = poly[i],
        q = poly[(i + 1) % 4],
        ax = -(q.y - p.y),
        ay = q.x - p.x;
      let a1 = Infinity,
        a2 = -Infinity,
        b1 = Infinity,
        b2 = -Infinity;
      for (const v of A) {
        const d = v.x * ax + v.y * ay;
        a1 = Math.min(a1, d);
        a2 = Math.max(a2, d);
      }
      for (const v of B) {
        const d = v.x * ax + v.y * ay;
        b1 = Math.min(b1, d);
        b2 = Math.max(b2, d);
      }
      if (a2 <= b1 || b2 <= a1) return false;
    }
  return true;
}
function segX(p, q, r, s) {
  const d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d,
    u = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
    ? { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) }
    : null;
}
const polyLen = (pts) => {
  let s = 0;
  for (let i = 1; i < pts.length; i++)
    s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
};
const markLen = (m) => polyLen(m.closed ? [...m.pts, m.pts[0]] : m.pts);

/* fixed structure drawn on the base drawing: walls, columns, doors and fixed equipment */
function fxRects(sh) {
  const out = [];
  for (const f of DM(sh)?.fixed || []) {
    if (f.t === "wall") {
      const q = f.closed ? [...f.pts, f.pts[0]] : f.pts;
      for (let i = 1; i < q.length; i++) {
        const a = q[i - 1],
          b = q[i],
          L = Math.hypot(b.x - a.x, b.y - a.y);
        if (L < 1e-6) continue;
        out.push({
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          w: L + f.th,
          h: f.th,
          a: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
          wall: f,
        });
      }
    } else if (f.t === "block" && !f.passable)
      out.push({ x: f.x, y: f.y, w: f.w, h: f.h, a: f.a, solid: f });
  }
  return out;
}
const fxDoors = (sh) =>
  (DM(sh)?.fixed || []).filter((f) => f.t === "block" && f.passable);
function ptInRect(p, z) {
  const r = (-z.a * Math.PI) / 180,
    dx = p.x - z.x,
    dy = p.y - z.y,
    lx = dx * Math.cos(r) - dy * Math.sin(r),
    ly = dx * Math.sin(r) + dy * Math.cos(r);
  return Math.abs(lx) <= z.w / 2 && Math.abs(ly) <= z.h / 2;
}
function segRectHit(p, q, z) {
  const c = corners(z);
  for (let i = 0; i < 4; i++) {
    const h = segX(p, q, c[i], c[(i + 1) % 4]);
    if (h) return h;
  }
  return ptInRect(p, z) ? { x: p.x, y: p.y } : null;
}
const fxNorm = (f) => {
  if (!f || typeof f !== "object") return null;
  const id = String(f.id || uid()),
    hex = /^#[0-9a-f]{6}$/i,
    c = hex.test(f.c) ? f.c : "#4A4F66",
    label = String(f.label || "");
  if (f.t === "wall") {
    if (
      !Array.isArray(f.pts) ||
      f.pts.length < 2 ||
      !f.pts.every(
        (q) => q && q && Number.isFinite(q.x) && Number.isFinite(q.y),
      )
    )
      return null;
    return {
      id,
      t: "wall",
      label: label || "Wall",
      pts: f.pts.map((q) => ({ x: q.x, y: q.y })),
      closed: !!f.closed,
      th: Number.isFinite(f.th) && f.th > 0 ? f.th : 2,
      c,
      locked: !!f.locked,
    };
  }
  if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) return null;
  const a = Number.isFinite(Number(f.a)) ? Number(f.a) : 0;
  if (f.t === "text") {
    const fs = Number.isFinite(f.fs) && f.fs > 0 ? f.fs : 10,
      lb = label || "Label";
    return {
      id,
      t: "text",
      label: lb,
      x: f.x,
      y: f.y,
      fs,
      w: Math.max(1, lb.length) * fs * 0.6,
      h: fs * 1.3,
      a,
      c: hex.test(f.c) ? f.c : "#1C2250",
      locked: !!f.locked,
    };
  }
  if (
    !(f.w > 0) ||
    !(f.h > 0) ||
    !Number.isFinite(f.w) ||
    !Number.isFinite(f.h)
  )
    return null;
  if (f.t === "mask")
    return {
      id,
      t: "mask",
      label: label || "Cover up",
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      a,
      c: "#FFFFFF",
      locked: !!f.locked,
    };
  if (f.t === "block")
    return {
      id,
      t: "block",
      label: label || "Fixed object",
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
      a,
      c,
      passable: !!f.passable,
      locked: !!f.locked,
    };
  return null;
};

/* floor marking geometry */
function dedupePts(pts) {
  const out = [];
  for (const p of pts)
    if (
      !out.length ||
      Math.hypot(p.x - out.at(-1).x, p.y - out.at(-1).y) > 1e-6
    )
      out.push(p);
  return out;
}
function offsetPoly(pts0, d) {
  const pts = dedupePts(pts0),
    n = pts.length;
  if (n < 2) return pts.map((p) => ({ x: p.x, y: p.y }));
  const nor = (i) => {
      const a = pts[i],
        b = pts[i + 1],
        dx = b.x - a.x,
        dy = b.y - a.y,
        L = Math.hypot(dx, dy) || 1;
      return { x: -dy / L, y: dx / L };
    },
    out = [];
  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1) {
      const nn = nor(i === 0 ? 0 : n - 2);
      out.push({ x: pts[i].x + nn.x * d, y: pts[i].y + nn.y * d });
      continue;
    }
    const n1 = nor(i - 1),
      n2 = nor(i),
      bx = n1.x + n2.x,
      by = n1.y + n2.y,
      bl = Math.hypot(bx, by);
    if (bl < 1e-6) {
      out.push({ x: pts[i].x + n1.x * d, y: pts[i].y + n1.y * d });
      continue;
    }
    const ux = bx / bl,
      uy = by / bl,
      cs = Math.max(ux * n1.x + uy * n1.y, 0.25);
    out.push({
      x: pts[i].x + (ux * d) / cs,
      y: pts[i].y + (uy * d) / cs,
    });
  }
  return out;
}
const aisleEdges = (m) => ({
  a: offsetPoly(m.pts, m.width / 2),
  b: offsetPoly(m.pts, -m.width / 2),
});
function aisleRects(m) {
  const pts = dedupePts(m.pts),
    out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      L = Math.hypot(b.x - a.x, b.y - a.y);
    out.push({
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      w: L,
      h: m.width,
      a: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    });
  }
  return out;
}
function distToRect(p, z) {
  const r = (-z.a * Math.PI) / 180,
    dx = p.x - z.x,
    dy = p.y - z.y,
    lx = dx * Math.cos(r) - dy * Math.sin(r),
    ly = dx * Math.sin(r) + dy * Math.cos(r);
  return Math.hypot(
    Math.max(Math.abs(lx) - z.w / 2, 0),
    Math.max(Math.abs(ly) - z.h / 2, 0),
  );
}
function nearestStruct(sh, p) {
  let best = null;
  for (const z of fxRects(sh)) {
    const d = distToRect(p, z);
    if (!best || d < best.d)
      best = { d, label: (z.wall || z.solid).label || "Wall" };
  }
  return best;
}
const markTape = (m) =>
  m.kind === "arrow" ? 0 : markLen(m) * (m.kind === "aisle" ? 2 : 1);
function homeLen(o, sh) {
  const pad = 0.05 * upm(sh);
  return o.fpStyle === "outline"
    ? 2 * (o.w + o.h + 4 * pad)
    : 8 * (Math.min(o.w, o.h) * 0.3 + pad);
}
// slide a view (x, y, w, h) so it shows the drawing (dw x dh) rather than empty space past its edge;
// a view wider or taller than the drawing is centred on it in that direction
function viewInDrawing(x, y, w, h, dw, dh) {
  const ax = dw * 0.015,
    ay = dh * 0.025,
    slide = (v, len, size, m) =>
      len >= size + 2 * m ? (size - len) / 2 : clamp(v, -m, size + m - len);
  return { x: slide(x, w, dw, ax), y: slide(y, h, dh, ay) };
}
