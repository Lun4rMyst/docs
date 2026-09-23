# Find rooms from walls: port the offline room finder into the app

## Context
The app's room sizes come from either manual tracing, printed sizes in the text layer, or a Claude image read. The Claude read mis-sized rooms on 3 Daisy Lane (laundry 2610 × 1945 instead of 3751 × 1947, study spanning two rooms) because it matches dimension strings to rooms by eye. The offline Python pipeline (`scratchpad/pipeline.py`) instead reads the wall shapes out of the PDF's vector data, seals the door openings, finds every enclosed room and measures it off the wall faces. On three jobs it matched the estimator's own measurements (Daisy 252.82 m² vs 252.7 m² measured). The estimator approved that output and wants it inside the app: one button per sheet, coloured room shapes drawn over the plan to check, a check image handed to the user, and no Claude needed for sizes.

Sizes are measured face to face between the wall fills, exactly as in the approved offline run. Wall-thickness differences of a few tens of mm are accepted for skirting.

## What the estimator gets
- **Rooms tab → "Find rooms from walls"** on the current sheet. Runs in the browser (no Claude call, no usage). Creates traced rooms (polygons, `src: 'walls'`) named from the plan's room labels, skirting defaults by name, sizes and perimeters from the wall faces. Takes 1–3 s per sheet with a progress bar and a working Stop button.
- **Coloured overlay on the plan**: every found room in its own colour with a pill showing name, size (L × W mm) and perimeter, the same picture as the offline check images.
- **"Check image"** button: the sheet with the overlay rendered to a 2× PNG and handed to the user to check (downloads capability in the published app, ordinary download otherwise).
- **Two fix tools** for the odd gap the finder cannot seal: **Wall plug** (P) drags a box that counts as wall, e.g. a window opening cut out of a wall line; **Open wall** (O) drags a box that removes wall, e.g. a robe front or a section marker drawn as a bar. Boxes are saved per sheet in the project, drawn in red/orange, can be selected and deleted, and the finder re-runs on every change. Undo covers them.
- Re-running keeps renames, skirting toggles, deductions, notes and the door/window room links of rooms that are found again.
- "Find from plan text" and Claude reads no longer add a room whose label sits inside a room already found from walls; a Claude read can name a `ROOM n` placeholder.
- Labels that end up in no room (alfresco, porch, anything not enclosed) are listed once so nothing is silently dropped.

## How it works (same steps as the approved Python run)
1. Read the sheet's vector drawing (fills and strokes) from pdf.js's operator list.
2. Keep the black fills that look like wall pieces; drop blobs, symbols and door-swing fills.
3. On sheets where the walls are drawn as face lines instead of fills (Point Cartwright brick veneer), chain the black 0.4 pt strokes and thicken them into 90 mm bands; door arcs are recognised by circle fit and dropped. This kicks in automatically when the fills-only run finds fewer than 3 rooms or leaves more than 40 % of the labels unassigned.
4. Subtract the user's Open wall boxes, swell every piece by 20 mm, then seal openings: a global 700 mm closing keeps only thin bridge pieces (door and window gaps), plus one closing per door/window code found in the text at radius width/2 + 250. Add the user's Wall plug boxes.
5. Union everything. Each hole in the sealed wall shape is a room. Shrink back 20 mm, drop anything under 0.5 m², simplify the outline to 15 mm.
6. Name each room from the room labels inside it (joined with `/` for open plan, e.g. `LIVING/DINING/KIT`). Rooms with no label get the existing text guess, else `ROOM n` with a note. Unnamed rooms outside the named rooms' area plus 2.5 m are dropped (title blocks, elevations).

## Design decisions
| Topic | Decision |
|---|---|
| Geometry library | clipper-lib 6.4.2 via `<script src="https://cdn.jsdelivr.net/npm/clipper-lib@6.4.2/clipper.js">` after the pdf.js tag (global `ClipperLib`, `version '6.4.2.2'`). jsdelivr is blocked from this sandbox, so verify in the browser at implementation; fallback is vendoring the file as `js/clipper.js`, which `build.py` inlines automatically. |
| Units | Integer Clipper units of 0.1 mm (`WL_U = 10`); `toU(pt) = Math.round(pt × mmPerPt × 10)`. Any sheet stays far below Clipper's fast-path range. |
| Threading | Main thread with `await` yields between stages and every 4 openings; the existing `#aiStop` button sets an abort flag. Vector reading already happens in the pdf.js worker. |
| Offsets | `new ClipperLib.ClipperOffset(5, 0.25)`, `jtMiter` (shapely mitre limit 5); stroke chains use `etOpenButt` (shapely `cap_style=2` is flat). |
| Title block cutoff | Automatic plan-area rule (named rooms' bbox + 2500 mm) replaces the per-job `max_x` / `skip_x_over`. |
| Room labels | Add `PTRY\|SEWING(?: ROOM)?\|STUDIO\|MAIN BATH(?:ROOM)?\|GUEST BATH(?:ROOM)?\|W[IL]L\|POOL\|ENTERTAINMENT` to `ROOM_WORDS` (reading.js:2). Verified: these are exactly the labels the app's `ROOM_RE` missed on Kalinda, Point Cartwright and Daisy. |
| Black test | Exact `[0,0,0]` (option `darkMax`, default 0), as in the reference runs. |
| Walker parity | The vector walker mirrors `test/vectors.js` op for op (including its `curveTo` quirk of keeping the second control point and the end point) so results match the reference JSON; adds `setGState` `LW` line widths. |

## Changes by file

### `floor-plan-takeoff/index.html`
- Clipper script tag after pdf.js (line 261); `<script src="js/walls.js">` between reading.js and panels.js.
- Two tool buttons in `#toolGrp` after Window: `data-tool="plug"` "Wall plug" and `data-tool="erase"` "Open wall" with title hints. `bindTop()` (takeoff.js:122) already wires `data-tool` buttons to `setTool`.
- CSS: add `.tool-plug` / `.tool-erase` to the crosshair rule (line 82); `.fixes` list styling and a `.sw` colour swatch.

### `floor-plan-takeoff/js/viewer.js`
- `V.text = {}` reset in openPdf (line 13) → also `V.vec = {}` (vector cache).
- `drawLabel` (159): trailing `fsc = 1` scale factor on font sizes and paddings so the check image gets legible pills.
- `drawOverlay` (187) → thin wrapper around new `paintOverlay(ctx, z, pn, {sel, draft, hover, fsc})` so the check image can paint with the same code. In the room loop: walls rooms get `wallColour(r)` fill/stroke, label at `wlLabelPoint(pts)`, sub-line `L × W · P m`; after doors/windows call `wlDrawBoxes(ctx, z, pn, sel)` (plugs red `#D62728`, erases orange `#FF7F0E`, selected one in `COL.sel`); draft branch for `kind: 'box'`.
- `HINTS` (239): plug and erase hints.
- Pointer handlers: pointerdown `case 'plug': case 'erase'` starts a `{kind:'box', box: tool, pts:[p,p]}` draft; pointermove updates it like the AI box; pointerup calls `addWallBox(kind, pn, a, b)` when the box is more than 4 px each way, else toasts.
- `hitTest` (258): boxes tested before rooms; `onSelect` (350) shows the Rooms tab; `deleteItem` (416) tries `removeWallBox(id)` first. Keys (435): `p` plug, `o` erase.

### `floor-plan-takeoff/js/walls.js` (new, every top-level name prefixed `wl` / `WL_`)
- **Constants**: `WL_U`, `WL_PALETTE` (16 colours, no red/orange), `WL_P` thresholds copied from `pipeline.py` (swell 20, closing 700 / thick 650 / area 0.35e6, opening pad 250 / clip 900 / thick 330, blob side 400 & area 0.05e6, symbol side 300, MRR ratio 0.8, thin curved strip min ≤ 400 & max ≥ 1500, stroke min width 0.4 pt, chain grid 2 mm, arc r 450–1400 / sweep 55–110°, chain min 150, band 45, room closing 45, room min side 350, room min area 0.5e6, simplify 15, plan pad 2500).
- **Geometry layer** (shapely → Clipper): `wlRing` / `wlRepair` (`SimplifyPolygon` even-odd), `wlUnion` (`ctUnion` non-zero), `wlBuffer(paths, mm, open)` (`ClipperOffset(5, 0.25)`, mitre, closed polygon or open butt), `wlClosing` (buffer +r then −r), `wlDiff`, `wlInter`, `wlDisc` (64-gon), `wlBox`, `wlComponents` (PolyTree → `{outer, holes[]}`, recursing into islands), `wlAreaMm2`, `wlLenMm`, `wlSides` (minimum rotated rectangle by rotating calipers on the convex hull), `wlContains` (`PointInPolygon` on outer and not in a hole), `wlDP` (Douglas–Peucker on the closed ring, keep the original if simplification self-intersects), `wlLabelPoint` (area centroid), `wlFitCircle` (Kåsa least squares).
- **Vector walker** `pageVectors(pn)` → cached `V.vec[pn] = {width, height, shapes}` with `shapes = [{t:'fill'|'stroke', c:[r,g,b]|null, w, curved, pts}]` in base pt, top-left origin. Walks `page.getOperatorList()` with a CTM stack: `save`/`restore`, `transform`, form XObjects (matrix applied, bbox clip ignored), fill/stroke RGB colours (patterns → null), `setLineWidth`, `setGState` LW, `constructPath` sub-ops exactly as vectors.js, fill/stroke/fillStroke variants emit shapes, stroke width = `lw × hypot(ctm[0], ctm[1])`. Keeps at most 3 pages cached.
- **Text helpers** on `pageLines(pn)`: `wlLabelName` (`ROOM_RE`, then `LABEL_DIM_RE` group 1), `wlOpeningWidth` (garage codes `HHWW PANELIFT|SECTIONAL|ROLLER|SSSF|TILT` → w + 60; `parseCode('D')`: CSD → 2w, `2/` pair → 2w + 50, RD/SD → w + 10, hinged → w + 50; `parseCode('W')` → w + 10; token fallback when a code is merged with a neighbouring dimension), `wlLabels`, `wlOpenings`.
- **Pipeline** `findRoomsFromWalls(pn, {strokes:'auto'|true|false, plugs, erases, progress})` → `{rooms:[{pts, names, areaM2, perimM, bboxMm, centroid, holes}], labels, unassigned, usedStrokes, stats}` following the eight steps above. Auto mode runs fills only, re-runs with strokes when rooms < 3 or unassigned > 40 %, keeps the run with more assigned labels.
- **App integration**: `runFindWalls(o)` (template `runFindRooms`, panels.js:260: guard pdf and `ClipperLib`, auto-detect scale via `findScaleText` or modal "Set the scale first", `undo.push` unless auto re-run, progress via `aiProgress`/`aiDone`, "no wall fills" modal for scanned sheets, toast with counts, unassigned-labels modal with the plug/open/trace hint), `applyWallsRooms(pn, res)` (replace this sheet's walls rooms; carry over id/hue/skirting/deductions/notes and manual renames by mutual centroid containment; relink doors and windows through `roomsNear`), `wallColour`, `wlBboxMm`, `wallBoxes` / `addWallBox` / `removeWallBox` (stored as `S.pages[pn].plugs` / `.erases`, `{id, x0, y0, x1, y1}` in base pt, `saveSoon`, auto re-run), `renderCheckCanvas(pn)` (sheet at 2× plus `paintOverlay` with `fsc`, capped at 16 MP), `saveCheckImage(pn)` → `saveBlob` (`CAP.downloads.save({filename, data: blob})`, `declined` ignored; `<a download>` outside the artifact; image modal as last resort).

### `floor-plan-takeoff/js/panels.js`
- Rooms tab (`renderRooms`, 200): "Find rooms from walls" and "Check image" buttons next to "Find from plan text"; `wallFixBox()` after `aiQueueBox()` listing this sheet's plugs/erases with delete buttons, the two tool buttons, "Clear fixes", and a one-line status from the last run (rooms found, unnamed, face lines used, unassigned labels); `bindWallFixes(el)`.
- Empty-state hint mentions the new button; `roomCard` (222) shows a `(walls)` marker like `(Claude)`; keys line in `renderSpec` (172) adds P / O.

### `floor-plan-takeoff/js/reading.js`
- `ROOM_WORDS` additions (line 2).
- `findRoomsFromText` (88): skip a label that lies inside any traced/found outline, whatever its name.
- `applyAi` (316): match a Claude room to an existing room by containment when the name does not match; rename `ROOM n` placeholders (and reset their skirting default); the "size estimated" note only for `method === 'dims'`.
- `findRoom` (323): fallback that matches one part of a merged `LIVING/DINING` name.

### `floor-plan-takeoff/README.md`
- "Rooms from walls" section under the workflow (needs a vector PDF with walls as solid black fills or face lines; opening codes sealed; open plan comes out as one room; outdoor areas are not enclosed), the two fix tools and keys, the check image, the duplicate rule for text/Claude reads, the clipper-lib dependency and `js/walls.js` in the file list. Also correct the stale line saying robes and garages default to no skirting (they get skirting; only wet areas and outdoor rooms don't).

### `build.py`
- No change; the CDN tag passes through and `js/walls.js` (and `js/clipper.js` if vendored) are inlined by the existing regex. Rebuild `scratchpad/artifact.html` with `--artifact` and republish the artifact.

## Test harness: `scratchpad/test/walls-test.js`
- Setup: `npm i clipper-lib@6.4.2` in `test/`; sync repo `js/*.js` and `index.html` into `test/app/` keeping the local pdf.js path (`PDFJS_WORKER` in core.js) and pointing the clipper tag at `../node_modules/clipper-lib/clipper.js`; the static server on 127.0.0.1:8765 is already running.
- Jobs: Kalinda `/plans.pdf` pages 4, 5 (plug `[448.5, 591.3, 508.6, 595.9]` on 5) vs `kalinda/rooms4,5.json`; Point Cartwright `/poi-plans.pdf` pages 3, 4 with the plugs and erase from `poi/job.json` vs `poi/rooms3,4.json`; Daisy `/daisy-plan.pdf` page 4 with the plug and erases from `daisy/job.json` vs `daisy/rooms4.json`.
- Per page in Chromium (pattern of `show.js`): `openPdf(bytes, name, {silent:true, noStore:true})`, preset 1:100 scale plus the boxes on `S.pages[pn]`, `goPage(pn)`, time `runFindWalls()`, read back the walls rooms and `V.wallsLast[pn]`.
- Checks: walker parity with the job's `vec{p}.json` (shape count and black-fill count, e.g. Kalinda p4 8348 / 103, POI p3 26890 / 133, Daisy p4 10862 / 144); room count equals the reference; each reference room matched by mutual centroid containment with exterior area and perimeter (shoelace on `pts_pt`) within 1.5 %; unmatched and extra rooms listed; `usedStrokes` true only for POI; run time printed (target < 3 s); no page errors; screenshots and check images written to each job's `img/` folder for eyeballing.
- If Kalinda differs only by the newer thin-curved-strip rule, regenerate its references with `pipeline.py` and a `kalinda/job.json` rather than loosening the test.

## Verification
1. Open the app locally: no console errors, `ClipperLib.version === '6.4.2.2'`.
2. `node walls-test.js` passes for all three jobs; Daisy total ≈ 252.8 m²; check images look like the approved offline ones (colours, pills with `L × W · P m`, red/orange boxes).
3. Manual on Daisy p4: draw a Wall plug over the window gap at (624,559)–(671,564) without the pre-seeded box and see the open-plan room appear; draw an Open wall over a robe front and see the recess join the bedroom; select a box, Delete, confirm the re-run; Ctrl+Z restores boxes and rooms.
4. Rename a room and toggle skirting, re-run, confirm the edits and door links survive.
5. "Find from plan text" after a walls run adds only labels outside found outlines; a Claude read on the published copy does not duplicate walls rooms and names a `ROOM n` placeholder.
6. `python3 build.py` bundle loads in the harness; `--artifact` build republished; the published copy saves the check image through the downloads prompt.
7. Sheet without a scale → "Set the scale first"; scanned sheet → "no wall fills" message with no undo entry left behind; Stop aborts mid-run without a half-applied state.
8. Commit and push to `claude/floor-plan-calculator-xwgopy`; no client job data in the repo.

## Known limits (stated in the README and the unnamed-room note)
- Curved walls come out as chords, so perimeters along curves read slightly short.
- Open-plan areas are one room; islands (kitchen benches drawn as fills) are ignored.
- Outdoor rooms are not enclosed and are reported as unassigned labels, which is expected.
- A wrong scale breaks every mm threshold; the run is blocked until a scale is set.
- Content hidden on invisible layers is still read (possible follow-up: optional-content visibility).
- Near-black CMYK fills are not treated as walls unless `darkMax` is raised.

## Out of scope for this change
- The dimension-chain parsing plan for the Claude read (superseded for sizes by this feature).
- The full Daisy takeoff (needs the job's spec).

## Status at 23 September 2026 (implementation paused after the first file)

### Done
- Plan approved by the estimator.
- **clipper-lib 6.4.2 vendored as `js/clipper.js`** (204 KB, Boost licence). Chosen over the CDN tag: jsdelivr is blocked from the sandbox so the URL could not be verified, and the vendored copy also works offline and is inlined by `build.py` like every other `js/` file. Load it with `<script src="js/clipper.js">` before `core.js`.
- Clipper behaviour checked in node: `Clipper.Orientation` is true for a ring drawn clockwise on screen (y down); `SimplifyPolygon` normalises orientation; `new ClipperOffset(5, 0.25)` with `jtMiter` and `etClosedPolygon` / `etOpenButt` offsets as expected; `JS.PolyTreeToExPolygons` returns `{outer, holes}` at every depth with holes negatively oriented; `PointInPolygon` returns 1 inside a hole ring too, so containment must test the outer and every hole.
- **`js/walls.js` written in full**: geometry layer, vector walker (mirrors `tests/vectors.js`, plus `setGState` line widths), label and opening-code helpers, the pipeline with the automatic stroke fallback, `runFindWalls`, `applyWallsRooms`, the plug/erase box API, the check image and `saveBlob`. It is **not loaded by `index.html` yet and has never run**, so treat it as untested.
- Reference provenance: Kalinda `rooms4/5.json` came from the older `rooms.py` (no thin-curved-strip rule, no `ext_m`); Point Cartwright and Daisy from `pipeline.py`. Vector counts for the walker parity check: Kalinda p4 8348 shapes / 103 black fills, p5 10976 / 121; POI p3 26890 / 133, p4 14672 / 145; Daisy p4 10862 / 144, p5 7819 / 113.

### Deltas from the design above, as written in `walls.js`
- Per-opening plugs are differenced against the local wall subset (`walls ∩ disc(r + 2500)`) rather than every wall; the result is identical because the clip disc (`r + 900`) lies inside that subset, and a bounding-box prefilter on the wall paths keeps each opening cheap.
- A bare number only counts as a door code when it is 400–1250 mm; other bare numbers are dimension strings.
- A room label merged with a tag or number on the same baseline is recovered by trying 1–3 word windows; an opening code on a short line by 1–2 token windows. Positions come from the character offsets within the line.
- `applyWallsRooms`: a room from the text or a Claude read (label only, no outline) that sits inside a found room is absorbed, keeping its id so door links survive; a hand-traced room covering the same space makes the finder skip that room; doors on the sheet get empty from/to rooms filled from the new outlines (garage doors keep two rooms, other external types one).
- The scanned-sheet message triggers when there are no black fills and no thick black strokes.

### Remaining steps, in order
1. `index.html`: `js/clipper.js` tag before `core.js`; `js/walls.js` between `reading.js` and `panels.js`; the Wall plug (P) and Open wall (O) tool buttons; CSS for `.tool-plug` / `.tool-erase` (crosshair), `.fixes`, `.fixhead`, `.fixlist` (+ `li.sel`), `.sw`.
2. `viewer.js`: reset `V.vec`, `V.vecOrder`, `V.wallsLast` in `openPdf`; `drawLabel(..., fsc)`; split `drawOverlay` into `paintOverlay(ctx, z, pn, {sel, draft, hover, fsc})` with `wallColour` fills, `wlLabelPoint` label position and the `L × W · P m` sub-line for walls rooms, `wlDrawBoxes` after doors and windows, a `kind: 'box'` draft; HINTS for plug and erase; pointer handlers for the two box tools calling `addWallBox`; `hitTest` boxes before rooms; `onSelect` box → rooms tab; `deleteItem` tries `removeWallBox` first; `refreshSelection` toggles `.fixlist li.sel`; keys `p` and `o`.
3. `panels.js`: `#roomFindWalls` and `#roomCheckImg` buttons; `wallFixBox()` and `bindWallFixes(el)` after `aiQueueBox()`; `(walls)` marker and a colour swatch on room cards; P / O in the keys line.
4. `reading.js`: ROOM_WORDS additions; `findRoomsFromText` skips labels inside any outline; `applyAi` matches by containment and names `ROOM n` placeholders; `findRoom` merged-name fallback.
5. README section.
6. Harness: `tests/walls-test.js` per the plan, with the vector counts above hardcoded and the references read from `tests/jobs/<job>/rooms<page>.json`; a sync script for the app copy (local pdf.js paths, `PDFJS_WORKER` kept local); run all three jobs; if Kalinda differs only by the curved-strip rule, regenerate its references with `tools/pipeline.py`.
7. `python3 build.py --artifact`, republish the artifact, commit and push.

### Where things live in the repo now
- `tools/`: the offline Python pipeline and helpers (`pipeline.py`, `rooms.py`, `dbg_crop.py`, `overlay.py`, `doors.py`, `doors_job.py`, `build_project.py`, `build_project_poi.py`, `make_sample.py`).
- `tests/`: the Playwright harness scripts, `package.json`, the synthetic `unit-leaves.json`, and `tests/jobs/<job>/` with each job's `job.json`, `rooms<page>.json` references and `tagmap.json`. Client PDFs, the extracted `vec*.json` / `items.json` / text dumps, screenshots and takeoff exports are not committed (see `tests/.gitignore`).
- `docs/plans/find-rooms-from-walls.md`: this plan.
