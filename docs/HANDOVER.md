# Handover: state of Lean Studio (formerly 5S Studio)

Last updated after areas and problem solving (9 Oct 2026). Read this first when picking the work back up.

## What is built

| View | What it does |
|---|---|
| Layout | Scaled drawing, walls and fixed equipment, items with home marks, floor tape (schedule, setting-out, rolls), routes, layout checks, proposals compared with the standard, daily checks, pins for red tags / actions / documents |
| Setup | Factory map (plan image, scale, walls), lines, zones: cards edited in place |
| Lines and zones (Zones tab and Zone tool) | Named polygons: a line holds zones (`a.parent`); items belong to zones by position or designation; items belong by position or are designated; strays flagged on Compare, the map and daily checks; stats per area, A3 area sheets, Area column in registers |
| Problems | Problem records with 5-Why, fishbone, countermeasures (actions with `prob`), review and close, Pareto, A3 report; raise one from a red tag or a zone |
| Documents | Register of SOPs, OPLs, checklists, boards: owner, revision, review date, where kept; document map and tick list |
| Red tags, Actions | Registers with pins, CSV and print |
| Tracking | Daily checks over time: where items actually sit (drift map), suggested new homes, trend, movement-log CSV, print |

Navigation (reworked 11 Oct): four sections. **Setup** = 1 Factory map, 2 Lines, 3 Zones (done once);
**5S** = Layout, Tracking, Red tags, 5S actions; **Documents** = Document list, Document map, Document
actions; **Improve** = Problem solving. One list (`NAV` in `js/12-views.js`) drives the header buttons, the
phone tab bar and the page bar under it. The **Showing picker** on the right of that bar chooses the
whole factory, one line (with all its zones) or one zone, and it follows you between sections. A zone
is drawn sharp with a faded margin of context (`scopeBox`, 28% round it); the document map zooms to it;
lists, registers and problems filter to it. Tracking is always the whole factory. Lines and zones live in
`P.areas` (`a.level`, `a.parent`); drawing them hands off to the layout with a Back to Setup button.
Actions have a `stream` ("5s", "doc", "improve") and optionally a linked document `a.doc`. Project version 9.
Boards and SMED were removed (11 Oct): their data is parked in the project file, the code is in git
before `c0594d8`. Ideas for Improve (nothing built): improvement log, one-point lessons, factory overview.

Layout editing (cleaned up 10 Oct, `js/37-layout-edit.js`): toolbar under the selection, smart guides,
Shift-drag box select, align / space evenly, copy and paste across sheets, typed positions from the datum,
full names shown for small items on hover or selection, the item list hidden while something is selected,
"Marked zone" / "Keep-clear zone" wording so zones are not confused with Areas. Not done yet: touch box
select, group/ungroup, align for tape and routes.

Problem solving (reworked 10 Oct): problems open as one board like the team's whiteboard: fishbone, likely causes, causes and
actions sharing a number, hypothesis and confirmation, why chain, inline actions; the rest sits under
"A3 details and close". Board prints on one A3 sheet.

Documents moved off the layout (10 Oct, at Sam's request): Documents opens on a Map tab where pins are
placed, dragged and opened; the Layout's Document tool is gone and its document layer is off by default.

The example model line (Settings, or the empty layout) fills every view.

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

Sign-in screen (username + password, hashed in the browser), several projects per account, and a Team
tab that publishes your open project to a shared folder and opens teammates' projects as copies. Data is
stored under per-account keys in the `studio-5s` database. Project files, the example and teammates'
projects always become new projects. Not security: the site is public and nothing is encrypted.

## Known limits (not bugs)

- Two tabs open on the same account and project overwrite each other: last save wins.
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
