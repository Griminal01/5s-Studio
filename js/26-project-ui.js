"use strict";
/* ============ project name, duplicate, item list controls ============ */
function updateProjectIdentity() {
  if (!P) return;
  $("#projectIdentity").textContent = P.projectName || "Lean Studio project";
  $("#projectIdentity").title =
    "Click to rename the project. Last backup download: " +
    (P.lastBackupDownload
      ? new Date(P.lastBackupDownload).toLocaleString("en-GB")
      : "not yet");
}
$("#projectIdentity").onclick = async () => {
  const r = await modal(
    "Project name",
    `<label class="f">Name<input name="name" required value="${esc(P.projectName || "Lean Studio project")}"></label>`,
    "Save",
  );
  if (!r || !r.name.trim()) return;
  checkpoint();
  P.projectName = r.name.trim();
  record("Project renamed", P.projectName);
  renderAll();
};
pane.addEventListener("input", (e) => {
  if (e.target.id !== "itemSearch") return;
  const start = e.target.selectionStart,
    end = e.target.selectionEnd;
  ui.itemQuery = e.target.value;
  renderSide();
  const input = $("#itemSearch");
  input.focus();
  input.setSelectionRange(start, end);
});
pane.addEventListener("change", (e) => {
  if (e.target.id === "itemFilter") {
    ui.itemFilter = e.target.value;
    renderSide();
  }
  if (e.target.hasAttribute("data-category-visible")) {
    const id = e.target.dataset.categoryVisible;
    if (e.target.checked) ui.hiddenCategories.delete(id);
    else ui.hiddenCategories.add(id);
    // Clear hidden selections so resize handles never reveal hidden items.
    ui.sel = ui.sel.filter((id) => {
      const f = find(id);
      return (
        !f ||
        f.t !== "obj" ||
        f.x.kind !== "item" ||
        !ui.hiddenCategories.has(itemCategoryId(f.x))
      );
    });
    renderSide();
    draw();
  }
});
pane.addEventListener("click", (e) => {
  if (e.target.closest("[data-show-categories]")) {
    ui.hiddenCategories.clear();
    renderSide();
    draw();
  }
});
