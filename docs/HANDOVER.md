# Handover: state of 5S Studio

Last updated after the full review (9 Oct 2026). Read this first when picking the work back up.

## What is built

| View | What it does |
|---|---|
| Layout | Scaled drawing, walls and fixed equipment, items with home marks, floor tape (schedule, setting-out, rolls), routes, layout checks, proposals compared with the standard, daily checks, pins for red tags / actions / documents |
| SMED | Changeovers: steps stopped / before / after, plan per step, Gantt now vs plan, savings per changeover and per year, stopwatch, trials and history, A3 work sheet |
| Boards | Shadow boards, cleaning stations, kanban racks: numbered slots, location codes (`SB-01-03`), fit check, labels for a label printer, 1:1 outlines, CSV |
| Documents | Register of SOPs, OPLs, checklists, boards: owner, revision, review date, where kept; document map and tick list |
| Red tags, Actions | Registers with pins, CSV and print |
| Tracking | Daily checks over time: where items actually sit (drift map), suggested new homes, trend, movement-log CSV, print |

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
3. Problem solving module (roadmap phase 3): A3, 5-Why, fishbone, linked to red tags, SMED steps
   and actions.
