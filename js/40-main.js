"use strict";
init().catch((error) => {
  console.error(error);
  $("#saved").textContent = "Could not start";
  toast(
    "The studio could not start. Keep your project backup and reload.",
    10000,
  );
});
