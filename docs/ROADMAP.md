# Lean Studio roadmap

## Direction (updated)

Lean Studio (formerly 5S Studio) is a **design tool for the model line**, used by Josh and Sam to work out, before touching the floor:

1. **5S design**: what the area should look like, where floor tape goes, and which items and documents live where.
2. **Problem solving**: structured analysis (A3, 5-Why, fishbone) that feeds actions.

Mobile auditing, the factory TV dashboard and cloud sync are **deferred** until IT and existing systems are known. They stay designed (section 7) so we can expand later, but nothing in the first phases depends on them. Everything below works offline, local-first, with no IT involvement.

Navigation is four sections (Setup, 5S, Documents, Improve) with a whole-factory / line / zone Showing picker. Boards and SMED were removed in version 9 (data parked). Operator tasks (per zone, linked to items) are in; next for them: show unused items on the layout, tie tasks to documents and daily checks. Next: scope Tracking, a whole-factory overview dashboard, and ideas for Improve (improvement log, one-point lessons).

Effort: **S** = under a day, **M** = a few days, **L** = a week or more.

---

## 1. Where the app is today

**Built and kept**
- Scaled layout editor: equipment catalogue (incl. shadow board, KPI board, document stand), movable items with home markings, routes, measure tool, undo/redo, print and PNG export.
- **Floor marking**: marking types and colours (walkway, WIP, red tag, keep-clear, hazard...), schedule, setting-out and tape-roll calculations, A3 marking sheet.
- Proposals and trials, comparison with the standard, layout checks (keep-clear, aisle widths, walls).
- **Documents register** (new): SOPs, OPLs, checklists and boards with owner, revision, review date, holder, format and copies; pins on the layout; document map and tick-off list for printing; CSV.
- **Example model line** (new): a complete project to explore, also the test fixture.
- **Red tags** (restored): register, form with photos, pins, linked actions.
- **Daily checks and Tracking** (restored): each check copies the standard; Tracking shows where each item actually sits across checks, what drifts from its home, a suggested new home, a trend chart and a movement-log CSV.
- Action log with pins.
- Project save/open as a file, browser autosave, opens older v6 files.

**Removed (parked in the project file, code in git at `2ddb593`)**: formal 5S audits and dashboards, TV mode, audit lines. Areas are back as design zones (items designated to them, area sheets). The rest returns only if needed (see section 7).

**Gaps for the new direction** (checked 9 Oct 2026)

| # | Gap | Effect |
|---|---|---|
| D2 | Items have no "home contents" (the tools on a shadow board, quantities, labels). Shadow boards were removed in version 9, so this is open again. | Can't print shadow-board outlines or location labels. |
| D3 | The tape plan exists but the **printed output** for the person laying tape needs review against real use. | The point of the tool is a plan someone can take onto the floor. |
| D4 | ~~No problem-solving tools~~ Built (section 5). SMED was built and removed (section 4). | Still to try on a real problem. |
| D5 | Two people share one project by passing a file or a team folder. The app now warns when a second tab has the project open, and keeps same-name team files from different computers apart. Copies still do not merge. | Overwrite risk is lower, not gone. |
| D6 | ~~Item labels hard to read at whole-factory scale.~~ Done: `js/37-labels.js` (inside, else tag with leader line; zone names clear of items). Route and pin names still sit outside it. | Try on a real sheet. |

---|---|---|
| D2 | **Items have no "home contents".** A shadow board is one rectangle; the tools on it, quantities and labels aren't recorded. | Can't print shadow-board outlines or location labels. |
| D3 | The tape plan exists but the **printed output** for the person laying tape needs review against real use. | The point of the tool is a plan someone can take onto the floor. |
| D4 | **No SMED or problem-solving tools** at all. | The two main later uses. |
| D5 | Two people share one project by passing a file; no guidance or safeguards. | Risk of overwriting each other's work. |
| D6 | Layout editor is desktop-first; the phone layout is not designed. | Fine for now (design is a desktop task). |

---

## 2. Phase 0: foundation (done)

Split into `index.html`, `css/*.css` and ordered `js/` files, verified identical to v7. Smoke test, cross-file lint, CI, Pages workflow, README, `CLAUDE.md`. Original kept in `archive/`. Then pruned to a design tool (section 1).

---

## 3. Phase 1: Design 5S for the model line  |  now

Goal: Josh and Sam can sit down, design the model line area, and print what the team needs to build it.

| Item | Detail | Size |
|---|---|---|
| 1.1 **Model line sample project** ✅ | `js/24-example-project.js`: walls, machines, items with home marks, tape, routes, 14 documents, actions and a proposal. Loadable from Settings or the empty layout, and used by the smoke test (no layout problems, documents print, data round-trips) | S |
| 1.2 **Tape plan review and print** | Walk through the existing floor-marking schedule and setting-out with a real area. Produce one A3 "tape plan" page: scaled drawing, colour legend, each strip with length/width/colour, measurements from datum, total tape per colour and rolls to order. Check against the company's actual tape colour standard | M |
| 1.3 **Documents in the area** ✅ | A document register: title, type (SOP, OPL, checklist, changeover sheet, risk assessment, KPI), owner, revision, review date, format/size, quantity, holder. Place each as a pin on the drawing linked to its holder (document stand, board, noticeboard). Printable "document map" and list; warn when review date has passed. Next: a shared-template field and a "last checked on the floor" date | M |
| 1.4 **Items and shadow boards** ✅ (removed in version 9, data parked) | Boards view: numbered slots with type, part no., qty, min/max and size; location codes (`SB-01-03`); auto-packed layout with a "does it fit" check; labels for a label printer (one label per page, Brother TZe / Dymo / Zebra / custom), CSV for label software, scaled layout print, 1:1 outlines on A4 or A3. Next: QR / barcode on kanban labels, board photos, and a drag-to-arrange editor | M |
| 1.5 **Design variants side by side** | Proposals exist; add a side-by-side view of two proposals with differences listed (distance walked, floor area, tape needed) so a design decision can be argued from numbers | M |
| 1.6 **Floor plan import** ✅ (Setup > Factory map) | Place a photo/PDF/PNG of the real floor as the drawing background with scale calibration, so tape and items are designed on the true space | M |
| 1.7 **Working as two people** | `docs/WORKFLOW.md`: one master file in a shared folder; "Save as" with date and initials; a change note on each save (the app already has a journal); a warning when opening a file older than the one in the browser. A real merge feature is not needed for two users | S |
| 1.8 **Module registry** | A small `registerModule({ id, name, nav, render, migrate })` so SMED and problem solving plug in as modules with their own data namespace, without editing 5S code. The existing 5S code becomes the first module | S |
| 1.9 **Split the big files** | The stylesheet is now split into numbered files in `css/` (9 Oct 2026). `07-canvas.js` (about 1,300 lines) is still one file | M |

**Done when:** the model line can be designed from a blank page and printed as a pack (layout, tape plan, document map, shadow-board labels) without reading instructions.

---

## 4. Phase 2: SMED  |  removed (version 9)

SMED was built (changeover record, timeline, convert and compare, standard work, history) and then removed again because it was not earning its place. Its data is kept in `project.parked.smed` and the code is in git history before commit `c0594d8`. The table below is kept for reference if it is ever restored.

| Item | Detail | Size |
|---|---|---|
| 2.1 **Changeover record** ✅ | Steps with who, time, type (stopped / before / after), waits-for, kit location; typed in or captured with a stopwatch (`Time one now`) | M |
| 2.2 **Video-timestamped steps** | Load a phone video of a changeover, press a key at each step boundary to capture start/end times (video stays on the device, not stored in the project file) | M |
| 2.3 **Timeline view** ✅ | Gantt per person: navy = stopped, green hatched = external; red band = stopped time; target line | M |
| 2.4 **Convert and compare** ✅ | Per step: keep / move to external / shorten / do in parallel / eliminate; recomputes the timeline, saving per changeover and per year (and £ if a minute value is set); "look here first" list | M |
| 2.5 **Link to the layout** (partly ✅) | Routes drawn on the layout can be linked to a changeover; distance and walking time are compared across the standard and proposals; steps point at kit slots on the Boards. Still to do: report walking as a step automatically | M |
| 2.6 **Standard work and checklist print** ✅ | A3 sheet: improved and observed timelines, then a checklist by phase with "get it from" and tick boxes | S |
| 2.7 **Changeover history** ✅ | Trials of the same changeover on one chart (observed vs plan) with the target; "Next trial from the plan" creates the next record | S |

**Later:** pull real changeover times from the Allen-Bradley PLC / historian instead of typing them (needs IT / controls input).

---

## 5. Phase 3: Problem solving  |  built (3.1 to 3.6), to be tried on a real problem

A module; every output ends in the existing actions register (one list of what's owed).

| Item | Detail | Size |
|---|---|---|
| 3.1 **Problem record** | Title, area/line, date, owner, containment, photos, link to a red tag / SMED step / layout item | S |
| 3.2 **5-Why** | Guided chain with a root-cause check ("if we fix this, does the problem stop?") | S |
| 3.3 **Fishbone (Ishikawa)** | Categories (people, machine, method, material, measurement, environment), drag-sorted causes, mark the likely ones | M |
| 3.4 **A3 report** | One A3 page: background, current state, target, analysis (5-Why/fishbone), countermeasures (actions), follow-up. Prints cleanly and exports PDF via print | M |
| 3.5 **Verify and close** | Effectiveness check date and result; reopen if it recurs | S |
| 3.6 **Pareto** | Count problem causes or downtime reasons and chart them; helps pick what to attack first | S |

---

## 6. Cross-cutting rules

- **No build step, no frameworks, no runtime CDNs.** Works offline from a file or a static host.
- **Never break old data.** Every model change bumps a version and migrates; old backups must still open. Keep a fixture of each version in `tests/fixtures/`.
- **Check before committing:** `npm run check && npm test`; UI changes also get screenshots at desktop and print sizes (A3/A4 print preview for anything meant to be printed).
- **Print is a first-class output.** Every new feature has a print layout, tested at A3 and A4.
- **Privacy:** don't put real photos or people on a public URL. See section 8 on hosting.

---

## 7. Deferred (kept designed, not scheduled)

Resume these once IT and existing systems are known.

- **Phone auditing**: audit-first mobile mode, one question per screen, camera, quick red tag, areas from a list, installable offline app (PWA). The app installs and works offline (see `docs/DOMAIN.md`). On a phone the sheet bar collapses to the name and an Options button, and the drawing has a full-screen button.
- **Factory TV dashboard**: a separate read-only `tv.html` for 1080p/4K from a mini PC in Chrome/Edge kiosk mode (plain JS so the TV's own browser can be a fallback), rotating screens, "last updated" and stale-data warning, wake lock.
- **Shared data across devices**: a storage adapter (`load/save/subscribe`) with records merged by id. Options: shared file on a company drive, small hosted backend (Supabase/Firebase), or an on-site server. Pick after IT input; all can be swapped in behind the adapter. Needs your IT or data-protection sign-off before real data goes online.
- **Integration** with existing systems (maintenance, quality, MES, PLC data).

Earlier answers that still apply when these resume: TV is a mini PC or the TV's own browser, it has internet, and about four shift managers (one per team) would audit.

---

## 8. Hosting and sharing for two users (decided)

- **Hosting:** GitHub Pages (workflow included, see README). The site is public and holds no data.
- **Accounts:** username and password, kept in each browser (PBKDF2 hash). They separate people on a shared
  computer; they are not site security.
- **Sharing:** each person points the studio at a shared team folder (OneDrive, Teams or a network drive);
  the open project is published there as a file, and teammates' projects open as copies in your own list.
  No server, no IT approval needed for the studio itself.
- **Data stays in one browser.** The app asks the browser to keep its storage, but clearing site data still deletes it. A backup file (File > Save project) is the real safety net; the header shows a chip when no backup has been downloaded for a week.
- **Not covered:** two people editing the same project at once (copies do not merge), or protecting files in
  the team folder (anyone who can open the folder can read them). A real shared backend is deferred; see
  section 7.

---

## 9. Suggested order

1. ✅ **1.1** model line sample project and **1.3** documents. Then **1.8** module registry.
2. ✅ **1.4** shadow boards and labels (later removed).
3. **1.2** tape plan print review (with Sam and a real tape colour standard).
4. **1.7** shared workflow doc, **1.5** side-by-side, **1.6** floor plan import.
5. ✅ **Phase 2 SMED** core, later removed.
6. ✅ **Phase 3 problem solving**, **lines and zones** and **operator tasks**. Next: try them on a real problem.
7. Revisit section 7 with IT.

## 10. Questions for Josh and Sam

1. What exactly is the "model line", and which area do you want to design first? A photo or a drawing to work from would let us use real dimensions.
2. Is there a plant tape colour standard (walkway, WIP, red tag, keep-clear, hazard)? We'll match the colours and widths.
3. Which documents belong in an area (SOPs, OPLs, checklists, changeover sheets...)? Do you have existing templates or a naming/revision scheme to follow?
4. Which printer sizes do you have (A4, A3)? Tape plans and labels are designed around this.
