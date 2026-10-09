"use strict";
init().catch((error) => {
  console.error(error);
  $("#saved").textContent = "Could not start";
  toast(
    "The studio could not start. Keep your project backup and reload.",
    10000,
  );
});

// Work offline: a service worker keeps the app's files. It needs http(s), so not from file://.
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // a newer version took over: the page in front of you keeps working, the next load uses it
    if (had)
      toast("A new version of Lean Studio is ready. Reload to use it.", 8000);
  });
}
