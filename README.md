# Lean Studio

Lean tools for a production line (it started as 5S Studio), used to work out before touching the floor:

1. **5S design**: the layout, where floor tape goes, and which items and documents live where.
2. **SMED**: cut changeover time.
3. **Problem solving**: 5-Why, fishbone, Pareto and an A3 report, feeding the action log.

Everything runs in the browser. There is no server and no build step. Data is stored on the device
(IndexedDB) and can be saved to / opened from a project file.

## How it is laid out

Three sections along the top: **5S** (layout, boards, tracking, red tags, 5S actions), **Document mapping**
(document list, factory map, document actions) and **Improve** (problem solving, SMED). In the 5S section
an Area picker switches between the whole factory and one area, so a layout is not cluttered; document
pages always show the whole factory.

## What is in it

- **Layout**: scaled drawing with walls and fixed equipment, movable items, floor tape (with a tape
  schedule, setting-out and rolls to order), walking and vehicle routes, layout checks (keep-clear,
  aisle widths), proposals compared with the standard, A3 print and PNG export. Editing: a toolbar
  under the selection (rotate, duplicate, lock, align, delete), items snap to the edges of other items
  and walls (hold Alt to place freely), Shift-drag to box-select, align and space evenly, copy and paste
  between sheets (Ctrl+C / Ctrl+V), exact positions from the datum, and a shortcuts list (press ?).
- **Areas**: outline named zones of the line (Area tool, Q) with an owner and a note. An item belongs to
  the area it sits in, or you designate it to one; a designated item that strays is flagged in Compare,
  on the map and on daily checks. Each area shows its items, tape, documents, boards, red tags and
  actions, and prints as an A3 area sheet. Registers have an Area column and filter.
- **Problems**: each problem is a **board** laid out like the whiteboard version: problem statement,
  a fishbone (machine, method, material, environment, people, measurement) with likely causes starred,
  a hypothesis and how it was confirmed, the why chain to the root cause, and the action list. An
  action raised from a cause gets the same number as the cause. Actions are normal actions in the
  action log. The A3 details tab holds background, target, containment, links, photos and the
  effectiveness check before closing. Print the board on one A3 sheet or print an A3 report; a
  **Pareto** chart shows what to attack first. Raise a problem from scratch, a changeover, a red tag
  or an area.
- **SMED**: works through the four SMED steps. **Record** the changeover (stopwatch, or type the steps
  in), **Separate** each step into machine stopped / before the stop / after the restart with one tap,
  **Improve** each stopped step (make external, shorten, in parallel, eliminate), and print the
  **Standard work** with where each part or tool comes from. Trials of the same changeover sit side
  by side, and a click on a bar in the timeline finds its step. Gantt timelines of now and the plan, stopped time saved per changeover and per
  year, a target line, a "look here first" list, walking distance from layout routes, a history across
  trials, and a printable standard-work checklist.
- **Boards**: shadow boards, cleaning stations and kanban racks. List what lives on each board in
  numbered slots (tools, cleaning kit, spares, changeover parts, kanban bins with min / max). Each slot
  gets a location code such as `SB-01-03`. Print labels sized for your label printer (Brother TZe, Dymo,
  Zebra or a custom size), a scaled board layout, 1:1 outlines to cut from (A4 or A3), or export a CSV for
  label software.
- **Documents**: a register of the SOPs, one-point lessons, checklists and boards in the area, where
  each is kept, who owns it and when it is reviewed. Documents have their own **map** (over a faded
  copy of the layout, with a line to the item each is kept at), so the layout itself stays about
  items and tape. Print a document map or a tick-off list.
- **Red tags**: tag anything not needed or in the wrong place, with an owner, a decision and a date;
  pin it on the layout, with a register of what is open and overdue.
- **Daily checks and Tracking**: start a check each day (it copies the standard), move things to where
  they really are, and Tracking shows **where each item actually sits over time**, what keeps drifting
  from its home, and suggests moving the home to where it is really used. Export the movement log to a
  spreadsheet.
- **Actions**: a simple action log with owners and due dates, pinned on the layout.
- **Example**: *Settings > Open the example model line* (or the button on an empty layout) loads a
  complete example project to explore.

Removed (parked, not lost: old project files keep that data): formal 5S audits and dashboards and the TV
display. They are in git history at commit `2ddb593`.

## Accounts, projects and sharing

- Sign in with a **username and password** (created on first visit). Accounts live in this browser, so
  two people can share a computer without seeing each other's work. Passwords are stored only as a salted
  hash. It is a sign-in screen, **not encryption and not site security**: anyone can open the site and
  make their own account, and there is no password reset. Keep **Save project** backups.
- Each account has several **projects** (person icon, top right). Opening a project file, the example
  or a teammate's project always adds a new project; nothing is replaced.
- **Team**: pick a folder you both reach (a synced OneDrive or Teams folder, or a network drive) and your
  open project is written there as a file. Your teammate's projects appear in the Team tab, and opening one
  adds a copy to your own list, so you can look at each other's work and never overwrite it. Needs Chrome
  or Edge; other browsers use the download and open buttons. The files are plain project files: anyone who
  can open the folder can read them.

## Live site

https://griminal01.github.io/5s-Studio/ (published from `main` by the `Deploy to Pages` workflow).

## Run it

```bash
npm run serve        # http://localhost:8080
```

Or just open `index.html` in Chrome or Edge, or use the GitHub Pages address once the repository is
published (see below). Use **Save project** regularly: the backup file is the only copy
outside that browser.

## Layout of the repo

```
index.html          page markup; loads css/ and js/ in order
css/styles.css      all styles (screen and print)
js/NN-name.js       app code, loaded in numeric order (see CLAUDE.md)
tests/smoke.cjs     boots the app, visits every view, loads the example, prints documents
tools/lint.cjs      cross-file lint (undefined names, unused code)
docs/ROADMAP.md     the plan
archive/            the original single-file v7, untouched
```

## Develop

```bash
npm install          # first time (Playwright and ESLint)
npm run check        # syntax-check every js file
npm run lint         # undefined names and dead code across all files
npm test             # smoke test
```

See `docs/ROADMAP.md` for where this is going and `CLAUDE.md` for how the code is organised.

## Host it on GitHub Pages

1. Merge the working branch into `main`.
2. Repository **Settings > Pages > Build and deployment > Source: GitHub Actions**.
3. The `Deploy to Pages` workflow publishes `index.html`, `css/` and `js/`; the address is
   `https://<username>.github.io/<repository>/`.

Pages sites are public (private Pages needs GitHub Enterprise Cloud). Nothing is stored on the site:
projects stay in each person's browser or in their team folder. Because the site is public, anyone can
create an account in their own browser and use the tool; the accounts only keep people on one computer apart.
