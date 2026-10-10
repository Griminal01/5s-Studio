# Handover: state of Lean Studio (formerly 5S Studio)

Last updated after the review fixes (9 Oct 2026; the dates below from the audit are as written in the project history). Read this first when picking the work back up.

## What is built

| View | What it does |
|---|---|
| Layout | Scaled drawing, walls and fixed equipment, items with home marks, floor tape (schedule, setting-out, rolls), routes, layout checks, proposals compared with the standard, daily checks, pins for red tags / actions / documents |
| Setup | Factory map (plan image, scale, walls), lines, zones: cards edited in place |
| Lines and zones (Zones tab and Zone tool) | Named polygons: a line holds zones (`a.parent`); items belong to zones by position or designation; items belong by position or are designated; strays flagged on Compare, the map and daily checks; stats per area, A3 area sheets, Area column in registers |
| Improvement log | Ideas from anyone: zone, benefit and effort, status from New to Done, owner, linked proposal, problem or red tag, actions; quick-win chart, print, CSV |
| Problems | Problem records with 5-Why, fishbone, countermeasures (actions with `prob`), review and close, Pareto, A3 report; raise one from a red tag or a zone |
| Present | Layout only for now: full-screen TV view of the open sheet, tour through factory, lines and zones, optional change overlay. Documents, tasks and problems are not presentable yet |
| Bring items | Layout panel button: choose another project, tick items, they are copied to the open sheet (new refs, scale-converted, categories matched, tasks come too). Documents, tape and zones are not brought |
| Operator tasks | Per zone: task, who, when, minutes, 5S step, linked document, steps, and the items it uses (by item ref). KPIs: zones with tasks, items used, minutes per shift. Zone and item panels list them; zone A3 sheet, print, CSV |
| Documents | Register of SOPs, OPLs, checklists, boards: owner, revision, review date, where kept; document map and tick list |
| Red tags, Actions | Registers with pins, CSV and print |
| Tracking | Daily checks over time: where items actually sit (drift map), suggested new homes, trend, movement-log CSV, print |

Navigation (reworked 11 Oct): four sections. **Setup** = 1 Factory map, 2 Lines, 3 Zones (done once);
**5S** = Layout, Operator tasks, Tracking, Red tags, 5S actions; **Documents** = Document list, Document map, Document
actions; **Improve** = Problem solving. One list (`NAV` in `js/12-views.js`) drives the header buttons, the
phone tab bar and the page bar under it. The **Showing picker** on the right of that bar chooses the
whole factory, one line (with all its zones) or one zone, and it follows you between sections. A zone
is drawn sharp with a faded margin of context (`scopeBox`, 28% round it); the document map zooms to it;
lists, registers and problems filter to it. Tracking is always the whole factory. Lines and zones live in
`P.areas` (`a.level`, `a.parent`); drawing them hands off to the layout with a Back to Setup button.
Actions have a `stream` ("5s", "doc", "improve") and optionally a linked document `a.doc`. Project version 11 (10 added `P.tasks`, 11 added `a.locked` on lines and zones: no reshape handles, no drag, no delete; rename and owner still editable).
Boards and SMED were removed (11 Oct): their data is parked in the project file, the code is in git
before `c0594d8`. Ideas for Improve (nothing built): improvement log, one-point lessons, factory overview.

Layout editing (cleaned up 10 Oct, `js/37-layout-edit.js`): toolbar under the selection, smart guides,
Shift-drag box select, align / space evenly, copy and paste across sheets, typed positions from the datum,
full names shown for small items on hover or selection, the item list hidden while something is selected,
"Marked floor area" / "Keep-clear area" wording so they are not confused with zones (production zones). Not done yet: touch box
select, group/ungroup, align for tape and routes.

Problem solving (reworked 10 Oct): problems open as one board like the team's whiteboard: fishbone, likely causes, causes and
actions sharing a number, hypothesis and confirmation, why chain, inline actions; the rest sits under
"A3 details and close". Board prints on one A3 sheet.

Documents moved off the layout (10 Oct, at Sam's request): Documents opens on a Map tab where pins are
placed, dragged and opened; the Layout's Document tool is gone and its document layer is off by default.

The example model line (Settings, or the empty layout) fills every view.

Offline and install (11 Oct): `sw.js`, `manifest.webmanifest`, `icons/`; see `docs/DOMAIN.md`. Live at leanstudio.app.

Deploys stamp the css and script links with the commit id (`pages.yml`), so a browser cannot run new scripts against cached old CSS. If something looks unstyled or black after an update, hard refresh (Ctrl+Shift+R).

## Outside review (10 Oct)

From a review of the live site: the title says what it is ("Lean Studio: 5S layout and floor tape planner"), the
meta and link-preview descriptions are one text that mentions the fishbone board, the first screen has a one-line
intro, and a `<noscript>` text explains the tool to anything that does not run scripts. File has "Export layout
as image (PNG)" and "Print layout or save as PDF". The save status shows on laptops (it was hidden below 1500 px).
Phones get a one-time note on the Layout that drawing is easiest on a computer. Found while testing: a project
added in the moment between "Who is working?" and the end of start-up could drop out of the project list (its data
kept but not listed); adding, opening and deleting projects now wait for start-up (`appReady`, 16-app).

## Project folder (10 Oct, `js/33-team.js`)

Projects can live as files in a folder: Account (name button) > Project folder > Choose the project folder, then
"Save the open project to the folder". Pick a OneDrive or Teams folder synced to the PC. Each project is one
file, `<name>.leanstudio.json`, overwritten in place (no extra files); the browser copy saves at once and the
file at most every 30 seconds while you work, and straight away when you leave the tab, close the page or open
another project, so OneDrive's version history and uploads stay small. Leftover `.crswap` temporary files
(from a browser crash mid-save) are removed once they are 10 minutes old. Teammates open the same file from the list. If someone else saved the file
and you have no unsaved changes, their version simply comes in; if you both changed it, a yellow banner asks:
use theirs (yours is kept in My projects) or save yours as a new file. Nothing is overwritten. Access, version
history and retention come from OneDrive. Needs Edge or Chrome on a computer; elsewhere use Download and Open.
The old publish-a-copy team folder is replaced; older team files still open as copies. Ask IT whether the browser
may edit files in synced folders (some companies restrict it).

## Improvement log (9 Oct, `js/35-ideas.js`)

Improve now opens on the **Improvement log**: ideas anyone can raise (anyone, not just account holders: "Raised
by" is a free name). Each idea has a zone, what happens now and what would change, and what it would improve;
whoever takes it forward rates benefit and effort (Low, Medium, High), sets the status (New, Assessed, Trial,
Done, Not now), an owner, and links a layout proposal to try it, a problem it helps or a red tag it came from.
The work it needs is ordinary actions with `a.idea` (added from inside the idea). A **quick-win chart** places
open ideas by benefit and effort. Ideas left as New for over 14 days turn the Improve badge red, so every idea
gets an answer. Raise one from the page, from a zone's side panel ("Raise an idea here") or from a red tag row
("Idea"). Print (chart and lists, A4) and CSV. Project version 13. Next, as agreed: before and after results on a
closed idea (photos, layout numbers from the proposal, own measures), then an Improve overview.

## Tape plan (9 Oct, `js/23-tape-plan.js`)

The Tape tab prints a **tape plan** on one A3 sheet: the plan at a true scale (the smallest of 1:50, 1:75,
1:100, 1:125 ... that fits, with a scale bar; print at 100% for it to measure true), run numbers and the datum,
a colour key, an order list (supplier, order code, metres to lay, roll length, rolls), the runs with their start
points, and a title block with Checked and Approved boxes. The full point by point setting-out is the
**Setting-out sheet** (was "marking sheet"). **Print colour standard** prints the marking standard as an A4
document to sign: big swatches (stripes on the diagonal), colour, width, colour reference, supplier, code, roll.
Each tape type now has a colour reference, supplier, order code and its own roll length (project version 12).
The team is setting up its colour standard and buying tape from one supplier: put that supplier's codes and
roll lengths into the marking standard; nothing supplier-specific is in the code. Not done: printed on a real
A3 printer; pre-cut shapes (corners, feet, arrows) are only counted, not ordered as products.

## Code audit (11 Oct)

Four independent read-through reviews plus random-click runs. Fixed: the Settings dialog could not be saved
(number steps) and "New empty project" did nothing; the on-canvas hint covered the drawing on a phone so
touch drawing failed (and a tap on a draw tool now waits to see if it is a pinch); Reshape on the map threw;
scoped views lost layout checks, drifted items, and left hidden tape selected; red tags, actions and problems
with no place vanished under a scope; countermeasures changed section wrongly when a problem was deleted or an
action linked; A3 fishbone dropped starred causes; Pareto dates used UTC; aisle widths were not rescaled when
the scale was set; Compare with the sheet itself showed nothing; delete or "refresh my copy" could remove data
before the replacement was known good; images could be dropped after a failed database write; record ids are
now unique after validate. Dead CSS from Boards and SMED removed.

Review fixes (after a full pass of the app): the browser is asked to keep storage (`keepStorage()`); a second tab
on the same project shows a warning banner, and the tab that is now out of date asks for a reload (`BroadcastChannel`
in `js/05-storage.js`; a warning, not a lock); two people with the same username on different computers no longer
write the same team file (the second gets the project name plus a short device id); the sheet bar on a phone
collapses to the name and an Options button; the drawing has a full-screen button (Esc returns); wide tables show a soft
edge; the empty layout points to Setup; the stylesheet is split into `css/*.css`. Known and not fixed: "Show" on a
task and several dialogs lose unsaved edits if you leave through a button inside the dialog (Settings Scale/Logo).
Names on the layout (9 Oct, `js/37-labels.js`): every name is placed in one pass. Inside the item when it fits (wrapped, turned along the long side), otherwise a tag with a leader line in the nearest free floor space; line and zone names move to a clear spot. On a phone-sized drawing the tags are held back until you zoom. Layers > "Names on the drawing" turns them off. Not done: route names and pin names are not in the engine; long names are never shortened, so a very crowded sheet can leave a tag out (tap or hover shows it).

## Review done (two passes, all fixed and pushed)

Highlights: phones showed no drawing (from v7); Enter in any dialog field cancelled it and lost what
was typed (from v7); the stopwatch could lose a timing on Esc (now also kept in the browser as it
goes); timed changeovers showed savings with nothing planned; kit links broke when slots moved;
label settings changed on Cancel; red tag photo removal could not be undone; Tracking "Add to the
standard" made duplicates; prints could inherit a label page size. Full list in the git log.

Tests: `npm run check && npm run lint && npm test`. The smoke test drives the real forms, loads the
example, prints everything, and opens a real backup made with the original v7 file
(`tests/fixtures/v7-backup.json`).

## Accounts, projects, team (added 9 Oct)

"Who is working?" screen (names only; passwords were removed on 10 Oct because a static site cannot protect
anything with them and a forgotten one could only be recovered by deleting the work), several projects per
person, and a Project folder (see above) where projects are saved as files and shared. Data is
stored under per-account keys in the `studio-5s` database. Project files, the example and teammates'
projects always become new projects. Not security: the site is public and nothing is encrypted.

## Known limits (not bugs)

- Two tabs open on the same project: the app warns, but if both are edited the last save wins.
- Team copies do not merge back; refresh a copy by opening the teammate's project again.

- Nothing has been tried on a real label printer or real printer yet. Print one test label first.
- The example data is invented. Real line dimensions, tape colours, documents, board contents and
  changeover steps are still needed from Josh and Sam.
- The layout editor is desktop-first. On a phone it works but is cramped.
- Data lives in one browser; share by Save project / Open (see `docs/ROADMAP.md` section 8).
- SMED steps timed with the stopwatch keep their recorded start times; editing a time does not move
  later steps. Waits seen in the timing are kept in the plan until an improvement is chosen.

## Next, in order

1. Real data: line drawing and scale, tape standard, label printer model and tape size.
2. SMED video timing (roadmap 2.2) if the team prefers filming to the stopwatch.
3. Try problem solving on one real problem and area layout with Sam, then adjust the A3 wording.
4. Ideas parked: drag-to-arrange fishbone, SMED step level "raise a problem", problem pins on the
   layout, per-area daily check score.
