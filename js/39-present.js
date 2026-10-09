"use strict";
/* ============ presentation mode: the layout, full screen, for a TV or projector ============ */
// Shows the open sheet large and clean (no tools). The arrow keys, or the buttons that appear when the
// pointer moves, step through the whole factory, each line and each zone; Tour does that on a timer.
// It draws with its own scope and leaves the Showing picker alone.

const pr = {
  on: false,
  steps: [],
  i: 0,
  timer: null,
  compare: false,
  hide: null,
  z: 1, // zoom: 1 = the whole step fits the screen
  c: null, // centre of the zoomed view, in drawing units (null = centre of the step)
  base: null,
  vb: null,
  ptrs: new Map(),
};

function presentSteps() {
  const sh = STD(),
    lines = linesOn(sh),
    zones = areasOn(sh),
    steps = [{ id: "", name: "Whole factory" }];
  for (const l of lines) {
    steps.push({ id: l.id, name: l.name, kind: "Line" });
    for (const z of zones.filter((x) => x.parent === l.id))
      steps.push({ id: z.id, name: z.name, kind: "Zone" });
  }
  for (const z of zones.filter((x) => !lines.some((l) => l.id === x.parent)))
    steps.push({ id: z.id, name: z.name, kind: "Zone" });
  return steps;
}

function openPresent() {
  if (!P || ui.view !== "layout") return;
  pr.steps = presentSteps();
  pr.i = Math.max(
    0,
    pr.steps.findIndex((s) => s.id === ui.scope),
  );
  // a proposal or daily check is most useful with what changed shown
  pr.compare = S().kind !== "standard";
  pr.z = 1;
  pr.c = null;
  pr.on = true;
  $("#present").hidden = false;
  document.body.classList.add("presenting");
  // the whole page goes full screen (more dependable than one element); the overlay covers it
  document.documentElement.requestFullscreen?.().catch(() => {});
  renderPresent();
  // the size can change as full screen starts, so draw again whenever the stage changes size
  pr.watch ||= new ResizeObserver(() => renderPresent());
  pr.watch.observe($("#prStage"));
  requestAnimationFrame(renderPresent);
  pokePresent();
}
function closePresent() {
  if (!pr.on) return;
  pr.on = false;
  stopTour();
  pr.watch?.disconnect();
  $("#present").hidden = true;
  document.body.classList.remove("presenting");
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  draw();
}

function renderPresent() {
  if (!pr.on) return;
  const stage = $("#prStage"),
    sh = S(),
    step = pr.steps[pr.i] || pr.steps[0],
    W = stage.clientWidth,
    H = stage.clientHeight;
  if (!W || !H) return;
  const saveScope = ui.scope,
    saveLayers = { ...ui.layers };
  // names get bigger as you zoom in, so they can be read from across the room
  ui.textBoost = Math.min(1.5 + 0.7 * (pr.z - 1), 6);
  let svgText = "";
  try {
    ui.scope = step.id;
    const A = scopeArea(),
      d = DM(sh),
      box = A
        ? (() => {
            // a closer frame than the editor's: the zone and a little around it
            const b = areaBox(A),
              pad = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.1 + 4;
            return {
              x0: b.x0 - pad,
              y0: b.y0 - pad,
              x1: b.x1 + pad,
              y1: b.y1 + pad,
            };
          })()
        : {
            x0: -d.w * 0.015,
            y0: -d.h * 0.025,
            x1: d.w * 1.015,
            y1: d.h * 1.025,
          },
      bw = box.x1 - box.x0,
      bh = box.y1 - box.y0,
      bvw = Math.max(bw, (bh * W) / H),
      bvh = (bvw * H) / W,
      bc = { x: box.x0 + bw / 2, y: box.y0 + bh / 2 },
      // zoomed in: a smaller window on the drawing, so labels have room to show in full
      vw = bvw / pr.z,
      vh = bvh / pr.z,
      c = pr.z > 1 && pr.c ? pr.c : bc,
      vb = [c.x - vw / 2, c.y - vh / 2, vw, vh],
      k = vw / W,
      ref = pr.compare ? cmpSheet() : null;
    pr.base = { vw: bvw, vh: bvh, c: bc };
    pr.vb = vb;
    Object.assign(ui.layers, {
      drawing: true,
      fixed: true,
      objects: true,
      marks: true,
      routes: true,
      areas: true,
      overlay: !!ref,
      pins: false,
      docs: false,
      dims: false,
      runs: false,
      grid: false,
    });
    svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map((v) => Math.round(v * 100) / 100).join(" ")}" width="${W}" height="${H}" aria-label="Layout">${buildSVG(sh, { k, cmp: ref ? compare(sh, ref) : null, scoped: true, export: true })}</svg>`;
  } catch (err) {
    console.error(err);
    svgText = `<p style="padding:24px;color:#1c2250;font-size:18px">The layout could not be drawn for the presentation (${esc(err.message)}). Press Exit and try again.</p>`;
  } finally {
    ui.scope = saveScope;
    ui.textBoost = 0;
    Object.assign(ui.layers, saveLayers);
  }
  stage.innerHTML = svgText;
  $("#prTitle").textContent = P.projectName || "Lean Studio project";
  $("#prSub").textContent = " · " + sh.name;
  $("#prStep").innerHTML =
    (step.kind ? `<small>${esc(step.kind)}</small> ` : "") +
    `<b>${esc(step.name)}</b> <span>${pr.i + 1} / ${pr.steps.length}${pr.z > 1 ? " · " + pr.z.toFixed(1) + "×" : ""}</span>`;
  stage.classList.toggle("zoomed", pr.z > 1);
  $("#prOut").disabled = $("#prFit").disabled = pr.z <= 1;
  const cmpBtn = $("#prCmp");
  cmpBtn.hidden = sh.kind === "standard";
  cmpBtn.textContent = pr.compare ? "Hide changes" : "Show changes";
  $("#prPlay").textContent = pr.timer ? "❚❚ Pause" : "▶ Tour";
  $("#prPrev").disabled = $("#prNext").disabled = pr.steps.length < 2;
}
function stepPresent(d) {
  pr.i = (pr.i + d + pr.steps.length) % pr.steps.length;
  pr.z = 1;
  pr.c = null;
  renderPresent();
}
/* zoom by a factor about a point of the stage (px, py in pixels; the middle if not given) */
let zoomFrame = 0;
function zoomPresent(f, px, py) {
  const stage = $("#prStage"),
    W = stage.clientWidth,
    H = stage.clientHeight;
  if (!pr.vb || !W) return;
  px ??= W / 2;
  py ??= H / 2;
  const [x, y, w, h] = pr.vb,
    wx = x + (px / W) * w,
    wy = y + (py / H) * h,
    z = clamp(pr.z * f, 1, 14);
  if (z === pr.z) return;
  const nw = pr.base.vw / z,
    nh = pr.base.vh / z;
  pr.z = z;
  // the drawing point under the pointer stays under it
  pr.c =
    z === 1
      ? null
      : { x: wx - (px / W) * nw + nw / 2, y: wy - (py / H) * nh + nh / 2 };
  cancelAnimationFrame(zoomFrame);
  zoomFrame = requestAnimationFrame(renderPresent);
}
function resetZoom() {
  pr.z = 1;
  pr.c = null;
  renderPresent();
}
/* drag: move the zoomed view without drawing it again */
function panPresent(dx, dy) {
  const stage = $("#prStage"),
    svg = stage.querySelector("svg");
  if (!svg || !pr.vb || pr.z <= 1) return;
  const k = pr.vb[2] / stage.clientWidth;
  pr.vb = [pr.vb[0] - dx * k, pr.vb[1] - dy * k, pr.vb[2], pr.vb[3]];
  pr.c = { x: pr.vb[0] + pr.vb[2] / 2, y: pr.vb[1] + pr.vb[3] / 2 };
  svg.setAttribute(
    "viewBox",
    pr.vb.map((v) => Math.round(v * 100) / 100).join(" "),
  );
}
function stopTour() {
  clearInterval(pr.timer);
  pr.timer = null;
}
function toggleTour() {
  if (pr.timer) stopTour();
  else if (pr.steps.length > 1)
    pr.timer = setInterval(() => stepPresent(1), 8000);
  renderPresent();
}
/* the buttons show when the pointer moves or a key is pressed, and fade after a few seconds */
function pokePresent() {
  $("#present").classList.add("active");
  clearTimeout(pr.hide);
  pr.hide = setTimeout(() => $("#present").classList.remove("active"), 3500);
}

$("#bPresent").onclick = openPresent;
$("#prExit").onclick = closePresent;
$("#prPrev").onclick = () => stepPresent(-1);
$("#prNext").onclick = () => stepPresent(1);
$("#prPlay").onclick = toggleTour;
$("#prIn").onclick = () => zoomPresent(1.6);
$("#prOut").onclick = () => zoomPresent(1 / 1.6);
$("#prFit").onclick = resetZoom;
$("#prCmp").onclick = () => {
  pr.compare = !pr.compare;
  renderPresent();
};
$("#present").addEventListener("pointermove", pokePresent);
$("#present").addEventListener("pointerdown", pokePresent);
document.addEventListener(
  "keydown",
  (e) => {
    if (!pr.on) return;
    const k = e.key;
    if (
      [
        "Escape",
        "ArrowRight",
        "ArrowLeft",
        " ",
        "c",
        "C",
        "+",
        "=",
        "-",
        "_",
        "0",
      ].includes(k)
    ) {
      e.preventDefault();
      e.stopPropagation();
    } else if (!e.ctrlKey && !e.metaKey) {
      e.stopPropagation(); // editing shortcuts do nothing while presenting
      return;
    }
    if (k === "Escape") closePresent();
    else if (k === "ArrowRight") stepPresent(1);
    else if (k === "ArrowLeft") stepPresent(-1);
    else if (k === " ") toggleTour();
    else if (k === "+" || k === "=") zoomPresent(1.6);
    else if (k === "-" || k === "_") zoomPresent(1 / 1.6);
    else if (k === "0") resetZoom();
    else if ((k === "c" || k === "C") && S().kind !== "standard") {
      pr.compare = !pr.compare;
      renderPresent();
    }
    pokePresent();
  },
  true,
);
/* the stage: wheel and pinch zoom, drag to move, double click or tap to zoom in */
{
  const stage = $("#prStage"),
    at = (e) => {
      const r = stage.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
  let pinch = 0;
  // on the document, so the browser always passes the wheel to the page while presenting
  document.addEventListener(
    "wheel",
    (e) => {
      if (!pr.on) return;
      e.preventDefault();
      if (stage.contains(e.target))
        zoomPresent(e.deltaY < 0 ? 1.2 : 1 / 1.2, ...at(e));
    },
    { passive: false },
  );
  stage.addEventListener("pointerdown", (e) => {
    stage.setPointerCapture(e.pointerId);
    pr.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pr.ptrs.size === 2) {
      const [a, b] = [...pr.ptrs.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    }
  });
  stage.addEventListener("pointermove", (e) => {
    const p = pr.ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pr.ptrs.size === 2) {
      const [a, b] = [...pr.ptrs.values()],
        d = Math.hypot(a.x - b.x, a.y - b.y) || 1,
        r = stage.getBoundingClientRect();
      zoomPresent(d / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinch = d;
    } else panPresent(dx, dy);
  });
  const up = (e) => pr.ptrs.delete(e.pointerId);
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("dblclick", (e) =>
    pr.z >= 6 ? resetZoom() : zoomPresent(2.5, ...at(e)),
  );
}
window.addEventListener("resize", () => pr.on && renderPresent());
// leaving full screen with Esc ends the presentation too
document.addEventListener("fullscreenchange", () => {
  if (pr.on && !document.fullscreenElement && pr.fs) closePresent();
  pr.fs = !!document.fullscreenElement;
});
