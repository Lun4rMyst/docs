# Test harness

Playwright scripts that drive the app in headless Chromium against real plan sets, plus the reference data the room finder is checked against. Client PDFs, the vector and text extracted from them, screenshots and takeoff exports are not in git (see `.gitignore`); only each job's `job.json`, `rooms<page>.json` references and `tagmap.json` are.

## Setup

1. `npm install` here (pdfjs-dist 3.11.174, playwright, clipper-lib). Chromium is expected at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; change the `executablePath` in the scripts if yours differs.
2. Put pdf.js 3.11.174's `pdf.min.js` and `pdf.worker.min.js` in `pdfjs/` (copy them from `node_modules/pdfjs-dist/build/`).
3. Make the app copy the scripts load: copy `../index.html` and `../js/` into `app/`, point the pdf.js script tag at `../pdfjs/pdf.min.js` and set `PDFJS_WORKER` in `app/js/core.js` to `/pdfjs/pdf.worker.min.js`. Re-copy after every change to the app, keeping those two local paths.
4. Put the plan PDFs here as `plans.pdf` (Kalinda), `poi-plans.pdf` (Point Cartwright), `daisy-plan.pdf` and `daisy-sched.pdf` (Daisy Lane).
5. Serve this folder: `python3 -m http.server 8765 --bind 127.0.0.1`, then run a script with `node <script>.js` from this folder.

## Scripts

- `vectors.js <pdf> <page> <out.json>` — fills and strokes of a page in base points (the Python pipeline's `vec<page>.json`). `items.js` does the same for text (`items.json`).
- `show.js`, `show-poi.js`, `spec-shot.js` — load a job's project file, screenshot the tabs and report what the text readers find.
- `calc.js`, `calc-poi.js`, `calc-unit.js` — run the takeoff on a project file and write the CSV / text exports; `unit-leaves.json` is the synthetic project for the multi-panel slider deduction check.
- `render.js`, `render-poi.js`, `render-any.js '<jobs json>' '<pdf url>'` — render sheets to PNG for eyeballing.
- `queue-test.js`, `queue-dbg.js` — the Claude read queue with a stubbed sample capability.
- `tags-daisy.js` — schedule-sheet tag reading on the Daisy door schedule.
- `smoke.js`, `smoke2.js`, `extract.js` — early smoke tests.

## Jobs

`jobs/<job>/job.json` is the config for `../tools/pipeline.py` (pages, room label regex, opening code widths, manual plug and erase boxes in points, stroke-wall options). `rooms<page>.json` is the pipeline's output that the in-app finder is compared with: room names, area, perimeter, bbox, outline in points and centroid. Run the Python tools from `jobs/` so their relative paths (`kalinda/...`, `poi/...`, `daisy/...`) resolve; they also need `vec<page>.json` and `items.json` in each job folder, made with `vectors.js` and `items.js`, and an `img/` folder for the debug pictures.
