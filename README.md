# Lean Studio

Lean tools for a production line (it started as 5S Studio), used to work out before touching the floor:

1. **5S design**: the layout, where floor tape goes, and which items and documents live where.
2. **Problem solving**: 5-Why, fishbone, Pareto and an A3 report, feeding the action log.

Everything runs in the browser. There is no server and no build step. Data is stored on the device
(IndexedDB) and can be saved to / opened from a project file.

## Offline and install

Lean Studio works with no network once it has loaded once. In Chrome, Edge or Brave use *Install app* (or
*Add to Home screen* on a phone) for an app icon and a window of its own. After an update a message says
*A new version is ready. Reload to use it.* Notes on the domain and hosting are in `docs/DOMAIN.md`.

## How it is laid out

Four sections along the top. **Setup** is done once: the factory map (plan image, scale, walls), then
the production **lines**, then the **zones** in each line. The working sections are **5S** (layout,
operator tasks, tracking, red tags, 5S actions), **Documents** (document list, document map, document actions) and
**Improve** (problem solving). In each of those, the **Showing** picker at the right of the page bar
chooses the whole factory, one line, or one zone. A zone is shown with a faded margin of context
around it, so a layout is not cluttered; the document map zooms to it, and lists and registers
filter to it.

## What is in it

- **Layout**: scaled drawing with walls and fixed equipment, movable items, floor tape (with a tape
  schedule, setting-out and rolls to order), walking and vehicle routes, layout checks (keep-clear,
  aisle widths), proposals compared with the standard, A3 print and PNG export. Editing: a toolbar
  under the selection (rotate, duplicate, lock, align, delete), items snap to the edges of other items
  and walls (hold Alt to place freely), Shift-drag to box-select, align and space evenly, copy and paste
  between sheets (Ctrl+C / Ctrl+V), exact positions from the datum, and a shortcuts list (press ?).
- **Present**: the *Present* button on the Layout shows the layout full screen for a TV or projector.
  Arrow keys (or the buttons that appear when you move the pointer) step through the whole factory, each
  line and each zone; *Tour* (Space) does it on a timer; *C* shows what changed on a proposal. Esc exits.
  Zoom with the mouse wheel, pinch, double-click or the + / − keys and buttons (0 or Fit resets); drag to
  move. Item names grow as you zoom in, so you can read them from across the room.
- **Lines and zones**: outline each production line, then the zones inside it (Zone tool, Q), each with an
  owner and a note. An item belongs to the zone it sits in, or you designate it to one; a designated item
  that strays is flagged in Compare, on the map and on daily checks. Each zone shows its items, tape,
  documents, operator tasks, red tags and actions, and prints as an A3 zone sheet. **Lock** a line or
  zone (toolbar under the selection, side panel, or its Setup card) so it cannot be moved, reshaped or
  deleted by accident.
- **Problems**: each problem is a **board** laid out like the whiteboard version: problem statement,
  a fishbone (machine, method, material, environment, people, measurement) with likely causes starred,
  a hypothesis and how it was confirmed, the why chain to the root cause, and the action list. An
  action raised from a cause gets the same number as the cause. Actions are normal actions in the
  action log. The A3 details tab holds background, target, containment, links, photos and the
  effectiveness check before closing. Print the board on one A3 sheet or print an A3 report; a
  **Pareto** chart shows what to attack first. Raise a problem from scratch, a red tag or a zone.
- **Documents**: a register of the SOPs, one-point lessons, checklists and boards in the area, where
  each is kept, who owns it and when it is reviewed. Documents have their own **map** (over a faded
  copy of the layout, with a line to the item each is kept at), so the layout itself stays about
  items and tape. Print a document map or a tick-off list.
- **Bring items from another project**: on the Layout, *Bring items from another project* lists the items
  of any project in My projects (your own or a teammate's copy). Tick the ones you want and they are
  copied onto the layout you have open, together or at the same positions, sized to your scale, with the
  operator tasks that use them. Nothing in the other project changes, and Undo takes them back out.
- **Operator tasks**: define what operators do in each zone (change the film reel, end-of-shift clean,
  update the KPI board) with who, how often, how long, the 5S step, an optional document and the
  **items each task uses**. See which items nobody uses, which zones have no tasks, and the minutes a
  shift's tasks add up to. Tasks show in the zone and item panels, on the zone's A3 sheet, and print
  or export to CSV.
- **Red tags**: tag anything not needed or in the wrong place, with an owner, a decision and a date;
  pin it on the layout, with a register of what is open and overdue.
- **Daily checks and Tracking**: start a check each day (it copies the standard), move things to where
  they really are, and Tracking shows **where each item actually sits over time**, what keeps drifting
  from its home, and suggests moving the home to where it is really used. Export the movement log to a
  spreadsheet.
- **Actions**: a simple action log with owners and due dates, pinned on the layout.
- **Example**: *Settings > Open the example model line* (or the button on an empty layout) loads a
  complete example project to explore.

Removed (parked, not lost: old project files keep that data): Boards, SMED, formal 5S audits and dashboards and the TV
display. They are in git history at commit `2ddb593`.

## Accounts, projects and sharing

- **Who is working?** Type your name the first time; after that the studio opens straight to the last person
  on this computer, and "Switch person" (person icon, top right) goes back to the list of names. Each name has
  its own projects in this browser, so two people can share a computer. There is **no password**: it is a
  static site and the data lives in the browser, so anyone at the computer can open any name. Nothing is
  encrypted. Keep **Save project** backups.
- Each account has several **projects** (person icon, top right). Opening a project file, the example
  or a teammate's project always adds a new project; nothing is replaced.
- **Project folder**: pick your team's OneDrive or Teams folder (synced to the PC) or a network drive. Each
  project becomes one file there (`<name>.leanstudio.json`), saved a moment after every change, and your
  teammates open the same files. If someone else saved a file while you also changed it, you are asked: use
  theirs (yours is kept as a copy) or save yours as a new file; nothing is overwritten. Who can open the files
  is set by the folder's sharing, and OneDrive keeps their version history. Needs Edge or Chrome on a
  computer; other browsers use the download and open buttons.

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
css/*.css           styles in numbered files (screen and print), loaded in order
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
projects stay in each person's browser or in the project folder (your OneDrive). Because the site is public,
anyone can use the tool in their own browser; the names only keep people on one computer apart.
