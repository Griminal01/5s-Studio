"use strict";
/* ============ views: layout, SMED, boards, documents, red tags, actions, tracking ============ */
function setView(v) {
  if (ui.editDrawing && v !== "layout") setEditDrawing(false);
  ui.view = v;
  $$(".views button").forEach((b) =>
    b.classList.toggle("on", b.dataset.view === v),
  );
  $("#layoutView").hidden = v !== "layout";
  const reg = v === "tags" || v === "actions";
  $("#regView").hidden = !reg;
  $("#docView").hidden = v !== "documents";
  $("#boardView").hidden = v !== "boards";
  $("#smedView").hidden = v !== "smed";
  $("#trackView").hidden = v !== "tracking";
  $("#days").hidden = v !== "layout";
  if (reg) renderRegister();
  else if (v === "tracking") renderTracking();
  else if (v === "boards") renderBoards();
  else if (v === "smed") renderSmed();
  else if (v === "documents") renderDocuments();
  else {
    ui.vb = ui.vb || null;
    draw();
  }
}
$$(".views button").forEach((b) => (b.onclick = () => setView(b.dataset.view)));
