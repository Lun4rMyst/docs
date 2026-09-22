# Trim & Door Takeoff

A single-page app for taking off **skirting**, **architrave** and **doors** from PDF floor plans. Open a plan, set the scale, mark up the rooms, doors and windows, and read the quantities off the Takeoff tab. Everything is one HTML file with no build step.

## Running it

- **Locally:** open `index.html` in Chrome, Edge or Firefox (keep the `js` folder next to it). It loads pdf.js from cdnjs, so it needs an internet connection the first time. `python3 build.py > trim-door-takeoff.html` makes a single-file copy you can email.
- **Published copy:** the same file is published as a Claude artifact. That copy can also *read the plan with Claude* (see below); the local copy cannot.

Your work autosaves in the browser (the takeoff in localStorage, the last PDF in IndexedDB). Use **Save project** to keep a `.json` you can reload later or hand to someone else, and **Load project** to bring one back.

## Workflow

1. **Spec tab.** Enter the job's skirting and architrave (size, profile, material, stock length, waste), colours, door defaults, jamb and hardware. *Save as my defaults* makes these the starting point for future jobs.
2. **Open PDF** (or drop it on the plan). Use the sheet arrows for multi-sheet sets and give each sheet a name (Ground floor, First floor).
3. **Scale.** Either pick a preset (1:100 etc., assumes the PDF is at true paper size) or, better, use **Calibrate**: click both ends of a long dimension string and type its length.
4. **Rooms.** Trace each room along the inside face of the walls (**Trace room** for any shape, **Rect room** for rectangles; right-angle snap is on, hold Alt to turn it off), or type sizes with **+ Room by size**. On vector PDFs, **Find from plan text** reads room names with sizes printed under them (`BED 1` / `3.6 x 3.3`) and creates the rooms for you.
5. **Doors and windows.** Click them on the plan with the **Door** and **Window** tools. A door is assigned to the rooms either side of it automatically when those rooms are traced. **Find tags from plan text** picks up `D01` / `W01` tags on the plan and reads the door and window schedule tables for types and sizes.
6. **Takeoff tab.** Skirting per room, architrave per opening, the door schedule, an order summary grouped by type and size, and hardware counts. Export as CSV, as a Databuild import CSV, copy the report as text, or print.

Keys: `V` select · `C` calibrate · `R` trace room · `X` rect room · `D` door · `W` window · `Enter` close a room · `Esc` cancel · `Delete` remove · `Ctrl+Z` undo · `+` `-` `0` zoom · `Ctrl`+wheel zoom · `Space`+drag pan · `PgUp` / `PgDn` sheets.

## How the numbers are worked out

- **Room perimeter**: from the traced outline and the sheet scale, or `2 × (length + width)`, or a typed perimeter.
- **Skirting per room** = perimeter − Σ door openings − other deductions. Each door deducts `door width × leaves + opening allowance` (default 200 mm, covering jamb and architrave each side) from **both** rooms it joins. Add other deductions per room for kitchen kickboards, robes, vanities, fireplaces and so on.
- **Rooms with no skirting**: wet areas, robes and garage/outdoor rooms default to no skirting (switchable in the spec and per room).
- **Architrave per door** = sides × (2 × (height + leg allowance) + (width + head allowance)). Internal doors, cavity sliders, cased openings and barn doors get both sides; entry, external, robe, bifold and aluminium sliding doors get one side. Windows get `2 × (width + allowance) + 2 × (height + allowance)` when architraved.
- **Stock lengths** = ceil(net metres × (1 + waste %) ÷ stock length).
- **Hardware**: hinges (3 per leaf, 4 over 2100 high), lever sets (privacy for bed and wet-area doors, passage elsewhere, entrance sets on external doors, cavity sets on sliders), stops, closers, cavity units and track sets, all editable per door.

Door types: hinged internal, cavity slider, sliding robe, bifold, cased opening, entry, external hinged, garage access (self-closing, solid core), external sliding/stacker and external doors by others such as aluminium or pivot doors (listed but not counted as leaves), barn.

## Reading the plan with Claude

In the published copy, **Read area with Claude** (drag a box) or **Read sheet with Claude** sends an image of the plan plus its text layer to Claude, which returns rooms with sizes, doors with types and sizes, and windows. Results are added as normal items marked *(Claude)* for you to check. It uses the viewer's own Claude account, so the first call asks for permission.

## Databuild export

The Databuild CSV is the headerless 4-field format for the *Import Quantities* screen (`code, qty, description, unit price`): skirting and architrave as stock lengths (code 0001) or lineal metres (0004), one line per door type and size, and hardware lines. Descriptions have no full stops or pipes. Rates come from the spec and default to 0.00.

## Things to check

- The scale. A preset is only right if the PDF is at true paper size; calibrating on a long dimension is safer.
- Rooms created from text labels have sizes but no outline, so doors near them are matched to the nearest labels and can need correcting. Trace the room to fix it.
- Window schedules are read as height × width. Door schedules are read as height × width unless the numbers make that impossible.
- Windows without a size count no architrave until you enter one; the Takeoff tab lists them.

## Files

- `index.html` — page markup and styles; loads pdf.js from cdnjs and the scripts below.
- `js/core.js` — state, spec defaults, door type rules, saving and loading, the embedded sample plan.
- `js/viewer.js` — PDF rendering, zoom and pan, scale calibration, the drawing tools and overlay.
- `js/reading.js` — text extraction, room label / tag / schedule detection, the Claude read.
- `js/panels.js` — the calculations and the Spec, Rooms and Doors panels.
- `js/takeoff.js` — the Takeoff panel, exports and start-up.
- `build.py` — bundles everything into one self-contained HTML file (`--artifact` strips the page wrapper for publishing as a Claude artifact).
