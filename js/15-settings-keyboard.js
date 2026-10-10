"use strict";
/* ============ settings ============
   Settings dialog, keyboard shortcuts (document keydown), zoom buttons, the full-screen drawing
   (setDrawFocus), the phone sheet-bar Options button, undo / redo buttons, print hooks. */
$("#bSettings").onclick = async () => {
  const s = P.settings,
    m = mpu();
  let next = ""; // a second dialog opens only after this one has finished closing
  const r = await modal(
    "Settings",
    `<div class="row2"><label class="f">Counts as moved beyond (${m ? "m" : "drawing units"})<input name="tol" type="number" step="any" min="0.05" value="${m ? s.tolM : s.tolU}"></label><label class="f">Or turned more than (°)<input name="rot" type="number" step="any" min="1" value="${esc(s.rotTol)}"></label></div>
    <div class="row2"><label class="f">Score is green above (%)<input name="target" type="number" min="1" max="100" value="${esc(s.target)}"></label><label class="f">Walking speed (m/s)<input name="walk" type="number" step="any" min="0.3" value="${esc(s.walk)}"></label></div>
    <label class="f">Shift length (hours)<input name="shiftH" type="number" step="any" min="1" value="${esc(s.shiftH)}"></label>
    <h3>Scale</h3><p class="small muted" style="margin:0 0 6px">${m ? `10 m = ${Math.round(10 / m)} drawing units on this drawing.` : "Not set on this drawing yet."}</p>
    <div class="btns"><button type="button" id="stScale">Set scale with Measure</button>${m ? '<button type="button" id="stClear">Clear scale</button>' : ""}</div>
    <h3>Branding</h3><div class="btns"><button type="button" id="stLogo">Add logo</button>${P.logo ? '<button type="button" id="stNoLogo">Remove logo</button>' : ""}</div><p class="small muted" style="margin:0">Use an approved logo file, not a screenshot.</p>
    <h3>Start again</h3><div class="btns"><button type="button" id="stExample">Open the example model line</button><button type="button" id="stReset">New empty project</button></div><p class="small muted" style="margin:0">Both are added to My projects (the person icon at the top right).</p>`,
    "Save settings",
    {
      onOpen: (d) => {
        $("#stScale").onclick = () => {
          d.close("cancel");
          setView("layout");
          setTool("measure");
        };
        $("#stClear") &&
          ($("#stClear").onclick = () => {
            checkpoint();
            DM().mpu = null;
            record("Scale cleared", "");
            d.close("cancel");
            renderAll();
          });
        $("#stLogo").onclick = () => {
          d.close("cancel");
          $("#fLogo").click();
        };
        $("#stNoLogo") &&
          ($("#stNoLogo").onclick = () => {
            checkpoint();
            P.logo = "";
            d.close("cancel");
            renderAll();
          });
        $("#stExample").onclick = () => {
          next = "example";
          d.close("cancel");
        };
        $("#stReset").onclick = () => {
          next = "reset";
          d.close("cancel");
        };
      },
    },
  );
  if (next === "example") return void loadExample();
  if (next === "reset") {
    const q = await modal(
      "New empty project",
      '<label class="f">Name<input name="n" required placeholder="e.g. Packing line, big redesign"></label><p class="small muted">It is added to My projects. Nothing you have is changed.</p>',
      "Create",
    );
    if (q) await startNewProject(q.n.trim());
    return;
  }
  if (!r) return;
  checkpoint();
  const num = (v, d) => (Number(v) > 0 ? Number(v) : d);
  if (m) s.tolM = num(r.tol, s.tolM);
  else s.tolU = num(r.tol, s.tolU);
  s.rotTol = num(r.rot, s.rotTol);
  s.target = clamp(num(r.target, s.target), 1, 100);
  s.walk = num(r.walk, s.walk);
  s.shiftH = num(r.shiftH, s.shiftH);
  record("Settings changed", "");
  renderAll();
};

/* ============ keyboard ============ */
document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || $("#dlg").open) return;
  const mod = e.ctrlKey || e.metaKey,
    key = e.key.toLowerCase();
  if (mod && key === "z") {
    e.preventDefault();
    e.shiftKey ? restore(redoS, undoS) : restore(undoS, redoS);
    return;
  }
  if (mod && key === "y") {
    e.preventDefault();
    restore(redoS, undoS);
    return;
  }
  if (mod && key === "s") {
    e.preventDefault();
    saveProject();
    return;
  }
  if (mod && key === "d" && ui.view === "layout") {
    e.preventDefault();
    act("dup");
    return;
  }
  if (mod && ui.view === "layout" && !window.getSelection()?.toString()) {
    if (key === "c" && ui.sel.length) {
      e.preventDefault();
      copySel();
      return;
    }
    if (key === "v" && ui.clip) {
      e.preventDefault();
      pasteClip();
      return;
    }
    if (key === "a") {
      e.preventDefault();
      selectAll();
      return;
    }
  }
  if (mod || e.altKey || ui.view !== "layout") return;
  if (e.key === " ") {
    if (["BUTTON", "SUMMARY"].includes(tag)) return;
    ui.space = true;
    e.preventDefault();
    return;
  }
  if (e.key === "Escape") {
    if (ui.draft) cancelDraft();
    else if (ui.tool !== "select") setTool("select");
    else if (ui.sel.length) {
      ui.sel = [];
      draw();
      renderSide();
    }
    return;
  }
  if (e.key === "Enter" && ui.draft) {
    finishDraft();
    return;
  }
  if (e.key === "Backspace" && ui.draft) {
    e.preventDefault();
    ui.draft.pts.pop();
    if (!ui.draft.pts.length) ui.draft = null;
    updateHint();
    draw();
    return;
  }
  if ((e.key === "Delete" || e.key === "Backspace") && ui.sel.length) {
    e.preventDefault();
    act("del");
    return;
  }
  const arrows = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }[e.key];
  if (arrows && ui.sel.length) {
    e.preventDefault();
    const st = snapStep(S()) * (e.shiftKey ? 10 : 1),
      [dx, dy] = arrows.map((v) => v * st);
    if (!selected().some((f) => !f.x.locked)) return;
    if (!e.repeat) checkpoint(); // one undo step for a held key
    for (const f of selected()) {
      if (f.x.locked) continue;
      if (f.t === "obj") {
        f.x.x += dx;
        f.x.y += dy;
      } else f.x.pts = f.x.pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
    draw();
    renderSide();
    save();
    return;
  }
  if (key === "r" && ui.sel.length) {
    act("rot90");
    return;
  }
  if (ui.tool === "tape" && /^[1-9]$/.test(e.key)) {
    const ids = P.marking.types.map((t) => t.id),
      id = ids[+e.key - 1];
    if (id) {
      ui.tape = id;
      renderTools();
      draw();
    }
    return;
  }
  const tools = ui.editDrawing
    ? { v: "select", w: "wall", m: "measure" }
    : {
        v: "select",
        t: "tape",
        w: "route",
        m: "measure",
        g: "tag",
        a: "action",
        q: "area",
      };
  if (tools[key]) {
    setTool(tools[key]);
    return;
  }
  if (key === "f") {
    if (ui.sel.length) zoomToSel();
    else {
      fitView();
      draw();
    }
    return;
  }
  if (e.key === "?") shortcutsModal();
});
document.addEventListener("keyup", (e) => {
  if (e.key === " ") ui.space = false;
});
window.addEventListener("blur", () => {
  ui.space = false;
  ptrs.clear();
  ui.pinch = null;
  if (ui.drag) {
    endDrag({ pointerId: -1 });
    draw();
  }
});
$("#zIn").onclick = () => zoomAt(1.3);
$("#zOut").onclick = () => zoomAt(1 / 1.3);
$("#zFit").onclick = () => {
  fitView();
  draw();
};
// the drawing on its own: hides the header, page bars and sheet bar (useful on a phone)
function setDrawFocus(on) {
  document.body.classList.toggle("drawfocus", on);
  const b = $("#zFull");
  b.setAttribute("aria-pressed", String(on));
  b.textContent = on ? "✕" : "⛶";
  b.title = on
    ? "Back to the page (Esc)"
    : "Drawing full screen (Esc to come back)";
  requestAnimationFrame(() => {
    fitView();
    draw();
  });
}
// phones: say once, kindly, that drawing the layout is a computer job
const PHONE_HINT = "studio5s-phonehint",
  phoneMQ = matchMedia("(max-width: 760px)");
function updatePhoneHint() {
  let seen = false;
  try {
    seen = !!localStorage.getItem(PHONE_HINT);
  } catch {}
  $("#phoneHint").hidden = seen || !phoneMQ.matches;
}
$("#phoneHintOk").onclick = () => {
  try {
    localStorage.setItem(PHONE_HINT, "1");
  } catch {}
  $("#phoneHint").hidden = true;
};
phoneMQ.addEventListener("change", updatePhoneHint);
updatePhoneHint();
$("#sbMore").onclick = () => {
  const bar = $(".sheetbar"),
    open = bar.classList.toggle("open");
  $("#sbMore").setAttribute("aria-expanded", String(open));
  $("#sbMore").textContent = open ? "Less" : "Options";
  requestAnimationFrame(() => draw());
};
$("#zFull").onclick = () =>
  setDrawFocus(!document.body.classList.contains("drawfocus"));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("drawfocus"))
    setDrawFocus(false);
});
$("#bUndo").onclick = () => restore(undoS, redoS);
$("#bRedo").onclick = () => restore(redoS, undoS);
window.addEventListener("resize", () => draw());
window.addEventListener("beforeprint", () => {
  if (ui.view !== "layout") return;
  ui.printing = true;
  drawNow();
});
window.addEventListener("afterprint", () => {
  ui.printing = false;
  document.body.classList.remove("printing-doc");
  $("#printDoc").className = "";
  $("#pageStyle")?.remove();
  draw();
});
