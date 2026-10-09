"use strict";
/* ============ basics ============ */
const TOUCH = matchMedia("(pointer:coarse)").matches ? 1.7 : 1;
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const RATIO0 = 1.7839135654261704; // blank drawing aspect ratio (1000 x ~560)
const LSKEY = "studio5s-recovery"; // browser fallback copy if the database cannot be written
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = (x) => JSON.parse(JSON.stringify(x));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
const n2 = (v) => Math.round(v * 100) / 100;
const today = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};
const fmtDate = (s) => {
  if (!s) return "Undated";
  const d = new Date(s + "T12:00");
  return isNaN(d)
    ? s
    : d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
};
const angDiff = (a, b) => {
  let d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};
