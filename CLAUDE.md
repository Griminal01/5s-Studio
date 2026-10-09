# CLAUDE.md

Guidance for Claude Code sessions in this repo.

## What this is
5S Studio: a **design tool for a production line**, used by a small team (two people to start).
Priorities, in order: (1) design 5S: layout, floor tape, items and documents in an area;
(2) SMED; (3) problem solving (A3, 5-Why, fishbone). Mobile auditing, the TV dashboard and cloud sync
are deferred until IT input. See `docs/ROADMAP.md`. Local-first, offline, no IT dependency.

## Hard rules
- **No build step, no framework, no bundler.** Plain HTML/CSS/JS that works from `file://` and GitHub Pages.
- **No external network dependencies at runtime** (no CDNs, fonts, analytics). It must work offline on the shop floor.
- **Never lose user data.** Storage lives in `js/05-storage.js` (`validate()` migrates old shapes,
  `migrateLegacy()` reads v6 files). Any change to the project shape must: bump a version, migrate old
  projects in `validate()`, and keep opening old backup files working.
- Keep it **accessible on touch**: targets >= 44px on mobile, no hover-only features.
- **Print is a first-class output** (A3 and A4): new features need a print layout.
- New big features (SMED, problem solving) are **modules** with their own namespace in the project data.

## Code layout
`index.html` loads `js/*.js` as classic scripts **in filename order**, sharing one global scope
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
| 12-views | navigation: the `NAV` list (grouped sections) renders the header, the medium-width menu and the phone tab bar; `setView()`; badges; address-bar routing (`#/problems/<id>/why`, Back works). Add a new section by adding it to `NAV` |
| 13-exports .. 16-app | PNG/CSV exports, save/open, settings and keys, `renderAll` and `init` |
| 17-pins, 18-shared-helpers | pins on the drawing (actions, documents), shared form helpers |
| 19-forms, 20-registers | red tag form and register, action form and register |
| 21-documents | documents register, form, pins, document map and list printing |
| 22-drawing-editor, 23-floor-marking | walls and fixed objects; tape schedule, setting-out, print |
| 24-example-project | `makeExampleProject()` and `loadExample()` |
| 25-tracking, 27-drift-map | Tracking view: checks over time, charts, "where things actually sit" |
| 26-project-ui | project name, duplicate, item list controls |
| 28-boards, 29-labels | boards (shadow boards, kanban racks) and slots; label printer output, board layout and 1:1 outline printing |
| 30-smed, 31-smed-tools | SMED module (`P.smed`): changeover steps, schedule maths, Gantt charts, history, the four steps (Record, Separate, Improve, Standard work: `ui.smed.stage`, `setStep()`); stopwatch capture, work sheet printing |
| 32-accounts | accounts (username + password, salted PBKDF2 hash), sign-in screen, per-account project list, account dialog |
| 34-areas | areas (`P.areas`): polygons on a drawing, item designation (`o.area`), layout check `outOfArea`, area pane and tab, A3 area sheets |
| 35-problems, 36-problem-tools | problem solving module (`P.problems`, actions link by `a.prob`): list and detail tabs, 5-Why, fishbone SVG, countermeasures, review, Pareto, A3 print, CSV |
| 38-problem-board | the problem solving board (one screen, like the whiteboard): statement, fishbone with likely causes, causes numbered with their actions (`a.cause`), hypothesis and confirmation, why chain and root cause, inline action list, board print on A3 |
| 39-document-map | the Documents map tab: documents pinned, moved and opened over a faded copy of the standard layout, with a line to the item each is kept at. Document pins are off on the Layout by default |
| 37-layout-edit | layout editing helpers: toolbar under the selection (`positionSelbar`), align and space evenly, smart guides while dragging (edges of items, fixed objects, wall faces; Alt turns off), Shift-drag box select, Ctrl+A/C/V (paste works across sheets), full-name label tags, shortcuts dialog |
| 33-team | sharing through a team folder (File System Access API): publish my project, open teammates' projects as copies |
| 40-main | startup |

Removed features (formal audits, audit lines, TV) are preserved untouched in `project.parked` by
`validate()` so old backups lose nothing. Git history at `2ddb593` has the code. Red tags, daily
checks, the drift map and areas were removed and restored; `validate()` brings parked tags back and
turns old audit areas into plain areas. Project version is 7 (areas, problems; 7 added problem hypothesis/confirm and `a.cause`).

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
The smoke test also opens `tests/fixtures/v7-backup.json` (made with the original file): old backups must keep opening.
For UI changes, also load the page in Chromium (Playwright is preinstalled; do not run
`playwright install`) and take screenshots at desktop (1600x900), phone (390x844) and TV (1920x1080).

## Git
Develop on the branch you were given. Do not open PRs unless asked. Commit small, one change each.
Do not put company, site or product names in code, docs, tests or file names: the repo is published on GitHub Pages.
