# CLAUDE.md

Guidance for Claude Code sessions in this repo.

## What this is
Lean Studio (renamed from 5S Studio): a **lean design tool for a production line**, used by a small team (two people to start).
Priorities, in order: (1) design 5S: layout, floor tape, items and documents in an area;
(2) improvement: an improvement log anyone can add to, and problem solving (A3, 5-Why, fishbone).
Mobile auditing, the TV dashboard and a real server are deferred until IT input. See `docs/ROADMAP.md`.
Local-first, offline, no IT dependency. **Storage direction (decided 10 Oct):** stay a static site; the real copy
of each project is a file in the team's OneDrive or Teams folder (the project folder, `33-team`), the browser keeps
a working copy. Access, version history and retention come from OneDrive, so IT governs the data with tools they
already have. A later step, only with IT, is Microsoft 365 sign-in with SharePoint reached straight from the page.

## Hard rules
- **No build step, no framework, no bundler.** Plain HTML/CSS/JS that works from `file://` and GitHub Pages.
- **No external network dependencies at runtime** (no CDNs, fonts, analytics). It must work offline on the shop floor.
- **Content-Security-Policy** (`<meta>` at the top of `index.html`) enforces that: only the site's own scripts, styles,
  images and fonts; inline styles and `data:`/`blob:` images allowed; no inline scripts, `onclick=` attributes,
  `eval`, `fetch()`, frames or form posts. New code must work within it, not loosen it. Tests fail on a CSP error.
- **Keep the old internal names.** The rename to Lean Studio is display only. The database `studio-5s`, the
  `studio5s-*` and `5s-smed-timer-draft` browser keys and `app: "5s-studio"` in project files must not change, or
  people's saved work disappears. Projects in a project folder are `<name>.leanstudio.json`; older team files
  `Lean-Studio__...` and `5S-Studio__...` are still read (as copies).
- **Never lose user data.** Storage lives in `js/05-storage.js` (`validate()` migrates old shapes,
  `migrateLegacy()` reads v6 files). Any change to the project shape must: bump a version, migrate old
  projects in `validate()`, and keep opening old backup files working.
- **Desktop first; phones and tablets are not a priority (decided 10 Oct).** Build and check for a computer and the TV.
  Do not spend work on phone or iPad layouts; just do not break what is there (no hover-only features).
- **Print is a first-class output** (A3 and A4): new features need a print layout.
- New big features (problem solving) are **modules** with their own namespace in the project data.

## Finding code
Read `docs/CODEMAP.md` before searching: every top-level function, constant and handler with its line and
comment, each file's purpose, and a "where things are wired" table. Then read only the lines you need.
After changing code run `npm run map` (`npm run check` fails while the map is out of date). Keep the
`/* ==== name ==== */` banner at the top of each file saying what is in it, and a one-line `//` comment
above functions whose name does not say enough: both become the map.

## Code layout
`index.html` loads `js/*.js` as classic scripts **in filename order** (files that share a number, such as the `34-*` and `39-*` ones, load alphabetically, and none of them may rely on another with the same number at top level), sharing one global scope
(each file starts with `"use strict"`). It is not ES modules, so a file may only *call* functions from
later files at runtime (after load), never at top level. `40-main.js` calls `init()` last.

| Files | Contents |
|---|---|
| 00-core | `$`, `$$`, `uid`, `clamp`, `esc` helpers |
| 01-catalogue | equipment catalogue, item categories, action and document constants |
| 02-state | default project, UI state, undo history |
| 03-geometry, 04-checks | geometry maths; layout checks and sheet comparison |
| 05-storage | IndexedDB (`studio-5s`), per-account/per-project keys (`K()`), `validate()` migration, save |
| 06-icons | line icons (`ICONS`, `icon(name)`) and `ICON_RULES`: a button's label picks its icon, added as buttons appear (MutationObserver), so templates stay plain text. Add a rule there for a new button; `ICON_SKIP` lists where buttons keep their own look |
| 06-ui-helpers | `modal()` (fresh body each time; Enter never submits; ✕ closes like Esc), `toast()` (with an Undo button after a delete: `offerUndo()`, called from `record()`), `flashRow()`, `printWithPage()` for every print, `printView()`, `csv()` |
| 07-canvas .. 11-side-panel | canvas, tools, sheets, render, side panel |
| 12-views | navigation: four sections (Setup, 5S, Documents, Improve) from the `NAV` list; section buttons in the header (`#gnav`) and phone tab bar, pages in the bar under it (`#subnav`), the last page per section remembered; the **Showing picker** (`#scopeSel`: whole factory, a line, or a zone); `setView()`; badges; address-bar routing (`#/layout/<zoneId>`, `#/problems/<id>/why`, Back works). Add a page by adding it to a section in `NAV` |
| 13-exports .. 16-app | PNG/CSV exports (also in the File menu: layout as PNG, print or save as PDF), save/open, settings and keys (full-screen drawing, phone note on the Layout), `renderAll` and `init`; `appReady` resolves when start-up has loaded the project list, and adding, opening or deleting a project waits for it |
| 17-pins, 18-shared-helpers | pins on the drawing (actions, documents), shared form helpers |
| 19-forms, 20-registers | red tag form and register, action form and register |
| 21-documents | documents register, form, pins, document map and list printing |
| 22-drawing-editor, 23-floor-marking | walls and fixed objects; tape schedule, setting-out sheet, marking standard editor (`markingModal`) |
| 23-tape-plan | `printTapePlan()`: one A3 sheet at a true scale (1:n chosen to fit, scale bar, print at 100%) with colour key, order list, runs and a title block; `printColourStandard()`: the marking standard as an A4 document to sign. Print styles in `css/95-tape-plan.css` |
| 24-example-project | `makeExampleProject()` and `loadExample()` |
| 25-tracking, 27-drift-map | Tracking view: checks over time, charts, "where things actually sit" |
| 26-project-ui | project name, duplicate, item list controls |
| 32-accounts | people: the "Who is working?" screen (`authGate`, names only, no password), per-person project list, account dialog (switch person, change name, remove) |
| 34-areas | lines and zones, both stored in `P.areas` (`a.level` "line" or "zone"; a zone's `a.parent` is its line; the old name `areas` is kept so saved work still opens): polygons on a drawing, `a.locked` (a locked line or zone cannot be moved, reshaped or deleted), item designation (`o.area`, zones only), layout check `outOfArea`, side panel and A3 sheets; **scope** (`ui.scope`, `setScope()`, `scopeObj/scopeMark/scopeBox/scopePass`): the Showing picker applies to the layout (zone drawn sharp, a faded margin of context around it), registers, documents, the document map and problems |
| 34-import | Bring items from another project: pick a project in My projects, tick items (grouped by its zones), they are copied onto the open sheet with new refs, sizes converted between the two scales, categories matched by id or name, and the operator tasks that use them (`bringItems()`) |
| 34-tasks | operator tasks (`P.tasks`: zone, who, frequency, minutes, 5S step, `items` = item refs, linked document): the Operator tasks page (follows the Showing picker), the form with its item picker, blocks in the zone and item side panels, zone A3 sheet table, CSV and print |
| 34-walks | where each operator task is done and its walk: `t.at` (a point on a drawing, placed with `startTaskPlace()` and the `taskat` tool), `t.per` (times a shift; `taskPerShift()` fills it from When), `t.walk` ("round" in the shortest order, `walkOrder()`, or "each" there and back). `walkGrid()` / `walkPath()` find paths round walls, fixed equipment (with clearance) and items, through doors; `taskWalk(t, sheet)` measures on any sheet by item ref. The Operator tasks page's **Spaghetti diagram** tab (`walksHTML`, `drawWalkMap`): follows the Showing picker and filters, measured on one sheet and compared with another, metres and walking time a shift, A3 print (`printWalks`), CSV |
| 34-setup | the Setup section: 1 Factory map (plan image, scale, walls), 2 Lines, 3 Zones; cards edited in place; drawing hands off to the layout with a Back to Setup button |
| 35-ideas | improvement log (`P.ideas`, numbered IM-001; actions carry them out via `a.idea`, stream "improve"): anyone raises an idea (who, zone, what, what it would improve), it is rated for benefit and effort (1-3; quick win = benefit 2+ and effort 1), goes New, Assessed, Trial, Done or Not now, links to a proposal, problem or red tag; page `#ideaView` with the quick-win chart, form `ideaModal()`, `ideaFromTag()`, zone side panel block `zoneIdeasHTML()`, print and CSV. New ideas waiting over 14 days make the Improve badge red. `normIdeas()` is its part of `validate()` |
| 35-problems, 36-problem-tools | problem solving module (`P.problems`, actions link by `a.prob`): list and detail tabs, 5-Why, fishbone SVG, countermeasures, review, Pareto, A3 print, CSV |
| 38-problem-board | the problem solving board (one screen, like the whiteboard): statement, fishbone with likely causes, causes numbered with their actions (`a.cause`), hypothesis and confirmation, why chain and root cause, inline action list, board print on A3 |
| 39-present | Presentation mode (the Present button on the Layout): the open sheet full screen for a TV, stepping through the whole factory, each line and each zone with the arrow keys or a timed Tour, and showing what changed on proposals and daily checks. Zoom (wheel, pinch, keys) with item and zone names growing via `ui.textBoost`. Draws with its own scope; leaves the Showing picker alone |
| 39-document-map | the Documents map tab: documents pinned, moved and opened over a faded copy of the standard layout, with a line to the item each is kept at. Document pins are off on the Layout by default |
| 37-context-menu | right-click menus (`#ctxMenu`, `openCtx()`): on the drawing, an item, tape, route or zone gets the selection toolbar's actions plus Copy with shortcuts (a zone also Show only this zone, Raise an idea here), empty floor gets Paste, Red tag here, Action here, Select all, Fit; a register row gets Open and its own buttons. Right-click while drawing ends the line; with a drawing tool, goes back to Select |
| 37-labels | every name on the layout, placed in one pass on top of the drawing (`labelsSVG`): inside its item (wrapped, turned along the long side, 8 px or bigger), else a tag with a leader line in free floor space; line and zone names pick a clear spot along their edge. Works in screen pixels (world / `k`), so screen, Present and prints agree. `LABEL.shown` says which names are whole; the Layers menu has a switch. `objSVG`, `fixedSVG` and `areaSVG` no longer draw names themselves when called from `buildSVG` |
| 37-layout-edit | layout editing helpers: toolbar under the selection (`positionSelbar`), align and space evenly, smart guides while dragging (edges of items, fixed objects, wall faces; Alt turns off), Shift-drag box select, Ctrl+A/C/V (paste works across sheets), full-name label tags, shortcuts dialog |
| 33-team | the **project folder** (File System Access API; a synced OneDrive or Teams folder in real use): each project is a file `<name>.leanstudio.json`, the file is the real copy and the browser a working copy. Links live on the index entry (`e.file`, `e.fileMod`, `e.fileKey`). `folderAfterSave` writes the file at most every 30 s (`FOLDER_GAP`) while someone works, and at once on leaving the tab, closing the page or opening another project (`folderFlush`, `folderFlushNow`); `folderTidy` removes `.crswap` temporary files left by a crashed save once they are 10 minutes old; `folderSync` loads a file someone else saved when there are no local changes, else `folderHold` shows the `#syncWarn` banner (use theirs and keep mine as a copy, or save mine as a new file; never overwrite). Checks again on opening a project and on returning to the tab. Older `Lean-Studio__` team files open as copies (`openTeammateBundle`). Tested in `tests/folder.cjs` with the browser's private file system standing in for the folder |
| 40-main | startup; registers the service worker |
| css/*.css | the stylesheet in numbered files (`00-base` to `95-tape-plan`), loaded in order by `index.html`, so keep the order when adding one. Add a link in `index.html`; `sw.js` and the deploy pick it up. `45-motion` holds all movement (one set of timings, off under reduced motion) |
| sw.js, manifest.webmanifest, icons/ | offline and install: `sw.js` caches every file `index.html` names (so a new script or stylesheet needs nothing extra), the deploy stamps `__BUILD__` and the css/js links with the commit id; anything outside `css/` and `js/` that the page needs must be added to the file list in `sw.js`. `tools/make-icons.cjs` redraws the PNG icons from `icons/icon.svg` |

Removed features (formal audits, audit lines, TV, Boards and SMED) are preserved untouched in `project.parked` by
`validate()` so old backups lose nothing. Git history at `2ddb593` has the code. Red tags, daily
checks, the drift map and areas were removed and restored; `validate()` parks `boards`, `smed` and `labels` untouched (git history at `c0594d8^` has the code); it brings parked tags back and
turns old audit areas into plain areas. Project version is 14 (areas, problems; 7 added problem hypothesis/confirm and `a.cause`; 8 added action `stream` ("5s", "doc", "improve") and `a.doc`, the linked document; 9 added `a.level` and `a.parent` on areas, and moved Boards and SMED into `parked`; 10 added `P.tasks`; 11 added `a.locked` on lines and zones; 12 added ordering details on tape types (`roll`, `supplier`, `code`, `ref`) and `P.marking.std` (the colour standard's number, revision, owner); 13 added `P.ideas`, the improvement log, and `a.idea` on actions; 14 added `at`, `per` and `walk` on tasks).

## Accounts and projects
Everything saved is keyed `u/<account id>/p/<project id>/...` (see `K()` in 05-storage). An account is just a
name picked on the "Who is working?" screen: **no password** (removed 10 Oct), so it is **not security**: the
code runs in the browser, data is not encrypted, and the site itself is public. Never describe it as secure.
The last person on a computer opens straight away; "Switch person" goes back to the names. Open / team files
become new projects in the list; nothing a person has is ever replaced silently. Tests go through the real
screen first (`tests/smoke.cjs`).

## Picking the work back up
Read `docs/HANDOVER.md` first: what is built, what the review fixed, known limits, what is next.
Still to do on the real site: try the project folder in Edge with the real OneDrive folder, and print the tape plan on A3 at 100%.
Working pattern with the user: build on a `claude/...` branch, verify, push, and merge to `main` (fast-forward)
when they say so.

## Verify before committing
```bash
npm run check && npm run lint && npm test
```
`npm run check` is a syntax check of every file plus the code map freshness check.
`npm test` runs the smoke test, `tests/offline.cjs` (installs the service worker over http, switches the network off, reloads)
and `tests/folder.cjs` (the project folder, with the browser's private file system standing in for OneDrive; it needs http,
so it serves the site itself). Tests that wait for saving should wait for `!savePending && !saveRunning`, not a fixed time.
The smoke test also opens `tests/fixtures/v7-backup.json` (made with the original file): old backups must keep opening.
For UI changes, also load the page in Chromium (Playwright is preinstalled; do not run
`playwright install`) and take screenshots at desktop (1600x900) and TV (1920x1080).

## Git
Develop on the branch you were given. Do not open PRs unless asked. Commit small, one change each.
Do not put company, site or product names in code, docs, tests or file names: the repo is published on GitHub Pages. Supplier names and product codes are data the team types into the marking standard, never defaults in the code.
