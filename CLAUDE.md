# CLAUDE.md

Guidance for Claude Code sessions in this repo.

## What this is
Lean Studio (renamed from 5S Studio): a **lean design tool for a production line**, used by a small team (two people to start).
Priorities, in order: (1) design 5S: layout, floor tape, items and documents in an area;
(2) problem solving (A3, 5-Why, fishbone). Mobile auditing, the TV dashboard and cloud sync
are deferred until IT input. See `docs/ROADMAP.md`. Local-first, offline, no IT dependency.

## Hard rules
- **No build step, no framework, no bundler.** Plain HTML/CSS/JS that works from `file://` and GitHub Pages.
- **No external network dependencies at runtime** (no CDNs, fonts, analytics). It must work offline on the shop floor.
- **Keep the old internal names.** The rename to Lean Studio is display only. The database `studio-5s`, the
  `studio5s-*` and `5s-smed-timer-draft` browser keys and `app: "5s-studio"` in project files must not change, or
  people's saved work disappears. Team files are written as `Lean-Studio__...` and `5S-Studio__...` is still read.
- **Never lose user data.** Storage lives in `js/05-storage.js` (`validate()` migrates old shapes,
  `migrateLegacy()` reads v6 files). Any change to the project shape must: bump a version, migrate old
  projects in `validate()`, and keep opening old backup files working.
- Keep it **accessible on touch**: targets >= 44px on mobile, no hover-only features.
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
| 06-ui-helpers | `modal()` (fresh body each time; Enter never submits), `printWithPage()` for every print, `printView()`, `csv()` |
| 07-canvas .. 11-side-panel | canvas, tools, sheets, render, side panel |
| 12-views | navigation: four sections (Setup, 5S, Documents, Improve) from the `NAV` list; section buttons in the header (`#gnav`) and phone tab bar, pages in the bar under it (`#subnav`), the last page per section remembered; the **Showing picker** (`#scopeSel`: whole factory, a line, or a zone); `setView()`; badges; address-bar routing (`#/layout/<zoneId>`, `#/problems/<id>/why`, Back works). Add a page by adding it to a section in `NAV` |
| 13-exports .. 16-app | PNG/CSV exports, save/open, settings and keys, `renderAll` and `init` |
| 17-pins, 18-shared-helpers | pins on the drawing (actions, documents), shared form helpers |
| 19-forms, 20-registers | red tag form and register, action form and register |
| 21-documents | documents register, form, pins, document map and list printing |
| 22-drawing-editor, 23-floor-marking | walls and fixed objects; tape schedule, setting-out sheet, marking standard editor (`markingModal`) |
| 23-tape-plan | `printTapePlan()`: one A3 sheet at a true scale (1:n chosen to fit, scale bar, print at 100%) with colour key, order list, runs and a title block; `printColourStandard()`: the marking standard as an A4 document to sign. Print styles in `css/95-tape-plan.css` |
| 24-example-project | `makeExampleProject()` and `loadExample()` |
| 25-tracking, 27-drift-map | Tracking view: checks over time, charts, "where things actually sit" |
| 26-project-ui | project name, duplicate, item list controls |
| 32-accounts | accounts (username + password, salted PBKDF2 hash), sign-in screen, per-account project list, account dialog |
| 34-areas | lines and zones, both stored in `P.areas` (`a.level` "line" or "zone"; a zone's `a.parent` is its line; the old name `areas` is kept so saved work still opens): polygons on a drawing, `a.locked` (a locked line or zone cannot be moved, reshaped or deleted), item designation (`o.area`, zones only), layout check `outOfArea`, side panel and A3 sheets; **scope** (`ui.scope`, `setScope()`, `scopeObj/scopeMark/scopeBox/scopePass`): the Showing picker applies to the layout (zone drawn sharp, a faded margin of context around it), registers, documents, the document map and problems |
| 34-import | Bring items from another project: pick a project in My projects, tick items (grouped by its zones), they are copied onto the open sheet with new refs, sizes converted between the two scales, categories matched by id or name, and the operator tasks that use them (`bringItems()`) |
| 34-tasks | operator tasks (`P.tasks`: zone, who, frequency, minutes, 5S step, `items` = item refs, linked document): the Operator tasks page (follows the Showing picker), the form with its item picker, blocks in the zone and item side panels, zone A3 sheet table, CSV and print |
| 34-setup | the Setup section: 1 Factory map (plan image, scale, walls), 2 Lines, 3 Zones; cards edited in place; drawing hands off to the layout with a Back to Setup button |
| 35-problems, 36-problem-tools | problem solving module (`P.problems`, actions link by `a.prob`): list and detail tabs, 5-Why, fishbone SVG, countermeasures, review, Pareto, A3 print, CSV |
| 38-problem-board | the problem solving board (one screen, like the whiteboard): statement, fishbone with likely causes, causes numbered with their actions (`a.cause`), hypothesis and confirmation, why chain and root cause, inline action list, board print on A3 |
| 39-present | Presentation mode (the Present button on the Layout): the open sheet full screen for a TV, stepping through the whole factory, each line and each zone with the arrow keys or a timed Tour, and showing what changed on proposals and daily checks. Zoom (wheel, pinch, keys) with item and zone names growing via `ui.textBoost`. Draws with its own scope; leaves the Showing picker alone |
| 39-document-map | the Documents map tab: documents pinned, moved and opened over a faded copy of the standard layout, with a line to the item each is kept at. Document pins are off on the Layout by default |
| 37-labels | every name on the layout, placed in one pass on top of the drawing (`labelsSVG`): inside its item (wrapped, turned along the long side, 8 px or bigger), else a tag with a leader line in free floor space; line and zone names pick a clear spot along their edge. Works in screen pixels (world / `k`), so screen, Present and prints agree. `LABEL.shown` says which names are whole; the Layers menu has a switch. `objSVG`, `fixedSVG` and `areaSVG` no longer draw names themselves when called from `buildSVG` |
| 37-layout-edit | layout editing helpers: toolbar under the selection (`positionSelbar`), align and space evenly, smart guides while dragging (edges of items, fixed objects, wall faces; Alt turns off), Shift-drag box select, Ctrl+A/C/V (paste works across sheets), full-name label tags, shortcuts dialog |
| 33-team | sharing through a team folder (File System Access API): publish my project, open teammates' projects as copies |
| 40-main | startup; registers the service worker |
| css/*.css | the stylesheet in numbered files (`00-base` to `90-tasks-present`), loaded in order by `index.html`, so keep the order when adding one. Add a link in `index.html`; `sw.js` and the deploy pick it up |
| sw.js, manifest.webmanifest, icons/ | offline and install: `sw.js` caches every file `index.html` names (so a new script or stylesheet needs nothing extra), the deploy stamps `__BUILD__` and the css/js links with the commit id; anything outside `css/` and `js/` that the page needs must be added to the file list in `sw.js`. `tools/make-icons.cjs` redraws the PNG icons from `icons/icon.svg` |

Removed features (formal audits, audit lines, TV, Boards and SMED) are preserved untouched in `project.parked` by
`validate()` so old backups lose nothing. Git history at `2ddb593` has the code. Red tags, daily
checks, the drift map and areas were removed and restored; `validate()` parks `boards`, `smed` and `labels` untouched (git history at `c0594d8^` has the code); it brings parked tags back and
turns old audit areas into plain areas. Project version is 12 (areas, problems; 7 added problem hypothesis/confirm and `a.cause`; 8 added action `stream` ("5s", "doc", "improve") and `a.doc`, the linked document; 9 added `a.level` and `a.parent` on areas, and moved Boards and SMED into `parked`; 10 added `P.tasks`; 11 added `a.locked` on lines and zones; 12 added ordering details on tape types (`roll`, `supplier`, `code`, `ref`) and `P.marking.std` (the colour standard's number, revision, owner)).

## Accounts and projects
Everything saved is keyed `u/<account id>/p/<project id>/...` (see `K()` in 05-storage). Accounts are a
sign-in screen for a shared computer, **not security**: the code runs in the browser, data is not
encrypted, and the site itself is public. Never describe it as secure. Open / team files become new
projects in the list; nothing a person has is ever replaced silently. Tests sign in through the real
screen first (`tests/smoke.cjs`).

## Picking the work back up
Read `docs/HANDOVER.md` first: what is built, what the review fixed, known limits, what is next.

## Verify before committing
```bash
npm run check && npm run lint && npm test
```
`npm run check` is a syntax check of every file plus the code map freshness check.
`npm test` runs the smoke test and `tests/offline.cjs` (installs the service worker over http, switches the network off, reloads).
The smoke test also opens `tests/fixtures/v7-backup.json` (made with the original file): old backups must keep opening.
For UI changes, also load the page in Chromium (Playwright is preinstalled; do not run
`playwright install`) and take screenshots at desktop (1600x900), phone (390x844) and TV (1920x1080).

## Git
Develop on the branch you were given. Do not open PRs unless asked. Commit small, one change each.
Do not put company, site or product names in code, docs, tests or file names: the repo is published on GitHub Pages. Supplier names and product codes are data the team types into the marking standard, never defaults in the code.
