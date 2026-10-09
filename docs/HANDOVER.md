# Handover: state of Lean Studio (formerly 5S Studio)

Last updated after areas and problem solving (9 Oct 2026). Read this first when picking the work back up.

## What is built

| View | What it does |
|---|---|
| Layout | Scaled drawing, walls and fixed equipment, items with home marks, floor tape (schedule, setting-out, rolls), routes, layout checks, proposals compared with the standard, daily checks, pins for red tags / actions / documents |
| SMED | Changeovers: steps stopped / before / after, plan per step, Gantt now vs plan, savings per changeover and per year, stopwatch, trials and history, A3 work sheet |
| Areas (Layout tab and tool) | Named polygon zones; items belong by position or are designated; strays flagged on Compare, the map and daily checks; stats per area, A3 area sheets, Area column in registers |
| Problems | Problem records with 5-Why, fishbone, countermeasures (actions with `prob`), review and close, Pareto, A3 report; raise one from SMED, a red tag or an area |
| Boards | Shadow boards, cleaning stations, kanban racks: numbered slots, location codes (`SB-01-03`), fit check, labels for a label printer, 1:1 outlines, CSV |
| Documents | Register of SOPs, OPLs, checklists, boards: owner, revision, review date, where kept; document map and tick list |
| Red tags, Actions | Registers with pins, CSV and print |
| Tracking | Daily checks over time: where items actually sit (drift map), suggested new homes, trend, movement-log CSV, print |

Navigation (reworked again, Sam's idea): three sections. **5S** = Setup, Layout, Boards, Tracking, Red tags, 5S actions;
**Document mapping** = Document list, Factory map, Document actions; **Improve** = Problem solving, SMED (kept,
last; Sam thinks it is not great, so it is a candidate to cut). One list (`NAV` in `js/12-views.js`) drives the
header buttons, the phone tab bar and the page bar under it. 5S pages are scoped from the **Setup** page (first page of 5S: a factory plan and a card for the whole
factory and each area; a "Showing ... change" chip on the other 5S pages links back): whole factory, or
one area, so a layout is not cluttered; the layout draws only that area, the registers filter to it, the address
bar holds it (`#/layout/<areaId>`). Document pages are always the whole factory. Actions have a `stream`
("5s", "doc", "improve"; problem-linked ones are "improve") and optionally a linked document `a.doc`; the 5S
actions page and Document actions page filter on it. Project version 8. Not done: Tracking and Boards are not
area-scoped, there is no whole-factory overview dashboard yet, nothing else added under Improve (ideas: an
improvement log / kaizen list, one-point lessons, a factory overview).

Layout editing (cleaned up 10 Oct, `js/37-layout-edit.js`): toolbar under the selection, smart guides,
Shift-drag box select, align / space evenly, copy and paste across sheets, typed positions from the datum,
full names shown for small items on hover or selection, the item list hidden while something is selected,
"Marked zone" / "Keep-clear zone" wording so zones are not confused with Areas. Not done yet: touch box
select, group/ungroup, align for tape and routes.

SMED and problem solving (reworked 10 Oct): SMED runs as four steps (Record, Separate, Improve,
Standard work) with one-tap choices, a compact timeline sized to the screen and steps as cards on a
phone. Problems open as one board like the team's whiteboard: fishbone, likely causes, causes and
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
