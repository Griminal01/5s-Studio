// Lints all js/*.js as ONE script (they share a global scope), so cross-file
// undefined names and unused top-level functions/variables are reported.
// Run: npm run lint   (needs eslint: npm install)
const fs = require("node:fs");
const path = require("node:path");
const { ESLint } = require("eslint");

const dir = path.resolve(__dirname, "..", "js");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".js"))
  .sort();
let code = "";
const map = []; // [startLine, file]
for (const f of files) {
  map.push([code.split("\n").length, f]);
  code += fs.readFileSync(path.join(dir, f), "utf8") + "\n";
}
const where = (line) => {
  let m = map[0];
  for (const e of map) if (e[0] <= line) m = e;
  return `${m[1]}:${line - m[0] + 1}`;
};

const browser = [
  "window",
  "document",
  "localStorage",
  "indexedDB",
  "navigator",
  "location",
  "console",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "matchMedia",
  "Blob",
  "URL",
  "FileReader",
  "Image",
  "DOMParser",
  "XMLSerializer",
  "TextEncoder",
  "TextDecoder",
  "atob",
  "btoa",
  "structuredClone",
  "HTMLElement",
  "Event",
  "CustomEvent",
  "ResizeObserver",
  "IntersectionObserver",
  "MutationObserver",
  "alert",
  "confirm",
  "prompt",
  "getComputedStyle",
  "fetch",
  "screen",
  "performance",
  "AbortController",
  "Path2D",
  "DOMMatrix",
  "MouseEvent",
  "KeyboardEvent",
  "FormData",
  "File",
  "navigator",
  "history",
  "print",
  "Intl",
  "queueMicrotask",
  "innerWidth",
  "innerHeight",
  "devicePixelRatio",
  "CSS",
  "createImageBitmap",
  "OffscreenCanvas",
  "WeakRef",
  "BroadcastChannel",
  "crypto",
  "IDBKeyRange",
  "sessionStorage",
  "showDirectoryPicker",
];
const globals = Object.fromEntries(browser.map((n) => [n, "readonly"]));

(async () => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        languageOptions: { ecmaVersion: 2023, sourceType: "commonjs", globals },
        rules: {
          "no-undef": "error",
          "no-unused-vars": [
            "warn",
            { vars: "all", args: "none", caughtErrors: "none" },
          ],
          "no-redeclare": "error",
        },
      },
    ],
  });
  const [res] = await eslint.lintText(code, { filePath: "bundle.js" });
  let n = 0;
  for (const m of res.messages) {
    n++;
    console.log(
      `${m.severity === 2 ? "error" : "warn "} ${where(m.line)}  ${m.message}`,
    );
  }
  const errors = res.messages.filter((m) => m.severity === 2).length;
  console.log(`${n} problem(s), ${errors} error(s)`);
  process.exit(errors ? 1 : 0);
})();
