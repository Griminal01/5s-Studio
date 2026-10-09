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
  pr.on = true;
  $("#present").hidden = false;
  document.body.classList.add("presenting");
  $("#present")
    .requestFullscreen?.()
    .catch(() => {});
  renderPresent();
  pokePresent();
}
function closePresent() {
  if (!pr.on) return;
  pr.on = false;
  stopTour();
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
      vw = Math.max(bw, (bh * W) / H),
      vh = (vw * H) / W,
      vb = [box.x0 + bw / 2 - vw / 2, box.y0 + bh / 2 - vh / 2, vw, vh],
      k = vw / W,
      ref = pr.compare ? cmpSheet() : null;
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
  } finally {
    ui.scope = saveScope;
    Object.assign(ui.layers, saveLayers);
  }
  stage.innerHTML = svgText;
  $("#prTitle").textContent = P.projectName || "Lean Studio project";
  $("#prSub").textContent = " · " + sh.name;
  $("#prStep").innerHTML =
    (step.kind ? `<small>${esc(step.kind)}</small> ` : "") +
    `<b>${esc(step.name)}</b> <span>${pr.i + 1} / ${pr.steps.length}</span>`;
  const cmpBtn = $("#prCmp");
  cmpBtn.hidden = sh.kind === "standard";
  cmpBtn.textContent = pr.compare ? "Hide changes" : "Show changes";
  $("#prPlay").textContent = pr.timer ? "❚❚ Pause" : "▶ Tour";
  $("#prPrev").disabled = $("#prNext").disabled = pr.steps.length < 2;
}
function stepPresent(d) {
  pr.i = (pr.i + d + pr.steps.length) % pr.steps.length;
  renderPresent();
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
    if (["Escape", "ArrowRight", "ArrowLeft", " ", "c", "C"].includes(k)) {
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
    else if ((k === "c" || k === "C") && S().kind !== "standard") {
      pr.compare = !pr.compare;
      renderPresent();
    }
    pokePresent();
  },
  true,
);
window.addEventListener("resize", () => pr.on && renderPresent());
// leaving full screen with Esc ends the presentation too
document.addEventListener("fullscreenchange", () => {
  if (pr.on && !document.fullscreenElement && pr.fs) closePresent();
  pr.fs = !!document.fullscreenElement;
});
